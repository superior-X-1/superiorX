#!/usr/bin/env bash
# ==============================================================================
# Measure X — One-shot local stack launcher (MySQL + FastAPI + Cloudflare)
#
# Brings up, in order:
#   1. MariaDB 10.11 (user-owned datadir, no root required) on 127.0.0.1:3306
#   2. FastAPI backend on 0.0.0.0:8000 (also serves the SPA + /api/v1)
#   3. Cloudflare quick tunnel -> free public https://*.trycloudflare.com URL
#
# Safe to re-run: every step is skipped if it is already up.
# Usage:  bash scripts/start_public_stack.sh [--seed]
# ==============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_DATA="$ROOT/storage/mysql-data"
DB_RUN="$ROOT/storage/mysql-run"
DB_SOCK="$DB_RUN/mysqld.sock"
LOG_DIR="$ROOT/storage/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
TUNNEL_OUT="$LOG_DIR/tunnel.out"
BACKEND_PORT=8000

mkdir -p "$DB_DATA" "$DB_RUN" "$LOG_DIR"

PY="$ROOT/venv/bin/python"
[ -x "$PY" ] || PY="$(command -v python3)"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# -----------------------------------------------------------------------------
# 1. MariaDB
# -----------------------------------------------------------------------------
step "Starting MariaDB (datadir: storage/mysql-data)"
if mysql --socket="$DB_SOCK" -u root -e "SELECT 1" >/dev/null 2>&1; then
  echo "MariaDB already running."
else
  if [ ! -d "$DB_DATA/mysql" ]; then
    echo "Initializing new MariaDB data directory..."
    mariadb-install-db --user="$(id -un)" --datadir="$DB_DATA" \
      --auth-root-authentication-method=normal >"$LOG_DIR/mariadb-install.log" 2>&1 \
      || { echo "mariadb-install-db failed, see $LOG_DIR/mariadb-install.log"; exit 1; }
  fi
  setsid nohup mariadbd --user="$(id -un)" --datadir="$DB_DATA" \
    --socket="$DB_SOCK" --port=3306 --bind-address=127.0.0.1 \
    --pid-file="$DB_RUN/mysqld.pid" --log-error="$LOG_DIR/mariadb-error.log" \
    </dev/null >"$LOG_DIR/mariadb.out" 2>&1 &
  for _ in $(seq 1 30); do
    mysql --socket="$DB_SOCK" -u root -e "SELECT 1" >/dev/null 2>&1 && break
    sleep 1
  done
  mysql --socket="$DB_SOCK" -u root -e "SELECT 1" >/dev/null 2>&1 \
    && echo "MariaDB is up on 127.0.0.1:3306." \
    || { echo "MariaDB failed to start, see $LOG_DIR/mariadb-error.log"; exit 1; }
fi

# -----------------------------------------------------------------------------
# 2. Schema + demo data
# -----------------------------------------------------------------------------
if [ "${1:-}" = "--seed" ]; then
  step "Applying schema and demo seed data"
  "$PY" scripts/setup_database.py
  "$PY" scripts/seed_data.py
  "$PY" scripts/seed_demo.py
fi

# -----------------------------------------------------------------------------
# 3. FastAPI backend (serves SPA + API on the same origin)
# -----------------------------------------------------------------------------
step "Starting FastAPI backend on port $BACKEND_PORT"
if pgrep -f "MX_BACKEND_SUPERVISOR" >/dev/null 2>&1 \
   || curl -sf -m 3 "http://127.0.0.1:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1; then
  echo "Backend already running."
else
  setsid nohup env MX_BACKEND_LOG="$BACKEND_LOG" \
    MX_PY="$PY" MX_BACKEND_PORT="$BACKEND_PORT" \
    bash -c 'MX_BACKEND_SUPERVISOR; cd "'"$ROOT"'"; while true; do
               echo "--- uvicorn start $(date -u +%H:%M:%S) ---" >>"$MX_BACKEND_LOG"
               "$MX_PY" -m uvicorn backend.main:app --host 0.0.0.0 --port "$MX_BACKEND_PORT" \
                 >>"$MX_BACKEND_LOG" 2>&1
               sleep 5
             done' </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
  for _ in $(seq 1 40); do
    curl -sf -m 3 "http://127.0.0.1:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf -m 5 "http://127.0.0.1:$BACKEND_PORT/api/v1/health" \
  && echo "" || { echo "Backend failed to start, see $BACKEND_LOG"; exit 1; }

# -----------------------------------------------------------------------------
# 4. Cloudflare quick tunnel (free, no account required)
#    Uses --protocol http2 (TCP 7844) because this host's UDP/QUIC path to the
#    Cloudflare edge is unreliable, and a supervisor loop that re-creates the
#    tunnel if the connector ever drops.
# -----------------------------------------------------------------------------
step "Starting Cloudflare quick tunnel"
URL_FILE="$LOG_DIR/public_url.txt"

if pgrep -f "MX_TUNNEL_SUPERVISOR" >/dev/null 2>&1; then
  echo "Tunnel supervisor already running."
else
  : >"$TUNNEL_LOG"; : >"$TUNNEL_OUT"
  setsid nohup env MX_TUNNEL_LOG="$TUNNEL_LOG" \
    MX_TUNNEL_OUT="$TUNNEL_OUT" MX_BACKEND_PORT="$BACKEND_PORT" \
    bash -c 'MX_TUNNEL_SUPERVISOR; while true; do
               echo "--- tunnel connector start $(date -u +%H:%M:%S) ---" >>"$MX_TUNNEL_OUT"
               cloudflared tunnel --url "http://127.0.0.1:$MX_BACKEND_PORT" \
                 --protocol http2 --no-autoupdate --logfile "$MX_TUNNEL_LOG" \
                 >>"$MX_TUNNEL_OUT" 2>&1
               sleep 5
             done' </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

PUBLIC_URL=""
for _ in $(seq 1 60); do
  PUBLIC_URL="$(grep -hoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_OUT" 2>/dev/null | tail -1)"
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done
[ -n "$PUBLIC_URL" ] && echo "$PUBLIC_URL" >"$URL_FILE"

printf '\n\033[1;32m============================================\033[0m\n'
if [ -n "$PUBLIC_URL" ]; then
  printf '\033[1;32m  PUBLIC URL : %s\033[0m\n' "$PUBLIC_URL"
  printf '  (also saved to %s)\n' "$URL_FILE"
else
  printf '  Tunnel URL not detected yet — check %s\n' "$TUNNEL_LOG"
fi
printf '  Local URL  : http://127.0.0.1:%s/\n' "$BACKEND_PORT"
printf '  Health API : /api/v1/health\n'
printf '  Logs       : %s\n' "$LOG_DIR"
printf '\033[1;32m============================================\033[0m\n'
printf '  Demo login : lmo.demo@measurex.local / MeasureX@Demo2026\n'
printf '  Stop all   : pkill -f MX_TUNNEL_SUPERVISOR; pkill -f MX_BACKEND_SUPERVISOR; pkill -f "cloudflared tunne[l]"; pkill -f "uvicorn backend.mai[n]"; mysqladmin --socket=%s -u root shutdown\n\n' "$DB_SOCK"
