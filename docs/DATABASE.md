# Measure X — MySQL 8+ Database Schema Specification (SIH26036)

## 1. Overview
The **Measure X** platform uses MySQL 8+ / MariaDB as its authoritative persistence engine. The schema contains 16 normalized relational tables enforced via foreign keys, unique indexes, audit timestamps, and automated non-destructive migrations.

Connection driver: `SQLAlchemy 2.0` with `PyMySQL` (`mysql+pymysql://<user>:<password>@<host>:<port>/measurex?charset=utf8mb4`).

---

## 2. Table Catalog

| # | Table Name | Description | Key Relationships |
|---|---|---|---|
| 1 | `roles` | System roles (`OWNER`, `LMO`, `GATC`, `ADMIN`, `PUBLIC`) | Reference table |
| 2 | `users` | Credentials, business profiles, GATC accreditation, LMO jurisdictions | `role_id` → `roles.id` |
| 3 | `password_reset_tokens` | Secure SHA-256 tokens for self-service password recovery | `user_id` → `users.id` |
| 4 | `otp_records` | Two-factor verification OTPs with rate limits | `user_id` → `users.id` |
| 5 | `instruments` | Commercial weighing and measuring instruments | `owner_id` → `users.id` |
| 6 | `applications` | Statutory verification, allocation, and stamping filings | `instrument_id`, `owner_id`, `assigned_officer_id`, `assigned_gatc_id` |
| 7 | `application_documents` | Metadata for uploaded statutory licenses, invoices, SHA-256 digests | `application_id` → `applications.id` |
| 8 | `verification_schedules` | Scheduled field inspection and GATC lab bench slots | `application_id`, `officer_id`, `gatc_id` |
| 9 | `verification_records` | Examination results, environmental controls, scale division $e$ | `application_id`, `instrument_id`, `officer_id`/`gatc_id` |
| 10| `verification_test_points` | OIML R76 multi-point test loads (nominal, observed, error, MPE) | `record_id` → `verification_records.id` |
| 11| `verification_evidence` | Photographic evidence, SHA-256 hashes, GPS coordinates | `record_id` → `verification_records.id` |
| 12| `certificates` | Digital verification certificates with RSA-2048 digital signatures | `instrument_id`, `application_id` |
| 13| `certificate_signers` | Multi-party signature audit trail (LMO / GATC / Directorate) | `certificate_id` → `certificates.id` |
| 14| `public_keys` | Active and historical RSA-2048 asymmetric public verification keys | Cryptographic key registry |
| 15| `notifications` | System alerts, inspection reminders, and certificate notifications | `recipient_id` → `users.id` |
| 16| `audit_logs` | Immutable audit trail of administrative, cryptographic, and field actions | `user_id` → `users.id` |
| 17| `system_settings` | Dynamic operational parameters (fees, validity periods, tolerances) | Key-value configuration |

---

## 3. Key Schema Upgrades for SIH26036

### 1. `roles` & `users` (Feature 1: GATC Role)
```sql
-- GATC added as first-class role
INSERT INTO roles (id, name, description) VALUES
('GATC', 'Government Approved Test Centre', 'Accredited statutory laboratory under Rule 27');

-- User table extended with GATC profile & approval fields
ALTER TABLE users ADD COLUMN accreditation_number VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN laboratory_name VARCHAR(200) NULL;
ALTER TABLE users ADD COLUMN approval_status VARCHAR(50) DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN approved_by VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN approved_at DATETIME NULL;
```

### 2. `applications` (Feature 2: Dual Allocation Desk)
```sql
ALTER TABLE applications ADD COLUMN assignment_type VARCHAR(20) DEFAULT 'UNASSIGNED'; -- 'LMO' | 'GATC' | 'UNASSIGNED'
ALTER TABLE applications ADD COLUMN assigned_officer_id VARCHAR(50) NULL;
ALTER TABLE applications ADD COLUMN assigned_gatc_id VARCHAR(50) NULL;
ALTER TABLE applications ADD COLUMN assigned_party_name VARCHAR(200) NULL;
ALTER TABLE applications ADD COLUMN allocation_date VARCHAR(50) NULL;
ALTER TABLE applications ADD COLUMN allocated_by VARCHAR(50) NULL;
ALTER TABLE applications ADD COLUMN correction_reason TEXT NULL;

CREATE INDEX idx_apps_assignment ON applications (assignment_type, status);
CREATE INDEX idx_apps_gatc ON applications (assigned_gatc_id);
```

### 3. `verification_test_points` (Feature 8: Authoritative OIML R76 Multi-Point Test Points)
```sql
CREATE TABLE verification_test_points (
    id VARCHAR(50) PRIMARY KEY,
    record_id VARCHAR(50) NOT NULL,
    load_stage VARCHAR(50) NOT NULL,            -- 'MIN' | 'HALF' | 'MAX' | 'CUSTOM'
    nominal_load DECIMAL(12, 4) NOT NULL,
    observed_value DECIMAL(12, 4) NOT NULL,
    error_value DECIMAL(12, 4) NOT NULL,        -- observed - nominal
    mpe_limit DECIMAL(12, 4) NOT NULL,          -- Permissible error based on OIML R76
    unit VARCHAR(20) DEFAULT 'kg' NOT NULL,
    result VARCHAR(20) NOT NULL,                -- 'PASS' | 'FAIL'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_test_points_record FOREIGN KEY (record_id) REFERENCES verification_records (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_test_points_record ON verification_test_points (record_id);
```

### 4. `certificates` & `public_keys` (Feature 5: True Asymmetric Cryptographic Signatures)
```sql
ALTER TABLE certificates ADD COLUMN verifier_type VARCHAR(20) DEFAULT 'LMO'; -- 'LMO' | 'GATC'
ALTER TABLE certificates ADD COLUMN signature_algorithm VARCHAR(50) DEFAULT 'RSA-2048-PKCS1-V1_5-SHA256';
ALTER TABLE certificates ADD COLUMN digital_signature TEXT NOT NULL;         -- Base64-encoded RSA-2048 signature
ALTER TABLE certificates ADD COLUMN key_id VARCHAR(100) NOT NULL;            -- Key identifier (e.g. 'MEASUREX-RSA2048-2026-v1')
ALTER TABLE certificates ADD COLUMN qr_verification_url VARCHAR(500) NOT NULL;
ALTER TABLE certificates ADD COLUMN canonical_payload TEXT NOT NULL;         -- Deterministic UTF-8 serialized payload

CREATE TABLE public_keys (
    key_id VARCHAR(100) PRIMARY KEY,
    algorithm VARCHAR(50) NOT NULL,
    public_key_pem TEXT NOT NULL,
    is_active TINYINT(1) DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. `verification_evidence` (Feature 10: Mobile Field Evidence & GPS Tagging)
```sql
CREATE TABLE verification_evidence (
    id VARCHAR(50) PRIMARY KEY,
    record_id VARCHAR(50) NOT NULL,
    evidence_type VARCHAR(50) NOT NULL,         -- 'testBench' | 'seal' | 'testWeights' | 'worksheet' | 'overall'
    file_path VARCHAR(500) NOT NULL,
    file_hash VARCHAR(100) NOT NULL,            -- SHA-256 digest of binary image
    latitude DECIMAL(10, 7) NULL,               -- Satellite GPS Latitude
    longitude DECIMAL(10, 7) NULL,              -- Satellite GPS Longitude
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_evidence_record FOREIGN KEY (record_id) REFERENCES verification_records (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
