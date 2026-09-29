# Measure X — System Architecture (SIH26036)

## 1. System Overview

**Measure X (SuperiorX)** is an enterprise-grade Digital Legal Metrology Platform for the statutory registration, verification, calibration, and digital certification of commercial weighing and measuring instruments under the Legal Metrology Act, 2009 and Legal Metrology (General) Rules, 2011.

Developed for **Smart India Hackathon 2026 problem statement SIH26036 — Development of an Online Verification System for Weighing and Measuring Instruments**, Measure X transforms legacy physical paper verification workflows into an authoritative, cryptographically authenticated, multi-stakeholder digital operating system.

---

## 2. High-Level Architecture Diagram

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
│  ├── Stakeholder Portals: OWNER • LMO Inspectorate • Verification Centres • State Admin         │
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
│  ├── Entrypoint: backend.main:app (uvicorn backend.main:app --host 0.0.0.0 --port $PORT)       │
│  ├── Security & Authorization: RBAC (OWNER, LMO, ADMIN, PUBLIC) + PBKDF2 Password Hash          │
│  ├── Statutory Allocation Engine: Conflict-Free Dispatch (/applications/{id}/allocate)         │
│  ├── OIML R76 Tolerance Computation: Multi-Point Verification Scale Division (e) Evaluation    │
│  ├── Cryptographic Signer (backend/crypto_signer.py):                                           │
│  │   • RSA-2048 Asymmetric Keypair Management (env variable / backend/keys/)                   │
│  │   • Deterministic Canonical Payload Normalization (canonical_certificate_payload)            │
│  │   • PKCS#1 v1.5 + SHA-256 Digital Signature Generation & Public Key Verification             │
│  ├── Standards-Compliant QR Service (backend/qr_service.py):                                    │
│  │   • ISO/IEC 18004 Matrix Generation (python-qrcode + Pillow)                                 │
│  │   • Dynamic PNG Stream Endpoint (/api/v1/certificates/{id}/qr.png) & Base64 Data URI         │
│  ├── Storage Abstraction Layer (backend/storage.py):                                            │
│  │   • Supabase Storage REST API in production / Local filesystem fallback in development      │
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

## 3. Core Architectural Principles

1. **Decoupled Cloud Topology**:
   - **Frontend (Vercel)**: Fast, global CDN delivery of the SPA/PWA static assets. Pure client-side hash routing, zero server-side rendering, instant caching.
   - **Backend (Render)**: Scalable asynchronous Python FastAPI service running in a persistent container with automated health checks and restart policies.
   - **Database (Supabase PostgreSQL)**: Fully managed PostgreSQL 15+ engine with connection pooling, transactional integrity, and automated backups.
   - **Storage (Supabase Storage)**: Secure object storage for applicant statutory licenses, manufacturer specifications, and officer inspection field evidence.
2. **PostgreSQL / Relational Single Source of Truth**: Zero simulated, in-memory, or mock runtime stores. All operational state persists across server restarts and browser reloads.
3. **First-Class Verification Centres Integration**: Government Approved Test Centres and regional calibration laboratories operate as first-class statutory facilities, equipped with accreditation reference numbers, district jurisdiction, and LMO inspectorate affiliations.
4. **Administrative Allocation Desk**: Applications transition from `SUBMITTED` $\to$ `UNDER_SCRUTINY` $\to$ `READY_FOR_ALLOCATION` $\to$ `ALLOCATED`. Directorate administrators route instruments to field officers based on live inspector workload and district jurisdiction.
5. **Authoritative OIML R76 Multi-Point Verification**: The backend strictly computes statutory Maximum Permissible Error (MPE) decisions across minimum, half, and maximum capacity loads based on scale division $e$ and accuracy class. The client UI cannot dictate PASS decisions.
6. **Asymmetric Cryptographic Non-Repudiation (RSA-2048)**: Authentic RSA-2048 / SHA-256 PKCS#1 v1.5 digital signatures. In production, private signing keys are loaded strictly from the `DIGITAL_SIGNATURE_PRIVATE_KEY_PEM` environment variable, ensuring zero key storage on disk. Public keys are served for client/statutory audit verification.
7. **Standards-Compliant ISO/IEC 18004 QR Codes**: Real PNG streams and high-contrast SVGs encoding secure verification URLs (`https://<domain>/#verify?id=<cert_id>`), scannable by all native smartphone cameras.
8. **Real Optical QR Camera Scanner**: Integrated `html5-qrcode` handling real-time webcam video feeds (rear camera preferred on mobile) and uploaded image decoding.
9. **PWA Offline Resilience**: Field officers in remote areas can record test points, photos, and GPS coordinates while disconnected. Data is queued in IndexedDB (`MeasureX_Offline_DB`) and synced via atomic batch endpoints on network restoration.

---

## 4. Cryptographic Signing & Public Verification Workflow

```text
               ISSUANCE WORKFLOW (Backend Authority on Render)
┌────────────────────────────────────────────────────────────────┐
│ 1. Assemble Certificate Record (ID, Instrument, Verifier, etc.)│
│ 2. Construct Deterministic Canonical Payload                   │
│    canonical_certificate_payload(cert, instrument, test_points)│
│ 3. Sign Canonical UTF-8 Bytes with RSA-2048 Private Key        │
│    (PKCS#1 v1.5 padding + SHA-256 hashing)                     │
│ 4. Encode Signature to Base64 String                           │
│ 5. Generate ISO/IEC 18004 QR Code with Verification URL        │
│ 6. Persist Digital Signature, Key ID, and URL in PostgreSQL    │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
               PUBLIC VERIFICATION (Public Portal on Vercel)
┌────────────────────────────────────────────────────────────────┐
│ 1. User Scans Real QR Code or Inputs Certificate / Seal ID     │
│ 2. Fetch Certificate, Instrument, and Signer Record            │
│ 3. Check Statutory Revocation & Expiration Status              │
│ 4. Download Active Public Key from /api/v1/public/keys/...     │
│ 5. Verify RSA-2048 PKCS#1 v1.5 Signature Over Canonical Data   │
│ 6. Render Authoritative Verdict: VALID, EXPIRED, or REVOKED    │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Security & Isolation Model

- **Zero Secret Commits**: RSA private keys and database credentials are injected exclusively via cloud provider environment variables (`DIGITAL_SIGNATURE_PRIVATE_KEY_PEM`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Role-Based Access Control (RBAC)**: Strict permission boundaries enforced at the FastAPI dependency layer (`require_role`) for `OWNER`, `LMO`, and `ADMIN`.
- **Statutory Audit Trail**: Every authentication attempt, application submission, allocation decision, verification completion, and certificate revocation generates an immutable log entry in `audit_logs`.
- **CORS Protection**: Render backend restricts API access to configured origins (`ALLOWED_ORIGINS` / `*.vercel.app` / `localhost`).
