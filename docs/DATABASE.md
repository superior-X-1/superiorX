# Measure X — Database Architecture & Schema Specification (SIH26036)

## 1. Overview
The **Measure X (SuperiorX)** platform uses **Supabase PostgreSQL 15+** as its primary production persistence engine, with built-in compatibility for MySQL 8+ and SQLite for local development.

The schema comprises 23 normalized relational tables enforced via foreign key constraints, unique indexes, audit timestamps, and non-destructive automated migrations.

### Production Connection Driver
- **Driver**: `psycopg` (v3) via SQLAlchemy 2.0 ORM.
- **Connection URI Format**:
  ```text
  postgresql+psycopg://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require
  ```
- **Connection Pool Configuration**:
  - `pool_size`: 10 persistent connections
  - `max_overflow`: 20 burst connections
  - `pool_recycle`: 300 seconds (prevents stale pooled sockets behind load balancers)
  - `pool_pre_ping`: True (active liveness test before checkout)

---

## 2. Table Catalog

| # | Table Name | Description | Key Relationships |
|---|---|---|---|
| 1 | `roles` | System roles (`OWNER`, `LMO`, `ADMIN`, `PUBLIC`) | Master reference table |
| 2 | `verification_centres` | Accredited testing facilities & laboratories | District & NABL registry |
| 3 | `users` | User credentials, business profiles, LMO jurisdictions | `role_id` → `roles.id`, `centre_id` → `verification_centres.id` |
| 4 | `centre_officer_affiliations`| Affiliations between LMOs and testing centres | `user_id`, `centre_id` |
| 5 | `password_reset_tokens` | Secure SHA-256 tokens for self-service password recovery | `user_id` → `users.id` |
| 6 | `otp_records` | Two-factor verification OTPs with rate limits | `user_id` → `users.id` |
| 7 | `instruments` | Commercial weighing and measuring instruments | `owner_id` → `users.id` |
| 8 | `applications` | Statutory verification, allocation, and stamping filings | `instrument_id`, `owner_id`, `assigned_officer_id`, `verification_centre_id` |
| 9 | `application_documents` | Metadata for uploaded statutory licenses, invoices, SHA-256 digests | `application_id` → `applications.id` |
| 10| `verification_schedules` | Scheduled field inspection and test centre appointments | `application_id`, `officer_id`, `centre_id` |
| 11| `verification_records` | Examination results, environmental controls, scale division $e$ | `application_id`, `instrument_id`, `officer_id`, `centre_id` |
| 12| `verification_test_points` | OIML R76 multi-point test loads (nominal, observed, error, MPE) | `record_id` → `verification_records.id` |
| 13| `verification_evidence` | Photographic evidence, SHA-256 hashes, GPS coordinates | `record_id` → `verification_records.id` |
| 14| `certificates` | Digital verification certificates with RSA-2048 digital signatures | `instrument_id`, `application_id` |
| 15| `certificate_signers` | Multi-party signature audit trail (LMO / Directorate) | `certificate_id` → `certificates.id` |
| 16| `public_keys` | Active and historical RSA-2048 asymmetric public verification keys | Cryptographic key registry |
| 17| `inspection_batches` | Batch verification filings for high-volume traders | `owner_id` → `users.id` |
| 18| `batch_instruments` | Mapping between inspection batches and instruments | `batch_id`, `instrument_id` |
| 19| `payment_transactions` | Statutory verification fee payments and receipts | `application_id`, `user_id` |
| 20| `notifications` | System alerts, inspection reminders, and certificate notifications | `recipient_id` → `users.id` |
| 21| `audit_logs` | Immutable audit trail of administrative, cryptographic, and field actions | `user_id` → `users.id` |
| 22| `offline_sync_queue` | Server-side record of synchronized PWA offline actions | Audit & reconciliation |
| 23| `system_settings` | Dynamic operational parameters (fees, validity periods, tolerances) | Key-value configuration |

---

## 3. PostgreSQL Migration Details (from MySQL)

The schema was refactored for native Supabase PostgreSQL compatibility while retaining backward compatibility with MySQL:

1. **Date & Timestamp Types**:
   - MySQL `DATETIME DEFAULT CURRENT_TIMESTAMP` $\to$ PostgreSQL `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
2. **Boolean Flags**:
   - MySQL `TINYINT(1)` $\to$ PostgreSQL `BOOLEAN DEFAULT TRUE` / `FALSE`.
3. **Primary Key Auto-Increment**:
   - MySQL `BIGINT AUTO_INCREMENT` $\to$ PostgreSQL `BIGSERIAL` / `SERIAL`.
4. **JSON Document Storage**:
   - MySQL `JSON` $\to$ PostgreSQL `JSONB` for optimized indexing and structured queries.
5. **Idempotency**:
   - DDL statements written using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to support automated zero-downtime execution.
6. **Statutory Integrity Constraints**:
   - Foreign keys configured with explicit referential actions (`ON DELETE CASCADE` for child test points and evidence; `ON DELETE RESTRICT` for statutory certificates and audit trails).

---

## 4. Supabase Database Setup & Initialization

### Option A: Via Supabase SQL Editor
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to the **SQL Editor**.
3. Copy and execute the contents of `backend/schema.sql` (or `backend/migrations/001_initial_supabase_postgres.sql`).
4. All 23 tables, standard metrology roles (`OWNER`, `LMO`, `ADMIN`, `PUBLIC`), and default verification centres will be created idempotently.

### Option B: Automatic SQLAlchemy Table Initialization
When `backend/main.py` starts, SQLAlchemy's `Base.metadata.create_all(bind=engine)` runs automatically during the application lifecycle, creating any missing tables without modifying existing data.
