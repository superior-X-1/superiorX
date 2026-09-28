# Measure X — System Architecture (SIH26036)

## 1. System Overview

**Measure X** is an enterprise-grade Digital Legal Metrology Platform for the statutory registration, verification, calibration, and digital certification of commercial weighing and measuring instruments under the Legal Metrology Act, 2009 and Legal Metrology (General) Rules, 2011.

Developed for **Smart India Hackathon 2026 problem statement SIH26036 — Development of an Online Verification System for Weighing and Measuring Instruments**, Measure X transforms legacy physical paper verification workflows into an authoritative, cryptographically authenticated, multi-stakeholder digital operating system.

---

## 2. High-Level Architecture Diagram

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
│  ├── Stakeholder Portals: OWNER • LMO Inspectorate • GATC Laboratory • State Admin Directorate  │
│  ├── Administrative Allocation Desk (Dual Dispatch: LMO Field Inspection vs GATC Lab Bench)     │
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
│  ├── Security & Authorization: RBAC (OWNER, LMO, GATC, ADMIN, PUBLIC) + PBKDF2 Password Hash   │
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

## 3. Core Architectural Principles

1. **MySQL 8+ / MariaDB as the Single Source of Truth**: Zero simulated, in-memory, or mock runtime stores. All operational state persists across server restarts and browser reloads.
2. **First-Class GATC Integration**: Government Approved Test Centres (GATCs) operate as first-class statutory actors alongside Legal Metrology Officers (LMOs), equipped with dedicated laboratory onboarding, NABL reference standards traceability, test bench queues, and statutory digital signing authority.
3. **Administrative Allocation Desk**: Applications transition from `SUBMITTED` $\to$ `UNDER_SCRUTINY` $\to$ `READY_FOR_ALLOCATION` $\to$ `ALLOCATED`. Administrative controllers can route instruments to field officers or accredited calibration laboratories based on accuracy class and capacity.
4. **Authoritative OIML R76 Multi-Point Verification**: The backend strictly computes statutory Maximum Permissible Error (MPE) decisions across minimum, half, and maximum capacity loads based on scale division $e$ and accuracy class. The client UI cannot dictate PASS decisions.
5. **Asymmetric Cryptographic Non-Repudiation**: Replaced insecure SHA-256 digest hashes with true asymmetric RSA-2048 / SHA-256 PKCS#1 v1.5 digital signatures. Signatures are generated strictly on the backend using the private key, and public keys are served for client/statutory audit verification.
6. **Standards-Compliant ISO/IEC 18004 QR Codes**: Real PNG streams and high-contrast SVGs encoding secure verification URLs (`https://<domain>/verify/<cert_id>`), scannable by all native smartphone cameras.
7. **Real Optical QR Camera Scanner**: Replaced simulated animations with `html5-qrcode` integration, handling real-time webcam video feeds (rear camera preferred on mobile) and uploaded image decoding.
8. **PWA Offline Resilience**: Field officers and test engineers in remote locations can capture test points, photos, and GPS coordinates while disconnected. Data is queued in IndexedDB (`MeasureX_Offline_DB`) and synced via atomic batch endpoints on network restoration.

---

## 4. Cryptographic Signing & Public Verification Workflow

```text
               ISSUANCE WORKFLOW (Backend Authority)
┌────────────────────────────────────────────────────────────────┐
│ 1. Assemble Certificate Record (ID, Instrument, Verifier, etc.)│
│ 2. Construct Deterministic Canonical Payload                   │
│    canonical_certificate_payload(cert, instrument, test_points)│
│ 3. Sign Canonical UTF-8 Bytes with RSA-2048 Private Key        │
│    (PKCS#1 v1.5 padding + SHA-256 hashing)                     │
│ 4. Encode Signature to Base64 String                           │
│ 5. Generate ISO/IEC 18004 QR Code with Verification URL        │
│ 6. Persist Digital Signature, Key ID, and URL in MySQL         │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
               PUBLIC VERIFICATION (Public Portal)
┌────────────────────────────────────────────────────────────────┐
│ 1. User Scans Real QR Code or Inputs Certificate / Seal ID     │
│ 2. Fetch Certificate, Instrument, and Signer Record            │
│ 3. Check Statutory Revocation & Expiration Status              │
│ 4. Reconstruct Canonical Payload from Stored Attributes        │
│ 5. Verify Base64 Signature against RSA-2048 Public Key         │
│ 6. Return Cryptographic Veracity State:                        │
│    VALID • EXPIRED • REVOKED • INVALID • NOT_FOUND             │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. End-to-End Application State Machine

```text
[ SUBMITTED ] ──────────────► Trader files statutory verification application with documents.
      │
      ▼
[ UNDER_SCRUTINY ] ─────────► Administrative desk examines uploaded invoices and model approvals.
      │
      ├───► [ CORRECTION_REQUESTED ] ──► Applicant uploads amended documents.
      │
      ├───► [ REJECTED ] ─────────────► Non-compliant filing rejected with statutory reasons.
      │
      ▼
[ READY_FOR_ALLOCATION ] ───► Cleared for routing to LMO or GATC.
      │
      ▼
[ ALLOCATED ] ──────────────► Assigned to LMO (Field) or GATC (Laboratory).
      │
      ▼
[ SCHEDULED ] ──────────────► Date, time window, and premises confirmed.
      │
      ▼
[ IN_VERIFICATION ] ────────► Multi-point test weights applied; environmental & checklist evaluated.
      │
      ├───► [ FAILED ] ───────────────► Errors exceed MPE; rejection notice issued with legal grounds.
      │
      ▼
[ VERIFIED / CERTIFICATE_ISSUED ] ──► RSA-2048 signed digital certificate & ISO/IEC 18004 QR issued.
      │
      ├───► [ EXPIRED ] ──────────────► Periodic statutory validity elapsed (surveillance notice).
      │
      └───► [ REVOKED ] ──────────────► Tampered wire seal detected; certificate revoked.
```
