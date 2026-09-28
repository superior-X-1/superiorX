-- =============================================================================
-- Measure X — Digital Legal Metrology Platform (MySQL 8.0+ Enterprise DDL)
-- Generated Schema Definition for 14 Core Relational Tables
-- =============================================================================

CREATE TABLE audit_logs (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	audit_code VARCHAR(50) NOT NULL, 
	timestamp DATETIME NOT NULL, 
	user_id VARCHAR(50), 
	user_name VARCHAR(150) NOT NULL, 
	`role` VARCHAR(50) NOT NULL, 
	action VARCHAR(100) NOT NULL, 
	entity VARCHAR(100) NOT NULL, 
	entity_id VARCHAR(50) NOT NULL, 
	previous_state VARCHAR(50), 
	new_state VARCHAR(50) NOT NULL, 
	channel VARCHAR(50) NOT NULL, 
	details TEXT, 
	client_ip VARCHAR(50), 
	PRIMARY KEY (id)
);

CREATE TABLE notifications (
	id VARCHAR(50) NOT NULL, 
	recipient_id VARCHAR(50), 
	target_role VARCHAR(50) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	message TEXT NOT NULL, 
	notification_type VARCHAR(50) NOT NULL, 
	related_entity VARCHAR(50), 
	related_id VARCHAR(50), 
	action_url VARCHAR(255), 
	priority VARCHAR(20) NOT NULL, 
	is_read BOOL NOT NULL, 
	read_at DATETIME, 
	sender_info VARCHAR(150) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE otp_records (
	id VARCHAR(50) NOT NULL, 
	recipient VARCHAR(150) NOT NULL, 
	otp_hash VARCHAR(255) NOT NULL, 
	salt VARCHAR(64) NOT NULL, 
	purpose VARCHAR(50) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	attempts INTEGER NOT NULL, 
	max_attempts INTEGER NOT NULL, 
	is_used BOOL NOT NULL, 
	resend_available_at DATETIME, 
	created_at DATETIME NOT NULL, 
	used_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE roles (
	id VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	is_privileged BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE system_settings (
	setting_key VARCHAR(100) NOT NULL, 
	setting_value TEXT NOT NULL, 
	description TEXT, 
	updated_at DATETIME NOT NULL, 
	updated_by VARCHAR(100) NOT NULL, 
	PRIMARY KEY (setting_key)
);

CREATE TABLE users (
	id VARCHAR(50) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	email VARCHAR(150) NOT NULL, 
	mobile VARCHAR(30) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role_id VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
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
	approved_at DATETIME, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(role_id) REFERENCES roles (id)
);

CREATE TABLE instruments (
	id VARCHAR(50) NOT NULL, 
	owner_id VARCHAR(50) NOT NULL, 
	owner_name VARCHAR(150) NOT NULL, 
	business_name VARCHAR(200) NOT NULL, 
	type VARCHAR(100) NOT NULL, 
	accuracy_class VARCHAR(50) NOT NULL, 
	manufacturer VARCHAR(150) NOT NULL, 
	model VARCHAR(100) NOT NULL, 
	serial_number VARCHAR(100) NOT NULL, 
	capacity VARCHAR(50) NOT NULL, 
	verification_scale_interval_e VARCHAR(50), 
	minimum_capacity VARCHAR(50), 
	location TEXT NOT NULL, 
	district VARCHAR(100) NOT NULL, 
	state VARCHAR(100) NOT NULL, 
	purchase_date VARCHAR(50), 
	installation_details TEXT, 
	status VARCHAR(50) NOT NULL, 
	valid_until VARCHAR(50), 
	last_verification_date VARCHAR(50), 
	last_officer_id VARCHAR(50), 
	last_officer_name VARCHAR(150), 
	active_certificate_id VARCHAR(50), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id)
);

CREATE TABLE password_reset_tokens (
	id VARCHAR(50) NOT NULL, 
	user_id VARCHAR(50) NOT NULL, 
	token VARCHAR(255) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	is_used BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE applications (
	id VARCHAR(50) NOT NULL, 
	instrument_id VARCHAR(50) NOT NULL, 
	owner_id VARCHAR(50) NOT NULL, 
	owner_name VARCHAR(150) NOT NULL, 
	business_name VARCHAR(200) NOT NULL, 
	application_type VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	submission_date VARCHAR(50) NOT NULL, 
	preferred_location TEXT NOT NULL, 
	assignment_type VARCHAR(50), 
	assigned_officer_id VARCHAR(50), 
	assigned_officer_name VARCHAR(150), 
	assigned_gatc_id VARCHAR(50), 
	assigned_gatc_name VARCHAR(150), 
	assigned_party_name VARCHAR(150), 
	scheduled_date VARCHAR(50), 
	scheduled_time VARCHAR(50), 
	scheduled_location TEXT, 
	rejection_reason TEXT, 
	correction_notes TEXT, 
	applicant_remarks TEXT, 
	fee_amount FLOAT NOT NULL, 
	payment_reference VARCHAR(100), 
	certificate_id VARCHAR(50), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(instrument_id) REFERENCES instruments (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id)
);

CREATE TABLE application_documents (
	id VARCHAR(50) NOT NULL, 
	application_id VARCHAR(50) NOT NULL, 
	document_type VARCHAR(100) NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	original_filename VARCHAR(255), 
	file_url TEXT NOT NULL, 
	storage_path TEXT, 
	file_size_bytes INTEGER, 
	mime_type VARCHAR(100), 
	uploaded_by VARCHAR(50), 
	uploaded_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(application_id) REFERENCES applications (id) ON DELETE CASCADE
);

CREATE TABLE certificates (
	id VARCHAR(50) NOT NULL, 
	instrument_id VARCHAR(50) NOT NULL, 
	application_id VARCHAR(50) NOT NULL, 
	record_id VARCHAR(50), 
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
	verifier_type VARCHAR(50) NOT NULL DEFAULT 'LMO', 
	authority VARCHAR(200) NOT NULL, 
	observed_measurement VARCHAR(50) NOT NULL, 
	permissible_error VARCHAR(50) NOT NULL, 
	unit VARCHAR(20) NOT NULL, 
	wire_seal_number VARCHAR(100) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	revocation_reason TEXT, 
	revoked_at DATETIME, 
	revoked_by VARCHAR(150), 
	qr_payload TEXT NOT NULL, 
	qr_verification_url VARCHAR(255), 
	digital_signature TEXT, 
	digital_signature_hash VARCHAR(255), 
	signature_algorithm VARCHAR(50) NOT NULL DEFAULT 'RSA-SHA256', 
	key_id VARCHAR(50) NOT NULL DEFAULT 'MX-KEY-2026-V1', 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(instrument_id) REFERENCES instruments (id), 
	FOREIGN KEY(application_id) REFERENCES applications (id)
);

CREATE TABLE verification_records (
	id VARCHAR(50) NOT NULL, 
	application_id VARCHAR(50) NOT NULL, 
	instrument_id VARCHAR(50) NOT NULL, 
	officer_id VARCHAR(50) NOT NULL, 
	officer_name VARCHAR(150) NOT NULL, 
	inspector_type VARCHAR(50) NOT NULL DEFAULT 'LMO', 
	inspection_date VARCHAR(50) NOT NULL, 
	physical_condition_check VARCHAR(20) NOT NULL, 
	level_indicator_check VARCHAR(20) NOT NULL, 
	zero_setting_check VARCHAR(20) NOT NULL, 
	display_pointer_check VARCHAR(20) NOT NULL, 
	security_seal_integrity_check VARCHAR(20) NOT NULL, 
	statutory_markings_check VARCHAR(20) NOT NULL, 
	nominal_test_weight VARCHAR(50) NOT NULL, 
	observed_measurement VARCHAR(50) NOT NULL, 
	permissible_tolerance VARCHAR(50) NOT NULL, 
	measurement_unit VARCHAR(20) NOT NULL, 
	calculated_error_deviation FLOAT NOT NULL, 
	verification_scale_interval_e VARCHAR(50), 
	accuracy_class VARCHAR(50), 
	result VARCHAR(20) NOT NULL, 
	wire_seal_number VARCHAR(100), 
	fail_reason TEXT, 
	officer_remarks TEXT, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(application_id) REFERENCES applications (id), 
	FOREIGN KEY(instrument_id) REFERENCES instruments (id), 
	FOREIGN KEY(officer_id) REFERENCES users (id)
);

CREATE TABLE verification_test_points (
	id VARCHAR(50) NOT NULL, 
	record_id VARCHAR(50) NOT NULL, 
	test_point_name VARCHAR(100) NOT NULL, 
	nominal_load FLOAT NOT NULL, 
	observed_load FLOAT NOT NULL, 
	unit VARCHAR(20) NOT NULL, 
	error_value FLOAT NOT NULL, 
	tolerance_mpe FLOAT NOT NULL, 
	result VARCHAR(20) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(record_id) REFERENCES verification_records (id) ON DELETE CASCADE
);

CREATE TABLE verification_schedules (
	id VARCHAR(50) NOT NULL, 
	application_id VARCHAR(50) NOT NULL, 
	officer_id VARCHAR(50) NOT NULL, 
	officer_name VARCHAR(150) NOT NULL, 
	inspector_type VARCHAR(50) NOT NULL DEFAULT 'LMO', 
	inspection_date VARCHAR(50) NOT NULL, 
	inspection_time VARCHAR(50) NOT NULL, 
	inspection_location TEXT NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	notes TEXT, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(application_id) REFERENCES applications (id), 
	FOREIGN KEY(officer_id) REFERENCES users (id)
);

CREATE TABLE verification_evidence (
	id VARCHAR(50) NOT NULL, 
	record_id VARCHAR(50) NOT NULL, 
	evidence_category VARCHAR(50) NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	file_url TEXT NOT NULL, 
	storage_path TEXT, 
	file_size_bytes INTEGER, 
	mime_type VARCHAR(100), 
	captured_at DATETIME NOT NULL, 
	geo_latitude FLOAT, 
	geo_longitude FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(record_id) REFERENCES verification_records (id) ON DELETE CASCADE
);

CREATE TABLE offline_sync_operations (
	id VARCHAR(50) NOT NULL, 
	user_id VARCHAR(50) NOT NULL, 
	operation_id VARCHAR(100) NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id VARCHAR(50) NOT NULL, 
	payload_json TEXT NOT NULL, 
	sync_status VARCHAR(30) NOT NULL, 
	conflict_details TEXT, 
	retry_count INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	synced_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE verification_centres (
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
	is_active BOOL NOT NULL DEFAULT TRUE,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_vc_district (district),
	INDEX idx_vc_code (centre_code)
);

CREATE TABLE instrument_types (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	code VARCHAR(50) NOT NULL UNIQUE,
	name VARCHAR(150) NOT NULL,
	description TEXT,
	default_verification_interval_months INTEGER NOT NULL DEFAULT 12,
	is_active BOOL NOT NULL DEFAULT TRUE,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_inst_type_code (code)
);

CREATE TABLE application_assignments (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	application_id VARCHAR(50) NOT NULL,
	assigned_lmo_id VARCHAR(50) NOT NULL,
	assigned_by VARCHAR(50) NOT NULL,
	verification_centre_id VARCHAR(50),
	assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	released_at DATETIME,
	reason TEXT,
	is_current BOOL NOT NULL DEFAULT TRUE,
	INDEX idx_app_assign_app (application_id),
	INDEX idx_app_assign_lmo (assigned_lmo_id),
	FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE,
	FOREIGN KEY (assigned_lmo_id) REFERENCES users (id),
	FOREIGN KEY (assigned_by) REFERENCES users (id),
	FOREIGN KEY (verification_centre_id) REFERENCES verification_centres (id)
);

CREATE TABLE certificate_revocations (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	certificate_id VARCHAR(50) NOT NULL,
	revoked_by VARCHAR(50) NOT NULL,
	revocation_reason TEXT NOT NULL,
	revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	previous_status VARCHAR(50) NOT NULL DEFAULT 'VALID',
	notes TEXT,
	INDEX idx_cert_revoc_cert (certificate_id),
	FOREIGN KEY (certificate_id) REFERENCES certificates (id) ON DELETE CASCADE,
	FOREIGN KEY (revoked_by) REFERENCES users (id)
);

CREATE TABLE user_preferences (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	user_id VARCHAR(50) NOT NULL UNIQUE,
	sidebar_collapsed BOOL NOT NULL DEFAULT FALSE,
	preferred_page_size INTEGER NOT NULL DEFAULT 10,
	preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
	theme VARCHAR(20) NOT NULL DEFAULT 'light',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_user_pref_user (user_id),
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE owner_profiles (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	user_id VARCHAR(50) NOT NULL UNIQUE,
	business_registration_number VARCHAR(100),
	gst_number VARCHAR(50),
	pan_number VARCHAR(50),
	trade_license_number VARCHAR(100),
	contact_person VARCHAR(150),
	authorized_signatory VARCHAR(150),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_owner_prof_user (user_id),
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE lmo_profiles (
	id VARCHAR(50) NOT NULL PRIMARY KEY,
	user_id VARCHAR(50) NOT NULL UNIQUE,
	verification_centre_id VARCHAR(50),
	badge_number VARCHAR(100),
	warrant_number VARCHAR(100),
	posting_date VARCHAR(50),
	active_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_lmo_prof_user (user_id),
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
	FOREIGN KEY (verification_centre_id) REFERENCES verification_centres (id)
);

