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
	assigned_officer_id VARCHAR(50), 
	assigned_officer_name VARCHAR(150), 
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
	file_url TEXT NOT NULL, 
	file_size_bytes INTEGER, 
	mime_type VARCHAR(100), 
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
	digital_signature_hash VARCHAR(255), 
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

CREATE TABLE verification_schedules (
	id VARCHAR(50) NOT NULL, 
	application_id VARCHAR(50) NOT NULL, 
	officer_id VARCHAR(50) NOT NULL, 
	officer_name VARCHAR(150) NOT NULL, 
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
	captured_at DATETIME NOT NULL, 
	geo_latitude FLOAT, 
	geo_longitude FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(record_id) REFERENCES verification_records (id) ON DELETE CASCADE
);
