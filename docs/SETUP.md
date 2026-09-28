# Measure X — Development & Production Setup Guide (SIH26036)

This guide walks through cloning, configuring, database initialization, automated migrations, cryptographic keypair generation, running, and testing the **Measure X** platform.

---

## 1. Prerequisites

- **Python**: Version 3.10 or higher
- **Node.js**: Version 18.0 or higher (for the frontend static server)
- **MySQL / MariaDB Server**: Version 8.0 / 10.11 or higher
- **Git**: Installed and configured

---

## 2. Environment Configuration

Copy the example environment configuration to `.env`:

```bash
cp .env.example .env
```

Configure your local MySQL / MariaDB credentials in `.env`:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=measurex
DB_USER=root
DB_PASSWORD=
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Cryptographic Keys (RSA-2048 PKCS#1 v1.5 + SHA-256)
SIGNING_KEY_PATH=keys/private.pem
PUBLIC_KEY_PATH=keys/public.pem
KEY_ID=MEASUREX-RSA2048-2026-v1

# Base URL for ISO/IEC 18004 QR Codes
PUBLIC_VERIFY_BASE_URL=http://localhost:3000/#verify?id=
```

> **Security Note**: Never commit the `.env` or `keys/private.pem` file. Both are listed in `.gitignore`.

---

## 3. Database Initialization & Automated Migrations

Create the MySQL / MariaDB database:

```sql
CREATE DATABASE IF NOT EXISTS measurex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Initialize all 16 relational tables and seed standard metrology roles and administrative accounts:

```bash
python scripts/setup_database.py
```

The database connection automatically runs non-destructive schema migrations at startup, ensuring all columns (`assignment_type`, `digital_signature`, `qr_verification_url`, `test_points`) exist.

To seed comprehensive demo data (instruments, applications, GATC test centres, certificates, and audit logs):

```bash
python scripts/seed_data.py
```

---

## 4. Backend Setup (FastAPI & Cryptographic Signer)

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Linux/macOS
   # .venv\Scripts\activate   # On Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Ensure RSA keypair exists (the backend will automatically generate a 2048-bit keypair in `keys/` if missing):
   ```bash
   python -c "from backend.crypto_signer import get_signer; print('Key ID:', get_signer().key_id)"
   ```

4. Start the FastAPI development server:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. Verify health check:
   ```bash
   curl http://127.0.0.1:8000/api/v1/health
   # Expected: {"status":"healthy","database":"mysql","database_connected":true,"signing_engine":"RSA-2048-PKCS1-V1_5"}
   ```

---

## 5. Frontend Setup (PWA + Camera Scanner)

1. Start the local frontend web server:
   ```bash
   # Using Python built-in static server:
   python3 -m http.server 3000
   # OR using npx serve:
   npx serve . -p 3000
   ```

2. Access the portal in your browser:
   ```
   http://localhost:3000/
   ```

---

## 6. Easy Demo Credentials (One-Click / Short Username)

| Role | Email / Username | Password | Primary Console |
|---|---|---|---|
| **State Administrator** | `admin@demo.com` *(or `admin`)* | `admin123` | `#admin-dashboard` |
| **Legal Metrology Officer (LMO)** | `officer@demo.com` *(or `officer` / `lmo`)* | `officer123` *(or `lmo123`)* | `#lmo-dashboard` |
| **Govt Approved Test Centre (GATC)** | `gatc@demo.com` *(or `gatc`)* | `gatc123` | `#gatc-dashboard` |
| **Trader / Owner** | `trader@demo.com` *(or `trader` / `owner`)* | `trader123` *(or `owner123`)* | `#owner-dashboard` |
| **Public Citizen** | *(No Login Required)* | *(No Login Required)* | `#verify` |

*Tip: The login page (`#login`) features **One-Click Demo Login** buttons that fill and submit automatically.*

---

## 7. Running the Automated Test Suite

Run full statutory compliance integration tests:

```bash
pytest tests/ -v
```
