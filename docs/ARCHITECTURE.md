# Measure X — System Architecture

## 1. System Overview

**Measure X** is an enterprise-grade Digital Legal Metrology Platform for the statutory registration, verification, calibration, and digital certification of commercial weighing and measuring instruments under the Legal Metrology Act, 2009.

The architecture enforces strict separation of concerns across presentation, API routing, business services, authentication, and persistent relational data storage in MySQL 8+.

---

## 2. High-Level Architecture

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

## 3. Core Architectural Principles

1. **MySQL 8+ as the Single Source of Truth**: Zero SQLite, zero local JSON databases, and zero in-memory datastores at runtime. All operational state persists across server restarts and browser reloads.
2. **Stateless Authenticated Sessions**: Authentication uses cryptographically signed JSON Web Tokens (`HS256`). The client stores the token in `sessionStorage`/`localStorage` for session maintenance, injecting `Authorization: Bearer <token>` into all API requests.
3. **Owner Data Isolation**: Enforced at the database query level on the backend. Every instrument, application, and certificate query automatically filters by `owner_id == current_user.id` when invoked by an `OWNER`.
4. **Role-Based Access Control (RBAC)**: Backend endpoints strictly enforce role authorization via FastAPI dependencies (`require_role("LMO", "ADMIN")`). The frontend role is purely a UI presentation state derived from `/api/v1/auth/me`.
5. **Statutory Non-Repudiation**: Every issued certificate is sealed with a SHA-256 digital signature hash linking the certificate ID, instrument serial number, LMO user ID, wire seal number, and issuance timestamp.

---

## 4. Authentication & User Identity Lifecycle

```text
  [ Commercial Trader ]                      [ FastAPI Backend ]                    [ MySQL Database ]
           │                                          │                                     │
    1. Fill Registration Form ───────────────────────►│                                     │
       (Name, Email, Mobile, Password)                │                                     │
           │                                          ├── Hash Password (Argon2/PBKDF2)     │
           │                                          ├── Assign Role (OWNER / LMO)         │
           │                                          ├── Set Status (ACTIVE / PENDING)     │
           │                                          ├── INSERT INTO users ───────────────►│
           │                                          │◄── Commit Transaction ──────────────┤
           │◄── 201 Created (User Data Without Hash) ─┤                                     │
           │                                          │                                     │
    2. Enter Email/Mobile + Password ────────────────►│                                     │
           │                                          ├── SELECT FROM users WHERE email ───►│
           │                                          │◄── Return User Record ──────────────┤
           │                                          ├── Verify Password Hash              │
           │                                          ├── Verify Status == 'ACTIVE'         │
           │                                          ├── Generate Signed JWT (HS256)       │
           │◄── 200 OK { token, user: { id, name } } ─┤                                     │
           │                                          │                                     │
    3. Browser Page Refresh                           │                                     │
       GET /api/v1/auth/me (Bearer Token) ───────────►│                                     │
           │                                          ├── Decode & Verify JWT Signature     │
           │                                          ├── SELECT FROM users WHERE id ──────►│
           │                                          │◄── Return Exact Authenticated User ─┤
           │◄── 200 OK (Authenticated User Profile) ──┤                                     │
```

---

## 5. Application State Machine

```text
[ SUBMITTED ] ──► Trader files application for registered instrument with location & fee details.
      │
      ▼
[ SCHEDULED ] ──► Assigned LMO inspector schedules field inspection date, time, and circle location.
      │
      ▼
[ IN_INSPECTION ] Field verification performed with physical checks, zero error, and MPE test weights.
      │
      ├─────────────────────────────────────────────────┐
      ▼ (Accuracy PASS, Seal Valid)                     ▼ (Accuracy FAIL / Broken Seal)
[ COMPLETED ]                                     [ REJECTED ]
      │                                                 │
      ├── Certificate Generated with QR & SHA-256 Hash   └── Rejection reason logged;
      ├── Instrument Status set to ACTIVE                └── Trader notified to calibrate.
      └── Valid Until set to +365 Days
```
