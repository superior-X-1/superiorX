# Measure X — Digital Legal Metrology Platform (SIH26036)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com)
[![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL%2015%2B-3ECF8E.svg)](https://supabase.com/)
[![RSA-2048 Digital Signatures](https://img.shields.io/badge/Signatures-RSA--2048%20%2F%20SHA--256-success.svg)](https://en.wikipedia.org/wiki/Digital_signature)
[![QR Standard: ISO/IEC 18004](https://img.shields.io/badge/QR%20Standard-ISO%2FIEC%2018004-orange.svg)](https://www.iso.org/standard/62021.html)
[![Frontend: Vercel](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://vercel.com/)
[![Backend: Render](https://img.shields.io/badge/Backend-Render-46E3B7.svg)](https://render.com/)

**Measure X (SuperiorX)** is an enterprise statutory platform developed for **Smart India Hackathon 2026 problem statement SIH26036 — Development of an Online Verification System for Weighing and Measuring Instruments**.

Built under the statutory framework of the **Legal Metrology Act, 2009** and **Legal Metrology (General) Rules, 2011**, Measure X establishes an end-to-end, tamper-evident digital architecture connecting **Commercial Instrument Owners (Traders)**, **Legal Metrology Officers (LMOs)**, the **Directorate Administration**, and the **Public Consumer**, backed by accredited **Verification & Test Centres** master facilities.

---

## 🏛️ System Architecture

```text
                           ┌────────────────────────────────────────────────────────┐
                           │                   PUBLIC CONSUMER                      │
                           │   Real Camera QR Scanner / Multi-Identifier Search     │
                           │         Browser / Smartphone / Desktop Client          │
                           └──────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND LAYER (Vercel)                                       │
│                   Vanilla HTML5 • Semantic CSS3 • Standards-Compliant ES6+ JavaScript          │
│                                                                                                 │
│  ├── Stakeholder Portals: OWNER / TRADER • LMO Inspectorate • State Admin Directorate • PUBLIC  │
│  ├── Master Data Registry: Accredited Verification & Testing Centres (/admin-centres)           │
│  ├── Statutory Allocation Desk: LMO Workload & Regional Dispatch (/admin-allocation)            │
│  ├── Authoritative OIML R76 Multi-Point Measurement Console with Live MPE Tolerance Feedback   │
│  ├── In-Browser Optical Engine: Real-time Camera QR Scanner & File Decode (Html5Qrcode)         │
│  └── Offline Synchronization Engine: IndexedDB Store (MeasureX_Offline_DB) + Service Worker     │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │ HTTPS / REST JSON API / Multipart Form-Data
                                                 │ Authorization: Bearer <HMAC-SHA256 JWT>
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FASTAPI BACKEND CORE (Render)                                   │
│                                         (Python 3.10+)                                          │
│                                                                                                 │
│  ├── Entrypoint: backend/main.py (uvicorn backend.main:app --host 0.0.0.0 --port $PORT)        │
│  ├── Security & Authorization: RBAC (OWNER, LMO, ADMIN, PUBLIC) + PBKDF2 Password Hash          │
│  ├── Statutory Allocation Engine: Conflict-Free Dispatch (/applications/{id}/allocate)         │
│  ├── OIML R76 Tolerance Computation: Multi-Point Verification Scale Division (e) Evaluation    │
│  ├── Cryptographic Signer (backend/crypto_signer.py):                                           │
│  │   • RSA-2048 Asymmetric Keypair (DIGITAL_SIGNATURE_PRIVATE_KEY_PEM / keys/public.pem)       │
│  │   • Deterministic Canonical Payload Normalization (canonical_certificate_payload)            │
│  │   • PKCS#1 v1.5 + SHA-256 Digital Signature Generation & Public Key Verification             │
│  ├── Standards-Compliant QR Service (backend/qr_service.py):                                    │
│  │   • ISO/IEC 18004 Matrix Generation (python-qrcode + Pillow)                                 │
│  │   • Dynamic PNG Stream Endpoint (/api/v1/certificates/{id}/qr.png) & Base64 Data URI         │
│  ├── Storage Abstraction (backend/storage.py):                                                  │
│  │   • Supabase Storage REST API in production / Local disk fallback in development             │
│  ├── PWA Batch Synchronization Engine (/api/v1/verification/sync)                               │
│  └── Automated Expiry Monitoring & Statutory Notice Dispatch Engine                             │
└───────────────────────┬─────────────────────────────────────────────────┬───────────────────────┘
                        │                                                 │
                        │ SQLAlchemy 2.0 ORM + psycopg v3 driver          │ HTTPS REST / S3 API
                        │ Atomic ACID Transactions & Pooling              │ Storage Bucket
                        ▼                                                 ▼
┌──────────────────────────────────────────────────────┐  ┌───────────────────────────────────────┐
│            DATABASE: SUPABASE POSTGRESQL             │  │       STORAGE: SUPABASE STORAGE       │
│   (or local MySQL 8+ / SQLite in development)        │  │   (or storage/uploads/ in dev)        │
│                                                      │  │                                       │
│  23 Normalized Relational Tables with Constraints:   │  │  Bucket: measurex-storage             │
│  • roles • users • instruments • applications        │  │  • applications/ (statutory docs)     │
│  • application_documents • verification_schedules    │  │  • evidence/ (inspection photos)      │
│  • verification_records • verification_test_points   │  │  • certificates/ (signed PDFs/PNGs)   │
│  • verification_evidence • certificates              │  │                                       │
│  • verification_centres • audit_logs • public_keys   │  │                                       │
└──────────────────────────────────────────────────────┘  └───────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Component | Technology | Production Cloud | Local Development |
|---|---|---|---|
| **Frontend Presentation** | Semantic HTML5, CSS3, ES6+ JS | **Vercel** (`frontend/`) | Python HTTP Server / Static server |
| **Backend API Engine** | FastAPI (Python 3.10+), Pydantic | **Render** (`backend/`) | Uvicorn (`127.0.0.1:8000`) |
| **Relational Database** | PostgreSQL 15+ / MySQL / SQLite | **Supabase PostgreSQL** | Supabase / MySQL / SQLite |
| **Document & Evidence Storage** | Object Storage / File API | **Supabase Storage** | Local filesystem (`storage/uploads/`) |
| **Database Driver & ORM** | SQLAlchemy 2.0 + `psycopg` v3 | PostgreSQL Connection Pool | PostgreSQL / PyMySQL / SQLite |
| **Cryptographic Signer** | Python `cryptography` | RSA-2048 asymmetric keypair | RSA-2048 (`keys/`) or env var |
| **QR Code Engine** | `python-qrcode` + Pillow | ISO/IEC 18004 PNG stream | Dynamic streaming endpoint |
| **Camera QR Decoder** | `html5-qrcode.min.js` | Browser webcam & camera | Browser webcam & file decode |
| **Offline Storage** | IndexedDB (`MeasureX_Offline_DB`) | Service Worker + IndexedDB | Service Worker + IndexedDB |

---

## 🚀 Cloud Deployment Architecture

### 1. Frontend → Vercel
- **Root Directory**: `frontend` (or repository root with `vercel.json` pointing to `outputDirectory: "frontend"`).
- **Build Command**: None (pure static SPA).
- **Routing**: Single Page Application fallback rewrite to `index.html`.
- **API Target**: Points to the Render backend URL (`https://superiorx-backend.onrender.com/api/v1`) configured dynamically or overridden via `window.__MEASUREX_API_URL__` / `localStorage.measurex_api_url`.

### 2. Backend → Render
- **Environment**: Python 3.10+.
- **Root Directory**: `backend` (or run from root specifying `backend/requirements.txt`).
- **Build Command**: `pip install -r backend/requirements.txt`.
- **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
- **Environment Variables**: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `JWT_SECRET`, `DIGITAL_SIGNATURE_PRIVATE_KEY_PEM`, `ALLOWED_ORIGINS`.

### 3. Database & Storage → Supabase
- **Database**: PostgreSQL 15+ hosted on Supabase. Schema initialized using `backend/schema.sql` or migrations in `backend/migrations/`.
- **Storage**: Storage bucket `measurex-storage` for application documents, calibration evidence photos, and inspection attachments.

---

## 💻 Local Development Quick Start

### 1. Environment Configuration
```bash
cp .env.example .env
```
For local development, you can use SQLite (zero setup) or connect to your local MySQL or cloud Supabase PostgreSQL database.

### 2. Install Backend Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Initialize Database Schema
```bash
# Option A: Automatic table creation on startup
# Option B: Run Supabase PostgreSQL DDL or migrations:
# psql $DATABASE_URL -f backend/schema.sql
```

### 4. Start FastAPI Backend
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 5. Start Frontend
```bash
# From the frontend directory or root:
cd frontend && python3 -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Run Automated Tests
```bash
pytest tests/ -v
```

---

## 👥 Demo Credentials

| Stakeholder Role | Email / Username | Password | Primary Route |
|---|---|---|---|
| **State Directorate Admin** | `admin@demo.com` *(or `admin`)* | `admin123` | `#admin-dashboard` |
| **Legal Metrology Officer (LMO)** | `officer@demo.com` *(or `officer` / `lmo`)* | `officer123` *(or `lmo123`)* | `#lmo-dashboard` |
| **Commercial Trader / Owner** | `trader@demo.com` *(or `trader` / `owner`)* | `trader123` *(or `owner123`)* | `#owner-dashboard` |
| **Public Consumer** | *(No Login Required)* | *(No Login Required)* | `#verify` |

*Tip: The login page (`#login`) features **One-Click Demo Login** buttons that fill and submit automatically.*

---

## 📜 Statutory Compliance & Legal Reference
- **The Legal Metrology Act, 2009** (Act No. 1 of 2010), Sections 15, 24, 30.
- **The Legal Metrology (General) Rules, 2011**, Rule 27, Schedule VII (Verification Intervals), Schedule VIII (Tolerances).
- **OIML R76-1:2006 (E)**: Non-automatic weighing instruments — Metrological and technical requirements.
- **Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023**, Section 65B (Admissibility of electronic records).
