# Measure X — Development & Production Setup Guide

This guide walks through cloning, configuring, database initialization, seeding, running, and testing the **Measure X** platform.

---

## 1. Prerequisites

- **Python**: Version 3.10 or higher
- **Node.js**: Version 18.0 or higher (for the frontend static server)
- **MySQL Server**: Version 8.0 or higher
- **Git**: Installed and configured

---

## 2. Environment Configuration

Copy the example environment configuration to `.env`:

```bash
cp .env.example .env
```

Configure your local MySQL credentials in `.env`:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=measurex
DB_USER=root
DB_PASSWORD=your_secure_password
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> **Security Note**: Never commit the `.env` file with actual passwords. `.env` is listed in `.gitignore`.

---

## 3. Database Initialization

Create the MySQL database:

```sql
CREATE DATABASE IF NOT EXISTS measurex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Initialize all 14 relational tables and seed standard metrology roles and administrative accounts:

```bash
python scripts/setup_database.py
```

To seed comprehensive demo data (instruments, applications, schedules, certificates, and audit logs):

```bash
python scripts/seed_data.py
```

---

## 4. Backend Setup (FastAPI)

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # macOS/Linux:
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Start the FastAPI development server:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. Verify health check:
   ```bash
   curl http://127.0.0.1:8000/api/v1/health
   # Expected: {"status": "healthy", "database": "mysql", "database_connected": true}
   ```

---

## 5. Frontend Setup

1. Install frontend server dependencies:
   ```bash
   npm install
   ```

2. Start the local frontend web server:
   ```bash
   node server.js
   # Running on http://localhost:3000
   ```

3. Open your browser and navigate to `http://localhost:3000`.

---

## 6. Pre-configured Demo Accounts

| Role | Email | Password | Status | Circle / Jurisdiction |
|---|---|---|---|---|
| **ADMIN** | `director.legal@metrology.gov.in` | `Admin@123` | `ACTIVE` | Directorate HQ, Patna |
| **LMO** | `officer.patna@metrology.gov.in` | `Officer@123` | `ACTIVE` | Patna Central Circle |
| **OWNER** | `trader.patna@biharmandi.com` | `Owner@123` | `ACTIVE` | Patna Grain Mandi |
| **OWNER (Fresh)** | `yaseen.test@example.com` | `Test@12345` | `ACTIVE` | Yaseen Trading Corp |

---

## 7. Running the Automated Test Suite

Measure X includes an end-to-end integration test suite validating real MySQL connectivity, password hashing, JWT authentication, `/auth/me` identity, owner data isolation, LMO approval workflow, and certificate digital signatures:

```bash
python tests/test_master_rebuild.py
```
Expected output:
```text
========================================================
ALL 10 TESTS COMPLETED AND 100% PASSED!
========================================================
```
