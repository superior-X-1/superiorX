# Measure X — Digital Legal Metrology Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479A1.svg)](https://www.mysql.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)

**Measure X** is a production-grade government digital service portal designed for the statutory onboarding, inspection, calibration, and digital certification of commercial weighing and measuring instruments under the Legal Metrology Act, 2009.

Built with **FastAPI**, **MySQL 8+**, and **Vanilla Modern Web Standards (HTML5/CSS3/ES6+)**, the platform replaces manual paper-based stamping workflows with a unified, tamper-evident digital architecture connecting **Commercial Instrument Owners (Traders)**, **Legal Metrology Officers (LMOs)**, **Directorate Administrators**, and the **Public Consumer**.

---

## 🏛️ System Architecture

```text
                           ┌─────────────────────────────┐
                           │      PUBLIC CONSUMER        │
                           │   Instant QR Verification   │
                           │  (No Authentication Req.)  │
                           └──────────────┬──────────────┘
                                          │
                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND PRESENTATION LAYER                     │
│               Vanilla HTML5 + Semantic CSS3 + ES6+ JavaScript          │
│                                                                        │
│  Landing • Trader Portal • LMO Inspectorate • Directorate Admin        │
│  Live Search/Filter • Form Validation • QR Verification • Certificates │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST API / Signed Bearer JWT
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI APPLICATION BACKEND                     │
│                             (Python 3.10+)                             │
│                                                                        │
│  ├── API Routers (/api/v1/auth, /instruments, /applications, ...)      │
│  ├── Security & Authorization (HMAC-SHA256 JWT, Argon2/PBKDF2 Hashing) │
│  ├── Domain Logic (Owner Isolation, Status Transition State Machine)   │
│  ├── Statutory Validation (MPE Tolerance Check, Wire Seal Audit)       │
│  └── Audit & Notification Engine                                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQLAlchemy 2.0 ORM + PyMySQL Driver
                                    │ Connection Pooling & Atomic ACID Transactions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MYSQL 8+ RELATIONAL DATABASE                    │
│                                                                        │
│  14 Normalized Tables with Foreign Keys, Unique Indexes & Constraints: │
│  roles • users • instruments • applications • application_documents   │
│  verification_schedules • verification_records • certificates          │
│  notifications • audit_logs • system_settings • otp_records ...        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Statutory Role-Based Access Control (RBAC)**
   - **Trader / Owner**: Equipment onboarding, application filing, fee payment simulation, certificate downloads, and automated 60/30/7-day expiry countdowns.
   - **Legal Metrology Officer (LMO)**: Circle jurisdiction inspection calendar, accuracy testing form with live MPE tolerance indicators, wire seal tracking, and certificate issuance.
   - **Admin / Directorate**: State-wide metrics, officer onboarding approvals, audit trails, and certificate revocation.
   - **Public Consumer**: Frictionless QR code verification of physical stamps without login.

2. **Strict Owner Data Isolation**
   - Enforced at the MySQL query level in FastAPI. Traders only access instruments, applications, schedules, and certificates linked to their authenticated `user_id`.

3. **Statutory Non-Repudiation**
   - Verification certificates generate an immutable **SHA-256 digital signature hash** cryptographically binding certificate ID, instrument serial number, LMO officer ID, wire seal number, and issuance timestamp.

4. **100% Persistent MySQL 8+ Architecture**
   - Zero SQLite, zero mock databases, zero in-memory fallback datastores. All user records, inspection logs, and certificate stamps persist across server reboots and browser refreshes.

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| **Backend Framework** | FastAPI (Python 3.10+) | High-performance async REST API with automatic OpenAPI documentation |
| **ORM & Database Driver** | SQLAlchemy 2.0 + PyMySQL | Type-safe query building, connection pooling, and ACID transactions |
| **Database Engine** | MySQL 8.0+ | Relational schema with foreign keys, indexes, and utf8mb4 encoding |
| **Authentication & Tokens** | PyJWT + HMAC-SHA256 | Real signed bearer tokens with role and user claims |
| **Password Security** | Argon2 / PBKDF2-HMAC-SHA256 | Cryptographic salted one-way password hashing (zero plaintext) |
| **Frontend Presentation** | Vanilla HTML5, CSS3, ES6+ JS | Responsive government UI with zero heavy framework overhead |
| **Frontend Web Server** | Node.js (`server.js`) | Static asset delivery and single-page routing |

---

## 📂 Project Structure

```text
Measure X/
│
├── frontend/
│   ├── assets/
│   │   ├── images/              # Government stamps and sample evidence photos
│   │   └── logo/                # Official SVG logos and emblems
│   ├── css/
│   │   ├── main.css             # Tokens, typography, reset, grid
│   │   ├── components.css       # Form controls, modals, badges, alerts
│   │   ├── dashboard.css        # Role portals, inspection cards, stat widgets
│   │   └── certificate.css      # Official A4 legal metrology certificate styles
│   └── js/
│       ├── config.js            # Environment endpoints and API configuration
│       ├── app.js               # Application controller and view routing
│       ├── services/api.js      # FastAPI client with JWT injection
│       ├── state/state.js       # Client session state manager
│       └── data/mock-data.js    # Metrology constants and statutory classes
│
├── backend/
│   ├── main.py                  # FastAPI server, endpoints, and routers
│   ├── database.py              # SQLAlchemy 2.0 models (14 tables) & DB session
│   ├── security.py              # JWT authentication & password hashing
│   ├── otp_service.py           # SMS/Email OTP generation in MySQL
│   ├── schema.sql               # Canonical MySQL DDL definitions
│   ├── requirements.txt         # Production Python dependencies
│   └── .env.example             # Backend environment template
│
├── docs/
│   ├── ARCHITECTURE.md          # Architectural blueprints and sequence flows
│   ├── API.md                   # Full REST API specification
│   ├── DATABASE.md              # 14-table MySQL schema documentation
│   └── SETUP.md                 # Development & production setup guide
│
├── scripts/
│   ├── setup_database.py        # Table migration & schema initializer
│   └── seed_data.py             # Official demo data seeder
│
├── tests/
│   └── test_master_rebuild.py   # Automated 10-step end-to-end test suite
│
├── index.html                   # Single Page Application entry point
├── server.js                    # Node.js production static server
├── Procfile                     # Deployment process configuration
├── package.json                 # Node dependencies
├── .env.example                 # Root configuration template
└── .gitignore                   # Repository exclusions
```

---

## ⚡ Quick Start

### 1. Configure MySQL Database

Ensure MySQL Server 8.0+ is running:

```sql
CREATE DATABASE IF NOT EXISTS measurex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `.env` and set your credentials:

```bash
cp .env.example .env
```

```ini
DB_HOST=localhost
DB_PORT=3306
DB_NAME=measurex
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 2. Initialize and Seed Tables

```bash
# Initialize schema (14 relational tables)
python scripts/setup_database.py

# Seed official demo accounts and instruments
python scripts/seed_data.py
```

### 3. Start the FastAPI Backend

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Start backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check verification:
```bash
curl http://127.0.0.1:8000/api/v1/health
# Expected: {"status": "healthy", "database": "mysql", "database_connected": true}
```

### 4. Start the Frontend Web Server

```bash
# Install Node dependencies
npm install

# Start static server
node server.js
```

Open your browser at `http://localhost:3000`.

---

## 🔑 Pre-configured Accounts

| Role | Email | Password | Status | Circle / Jurisdiction |
|---|---|---|---|---|
| **Directorate ADMIN** | `director.legal@metrology.gov.in` | `Admin@123` | `ACTIVE` | Directorate HQ, Patna |
| **Legal Metrology Officer (LMO)** | `officer.patna@metrology.gov.in` | `Officer@123` | `ACTIVE` | Patna Central Circle |
| **Trader / Owner** | `trader.patna@biharmandi.com` | `Owner@123` | `ACTIVE` | Patna Grain Mandi |
| **Trader / Owner (Fresh Account)**| `yaseen.test@example.com` | `Test@12345` | `ACTIVE` | Yaseen Trading Corp |

---

## 🧪 Automated Testing

Execute the automated end-to-end verification suite:

```bash
python tests/test_master_rebuild.py
```

The test validates:
1. Live MySQL database connectivity
2. User registration with Argon2/PBKDF2 password hashing
3. Login and signed HMAC-SHA256 JWT issuance
4. `/auth/me` identity consistency
5. Strict owner data isolation between multiple commercial traders
6. LMO onboarding with `PENDING_APPROVAL` status and `403 Forbidden` login enforcement
7. Administrative review and approval workflow in MySQL
8. Approved LMO authentication and dashboard access
9. Verification application filing, field testing, and accuracy tolerance evaluation
10. Official digital certificate issuance with QR code payload and SHA-256 digital signature hash
