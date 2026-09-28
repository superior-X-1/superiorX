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


# 1b. Verification Centres (Physical Inspection/Calibration Facility Master Data)
class VerificationCentre(Base):
    __tablename__ = "verification_centres"

    id = Column(String(50), primary_key=True)
    centre_code = Column(String(50), unique=True, nullable=False, index=True)
    centre_name = Column(String(200), nullable=False)
    centre_type = Column(String(100), default="GOVERNMENT_TEST_CENTRE", nullable=False)
    address_line1 = Column(Text, nullable=False)
    address_line2 = Column(Text, nullable=True)
    district = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    contact_phone = Column(String(30), nullable=True)
    contact_email = Column(String(150), nullable=True)
    license_number = Column(String(100), nullable=True)
    accreditation_number = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="centre_rel")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "centreCode": self.centre_code,
            "code": self.centre_code,
            "centreName": self.centre_name,
            "name": self.centre_name,
            "centreType": self.centre_type,
            "type": self.centre_type,
            "addressLine1": self.address_line1,
            "addressLine2": self.address_line2,
            "address": f"{self.address_line1}, {self.address_line2}" if self.address_line2 else self.address_line1,
            "district": self.district,
            "state": self.state,
            "pincode": self.pincode,
            "contactPhone": self.contact_phone,
            "phone": self.contact_phone,
            "contactEmail": self.contact_email,
            "email": self.contact_email,
            "licenseNumber": self.license_number,
            "accreditationNumber": self.accreditation_number,
            "isActive": self.is_active,
            "status": "ACTIVE" if self.is_active else "INACTIVE",
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


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

    # Master Data associations
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)

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

    accreditation_number = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    role_rel = relationship("Role", back_populates="users")
    centre_rel = relationship("VerificationCentre", back_populates="users", foreign_keys=[verification_centre_id], lazy="joined")
    instruments = relationship("Instrument", back_populates="owner_rel")
    applications = relationship("Application", back_populates="owner_rel")
    owner_profile = relationship("OwnerProfile", back_populates="user_rel", uselist=False, cascade="all, delete-orphan", lazy="joined")
    lmo_profile = relationship("LMOProfile", back_populates="user_rel", uselist=False, cascade="all, delete-orphan", lazy="joined")
    preferences = relationship("UserPreference", back_populates="user_rel", uselist=False, cascade="all, delete-orphan", lazy="joined")

    def to_dict(self) -> Dict[str, Any]:
        vc_name = None
        try:
            if getattr(self, "centre_rel", None):
                vc_name = self.centre_rel.centre_name
        except Exception:
            vc_name = None

        owner_prof = None
        try:
            if getattr(self, "owner_profile", None):
                owner_prof = self.owner_profile.to_dict()
        except Exception:
            owner_prof = None

        lmo_prof = None
        try:
            if getattr(self, "lmo_profile", None):
                lmo_prof = self.lmo_profile.to_dict()
        except Exception:
            lmo_prof = None

        user_prefs = None
        try:
            if getattr(self, "preferences", None):
                user_prefs = self.preferences.to_dict()
        except Exception:
            user_prefs = None

        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "mobile": self.mobile,
            "role": self.role_id,
            "roleId": self.role_id,
            "status": self.status,
            "approvalStatus": self.status,
            "verificationCentreId": self.verification_centre_id,
            "verificationCentreName": vc_name,
            "businessName": self.business_name,
            "businessType": self.business_type,
            "address": self.address,
            "district": self.district,
            "state": self.state,
            "pincode": self.pincode,
            "idType": self.id_type,
            "idNumber": self.id_number,
            "accreditationNumber": self.accreditation_number or self.id_number,
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
            "ownerProfile": owner_prof,
            "lmoProfile": lmo_prof,
            "preferences": user_prefs,
        }


# 2b. User Preferences
class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    sidebar_collapsed = Column(Boolean, default=False, nullable=False)
    preferred_page_size = Column(Integer, default=10, nullable=False)
    preferred_language = Column(String(20), default="en", nullable=False)
    theme = Column(String(20), default="light", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user_rel = relationship("User", back_populates="preferences")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "sidebarCollapsed": self.sidebar_collapsed,
            "preferredPageSize": self.preferred_page_size,
            "preferredLanguage": self.preferred_language,
            "theme": self.theme,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


# 2c. Owner Profile
class OwnerProfile(Base):
    __tablename__ = "owner_profiles"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    business_registration_number = Column(String(100), nullable=True)
    gst_number = Column(String(50), nullable=True)
    pan_number = Column(String(50), nullable=True)
    trade_license_number = Column(String(100), nullable=True)
    contact_person = Column(String(150), nullable=True)
    authorized_signatory = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user_rel = relationship("User", back_populates="owner_profile")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "businessRegistrationNumber": self.business_registration_number,
            "gstNumber": self.gst_number,
            "panNumber": self.pan_number,
            "tradeLicenseNumber": self.trade_license_number,
            "contactPerson": self.contact_person,
            "authorizedSignatory": self.authorized_signatory,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


# 2d. LMO Profile
class LMOProfile(Base):
    __tablename__ = "lmo_profiles"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)
    badge_number = Column(String(100), nullable=True)
    warrant_number = Column(String(100), nullable=True)
    posting_date = Column(String(50), nullable=True)
    active_status = Column(String(50), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user_rel = relationship("User", back_populates="lmo_profile")
    verification_centre = relationship("VerificationCentre")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "verificationCentreId": self.verification_centre_id,
            "verificationCentreName": self.verification_centre.centre_name if self.verification_centre else None,
            "badgeNumber": self.badge_number,
            "warrantNumber": self.warrant_number,
            "postingDate": self.posting_date,
            "activeStatus": self.active_status,
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


# 4b. Instrument Types (Statutory Metrology Category Master Data)
class InstrumentType(Base):
    __tablename__ = "instrument_types"

    id = Column(String(50), primary_key=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    default_verification_interval_months = Column(Integer, default=12, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "defaultVerificationIntervalMonths": self.default_verification_interval_months,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


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
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)
    assignment_type = Column(String(50), nullable=True) # "LMO"
    assigned_officer_id = Column(String(50), nullable=True)
    assigned_officer_name = Column(String(150), nullable=True)
    assigned_gatc_id = Column(String(50), nullable=True)
    assigned_gatc_name = Column(String(150), nullable=True)
    assigned_party_name = Column(String(150), nullable=True)
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
    instrument_rel = relationship("Instrument", back_populates="applications", lazy="joined")
    centre_rel = relationship("VerificationCentre", foreign_keys=[verification_centre_id])
    documents = relationship("ApplicationDocument", back_populates="application_rel", cascade="all, delete-orphan")
    assignments = relationship("ApplicationAssignment", back_populates="application_rel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        inst = getattr(self, "instrument_rel", None)
        if not inst and self.instrument_id:
            try:
                from sqlalchemy.orm import object_session
                sess = object_session(self)
                if sess:
                    inst = sess.query(Instrument).filter(Instrument.id == self.instrument_id).first()
            except Exception:
                inst = None

        inst_type = inst.type if inst else None
        manufacturer = inst.manufacturer if inst else None
        model = inst.model if inst else None
        serial_number = inst.serial_number if inst else None
        capacity = inst.capacity if inst else None
        accuracy_class = inst.accuracy_class if inst else None
        scale_e = inst.verification_scale_interval_e if inst else None
        min_cap = inst.minimum_capacity if inst else None
        inst_loc = inst.location if inst else None

        return {
            "id": self.id,
            "instrumentId": self.instrument_id,
            "instrumentType": inst_type,
            "type": inst_type,
            "manufacturer": manufacturer,
            "model": model,
            "serialNumber": serial_number,
            "serial_number": serial_number,
            "capacity": capacity,
            "accuracyClass": accuracy_class,
            "verificationScaleIntervalE": scale_e,
            "minimumCapacity": min_cap,
            "instrumentLocation": inst_loc,
            "ownerId": self.owner_id,
            "ownerName": self.owner_name,
            "applicantName": self.owner_name,
            "businessName": self.business_name,
            "applicationType": self.application_type,
            "status": self.status,
            "submissionDate": self.submission_date,
            "submittedDate": self.submission_date,
            "preferredLocation": self.preferred_location,
            "location": self.preferred_location,
            "verificationCentreId": self.verification_centre_id,
            "verificationCentreName": self.centre_rel.centre_name if getattr(self, "centre_rel", None) else None,
            "assignmentType": self.assignment_type or "LMO",
            "assignedOfficerId": self.assigned_officer_id,
            "assignedOfficerName": self.assigned_officer_name,
            "assignedGatcId": self.assigned_gatc_id,
            "assignedGatcName": self.assigned_gatc_name,
            "assignedPartyName": self.assigned_party_name or self.assigned_officer_name,
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
            "documents": [d.to_dict() for d in self.documents] if getattr(self, 'documents', None) else [],
            "assignments": [a.to_dict() for a in self.assignments] if getattr(self, 'assignments', None) else [],
        }


# 6b. Application Assignments (Statutory Allocation Trail)
class ApplicationAssignment(Base):
    __tablename__ = "application_assignments"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_lmo_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    assigned_by = Column(String(50), ForeignKey("users.id"), nullable=False)
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    released_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    is_current = Column(Boolean, default=True, nullable=False)

    application_rel = relationship("Application", back_populates="assignments")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "applicationId": self.application_id,
            "assignedLmoId": self.assigned_lmo_id,
            "assignedBy": self.assigned_by,
            "verificationCentreId": self.verification_centre_id,
            "assignedAt": self.assigned_at.isoformat() + "Z" if self.assigned_at else None,
            "releasedAt": self.released_at.isoformat() + "Z" if self.released_at else None,
            "reason": self.reason,
            "isCurrent": self.is_current,
        }



# 7. Application Documents
class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    file_url = Column(Text, nullable=False)
    storage_path = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    uploaded_by = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    application_rel = relationship("Application", back_populates="documents")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "applicationId": self.application_id,
            "documentType": self.document_type,
            "fileName": self.file_name,
            "originalFilename": self.original_filename or self.file_name,
            "fileUrl": self.file_url,
            "fileSizeBytes": self.file_size_bytes,
            "mimeType": self.mime_type,
            "uploadedBy": self.uploaded_by,
            "uploadedAt": self.uploaded_at.isoformat() + "Z" if self.uploaded_at else None,
        }


# 8. Verification Schedules
class VerificationSchedule(Base):
    __tablename__ = "verification_schedules"

    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("applications.id"), nullable=False, index=True)
    officer_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    officer_name = Column(String(150), nullable=False)
    inspector_type = Column(String(50), default="LMO", nullable=False) # LMO
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)
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
            "inspectorType": self.inspector_type,
            "verificationCentreId": self.verification_centre_id,
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
    inspector_type = Column(String(50), default="LMO", nullable=False) # LMO
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)
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
    verification_scale_interval_e = Column(String(50), nullable=True)
    accuracy_class = Column(String(50), nullable=True)
    result = Column(String(20), nullable=False)
    wire_seal_number = Column(String(100), nullable=True)
    fail_reason = Column(Text, nullable=True)
    officer_remarks = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    evidence = relationship("VerificationEvidence", back_populates="record_rel", cascade="all, delete-orphan")
    test_points = relationship("VerificationTestPoint", back_populates="record_rel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "applicationId": self.application_id,
            "instrumentId": self.instrument_id,
            "officerId": self.officer_id,
            "officerName": self.officer_name,
            "inspectorType": self.inspector_type,
            "verificationCentreId": self.verification_centre_id,
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
            "verificationScaleIntervalE": self.verification_scale_interval_e,
            "accuracyClass": self.accuracy_class,
            "result": self.result,
            "wireSealNumber": self.wire_seal_number,
            "failReason": self.fail_reason,
            "officerRemarks": self.officer_remarks,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "testPoints": [tp.to_dict() for tp in self.test_points] if self.test_points else [],
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


# 9b. Verification Test Points (Multiple Test Points per Inspection)
class VerificationTestPoint(Base):
    __tablename__ = "verification_test_points"

    id = Column(String(50), primary_key=True)
    record_id = Column(String(50), ForeignKey("verification_records.id", ondelete="CASCADE"), nullable=False, index=True)
    test_point_name = Column(String(100), nullable=False) # e.g. "Min Load", "Mid-range", "Max Capacity"
    nominal_load = Column(Float, nullable=False)
    observed_load = Column(Float, nullable=False)
    unit = Column(String(20), default="kg", nullable=False)
    error_value = Column(Float, nullable=False) # observed - nominal
    tolerance_mpe = Column(Float, nullable=False) # Maximum Permissible Error
    result = Column(String(20), default="PASS", nullable=False) # PASS / FAIL
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    record_rel = relationship("VerificationRecord", back_populates="test_points")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "recordId": self.record_id,
            "testPointName": self.test_point_name,
            "nominalLoad": self.nominal_load,
            "observedLoad": self.observed_load,
            "unit": self.unit,
            "errorValue": self.error_value,
            "toleranceMpe": self.tolerance_mpe,
            "result": self.result,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }


# 10. Verification Evidence
class VerificationEvidence(Base):
    __tablename__ = "verification_evidence"

    id = Column(String(50), primary_key=True)
    record_id = Column(String(50), ForeignKey("verification_records.id", ondelete="CASCADE"), nullable=True, index=True)
    application_id = Column(String(50), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True)
    evidence_category = Column(String(50), nullable=False)
    caption = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    storage_path = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    captured_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    geo_latitude = Column(Float, nullable=True)
    geo_longitude = Column(Float, nullable=True)
    uploaded_by = Column(String(50), nullable=True)

    record_rel = relationship("VerificationRecord", back_populates="evidence")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "recordId": self.record_id,
            "applicationId": self.application_id,
            "evidenceCategory": self.evidence_category,
            "category": self.evidence_category,
            "caption": self.caption,
            "fileName": self.file_name,
            "fileUrl": self.file_url,
            "fileSizeBytes": self.file_size_bytes,
            "mimeType": self.mime_type,
            "capturedAt": self.captured_at.isoformat() + "Z" if self.captured_at else None,
            "geoLatitude": self.geo_latitude,
            "geoLongitude": self.geo_longitude,
            "latitude": self.geo_latitude,
            "longitude": self.geo_longitude,
        }


# 11. Certificates
class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String(50), primary_key=True)
    instrument_id = Column(String(50), ForeignKey("instruments.id"), nullable=False, index=True)
    application_id = Column(String(50), ForeignKey("applications.id"), nullable=False, index=True)
    record_id = Column(String(50), nullable=True)
    verification_centre_id = Column(String(50), ForeignKey("verification_centres.id"), nullable=True, index=True)
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
    verifier_type = Column(String(50), default="LMO", nullable=False) # LMO
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
    qr_verification_url = Column(String(255), nullable=True)
    digital_signature = Column(Text, nullable=True) # Real asymmetric Base64 signature
    digital_signature_hash = Column(String(255), nullable=True)
    signature_algorithm = Column(String(50), default="RSA-SHA256", nullable=False)
    key_id = Column(String(50), default="MX-KEY-2026-V1", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    centre_rel = relationship("VerificationCentre", foreign_keys=[verification_centre_id])
    revocations = relationship("CertificateRevocation", back_populates="certificate_rel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "instrumentId": self.instrument_id,
            "applicationId": self.application_id,
            "recordId": self.record_id,
            "verificationCentreId": self.verification_centre_id,
            "verificationCentreName": self.centre_rel.centre_name if getattr(self, "centre_rel", None) else None,
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
            "verifierType": self.verifier_type,
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
            "qrVerificationUrl": self.qr_verification_url,
            "digitalSignature": self.digital_signature,
            "digitalSignatureHash": self.digital_signature_hash,
            "signatureAlgorithm": self.signature_algorithm,
            "keyId": self.key_id,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# 11b. Certificate Revocations (Statutory Revocation History)
class CertificateRevocation(Base):
    __tablename__ = "certificate_revocations"

    id = Column(String(50), primary_key=True)
    certificate_id = Column(String(50), ForeignKey("certificates.id"), nullable=False, index=True)
    revoked_by = Column(String(50), ForeignKey("users.id"), nullable=False)
    revocation_reason = Column(Text, nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    previous_status = Column(String(50), default="VALID", nullable=False)
    notes = Column(Text, nullable=True)

    certificate_rel = relationship("Certificate", back_populates="revocations")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "certificateId": self.certificate_id,
            "revokedBy": self.revoked_by,
            "revocationReason": self.revocation_reason,
            "revokedAt": self.revoked_at.isoformat() + "Z" if self.revoked_at else None,
            "previousStatus": self.previous_status,
            "notes": self.notes,
        }


# 11b. Offline Sync Operations (Mobile PWA synchronization queue & conflict resolution)
class OfflineSyncOperation(Base):
    __tablename__ = "offline_sync_operations"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    operation_id = Column(String(100), unique=True, nullable=False, index=True)
    entity_type = Column(String(50), nullable=False) # e.g. "INSPECTION", "EVIDENCE"
    entity_id = Column(String(50), nullable=False)
    payload_json = Column(Text, nullable=False)
    sync_status = Column(String(30), default="PENDING_SYNC", nullable=False) # PENDING_SYNC, SYNCING, SYNCED, FAILED, CONFLICT
    conflict_details = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    synced_at = Column(DateTime, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "operationId": self.operation_id,
            "entityType": self.entity_type,
            "entityId": self.entity_id,
            "payloadJson": self.payload_json,
            "syncStatus": self.sync_status,
            "conflictDetails": self.conflict_details,
            "retryCount": self.retry_count,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "syncedAt": self.synced_at.isoformat() if self.synced_at else None
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
            pool_size=25,
            max_overflow=50,
            echo=False
        )
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.Session = scoped_session(self.session_factory)
        self.init_database()

    def get_session(self):
        """Returns an isolated, thread-safe and async-safe SQLAlchemy session."""
        return self.session_factory()

    def init_database(self):
        """Creates all 16 relational tables in MySQL if not already existing, and seeds baseline records."""
        self.run_migrations()
        self.seed_baseline_data()

    def run_migrations(self):
        """
        Safely applies non-destructive schema migrations (ALTER TABLE) for new columns and tables.
        Guarantees existing MySQL data is preserved intact.
        """
        try:
            Base.metadata.create_all(self.engine)
            inspector = sa.inspect(self.engine)
            existing_tables = set(inspector.get_table_names())

            columns_to_ensure = [
                ("users", "verification_centre_id", "VARCHAR(50) NULL"),
                ("users", "accreditation_number", "VARCHAR(100) NULL"),
                ("applications", "verification_centre_id", "VARCHAR(50) NULL"),
                ("applications", "assignment_type", "VARCHAR(50) NULL"),
                ("applications", "assigned_gatc_id", "VARCHAR(50) NULL"),
                ("applications", "assigned_gatc_name", "VARCHAR(150) NULL"),
                ("applications", "assigned_party_name", "VARCHAR(150) NULL"),
                ("verification_schedules", "verification_centre_id", "VARCHAR(50) NULL"),
                ("verification_schedules", "inspector_type", "VARCHAR(50) NOT NULL DEFAULT 'LMO'"),
                ("verification_records", "verification_centre_id", "VARCHAR(50) NULL"),
                ("verification_records", "inspector_type", "VARCHAR(50) NOT NULL DEFAULT 'LMO'"),
                ("verification_records", "verification_scale_interval_e", "VARCHAR(50) NULL"),
                ("verification_records", "accuracy_class", "VARCHAR(50) NULL"),
                ("application_documents", "original_filename", "VARCHAR(255) NULL"),
                ("application_documents", "storage_path", "TEXT NULL"),
                ("application_documents", "uploaded_by", "VARCHAR(50) NULL"),
                ("verification_evidence", "storage_path", "TEXT NULL"),
                ("verification_evidence", "file_size_bytes", "INT NULL"),
                ("verification_evidence", "mime_type", "VARCHAR(100) NULL"),
                ("verification_evidence", "application_id", "VARCHAR(50) NULL"),
                ("verification_evidence", "caption", "TEXT NULL"),
                ("verification_evidence", "uploaded_by", "VARCHAR(50) NULL"),
                ("verification_records", "latitude", "FLOAT NULL"),
                ("verification_records", "longitude", "FLOAT NULL"),
                ("certificates", "verification_centre_id", "VARCHAR(50) NULL"),
                ("certificates", "verifier_type", "VARCHAR(50) NOT NULL DEFAULT 'LMO'"),
                ("certificates", "digital_signature", "TEXT NULL"),
                ("certificates", "signature_algorithm", "VARCHAR(50) NOT NULL DEFAULT 'RSA-SHA256'"),
                ("certificates", "key_id", "VARCHAR(50) NOT NULL DEFAULT 'MX-KEY-2026-V1'"),
                ("certificates", "qr_verification_url", "VARCHAR(255) NULL"),
            ]

            with self.engine.begin() as conn:
                for table_name, col_name, col_def in columns_to_ensure:
                    if table_name in existing_tables:
                        cols = [c["name"] for c in inspector.get_columns(table_name)]
                        if col_name not in cols:
                            try:
                                conn.execute(sa.text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                                print(f"[MeasureX DB Migration] Added column {table_name}.{col_name}")
                            except Exception as m_err:
                                print(f"[MeasureX DB Migration] Warning adding column {table_name}.{col_name}: {m_err}", file=sys.stderr)
        except Exception as e:
            print(f"[MeasureX DB Migration] Migration notice: {e}", file=sys.stderr)

    def seed_baseline_data(self):
        """Seeds initial canonical roles, master verification centres, instrument types, system settings, and statutory accounts."""
        session = self.get_session()
        try:
            # 1. Clean up legacy GATC role if present
            try:
                # Ensure legacy GATC users are detached/reassigned first
                session.query(User).filter(User.role_id == "GATC").update({
                    "role_id": "LMO",
                    "status": "DEACTIVATED",
                    "verification_centre_id": "VC-PAT-001"
                }, synchronize_session=False)
                session.query(Role).filter(Role.id == "GATC").delete(synchronize_session=False)
                session.commit()
            except Exception as _clean_err:
                session.rollback()

            # 2. Seed Statutory Roles (Strictly OWNER, LMO, ADMIN, PUBLIC)
            canonical_roles = [
                ("OWNER", "Instrument Owner / Commercial Trader", "Commercial establishment registering instruments and applying for verification.", False),
                ("LMO", "Legal Metrology Officer (Inspector)", "Field officer conducting physical inspection, calibration tolerance testing, and stamping.", True),
                ("ADMIN", "Directorate State Administrator", "State directorate administrator managing officers, compliance surveillance, and audit trails.", True),
                ("PUBLIC", "Public Citizen / Consumer", "Unauthenticated citizen accessing public QR seal and certificate verification.", False),
            ]
            for r_id, r_name, r_desc, r_priv in canonical_roles:
                existing_role = session.query(Role).filter(Role.id == r_id).first()
                if not existing_role:
                    session.add(Role(id=r_id, name=r_name, description=r_desc, is_privileged=r_priv))
            session.commit()

            # 3. Seed Verification Centres Master Data
            if session.query(VerificationCentre).count() == 0:
                centres = [
                    VerificationCentre(
                        id="VC-PAT-001",
                        centre_code="PAT-CENTRAL-01",
                        centre_name="Patna Central Legal Metrology Test Centre",
                        centre_type="CENTRAL_LABORATORY",
                        address_line1="Plot 14, Industrial Area, Patliputra",
                        address_line2="Near Polytechnic Ground",
                        district="Patna",
                        state="Bihar",
                        pincode="800013",
                        contact_phone="0612-2589012",
                        contact_email="patna.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-PAT-2024-001",
                        accreditation_number="NABL-TC-8891",
                        is_active=True
                    ),
                    VerificationCentre(
                        id="VC-PAT-002",
                        centre_code="PAT-NORTH-02",
                        centre_name="Patna North Secondary Verification Centre",
                        centre_type="SECONDARY_STANDARD_LAB",
                        address_line1="Circle Office Compound, Bailey Road",
                        address_line2=None,
                        district="Patna",
                        state="Bihar",
                        pincode="800001",
                        contact_phone="0612-2234567",
                        contact_email="patnanorth.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-PAT-2024-002",
                        accreditation_number="NABL-TC-8892",
                        is_active=True
                    ),
                    VerificationCentre(
                        id="VC-GAY-001",
                        centre_code="GAY-DIST-01",
                        centre_name="Gaya District Legal Metrology Centre",
                        centre_type="DISTRICT_LABORATORY",
                        address_line1="Collectorate Compound, Civil Lines",
                        address_line2=None,
                        district="Gaya",
                        state="Bihar",
                        pincode="823001",
                        contact_phone="0631-2220199",
                        contact_email="gaya.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-GAY-2024-001",
                        accreditation_number="NABL-TC-9102",
                        is_active=True
                    ),
                    VerificationCentre(
                        id="VC-MUZ-001",
                        centre_code="MUZ-REG-01",
                        centre_name="Muzaffarpur Regional Metrology Laboratory",
                        centre_type="REGIONAL_STANDARD_LAB",
                        address_line1="Bela Industrial Estate, Phase 2",
                        address_line2=None,
                        district="Muzaffarpur",
                        state="Bihar",
                        pincode="842005",
                        contact_phone="0621-2273412",
                        contact_email="muzaffarpur.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-MUZ-2024-001",
                        accreditation_number="NABL-TC-9204",
                        is_active=True
                    ),
                    VerificationCentre(
                        id="VC-BHA-001",
                        centre_code="BHA-DIST-01",
                        centre_name="Bhagalpur Legal Metrology Inspection Centre",
                        centre_type="DISTRICT_LABORATORY",
                        address_line1="Station Road, Near Court Compound",
                        address_line2=None,
                        district="Bhagalpur",
                        state="Bihar",
                        pincode="812001",
                        contact_phone="0641-2401822",
                        contact_email="bhagalpur.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-BHA-2024-001",
                        accreditation_number="NABL-TC-9311",
                        is_active=True
                    ),
                ]
                session.add_all(centres)
                session.commit()

            # 4. Seed Instrument Types Master Data
            if session.query(InstrumentType).count() == 0:
                inst_types = [
                    InstrumentType(
                        id="INST-TYPE-EPS",
                        code="EPS",
                        name="Electronic Platform Scale",
                        description="Non-automatic electronic platform weighing instrument used in warehouses, retail, and wholesale mandis.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-CWM",
                        code="CWM",
                        name="Counter Weighing Machine",
                        description="Compact electronic or mechanical counter scale used for retail and commercial weighing.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-WBG",
                        code="WBG",
                        name="Weighbridge / Truck Scale",
                        description="Heavy-capacity platform weighbridge for motor vehicles and freight rail wagons.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-FDU",
                        code="FDU",
                        name="Fuel Dispensing Unit",
                        description="Continuous liquid measuring system for petrol, diesel, and motor fuels at dispensing stations.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-PAB",
                        code="PAB",
                        name="Precision Analytical Balance",
                        description="Class I and Class II high precision micro-balance used in jewellery, bullion, and pharmaceutical testing.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-AGF",
                        code="AGF",
                        name="Automatic Gravimetric Filling Instrument",
                        description="Automated packaging and bagging weighing instrument for pre-packaged commodities.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-SPB",
                        code="SPB",
                        name="Spring Balance",
                        description="Mechanical extension spring scale used for domestic and agricultural weighing.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                    InstrumentType(
                        id="INST-TYPE-NWI",
                        code="NWI",
                        name="Non-Automatic Weighing Instrument (NAWI)",
                        description="General non-automatic weighing instrument compliant with OIML R76 statutory guidelines.",
                        default_verification_interval_months=12,
                        is_active=True
                    ),
                ]
                session.add_all(inst_types)
                session.commit()

            # 5. Seed System Settings
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

            # 6. Canonical Statutory Accounts & Easy Demo Credentials (NO GATC USERS)
            canonical_accounts = [
                # Easy Demo Accounts
                {
                    "id": "USR-ADM-DEMO-0001",
                    "name": "State Controller (Admin)",
                    "email": "admin@demo.com",
                    "mobile": "9800000001",
                    "password": "admin123",
                    "role_id": "ADMIN",
                    "status": "ACTIVE",
                    "department": "Directorate of Legal Metrology",
                    "designation": "Director General of Legal Metrology",
                    "office_address": "Directorate Headquarters, Patna, Bihar"
                },
                {
                    "id": "USR-LMO-DEMO-0002",
                    "name": "Rahul Kumar (LMO Officer)",
                    "email": "officer@demo.com",
                    "mobile": "9800000002",
                    "password": "officer123",
                    "role_id": "LMO",
                    "status": "ACTIVE",
                    "department": "Department of Legal Metrology",
                    "designation": "Legal Metrology Officer (Inspector)",
                    "employee_id": "LMO-PAT-2026-0042",
                    "verification_centre_id": "VC-PAT-001",
                    "jurisdiction": "Patna Central Circle",
                    "district": "Patna",
                    "state": "Bihar",
                    "office_address": "Patna Circle Office, Bihar"
                },
                {
                    "id": "USR-LMO-DEMO-0012",
                    "name": "Rahul Kumar (LMO)",
                    "email": "lmo@demo.com",
                    "mobile": "9800000012",
                    "password": "lmo123",
                    "role_id": "LMO",
                    "status": "ACTIVE",
                    "department": "Department of Legal Metrology",
                    "designation": "Legal Metrology Officer (Inspector)",
                    "employee_id": "LMO-PAT-2026-0042",
                    "verification_centre_id": "VC-PAT-001",
                    "jurisdiction": "Patna Central Circle",
                    "district": "Patna",
                    "state": "Bihar"
                },
                {
                    "id": "USR-OWN-DEMO-0004",
                    "name": "Rajesh Verma (Commercial Trader)",
                    "email": "trader@demo.com",
                    "mobile": "9800000004",
                    "password": "trader123",
                    "role_id": "OWNER",
                    "status": "ACTIVE",
                    "business_name": "Bihar Agro Commodities Mandi",
                    "business_type": "Wholesale Grain Mandi Merchant",
                    "address": "Bazar Samiti, Patna, Bihar",
                    "district": "Patna",
                    "state": "Bihar",
                    "pincode": "800006"
                },
                {
                    "id": "USR-OWN-DEMO-0014",
                    "name": "Rajesh Verma (Owner)",
                    "email": "owner@demo.com",
                    "mobile": "9800000014",
                    "password": "owner123",
                    "role_id": "OWNER",
                    "status": "ACTIVE",
                    "business_name": "Bihar Agro Commodities Mandi",
                    "business_type": "Wholesale Grain Mandi Merchant",
                    "address": "Bazar Samiti, Patna, Bihar",
                    "district": "Patna",
                    "state": "Bihar",
                    "pincode": "800006"
                },
                # Historical accounts
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
                    "verification_centre_id": "VC-PAT-001",
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
                        id_type=acc.get("id_type"),
                        id_number=acc.get("id_number"),
                        accreditation_number=acc.get("accreditation_number"),
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
            import secrets
            rand_hex = secrets.token_hex(4).upper()
            audit_code = f"AUD-{datetime.utcnow().year}-{rand_hex}"
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
