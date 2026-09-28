# Measure X — Backend Architecture & Integration Contract

This directory defines the target backend architecture for **Measure X**, establishing the API endpoints, data models, and authentication structure for later integration with **Django**, **FastAPI**, and **Microsoft SQL Server**.

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                      │
│            HTML5 + CSS3 + Vanilla JavaScript           │
│        (Frontend Services via `frontend/js/services/api.js`)│
└───────────────────────────┬────────────────────────────┘
                            │ REST API / JSON over HTTPS
                            ▼
┌────────────────────────────────────────────────────────┐
│                     API GATEWAY                        │
│                (FastAPI / Nginx Reverse Proxy)          │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│      DJANGO BACKEND       │ │       FASTAPI ENGINE     │
│ - User & Role Management  │ │ - High-throughput QR     │
│ - Instrument Registry     │ │   Verification API       │
│ - Verification Workflow   │ │ - Document Upload / Blob │
│ - Audit Trail & Logging   │ │   Processing             │
│ - Django Auth / JWT       │ │ - Digital Signature &    │
│                           │ │   PDF Generation Service │
└─────────────┬─────────────┘ └───────────┬──────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
             ┌─────────────────────────────┐
             │    MICROSOFT SQL SERVER     │
             │ Relational Data & Compliance │
             └─────────────────────────────┘
```

## 2. Relational Database Schema (MS SQL Server)

### Tables
1. **`Users`**: `user_id` (PK, GUID), `email`, `password_hash`, `full_name`, `mobile`, `role` (OWNER, LMO, ADMIN), `business_name`, `address`, `created_at`.
2. **`Instruments`**: `instrument_id` (PK, VARCHAR), `owner_id` (FK), `instrument_type`, `manufacturer`, `model_number`, `serial_number`, `capacity`, `location`, `installation_date`, `status` (ACTIVE, EXPIRED, PENDING_VERIFICATION), `created_at`.
3. **`Applications`**: `application_id` (PK, VARCHAR), `instrument_id` (FK), `owner_id` (FK), `application_type` (NEW, RE_VERIFICATION, REPAIR), `status` (SUBMITTED, UNDER_REVIEW, SCHEDULED, IN_VERIFICATION, APPROVED, FAILED), `preferred_location`, `submitted_date`, `remarks`.
4. **`ApplicationDocuments`**: `document_id` (PK), `application_id` (FK), `document_type`, `file_name`, `file_url`, `file_size`, `uploaded_at`.
5. **`Schedules`**: `schedule_id` (PK), `application_id` (FK), `assigned_officer_id` (FK), `inspection_date`, `inspection_time`, `location`, `status`.
6. **`VerificationRecords`**: `record_id` (PK), `application_id` (FK), `officer_id` (FK), `inspection_date`, `physical_condition`, `zero_check`, `accuracy_test`, `seal_check`, `observed_measurement`, `permissible_error`, `unit`, `result` (PASS, FAIL), `fail_reason`.
7. **`VerificationEvidence`**: `evidence_id` (PK), `record_id` (FK), `evidence_type` (INSTRUMENT_PHOTO, SEAL_PHOTO, INSPECTION_PHOTO, DOCUMENT), `file_url`, `created_at`.
8. **`Certificates`**: `certificate_id` (PK, VARCHAR), `instrument_id` (FK), `record_id` (FK), `issue_date`, `valid_until`, `status` (VALID, EXPIRED, REVOKED), `revocation_reason`, `revoked_at`, `qr_payload`.
9. **`AuditLogs`**: `log_id` (PK, BIGINT IDENTITY), `timestamp`, `user_id` (FK), `role`, `action`, `entity`, `entity_id`, `previous_state`, `new_state`.
10. **`Notifications`**: `notification_id` (PK), `recipient_id` (FK), `title`, `message`, `type`, `is_read`, `created_at`.

## 3. Core REST API Endpoints

### Authentication & Users
- `POST /api/v1/auth/register` — Register a new instrument owner
- `POST /api/v1/auth/login` — Login with credentials, returns JWT (access & refresh)
- `GET /api/v1/auth/me` — Retrieve currently logged-in user profile & role

### Instruments
- `GET /api/v1/instruments` — List owner/all instruments (filterable)
- `POST /api/v1/instruments` — Register a new instrument (returns `MX-INS-XXXXXX`)
- `GET /api/v1/instruments/{id}` — Retrieve instrument details, lifecycle & verification history

### Applications
- `GET /api/v1/applications` — List applications (filterable by status, role)
- `POST /api/v1/applications` — Submit a new verification application (returns `MX-APP-XXXXX`)
- `GET /api/v1/applications/{id}` — Retrieve application details, documents, and status timeline
- `PATCH /api/v1/applications/{id}/review` — LMO review decision (Approve for scheduling, request correction, reject)
- `POST /api/v1/applications/{id}/schedule` — Schedule inspection date, time, location, and assign officer

### Field Verification
- `POST /api/v1/verification/submit` — Submit LMO field verification record (measurements, checks, photos, PASS/FAIL decision)

### Certificates & Public QR Verification
- `GET /api/v1/certificates/{id}` — Get digital certificate data
- `GET /api/v1/public/verify/{cert_id}` — **Public unauthenticated endpoint** for QR scans (returns live validity status: VALID, EXPIRED, REVOKED, INVALID)
- `POST /api/v1/certificates/{id}/revoke` — Admin certificate revocation with mandatory justification

### Reports, Audit & Notifications
- `GET /api/v1/admin/reports` — Verification statistics, pass/fail ratios, regional breakdown
- `GET /api/v1/admin/audit-logs` — System compliance audit trail
- `GET /api/v1/notifications` — User notification feed
