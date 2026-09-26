# Measure X — MySQL 8+ Database Schema Specification

## 1. Overview
The **Measure X** platform uses MySQL 8+ as its sole persistence engine. The schema contains 14 normalized relational tables enforced via foreign keys, unique indexes, and audit constraints.

Connection driver: `SQLAlchemy 2.0` with `PyMySQL` (`mysql+pymysql://<user>:<password>@<host>:<port>/measurex?charset=utf8mb4`).

---

## 2. Table Catalog

| # | Table Name | Description | Key Relationships |
|---|---|---|---|
| 1 | `roles` | System roles (`OWNER`, `LMO`, `ADMIN`, `PUBLIC`) | Reference table |
| 2 | `users` | User credentials, business profiles, and officer jurisdictions | `role_id` → `roles.id` |
| 3 | `password_reset_tokens` | Secure SHA-256 tokens for self-service password recovery | `user_id` → `users.id` |
| 4 | `otp_records` | Two-factor verification OTPs with rate limits | `user_id` → `users.id` |
| 5 | `instruments` | Commercial weighing and measuring instruments | `owner_id` → `users.id` |
| 6 | `applications` | Verification, calibration, and stamping applications | `instrument_id`, `owner_id` |
| 7 | `application_documents` | Metadata for uploaded statutory licenses and invoices | `application_id` → `applications.id` |
| 8 | `verification_schedules` | Scheduled field inspection slots for LMO officers | `application_id`, `officer_id` |
| 9 | `verification_records` | Physical examination test results & observed tolerances | `application_id`, `instrument_id`, `officer_id` |
| 10| `verification_evidence` | Photographic evidence of physical condition and wire seal | `record_id` → `verification_records.id` |
| 11| `certificates` | Digital verification certificates with QR payloads and SHA-256 signatures | `instrument_id`, `application_id` |
| 12| `notifications` | System alerts, inspection reminders, and certificate notifications | `recipient_id` → `users.id` |
| 13| `audit_logs` | Immutable audit trail of administrative and operational actions | `user_id` → `users.id` |
| 14| `system_settings` | Dynamic operational parameters (fees, validity periods) | Key-value configuration |

---

## 3. Entity Definitions & DDL

### 1. `roles`
```sql
CREATE TABLE roles (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. `users`
```sql
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    mobile VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
    business_name VARCHAR(200) NULL,
    business_type VARCHAR(100) NULL,
    address TEXT NULL,
    district VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    pincode VARCHAR(20) NULL,
    id_type VARCHAR(50) NULL,
    id_number VARCHAR(100) NULL,
    department VARCHAR(150) NULL,
    designation VARCHAR(100) NULL,
    employee_id VARCHAR(50) NULL,
    jurisdiction VARCHAR(200) NULL,
    office_address TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role_status ON users (role_id, status);
CREATE INDEX idx_users_email ON users (email);
```

### 3. `instruments`
```sql
CREATE TABLE instruments (
    id VARCHAR(50) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150) NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    capacity VARCHAR(50) NOT NULL,
    accuracy_class VARCHAR(50) DEFAULT 'Class III' NOT NULL,
    location TEXT NOT NULL,
    installation_date VARCHAR(50) NULL,
    status VARCHAR(50) DEFAULT 'PENDING_VERIFICATION' NOT NULL,
    valid_until VARCHAR(50) NULL,
    last_verification_date VARCHAR(50) NULL,
    last_officer_id VARCHAR(50) NULL,
    last_officer_name VARCHAR(150) NULL,
    active_certificate_id VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_instruments_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_instruments_owner_status ON instruments (owner_id, status);
CREATE INDEX idx_instruments_serial ON instruments (serial_number);
```

### 4. `applications`
```sql
CREATE TABLE applications (
    id VARCHAR(50) PRIMARY KEY,
    instrument_id VARCHAR(50) NOT NULL,
    owner_id VARCHAR(50) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    application_type VARCHAR(50) DEFAULT 'NEW_VERIFICATION' NOT NULL,
    status VARCHAR(50) DEFAULT 'SUBMITTED' NOT NULL,
    submission_date VARCHAR(50) NOT NULL,
    preferred_location TEXT NULL,
    assigned_officer_id VARCHAR(50) NULL,
    assigned_officer_name VARCHAR(150) NULL,
    scheduled_date VARCHAR(50) NULL,
    scheduled_time VARCHAR(50) NULL,
    scheduled_location TEXT NULL,
    rejection_reason TEXT NULL,
    correction_notes TEXT NULL,
    applicant_remarks TEXT NULL,
    fee_amount FLOAT DEFAULT 500.0 NOT NULL,
    payment_reference VARCHAR(100) NULL,
    certificate_id VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_applications_instrument FOREIGN KEY (instrument_id) REFERENCES instruments (id),
    CONSTRAINT fk_applications_owner FOREIGN KEY (owner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_applications_owner ON applications (owner_id);
CREATE INDEX idx_applications_status ON applications (status);
```

### 5. `certificates`
```sql
CREATE TABLE certificates (
    id VARCHAR(50) PRIMARY KEY,
    instrument_id VARCHAR(50) NOT NULL,
    application_id VARCHAR(50) NOT NULL,
    record_id VARCHAR(50) NULL,
    instrument_type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150) NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    capacity VARCHAR(50) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    location TEXT NOT NULL,
    verification_date VARCHAR(50) NOT NULL,
    valid_until VARCHAR(50) NOT NULL,
    officer_id VARCHAR(50) NOT NULL,
    officer_name VARCHAR(150) NOT NULL,
    officer_designation VARCHAR(100) NOT NULL,
    authority VARCHAR(200) NOT NULL,
    observed_measurement VARCHAR(50) NOT NULL,
    permissible_error VARCHAR(50) NOT NULL,
    unit VARCHAR(20) DEFAULT 'kg' NOT NULL,
    wire_seal_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'VALID' NOT NULL,
    revocation_reason TEXT NULL,
    revoked_at DATETIME NULL,
    revoked_by VARCHAR(150) NULL,
    qr_payload TEXT NOT NULL,
    digital_signature_hash VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_certs_instrument FOREIGN KEY (instrument_id) REFERENCES instruments (id),
    CONSTRAINT fk_certs_application FOREIGN KEY (application_id) REFERENCES applications (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_certificates_instrument ON certificates (instrument_id);
CREATE INDEX idx_certificates_status ON certificates (status);
CREATE INDEX idx_certificates_valid_until ON certificates (valid_until);
```

### 6. `verification_records` & `verification_schedules`
```sql
CREATE TABLE verification_schedules (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    officer_id VARCHAR(50) NOT NULL,
    officer_name VARCHAR(150) NOT NULL,
    inspection_date VARCHAR(50) NOT NULL,
    inspection_time VARCHAR(50) NOT NULL,
    inspection_location TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'SCHEDULED' NOT NULL,
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_sched_app FOREIGN KEY (application_id) REFERENCES applications (id),
    CONSTRAINT fk_sched_officer FOREIGN KEY (officer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE verification_records (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL,
    instrument_id VARCHAR(50) NOT NULL,
    officer_id VARCHAR(50) NOT NULL,
    officer_name VARCHAR(150) NOT NULL,
    inspection_date VARCHAR(50) NOT NULL,
    physical_condition_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    level_indicator_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    zero_setting_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    display_pointer_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    security_seal_integrity_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    statutory_markings_check VARCHAR(20) DEFAULT 'PASS' NOT NULL,
    nominal_test_weight VARCHAR(50) NOT NULL,
    observed_measurement VARCHAR(50) NOT NULL,
    permissible_tolerance VARCHAR(50) NOT NULL,
    measurement_unit VARCHAR(20) DEFAULT 'kg' NOT NULL,
    calculated_error_deviation FLOAT NOT NULL,
    result VARCHAR(20) NOT NULL,
    wire_seal_number VARCHAR(100) NULL,
    fail_reason TEXT NULL,
    officer_remarks TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_vr_app FOREIGN KEY (application_id) REFERENCES applications (id),
    CONSTRAINT fk_vr_instrument FOREIGN KEY (instrument_id) REFERENCES instruments (id),
    CONSTRAINT fk_vr_officer FOREIGN KEY (officer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7. `notifications` & `audit_logs`
```sql
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    recipient_id VARCHAR(50) NULL,
    target_role VARCHAR(20) NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'SYSTEM_ALERT' NOT NULL,
    related_entity VARCHAR(50) NULL,
    related_id VARCHAR(50) NULL,
    action_url VARCHAR(255) NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
    sender VARCHAR(100) DEFAULT 'System' NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    previous_state VARCHAR(100) NULL,
    new_state VARCHAR(100) NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id VARCHAR(50) NULL,
    details TEXT NULL,
    ip_address VARCHAR(50) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Transaction Management & ACID Guarantees

All state mutating actions (Registration, Status Transition, Application Filing, Verification Submission) execute within atomic SQLAlchemy session context managers:

```python
try:
    session.add(record)
    session.commit()
except Exception as e:
    session.rollback()
    logger.error(f"Transaction failed: {e}")
    raise HTTPException(status_code=500, detail="Database transaction failed")
```
