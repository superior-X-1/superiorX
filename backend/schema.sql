-- =============================================================================
-- Measure X — Digital Legal Metrology Platform
-- Supabase PostgreSQL Relational Schema DDL
-- Compliant with OIML D31 & Legal Metrology Act, 2009 statutory requirements
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_privileged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Verification Centres (Physical Laboratories / Calibration Test Facilities)
CREATE TABLE IF NOT EXISTS verification_centres (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    centre_code VARCHAR(50) NOT NULL UNIQUE,
    centre_name VARCHAR(200) NOT NULL,
    centre_type VARCHAR(100) NOT NULL DEFAULT 'GOVERNMENT_TEST_CENTRE',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    contact_phone VARCHAR(30),
    contact_email VARCHAR(150),
    license_number VARCHAR(100),
    accreditation_number VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vc_district ON verification_centres (district);
CREATE INDEX IF NOT EXISTS idx_vc_code ON verification_centres (centre_code);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    mobile VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) NOT NULL REFERENCES roles (id),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    business_name VARCHAR(200),
    business_type VARCHAR(100),
    address TEXT,
    district VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    department VARCHAR(200),
    designation VARCHAR(100),
    employee_id VARCHAR(100),
    jurisdiction VARCHAR(200),
    office_address TEXT,
    approval_notes TEXT,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    accreditation_number VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users (mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_vc ON users (verification_centre_id);

-- 4. User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_page_size INTEGER NOT NULL DEFAULT 10,
    preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_pref_user ON user_preferences (user_id);

-- 5. Owner Profiles
CREATE TABLE IF NOT EXISTS owner_profiles (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    business_registration_number VARCHAR(100),
    gst_number VARCHAR(50),
    pan_number VARCHAR(50),
    trade_license_number VARCHAR(100),
    contact_person VARCHAR(150),
    authorized_signatory VARCHAR(150),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_prof_user ON owner_profiles (user_id);

-- 6. LMO Profiles
CREATE TABLE IF NOT EXISTS lmo_profiles (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    badge_number VARCHAR(100),
    warrant_number VARCHAR(100),
    posting_date VARCHAR(50),
    active_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lmo_prof_user ON lmo_profiles (user_id);

-- 7. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens (token_hash);

-- 8. OTP Records
CREATE TABLE IF NOT EXISTS otp_records (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    recipient VARCHAR(150) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    resend_available_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otp_recipient ON otp_records (recipient);

-- 9. Instrument Types Master Data
CREATE TABLE IF NOT EXISTS instrument_types (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    default_verification_interval_months INTEGER NOT NULL DEFAULT 12,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inst_type_code ON instrument_types (code);

-- 10. Instruments Table
CREATE TABLE IF NOT EXISTS instruments (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL REFERENCES users (id),
    type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150) NOT NULL,
    model VARCHAR(150) NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    capacity VARCHAR(100) NOT NULL,
    accuracy_class VARCHAR(50) NOT NULL DEFAULT 'Class III',
    verification_scale_interval_e VARCHAR(50),
    minimum_capacity VARCHAR(50),
    location TEXT NOT NULL,
    purchase_date VARCHAR(50),
    installation_details TEXT,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    last_verification_date TIMESTAMP WITHOUT TIME ZONE,
    next_verification_due TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inst_owner ON instruments (owner_id);
CREATE INDEX IF NOT EXISTS idx_inst_serial ON instruments (serial_number);
CREATE INDEX IF NOT EXISTS idx_inst_status ON instruments (status);
CREATE INDEX IF NOT EXISTS idx_inst_district ON instruments (district);

-- 11. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    application_number VARCHAR(50) NOT NULL UNIQUE,
    instrument_id VARCHAR(50) NOT NULL REFERENCES instruments (id),
    owner_id VARCHAR(50) NOT NULL REFERENCES users (id),
    application_type VARCHAR(50) NOT NULL DEFAULT 'RE_VERIFICATION',
    preferred_location VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    assignment_type VARCHAR(50) DEFAULT 'LMO',
    assigned_officer_id VARCHAR(50) REFERENCES users (id),
    assigned_party_name VARCHAR(150),
    assigned_gatc_id VARCHAR(50),
    assigned_gatc_name VARCHAR(150),
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    applicant_remarks TEXT,
    correction_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_num ON applications (application_number);
CREATE INDEX IF NOT EXISTS idx_app_instrument ON applications (instrument_id);
CREATE INDEX IF NOT EXISTS idx_app_owner ON applications (owner_id);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_app_officer ON applications (assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_app_vc ON applications (verification_centre_id);

-- 12. Application Assignments
CREATE TABLE IF NOT EXISTS application_assignments (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    assigned_lmo_id VARCHAR(50) NOT NULL REFERENCES users (id),
    assigned_by VARCHAR(50) NOT NULL REFERENCES users (id),
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    assigned_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITHOUT TIME ZONE,
    reason TEXT,
    is_current BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_app_assign_app ON application_assignments (application_id);
CREATE INDEX IF NOT EXISTS idx_app_assign_lmo ON application_assignments (assigned_lmo_id);

-- 13. Application Documents
CREATE TABLE IF NOT EXISTS application_documents (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_url TEXT NOT NULL,
    storage_path TEXT,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by VARCHAR(50) REFERENCES users (id),
    uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_app ON application_documents (application_id);

-- 14. Verification Schedules
CREATE TABLE IF NOT EXISTS verification_schedules (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL UNIQUE REFERENCES applications (id) ON DELETE CASCADE,
    inspector_type VARCHAR(50) NOT NULL DEFAULT 'LMO',
    assigned_officer_id VARCHAR(50) REFERENCES users (id),
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    scheduled_date VARCHAR(50) NOT NULL,
    scheduled_time VARCHAR(50) NOT NULL,
    scheduled_location TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sched_app ON verification_schedules (application_id);
CREATE INDEX IF NOT EXISTS idx_sched_officer ON verification_schedules (assigned_officer_id);

-- 15. Verification Records Table
CREATE TABLE IF NOT EXISTS verification_records (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES applications (id),
    inspector_type VARCHAR(50) NOT NULL DEFAULT 'LMO',
    officer_id VARCHAR(50) NOT NULL REFERENCES users (id),
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    inspection_date VARCHAR(50) NOT NULL,
    physical_condition VARCHAR(20) NOT NULL,
    level_indicator VARCHAR(20) NOT NULL DEFAULT 'PASS',
    zero_check VARCHAR(20) NOT NULL,
    display_pointer VARCHAR(20) NOT NULL DEFAULT 'PASS',
    seal_check VARCHAR(20) NOT NULL,
    statutory_markings VARCHAR(20) NOT NULL DEFAULT 'PASS',
    accuracy_test VARCHAR(20) NOT NULL DEFAULT 'PASS',
    nominal_test_weight VARCHAR(50),
    observed_measurement VARCHAR(50),
    permissible_error VARCHAR(50),
    verification_scale_interval_e VARCHAR(50),
    accuracy_class VARCHAR(50),
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    wire_seal_number VARCHAR(100),
    result VARCHAR(20) NOT NULL,
    fail_reason TEXT,
    remarks TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vr_app ON verification_records (application_id);
CREATE INDEX IF NOT EXISTS idx_vr_officer ON verification_records (officer_id);
CREATE INDEX IF NOT EXISTS idx_vr_result ON verification_records (result);

-- 16. Verification Test Points Table
CREATE TABLE IF NOT EXISTS verification_test_points (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    record_id VARCHAR(50) NOT NULL REFERENCES verification_records (id) ON DELETE CASCADE,
    point_name VARCHAR(100) NOT NULL,
    nominal_load DOUBLE PRECISION NOT NULL,
    observed_load DOUBLE PRECISION NOT NULL,
    error_value DOUBLE PRECISION NOT NULL,
    tolerance_mpe DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',
    is_passed BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vtp_record ON verification_test_points (record_id);

-- 17. Verification Evidence Table
CREATE TABLE IF NOT EXISTS verification_evidence (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    record_id VARCHAR(50) REFERENCES verification_records (id) ON DELETE SET NULL,
    application_id VARCHAR(50) REFERENCES applications (id) ON DELETE CASCADE,
    evidence_category VARCHAR(100) NOT NULL,
    caption TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT,
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    geo_latitude DOUBLE PRECISION,
    geo_longitude DOUBLE PRECISION,
    uploaded_by VARCHAR(50) REFERENCES users (id),
    captured_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evd_record ON verification_evidence (record_id);
CREATE INDEX IF NOT EXISTS idx_evd_app ON verification_evidence (application_id);

-- 18. Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    certificate_number VARCHAR(100) NOT NULL UNIQUE,
    instrument_id VARCHAR(50) NOT NULL REFERENCES instruments (id),
    record_id VARCHAR(50) NOT NULL REFERENCES verification_records (id),
    verifier_type VARCHAR(50) NOT NULL DEFAULT 'LMO',
    verification_centre_id VARCHAR(50) REFERENCES verification_centres (id),
    issue_date VARCHAR(50) NOT NULL,
    valid_until VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'VALID',
    wire_seal_number VARCHAR(100),
    qr_payload TEXT NOT NULL,
    qr_verification_url VARCHAR(255),
    digital_signature TEXT,
    signature_algorithm VARCHAR(50) NOT NULL DEFAULT 'RSA-SHA256',
    key_id VARCHAR(50) NOT NULL DEFAULT 'MX-KEY-2026-V1',
    revocation_reason TEXT,
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cert_num ON certificates (certificate_number);
CREATE INDEX IF NOT EXISTS idx_cert_instrument ON certificates (instrument_id);
CREATE INDEX IF NOT EXISTS idx_cert_status ON certificates (status);

-- 19. Certificate Revocations
CREATE TABLE IF NOT EXISTS certificate_revocations (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    certificate_id VARCHAR(50) NOT NULL REFERENCES certificates (id) ON DELETE CASCADE,
    revoked_by VARCHAR(50) NOT NULL REFERENCES users (id),
    revocation_reason TEXT NOT NULL,
    revoked_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    previous_status VARCHAR(50) NOT NULL DEFAULT 'VALID',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cert_revoc_cert ON certificate_revocations (certificate_id);

-- 20. Offline Sync Operations
CREATE TABLE IF NOT EXISTS offline_sync_operations (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    operation_id VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(50) NOT NULL REFERENCES users (id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    sync_status VARCHAR(50) NOT NULL DEFAULT 'SYNCED',
    payload_json TEXT NOT NULL,
    synced_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_op ON offline_sync_operations (operation_id);

-- 21. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) NOT NULL PRIMARY KEY,
    recipient_id VARCHAR(50) REFERENCES users (id),
    target_role VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM_ALERT',
    related_entity VARCHAR(50),
    related_id VARCHAR(50),
    action_url VARCHAR(255),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    sender_info VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_role ON notifications (target_role);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications (is_read);

-- 22. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    audit_code VARCHAR(50) NOT NULL UNIQUE,
    timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50),
    user_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    previous_state VARCHAR(50),
    new_state VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'Secure Portal Web',
    details TEXT,
    client_ip VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_audit_code ON audit_logs (audit_code);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id);

-- 23. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) NOT NULL
);
