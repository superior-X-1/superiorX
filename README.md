# Measure X — Digital Legal Metrology Platform (SIH26036)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com)
[![MySQL / MariaDB](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-8.0%2B-4479A1.svg)](https://www.mysql.com/)
[![RSA-2048 Digital Signatures](https://img.shields.io/badge/Signatures-RSA--2048%20%2F%20SHA--256-success.svg)](https://en.wikipedia.org/wiki/Digital_signature)
[![QR Standard: ISO/IEC 18004](https://img.shields.io/badge/QR%20Standard-ISO%2FIEC%2018004-orange.svg)](https://www.iso.org/standard/62021.html)

**Measure X** is a production-grade statutory platform developed for **Smart India Hackathon 2026 problem statement SIH26036 — Development of an Online Verification System for Weighing and Measuring Instruments**.

Built under the statutory framework of the **Legal Metrology Act, 2009** and **Legal Metrology (General) Rules, 2011**, Measure X establishes an end-to-end, tamper-evident digital architecture connecting **Commercial Instrument Owners (Traders)**, **Legal Metrology Officers (LMOs)**, the **Directorate Administration**, and the **Public Consumer**, backed by accredited **Verification & Test Centres** master facilities.

---

## 🏛️ System Architecture

```text
                           ┌────────────────────────────────────────────────────────┐
                           │                   PUBLIC CONSUMER                      │
                           │   Real Camera QR Scanner / Multi-Identifier Search     │
                           │     Unauthenticated Verification Endpoint (FastAPI)    │
                           └──────────────────────────┬─────────────────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRESENTATION LAYER (SPA + PWA)                                │
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
│                                      FASTAPI BACKEND CORE                                       │
│                                         (Python 3.10+)                                          │
│                                                                                                 │
│  ├── Security & Authorization: RBAC (OWNER, LMO, ADMIN, PUBLIC) + PBKDF2 Password Hash          │
│  ├── Statutory Allocation Engine: Conflict-Free Dispatch (/applications/{id}/allocate)         │
│  ├── OIML R76 Tolerance Computation: Multi-Point Verification Scale Division (e) Evaluation    │
│  ├── Cryptographic Signer (backend/crypto_signer.py):                                           │
│  │   • RSA-2048 Asymmetric Keypair Management (keys/private.pem, keys/public.pem)              │
│  │   • Deterministic Canonical Payload Normalization (canonical_certificate_payload)            │
│  │   • PKCS#1 v1.5 + SHA-256 Digital Signature Generation & Public Key Verification             │
│  ├── Standards-Compliant QR Service (backend/qr_service.py):                                    │
│  │   • ISO/IEC 18004 Matrix Generation (python-qrcode + Pillow)                                 │
│  │   • Dynamic PNG Stream Endpoint (/api/v1/certificates/{id}/qr.png) & Base64 Data URI         │
│  ├── Multipart Document & Evidence Ingestion with SHA-256 File Hashes & Geolocation Stamping    │
│  ├── PWA Batch Synchronization Engine (/api/v1/verification/sync)                               │
│  └── Automated Expiry Monitoring & Statutory Notice Dispatch Engine                             │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │ SQLAlchemy 2.0 ORM + PyMySQL Driver
                                                 │ Atomic ACID Transactions & Connection Pooling
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                MYSQL 8+ / MARIADB RELATIONAL STORE                              │
│                                                                                                 │
│  16 Normalized Relational Tables with Foreign Keys, Unique Indexes, and Migrations:             │
│  • roles • users • instruments • applications • application_documents • verification_schedules  │
│  • verification_records • verification_test_points • verification_evidence • certificates       │
│  • certificate_signers • public_keys • notifications • audit_logs • system_settings • otp_recs  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key SIH26036 Core Capabilities

1. **Accredited Verification Centres Master Data Registry**
   - Statutory test facilities and regional calibration laboratories managed under `verification_centres` master data.
   - Comprehensive facility profiles with NABL accreditation reference, operational status, district coverage, and contact credentials.
   - LMO inspectorate personnel affiliated with testing centres for statutory stamp custody and calibration tracing.

2. **Administrative Statutory Allocation Desk**
   - Applications transition from `SUBMITTED` $\to$ `UNDER_SCRUTINY` $\to$ `READY_FOR_ALLOCATION` $\to$ `ALLOCATED`.
   - Directorate supervisors allocate equipment to designated Legal Metrology Officers based on live inspector workload and district jurisdiction.
   - Immutable assignment audit history tracked across all allocations and reassignments.

3. **Authoritative OIML R76 Multi-Point Verification Math**
   - Replaced simplistic 100 kg logic with rigorous multi-point testing across minimum (10%), half (50%), and maximum (100%) rated capacities.
   - Computes statutory Maximum Permissible Error (MPE) dynamically based on scale intervals $e$ and accuracy classes (Class I, II, III, IV):
     - $m \le 500e \implies \text{MPE} = \pm 1.0e$
     - $501e < m \le 2000e \implies \text{MPE} = \pm 2.0e$
     - $m > 2000e \implies \text{MPE} = \pm 3.0e$
   - Backend strictly enforces the final statutory decision (UI cannot dictate PASS).

4. **True Asymmetric Cryptographic Signatures (RSA-2048)**
   - Replaced plain SHA-256 hashes with asymmetric RSA-2048 / SHA-256 PKCS#1 v1.5 digital signatures.
   - Deterministic canonical payload serialization (`canonical_certificate_payload`).
   - Private signing keys are secured on the backend; public keys are published at `/api/v1/public/keys/public.pem`.

5. **Standards-Compliant ISO/IEC 18004 QR Codes & Real Optical Camera Scanner**
   - High-contrast QR codes scannable by all native smartphone cameras (iOS & Android).
   - Real-time webcam and mobile rear camera scanner powered by `html5-qrcode` with live QR decoding and image upload support.

6. **Public Multi-Identifier Certificate Verification**
   - Instant unauthenticated verification via Certificate Number, Instrument Serial, or Security Seal Number.
   - Explicit statutory states: `VALID`, `EXPIRED`, `REVOKED`, `INVALID`, `NOT_FOUND`.

7. **PWA Offline Resilience & IndexedDB Synchronization**
   - Field officers and laboratory technicians can record inspections, photos, and GPS fixes offline.
   - Queued in IndexedDB (`MeasureX_Offline_DB`) and batch-synced via `/api/v1/verification/sync` on reconnection.

---

## 🛠️ Technology Stack

| Component | Technology | Role |
|---|---|---|
| **Backend Framework** | FastAPI (Python 3.10+) | Asynchronous RESTful API engine with Swagger documentation |
| **Relational Database** | MySQL 8.0+ / MariaDB 10.11+ | 16 normalized tables with automated migrations |
| **ORM & Driver** | SQLAlchemy 2.0 + PyMySQL | Type-safe queries, connection pooling, and ACID safety |
| **Cryptographic Signer** | Python `cryptography` | RSA-2048 asymmetric keypair, PKCS#1 v1.5 + SHA-256 |
| **QR Code Engine** | `python-qrcode` + Pillow | ISO/IEC 18004 compliant PNG stream generator |
| **Camera QR Decoder** | `html5-qrcode.min.js` | Browser webcam and image QR code optical decoding |
| **Offline Storage** | IndexedDB (`MeasureX_Offline_DB`) | Client-side queue for offline field verification |
| **Frontend Presentation** | Semantic HTML5, CSS3, ES6+ JS | Responsive single-page application with hash routing |

---

## 🚀 Quick Start Guide

### 1. Environment Configuration
```bash
cp .env.example .env
```
Ensure your MySQL/MariaDB credentials and secret keys are configured in `.env`.

### 2. Database Initialization
```bash
python scripts/setup_database.py
python scripts/seed_data.py
```

### 3. Start Backend API
```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Start Frontend
```bash
python3 -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Automated Tests
```bash
pytest tests/ -v
```

---

## 👥 Easy Demo Credentials (One-Click / Short Username)

You can log in either by typing the full email or simply the **short username** (e.g. `admin` and `admin123`):

| Stakeholder Role | Email / Username | Password | Primary Route |
|---|---|---|---|
| **State Directorate Admin** | `admin@demo.com` *(or `admin`)* | `admin123` | `#admin-dashboard` |
| **Legal Metrology Officer (LMO)** | `officer@demo.com` *(or `officer` / `lmo`)* | `officer123` *(or `lmo123`)* | `#lmo-dashboard` |
| **Commercial Trader / Owner** | `trader@demo.com` *(or `trader` / `owner`)* | `trader123` *(or `owner123`)* | `#owner-dashboard` |
| **Public Consumer** | *(No Login Required)* | *(No Login Required)* | `#verify` |

*Tip: The login page (`#login`) also features **One-Click Demo Login** buttons that fill and submit automatically.*

---

## 📜 Statutory Compliance & Legal Reference
- **The Legal Metrology Act, 2009** (Act No. 1 of 2010), Sections 15, 24, 30.
- **The Legal Metrology (General) Rules, 2011**, Rule 27, Schedule VII (Verification Intervals), Schedule VIII (Tolerances).
- **OIML R76-1:2006 (E)**: Non-automatic weighing instruments — Metrological and technical requirements.
- **Indian Evidence Act, 1872 / Bharatiya Sakshya Adhiniyam, 2023**, Section 65B (Admissibility of electronic records).
