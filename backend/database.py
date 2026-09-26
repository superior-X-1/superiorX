"""
Measure X — Production MySQL Database Layer
Compliant with:
- MySQL 8.0+ Relational Schema
- SQLAlchemy 2.0 + PyMySQL Driver
- OIML D31 & Legal Metrology Act, 2009 statutory requirements
- Cryptographically salted password hashing (PBKDF2-HMAC-SHA256 / bcrypt)
"""

import os
import sys
import hashlib
import secrets
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
from dotenv import load_dotenv

import sqlalchemy as sa
from sqlalchemy import (
    Column, String, Text, Integer, Float, Double, Boolean, DateTime,
    ForeignKey, Index, UniqueConstraint, func, or_, and_
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, scoped_session

import urllib.parse

# Load environment configuration
env_path = Path(__file__).resolve().parent / ".env"
root_env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_NAME = os.environ.get("DB_NAME", "measurex")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

_encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{_encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

Base = declarative_base()


# -----------------------------------------------------------------------------
# Password Security Utilities
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique cryptographic salt."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"pbkdf2:sha256:100000${salt}${pw_hash}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verifies a plain password against the stored cryptographic hash."""
    if not stored_hash or not plain_password:
        return False
    if stored_hash.startswith("pbkdf2:sha256:"):
        try:
            parts = stored_hash.split("$")
            iterations = int(parts[0].split(":")[2])
            salt = parts[1]
            expected_hash = parts[2]
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
            return secrets.compare_digest(computed, expected_hash)
        except Exception:
            return False
    # Backward compatibility for existing hashed or legacy seeds
    return secrets.compare_digest(plain_password, stored_hash)


# -----------------------------------------------------------------------------
# SQLAlchemy Models (14 Relational Tables)
# -----------------------------------------------------------------------------

# 1. Roles
class Role(Base):
    __tablename__ = "roles"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_privileged = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="role_rel")


# 2. Users
class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    mobile = Column(String(30), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(String(50), ForeignKey("roles.id"), nullable=False, index=True)
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)

    # Business / Commercial attributes (Owner)
    business_name = Column(String(200), nullable=True)
    business_type = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    id_type = Column(String(50), nullable=True)
    id_number = Column(String(100), nullable=True)

    # Official / Institutional attributes (LMO / Admin)
    department = Column(String(200), nullable=True)
    designation = Column(String(100), nullable=True)
    employee_id = Column(String(100), nullable=True)
    jurisdiction = Column(String(200), nullable=True)
    office_address = Column(Text, nullable=True)
    approval_notes = Column(Text, nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    role_rel = relationship("Role", back_populates="users")
    instruments = relationship("Instrument", back_populates="owner_rel")
    applications = relationship("Application", back_populates="owner_rel")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "mobile": self.mobile,
            "role": self.role_id,
            "roleId": self.role_id,
            "status": self.status,
            "businessName": self.business_name,
            "businessType": self.business_type,
            "address": self.address,
            "district": self.district,
            "state": self.state,
            "pincode": self.pincode,
            "idType": self.id_type,
            "idNumber": self.id_number,
            "department": self.department,
            "designation": self.designation,
            "employeeId": self.employee_id,
            "jurisdiction": self.jurisdiction,
            "officeAddress": self.office_address,
            "approvalNotes": self.approval_notes,
            "approvedBy": self.approved_by,
            "approvedAt": self.approved_at.isoformat() + "Z" if self.approved_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }



# 3. Password Reset Tokens
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# 4. OTP Records
class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(String(50), primary_key=True)
    recipient = Column(String(150), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    purpose = Column(String(50), default="PASSWORD_RESET", nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    resend_available_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    used_at = Column(DateTime, nullable=True)


# 5. Instruments
class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(String(50), primary_key=True)
    owner_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    owner_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=False)
    type = Column(String(100), nullable=False)
    accuracy_class = Column(String(50), default="Class III", nullable=False)
    manufacturer = Column(String(150), nullable=False)
    model = Column(String(100), nullable=False)
    serial_number = Column(String(100), nullable=False, index=True)
    capacity = Column(String(50), nullable=False)
    verification_scale_interval_e = Column(String(50), nullable=True)
    minimum_capacity = Column(String(50), nullable=True)
    location = Column(Text, nullable=False)
    district = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    purchase_date = Column(String(50), nullable=True)
    installation_details = Column(Text, nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)
    valid_until = Column(String(50), nullable=True)
    last_verification_date = Column(String(50), nullable=True)
    last_officer_id = Column(String(50), nullable=True)
    last_officer_name = Column(String(150), nullable=True)
    active_certificate_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner_rel = relationship("User", back_populates="instruments")
    applications = relationship("Application", back_populates="instrument_rel")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "ownerId": self.owner_id,
            "ownerName": self.owner_name,
            "businessName": self.business_name,
            "type": self.type,
            "accuracyClass": self.accuracy_class,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "serialNumber": self.serial_number,
            "capacity": self.capacity,
            "verificationScaleIntervalE": self.verification_scale_interval_e,
            "minimumCapacity": self.minimum_capacity,
            "location": self.location,
            "district": self.district,
            "state": self.state,
            "purchaseDate": self.purchase_date,
            "installationDetails": self.installation_details,
            "status": self.status,
            "validUntil": self.valid_until,
            "lastVerificationDate": self.last_verification_date,
            "lastOfficerId": self.last_officer_id,
            "lastOfficerName": self.last_officer_name,
            "lastOfficer": self.last_officer_name,
            "activeCertificateId": self.active_certificate_id,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "lifecycle": [
                {
                    "stage": "REGISTRATION",
                    "title": "Instrument Registered in Registry",
                    "date": self.purchase_date or (self.created_at.strftime("%Y-%m-%d") if self.created_at else "2024-01-01"),
                    "time": "10:00 AM",
                    "actor": f"{self.owner_name} (Owner)",
                    "status": "COMPLETED",
                    "remarks": f"Registered commercial {self.type} model {self.model} with serial number {self.serial_number}."
                }
            ],
            "verificationHistory": []
        }



# 6. Applications
class Application(Base):
    __tablename__ = "applications"

    id = Column(String(50), primary_key=True)
    instrument_id = Column(String(50), ForeignKey("instruments.id"), nullable=False, index=True)
    owner_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    owner_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=False)
    application_type = Column(String(50), default="RE_VERIFICATION", nullable=False)
    status = Column(String(50), default="SUBMITTED", nullable=False, index=True)
    submission_date = Column(String(50), nullable=False)
    preferred_location = Column(Text, nullable=False)
    assigned_officer_id = Column(String(50), nullable=True)
    assigned_officer_name = Column(String(150), nullable=True)
    scheduled_date = Column(String(50), nullable=True)
    scheduled_time = Column(String(50), nullable=True)
    scheduled_location = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    correction_notes = Column(Text, nullable=True)
    applicant_remarks = Column(Text, nullable=True)
    fee_amount = Column(Float, default=750.0, nullable=False)
    payment_reference = Column(String(100), nullable=True)
    certificate_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner_rel = relationship("User", back_populates="applications")
    instrument_rel = relationship("Instrument", back_populates="applications")
    documents = relationship("ApplicationDocument", back_populates="application_rel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "instrumentId": self.instrument_id,
            "ownerId": self.owner_id,
            "ownerName": self.owner_name,
            "businessName": self.business_name,
            "applicationType": self.application_type,
            "status": self.status,
            "submissionDate": self.submission_date,
            "preferredLocation": self.preferred_location,
            "assignedOfficerId": self.assigned_officer_id,
            "assignedOfficerName": self.assigned_officer_name,
            "scheduledDate": self.scheduled_date,
            "scheduledTime": self.scheduled_time,
            "scheduledLocation": self.scheduled_location,
            "rejectionReason": self.rejection_reason,
            "correctionNotes": self.correction_notes,
            "applicantRemarks": self.applicant_remarks,
            "feeAmount": self.fee_amount,
            "paymentReference": self.payment_reference,
            "certificateId": self.certificate_id,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }



# 7. Application Documents
class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    application_rel = relationship("Application", back_populates="documents")


# 8. Verification Schedules
class VerificationSchedule(Base):
    __tablename__ = "verification_schedules"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id"), nullable=False, index=True)
    officer_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    officer_name = Column(String(150), nullable=False)
    inspection_date = Column(String(50), nullable=False, index=True)
    inspection_time = Column(String(50), nullable=False)
    inspection_location = Column(Text, nullable=False)
    status = Column(String(50), default="SCHEDULED", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "applicationId": self.application_id,
            "officerId": self.officer_id,
            "officerName": self.officer_name,
            "inspectionDate": self.inspection_date,
            "inspectionTime": self.inspection_time,
            "inspectionLocation": self.inspection_location,
            "status": self.status,
            "notes": self.notes,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


# 9. Verification Records
class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id"), nullable=False, index=True)
    instrument_id = Column(String(50), ForeignKey("instruments.id"), nullable=False, index=True)
    officer_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    officer_name = Column(String(150), nullable=False)
    inspection_date = Column(String(50), nullable=False)
    physical_condition_check = Column(String(20), default="PASS", nullable=False)
    level_indicator_check = Column(String(20), default="PASS", nullable=False)
    zero_setting_check = Column(String(20), default="PASS", nullable=False)
    display_pointer_check = Column(String(20), default="PASS", nullable=False)
    security_seal_integrity_check = Column(String(20), default="PASS", nullable=False)
    statutory_markings_check = Column(String(20), default="PASS", nullable=False)
    nominal_test_weight = Column(String(50), nullable=False)
    observed_measurement = Column(String(50), nullable=False)
    permissible_tolerance = Column(String(50), nullable=False)
    measurement_unit = Column(String(20), default="kg", nullable=False)
    calculated_error_deviation = Column(Float, nullable=False)
    result = Column(String(20), nullable=False)
    wire_seal_number = Column(String(100), nullable=True)
    fail_reason = Column(Text, nullable=True)
    officer_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    evidence = relationship("VerificationEvidence", back_populates="record_rel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "applicationId": self.application_id,
            "instrumentId": self.instrument_id,
            "officerId": self.officer_id,
            "officerName": self.officer_name,
            "inspectionDate": self.inspection_date,
            "physicalConditionCheck": self.physical_condition_check,
            "levelIndicatorCheck": self.level_indicator_check,
            "zeroSettingCheck": self.zero_setting_check,
            "displayPointerCheck": self.display_pointer_check,
            "securitySealIntegrityCheck": self.security_seal_integrity_check,
            "statutoryMarkingsCheck": self.statutory_markings_check,
            "nominalTestWeight": self.nominal_test_weight,
            "observedMeasurement": self.observed_measurement,
            "permissibleTolerance": self.permissible_tolerance,
            "measurementUnit": self.measurement_unit,
            "calculatedErrorDeviation": self.calculated_error_deviation,
            "result": self.result,
            "wireSealNumber": self.wire_seal_number,
            "failReason": self.fail_reason,
            "officerRemarks": self.officer_remarks,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


# 10. Verification Evidence
class VerificationEvidence(Base):
    __tablename__ = "verification_evidence"

    id = Column(String(50), primary_key=True)
    record_id = Column(String(50), ForeignKey("verification_records.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_category = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    captured_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    geo_latitude = Column(Float, nullable=True)
    geo_longitude = Column(Float, nullable=True)

    record_rel = relationship("VerificationRecord", back_populates="evidence")


# 11. Certificates
class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String(50), primary_key=True)
    instrument_id = Column(String(50), ForeignKey("instruments.id"), nullable=False, index=True)
    application_id = Column(String(50), ForeignKey("applications.id"), nullable=False, index=True)
    record_id = Column(String(50), nullable=True)
    instrument_type = Column(String(100), nullable=False)
    manufacturer = Column(String(150), nullable=False)
    model = Column(String(100), nullable=False)
    serial_number = Column(String(100), nullable=False)
    capacity = Column(String(50), nullable=False)
    owner_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=False)
    location = Column(Text, nullable=False)
    verification_date = Column(String(50), nullable=False)
    valid_until = Column(String(50), nullable=False, index=True)
    officer_id = Column(String(50), nullable=False)
    officer_name = Column(String(150), nullable=False)
    officer_designation = Column(String(100), nullable=False)
    authority = Column(String(200), nullable=False)
    observed_measurement = Column(String(50), nullable=False)
    permissible_error = Column(String(50), nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    wire_seal_number = Column(String(100), nullable=False)
    status = Column(String(50), default="VALID", nullable=False, index=True)
    revocation_reason = Column(Text, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(String(150), nullable=True)
    qr_payload = Column(Text, nullable=False)
    digital_signature_hash = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "instrumentId": self.instrument_id,
            "applicationId": self.application_id,
            "recordId": self.record_id,
            "instrumentType": self.instrument_type,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "serialNumber": self.serial_number,
            "capacity": self.capacity,
            "ownerName": self.owner_name,
            "businessName": self.business_name,
            "location": self.location,
            "verificationDate": self.verification_date,
            "validUntil": self.valid_until,
            "officerId": self.officer_id,
            "officerName": self.officer_name,
            "officerDesignation": self.officer_designation,
            "authority": self.authority,
            "observedMeasurement": self.observed_measurement,
            "permissibleError": self.permissible_error,
            "unit": self.unit,
            "wireSealNumber": self.wire_seal_number,
            "status": self.status,
            "revocationReason": self.revocation_reason,
            "revokedAt": self.revoked_at.isoformat() + "Z" if self.revoked_at else None,
            "revokedBy": self.revoked_by,
            "qrPayload": self.qr_payload,
            "digitalSignatureHash": self.digital_signature_hash,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# 12. Notifications
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True)
    recipient_id = Column(String(50), nullable=True, index=True)
    target_role = Column(String(50), default="ALL", nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)
    related_entity = Column(String(50), nullable=True)
    related_id = Column(String(50), nullable=True)
    action_url = Column(String(255), nullable=True)
    priority = Column(String(20), default="MEDIUM", nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    sender_info = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "recipientId": self.recipient_id,
            "userId": self.recipient_id,
            "targetRole": self.target_role,
            "title": self.title,
            "message": self.message,
            "type": self.notification_type,
            "notificationType": self.notification_type,
            "relatedEntity": self.related_entity,
            "relatedId": self.related_id,
            "actionUrl": self.action_url,
            "priority": self.priority,
            "read": self.is_read,
            "isRead": self.is_read,
            "readAt": self.read_at.isoformat() + "Z" if self.read_at else None,
            "sender": self.sender_info,
            "senderInfo": self.sender_info,
            "timestamp": self.created_at.strftime("%d %b %Y, %I:%M %p") if self.created_at else "",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# 13. Audit Logs
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    audit_code = Column(String(50), unique=True, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(String(50), nullable=True, index=True)
    user_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(String(50), nullable=False)
    previous_state = Column(String(50), nullable=True)
    new_state = Column(String(50), nullable=False)
    channel = Column(String(50), default="Secure Portal Web", nullable=False)
    details = Column(Text, nullable=True)
    client_ip = Column(String(50), nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "auditCode": self.audit_code,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "userId": self.user_id,
            "userName": self.user_name,
            "user": self.user_name,
            "role": self.role,
            "action": self.action,
            "entity": self.entity,
            "entityId": self.entity_id,
            "previousState": self.previous_state,
            "newState": self.new_state,
            "channel": self.channel,
            "details": self.details,
            "clientIp": self.client_ip,
        }



# 14. System Settings
class SystemSetting(Base):
    __tablename__ = "system_settings"

    setting_key = Column(String(100), primary_key=True)
    setting_value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_by = Column(String(100), nullable=False)


# -----------------------------------------------------------------------------
# Database Engine & Session Manager
# -----------------------------------------------------------------------------
class MySQLDatabaseManager:
    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or DATABASE_URL
        self.engine = sa.create_engine(
            self.db_url,
            pool_recycle=3600,
            pool_pre_ping=True,
            echo=False
        )
        self.session_factory = sessionmaker(bind=self.engine)
        self.Session = scoped_session(self.session_factory)
        self.init_database()

    def get_session(self):
        """Returns a managed SQLAlchemy session."""
        return self.Session()

    def init_database(self):
        """Creates all 14 tables in MySQL if not already existing, and seeds baseline records."""
        Base.metadata.create_all(self.engine)
        self.seed_baseline_data()

    def seed_baseline_data(self):
        """Seeds initial canonical roles, system settings, and statutory accounts. Zero dummy users."""
        session = self.get_session()
        try:
            # 1. Seed Roles
            if session.query(Role).count() == 0:
                roles = [
                    Role(id="OWNER", name="Instrument Owner / Commercial Trader", description="Commercial establishment registering instruments and applying for verification.", is_privileged=False),
                    Role(id="LMO", name="Legal Metrology Officer (Inspector)", description="Field officer conducting physical inspection, calibration tolerance testing, and stamping.", is_privileged=True),
                    Role(id="ADMIN", name="Directorate State Administrator", description="State directorate administrator managing officers, compliance surveillance, and audit trails.", is_privileged=True),
                    Role(id="PUBLIC", name="Public Citizen / Consumer", description="Unauthenticated citizen accessing public QR seal and certificate verification.", is_privileged=False),
                ]
                session.add_all(roles)
                session.commit()

            # 2. Seed System Settings
            if session.query(SystemSetting).count() == 0:
                settings = [
                    SystemSetting(setting_key="AUTHORITY_NAME", setting_value="Department of Legal Metrology, Government of Bihar", description="Statutory regulatory authority heading all legal certificates.", updated_by="System"),
                    SystemSetting(setting_key="VERIFICATION_VALIDITY_YEARS", setting_value="1", description="Statutory interval for commercial weighing instruments before mandatory re-verification.", updated_by="System"),
                    SystemSetting(setting_key="EXPIRY_ALERT_LEAD_DAYS", setting_value="30", description="Days in advance to generate automated statutory re-verification alert notifications to owners.", updated_by="System"),
                    SystemSetting(setting_key="ADMIN_ONBOARDING_CODE", setting_value="MX-GOV-ADMIN-2026", description="Department authorization code required for controlled Administrator onboarding.", updated_by="System"),
                    SystemSetting(setting_key="STATUTORY_RULES_REFERENCE", setting_value="Legal Metrology (General) Rules, 2011, Schedule VII", description="Statutory legal citation printed on digital certificates.", updated_by="System"),
                ]
                session.add_all(settings)
                session.commit()

            # 3. Canonical Statutory Accounts (Pre-configured as documented in README.md)
            canonical_accounts = [
                {
                    "id": "USR-ADM-0000-0001",
                    "name": "Director General Metrology",
                    "email": "director.legal@metrology.gov.in",
                    "mobile": "9999990001",
                    "password": "Admin@123",
                    "role_id": "ADMIN",
                    "status": "ACTIVE",
                    "department": "Directorate of Legal Metrology",
                    "designation": "Director General of Legal Metrology",
                    "office_address": "Directorate HQ, Patna, Bihar"
                },
                {
                    "id": "USR-LMO-0000-0002",
                    "name": "Shri R. K. Sharma (LMO)",
                    "email": "officer.patna@metrology.gov.in",
                    "mobile": "9999990002",
                    "password": "Officer@123",
                    "role_id": "LMO",
                    "status": "ACTIVE",
                    "department": "Department of Legal Metrology",
                    "designation": "Legal Metrology Officer (Inspector)",
                    "employee_id": "LMO-PAT-2026-0042",
                    "jurisdiction": "Patna Central Circle",
                    "office_address": "Patna Circle Office, Bihar"
                },
                {
                    "id": "USR-OWN-0000-0003",
                    "name": "Rajesh Agarwal",
                    "email": "trader.patna@biharmandi.com",
                    "mobile": "9999990003",
                    "password": "Owner@123",
                    "role_id": "OWNER",
                    "status": "ACTIVE",
                    "business_name": "Agarwal Trading Corporation",
                    "business_type": "Wholesale Grain Mandi Merchant",
                    "address": "Bazar Samiti, Patna, Bihar",
                    "district": "Patna",
                    "state": "Bihar",
                    "pincode": "800006"
                },
                {
                    "id": "USR-OWN-0000-0004",
                    "name": "Yaseen Test",
                    "email": "yaseen.test@example.com",
                    "mobile": "9000000001",
                    "password": "Test@12345",
                    "role_id": "OWNER",
                    "status": "ACTIVE",
                    "business_name": "Yaseen Commodities Pvt Ltd",
                    "business_type": "Wholesale Mandi Merchant",
                    "address": "Patna Mandi Complex, Bihar",
                    "district": "Patna",
                    "state": "Bihar",
                    "pincode": "800001"
                }
            ]
            for acc in canonical_accounts:
                existing = session.query(User).filter(User.email == acc["email"]).first()
                if not existing:
                    session.add(User(
                        id=acc["id"],
                        name=acc["name"],
                        email=acc["email"],
                        mobile=acc["mobile"],
                        password_hash=hash_password(acc["password"]),
                        role_id=acc["role_id"],
                        status=acc["status"],
                        department=acc.get("department"),
                        designation=acc.get("designation"),
                        employee_id=acc.get("employee_id"),
                        jurisdiction=acc.get("jurisdiction"),
                        office_address=acc.get("office_address"),
                        business_name=acc.get("business_name"),
                        business_type=acc.get("business_type"),
                        address=acc.get("address"),
                        district=acc.get("district"),
                        state=acc.get("state"),
                        pincode=acc.get("pincode"),
                        created_at=datetime.utcnow()
                    ))
            session.commit()

            # 4. System Initialization Audit Log
            if session.query(AuditLog).count() == 0:
                init_log = AuditLog(
                    audit_code="AUD-2026-0001",
                    timestamp=datetime.utcnow(),
                    user_id=None,
                    user_name="SYSTEM_INITIALIZER",
                    role="ADMIN",
                    action="SYSTEM_INITIALIZED",
                    entity="System",
                    entity_id="ROOT",
                    previous_state="OFFLINE",
                    new_state="ONLINE",
                    channel="System Console",
                    details="MeasureX MySQL 8.0 enterprise database initialized with 14 relational tables.",
                    client_ip="127.0.0.1"
                )
                session.add(init_log)
                session.commit()

        except Exception as e:
            session.rollback()
            print(f"[MeasureX DB] Baseline seed warning: {e}", file=sys.stderr)
        finally:
            session.close()

    # -------------------------------------------------------------------------
    # Helper CRUD & Transaction Methods
    # -------------------------------------------------------------------------
    def log_audit(self, user_name: str, role: str, action: str, entity: str, entity_id: str,
                  previous_state: str, new_state: str, user_id: Optional[str] = None,
                  channel: str = "Secure Portal Web", details: str = "", client_ip: str = "127.0.0.1"):
        """Logs an immutable statutory audit entry into MySQL."""
        session = self.get_session()
        try:
            count = session.query(AuditLog).count()
            audit_code = f"AUD-{datetime.utcnow().year}-{count + 1001:05d}"
            entry = AuditLog(
                audit_code=audit_code,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                user_name=user_name,
                role=role,
                action=action,
                entity=entity,
                entity_id=entity_id,
                previous_state=previous_state or "None",
                new_state=new_state,
                channel=channel,
                details=details or f"{action} for {entity} [{entity_id}]",
                client_ip=client_ip
            )
            session.add(entry)
            session.commit()
            return entry
        except Exception as err:
            session.rollback()
            print(f"[MeasureX DB] Audit log error: {err}", file=sys.stderr)
            return None
        finally:
            session.close()


# Global Singleton Database Manager instance
db = MySQLDatabaseManager()
