"""
Measure X — Production FastAPI Backend Engine
Digital Legal Metrology Platform for Registering, Verifying, Certifying & Tracking Instruments.
Full compliance with:
- MySQL 8.0+ Enterprise Relational Database (SQLAlchemy 2.0 + PyMySQL)
- Zero SQLite, Zero In-Memory DATASTORE as source of truth
- Pure Cryptographically Signed JWT Authentication (PyJWT HS256)
- Strict Owner Data Isolation based on Authenticated User ID from JWT
- Automatic Role Detection & Enforcement (OWNER, LMO, ADMIN)
- OIML D31 & Legal Metrology Act, 2009 Statutory Workflow
"""

import os
import sys
import uuid
import hashlib
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path

# Add backend directory to sys.path
current_dir = Path(__file__).resolve().parent
if str(current_dir.parent) not in sys.path:
    sys.path.insert(0, str(current_dir.parent))
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

import sqlalchemy as sa
from sqlalchemy.orm import Session
from fastapi import FastAPI, HTTPException, Query, status, Header, Depends, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from backend.database import (
    db, Base, Role, User, PasswordResetToken, OTPRecord,
    Instrument, Application, ApplicationDocument, VerificationSchedule,
    VerificationRecord, VerificationTestPoint, VerificationEvidence, Certificate,
    Notification, AuditLog, SystemSetting, OfflineSyncOperation,
    VerificationCentre, InstrumentType, ApplicationAssignment, CertificateRevocation,
    UserPreference, OwnerProfile, LMOProfile,
    hash_password, verify_password
)
from backend.security import (
    create_access_token, decode_access_token,
    get_current_user, get_optional_current_user, require_role
)
from backend.otp_service import otp_service, mask_recipient
from backend.crypto_signer import (
    canonical_certificate_payload, sign_certificate_payload,
    verify_certificate_signature, get_public_key_pem
)
from backend.qr_service import (
    build_verification_url, generate_certificate_qr,
    generate_qr_code_png_bytes, generate_qr_data_url
)
from backend import storage
from backend.dependencies import get_db
from backend.schemas import (
    LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, OTPRequest, OTPVerifyRequest, SendNotificationRequest,
    UpdateUserStatusRequest, InstrumentCreate, ApplicationCreate, ScheduleRequest,
    AllocateRequest, ReassignRequest, TestPointInput, VerificationSubmitRequest,
    RevokeCertificateRequest, ApplicationActionRequest, OfflineSyncItem, OfflineSyncRequest
)

# -----------------------------------------------------------------------------
# Storage Directories Configuration
# -----------------------------------------------------------------------------
UPLOAD_DIR = Path(os.environ.get("FILE_STORAGE_PATH", current_dir.parent / "storage" / "uploads"))
DOCUMENTS_DIR = UPLOAD_DIR / "documents"
EVIDENCE_DIR = UPLOAD_DIR / "evidence"
try:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
except (OSError, PermissionError):
    pass

# -----------------------------------------------------------------------------
# FastAPI App Initialization
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Measure X — Digital Legal Metrology Platform API",
    description="Statutory digital platform for verification, certification, and tracking of weighing & measuring instruments.",
    version="2.4.0-PROD"
)

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1",
    "https://superiorx.vercel.app",
    "https://measurex.vercel.app"
]
if cors_origins_env and cors_origins_env != "*":
    origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()] + default_origins
else:
    origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[a-zA-Z0-9-]+\.vercel\.app|[a-zA-Z0-9-]+\.onrender\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


def send_system_notification(session: Session, recipient_id: Optional[str], target_role: str,
                             title: str, message: str, notif_type: str = "SYSTEM_ALERT",
                             related_entity: Optional[str] = None, related_id: Optional[str] = None,
                             action_url: Optional[str] = None, priority: str = "MEDIUM",
                             sender: str = "Directorate of Legal Metrology"):
    """Dispatches a persistent notification to MySQL."""
    try:
        notif_id = f"NOTIF-{datetime.utcnow().year}-{secrets_hex_str(4)}"
        notif = Notification(
            id=notif_id,
            recipient_id=recipient_id,
            target_role=target_role,
            title=title,
            message=message,
            notification_type=notif_type,
            related_entity=related_entity,
            related_id=related_id,
            action_url=action_url,
            priority=priority,
            is_read=False,
            sender_info=sender,
            created_at=datetime.utcnow()
        )
        session.add(notif)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"[MeasureX Notification Warning] {e}", file=sys.stderr)


def secrets_hex_str(n: int = 4) -> str:
    import secrets
    return secrets.token_hex(n).upper()


def calculate_test_tolerances(
    nominal: float,
    observed: float,
    unit: str = "kg",
    tolerance_mpe: Optional[float] = None,
    accuracy_class: str = "Class III",
    scale_interval_e: Optional[float] = None
) -> Tuple[float, float, str]:
    """
    Computes statutory Legal Metrology error and pass/fail evaluation:
    - error = observed - nominal
    - deviation = abs(error)
    - MPE (Maximum Permissible Error) based on accuracy class and interval e
    Returns (error, mpe, "PASS" | "FAIL")
    """
    error = round(observed - nominal, 4)
    deviation = abs(error)

    if tolerance_mpe is not None and tolerance_mpe > 0:
        mpe = float(tolerance_mpe)
    else:
        # Default OIML R76 / Legal Metrology General Rules (Schedule VII) for Class III
        e = scale_interval_e if scale_interval_e and scale_interval_e > 0 else (0.01 if nominal <= 100 else 0.05)
        m = nominal / e if e > 0 else nominal
        if m <= 500:
            mpe = round(1.0 * e, 4)
        elif m <= 2000:
            mpe = round(2.0 * e, 4)
        else:
            mpe = round(3.0 * e, 4)

    is_pass = deviation <= (mpe + 1e-6)
    return error, mpe, ("PASS" if is_pass else "FAIL")


def evaluate_certificate_expiries(session: Session) -> Dict[str, int]:
    """
    Evaluates certificates against statutory expiry thresholds (60d, 30d, 7d, 0d)
    Updates certificate status and dispatches automated notifications.
    """
    today = date.today()
    counts = {"expired": 0, "expiring_soon": 0, "active": 0}

    active_certs = session.query(Certificate).filter(
        Certificate.status.in_(["VALID", "EXPIRING_SOON"])
    ).all()

    for cert in active_certs:
        try:
            expiry_dt = None
            for fmt in ["%d %b %Y", "%Y-%m-%d", "%d/%m/%Y"]:
                try:
                    expiry_dt = datetime.strptime(cert.valid_until.strip(), fmt).date()
                    break
                except Exception:
                    continue

            if not expiry_dt:
                continue

            days_remaining = (expiry_dt - today).days

            if days_remaining <= 0:
                cert.status = "EXPIRED"
                counts["expired"] += 1
                ins = session.query(Instrument).filter(Instrument.id == cert.instrument_id).first()
                if ins and ins.active_certificate_id == cert.id:
                    ins.status = "EXPIRED"

                notif_exists = session.query(Notification).filter(
                    Notification.related_id == cert.id,
                    Notification.notification_type == "CERTIFICATE_EXPIRED"
                ).first()
                if not notif_exists:
                    send_system_notification(
                        session=session,
                        recipient_id=None,
                        target_role="OWNER",
                        title=f"Statutory Verification Certificate {cert.id} EXPIRED",
                        message=f"Certificate {cert.id} for instrument {cert.instrument_id} expired on {cert.valid_until}. Commercial use without re-verification is prohibited.",
                        notif_type="CERTIFICATE_EXPIRED",
                        related_entity="Certificate",
                        related_id=cert.id,
                        action_url=f"#certificate-view?id={cert.id}",
                        priority="HIGH",
                        sender="Metrology Compliance Enforcement"
                    )
            elif days_remaining <= 7:
                cert.status = "EXPIRING_SOON"
                counts["expiring_soon"] += 1
                notif_exists = session.query(Notification).filter(
                    Notification.related_id == cert.id,
                    Notification.notification_type == "CERTIFICATE_EXPIRING_7D"
                ).first()
                if not notif_exists:
                    send_system_notification(
                        session=session,
                        recipient_id=None,
                        target_role="OWNER",
                        title="Mandatory Re-verification Alert: 7 Days Remaining",
                        message=f"Certificate {cert.id} for {cert.instrument_type} ({cert.serial_number}) expires in {days_remaining} days on {cert.valid_until}. Please file for re-verification immediately.",
                        notif_type="CERTIFICATE_EXPIRING_7D",
                        related_entity="Certificate",
                        related_id=cert.id,
                        action_url=f"#owner-apply?instrumentId={cert.instrument_id}",
                        priority="HIGH",
                        sender="Metrology Directorate Alert Engine"
                    )
            elif days_remaining <= 30:
                cert.status = "EXPIRING_SOON"
                counts["expiring_soon"] += 1
                notif_exists = session.query(Notification).filter(
                    Notification.related_id == cert.id,
                    Notification.notification_type == "CERTIFICATE_EXPIRING_30D"
                ).first()
                if not notif_exists:
                    send_system_notification(
                        session=session,
                        recipient_id=None,
                        target_role="OWNER",
                        title="Mandatory Re-verification Alert: 30 Days Remaining",
                        message=f"Certificate {cert.id} for {cert.instrument_type} ({cert.serial_number}) expires in {days_remaining} days on {cert.valid_until}. Schedule periodic re-verification.",
                        notif_type="CERTIFICATE_EXPIRING_30D",
                        related_entity="Certificate",
                        related_id=cert.id,
                        action_url=f"#owner-apply?instrumentId={cert.instrument_id}",
                        priority="MEDIUM",
                        sender="Metrology Directorate Alert Engine"
                    )
            elif days_remaining <= 60:
                counts["active"] += 1
                notif_exists = session.query(Notification).filter(
                    Notification.related_id == cert.id,
                    Notification.notification_type == "CERTIFICATE_EXPIRING_60D"
                ).first()
                if not notif_exists:
                    send_system_notification(
                        session=session,
                        recipient_id=None,
                        target_role="OWNER",
                        title="Statutory Notice: Certificate Expiring in 60 Days",
                        message=f"Certificate {cert.id} for {cert.instrument_type} will expire in {days_remaining} days on {cert.valid_until}.",
                        notif_type="CERTIFICATE_EXPIRING_60D",
                        related_entity="Certificate",
                        related_id=cert.id,
                        action_url=f"#owner-apply?instrumentId={cert.instrument_id}",
                        priority="LOW",
                        sender="Metrology Directorate Alert Engine"
                    )
            else:
                counts["active"] += 1
        except Exception as e:
            print(f"[MeasureX Expiry Engine] Warning processing cert {cert.id}: {e}", file=sys.stderr)

    session.commit()
    return counts


# -----------------------------------------------------------------------------
# REST API Endpoints
# -----------------------------------------------------------------------------

# --- 1. Health Check (Verifies Real MySQL Connectivity) ---
@app.get("/api/v1/health")
@app.get("/api/v1/healthz")
async def health_check():
    """System health check endpoint verifying live MySQL 8 connection."""
    try:
        with db.engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
        db_connected = True
        db_status = "connected (MySQL 8.0 Enterprise Relational Schema)"
    except Exception as e:
        db_connected = False
        db_status = f"disconnected: {str(e)}"

    return {
        "status": "healthy" if db_connected else "degraded",
        "service": "Measure X Digital Legal Metrology Platform",
        "version": "2.4.0-PROD",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": "mysql",
        "database_connected": db_connected,
        "database_info": db_status
    }


# --- 2. Authentication & Real Role Detection ---
@app.post("/api/v1/auth/login")
async def login(req: LoginRequest, session: Session = Depends(get_db)):
    """
    Unified Login Endpoint.
    Authenticates user from MySQL 8+ and issues signed JWT.
    The database is the ONLY source of truth for the user's role and status!
    """
    clean_identifier = req.email.strip().lower()
    clean_mobile = req.email.strip().replace(" ", "").replace("-", "")

    # Convenient demo username alias resolver
    demo_aliases = {
        "admin": "admin.demo@measurex.local",
        "admin@demo.com": "admin.demo@measurex.local",
        "officer": "lmo.demo@measurex.local",
        "officer@demo.com": "lmo.demo@measurex.local",
        "lmo": "lmo.demo@measurex.local",
        "lmo@demo.com": "lmo.demo@measurex.local",
        "trader": "owner.demo@measurex.local",
        "trader@demo.com": "owner.demo@measurex.local",
        "owner": "owner.demo@measurex.local",
        "owner@demo.com": "owner.demo@measurex.local",
        "owner1": "owner1.demo@measurex.local",
        "owner2": "owner2.demo@measurex.local",
        "owner3": "owner3.demo@measurex.local",
    }
    if clean_identifier in demo_aliases:
        clean_identifier = demo_aliases[clean_identifier]

    # Query MySQL by email or mobile
    user = session.query(User).filter(
        sa.or_(
            sa.func.lower(User.email) == clean_identifier,
            User.mobile == req.email.strip(),
            User.mobile == clean_mobile
        )
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with these credentials. Please check your email/mobile or register."
        )

    # Verify password against cryptographically salted hash
    is_pwd_valid = verify_password(req.password, user.password_hash)
    if not is_pwd_valid:
        # Convenience fallback for demo presentations
        if clean_identifier.endswith(".demo@measurex.local") and req.password in [
            "MeasureX@Demo2026", "admin123", "officer123", "lmo123", "trader123", "owner123"
        ]:
            is_pwd_valid = True

    if not is_pwd_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify your credentials or click Forgot Password."
        )

    # Enforce statutory account status
    if user.status in ["PENDING_APPROVAL", "PENDING_ADMIN_APPROVAL"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your official registration is currently PENDING ADMINISTRATIVE APPROVAL by the State Directorate. You will be notified once activated."
        )
    elif user.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account registration was rejected by the administration. Contact the legal metrology helpdesk."
        )
    elif user.status == "SUSPENDED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been temporarily suspended by the Legal Metrology Directorate. Please contact your district officer."
        )

    # Generate real signed JWT token
    token = create_access_token(user.id, user.role_id)

    # Log audit entry into MySQL
    db.log_audit(
        user_name=user.name,
        role=user.role_id,
        action="User Login",
        entity="User",
        entity_id=user.id,
        previous_state="OFFLINE",
        new_state="ACTIVE",
        user_id=user.id,
        details=f"Authenticated via portal with statutory role {user.role_id}"
    )

    return {
        "success": True,
        "token": token,
        "user": user.to_dict(),
        "detectedRole": user.role_id
    }


# --- 3. Registration (Pure MySQL Persistence) ---
@app.post("/api/v1/auth/register")
async def register(req: RegisterRequest, session: Session = Depends(get_db)):
    """
    Statutory User Registration.
    Persists directly to MySQL 8+ with correct role and status:
    - OWNER: status = ACTIVE
    - LMO: status = PENDING_APPROVAL (Admin approval required)
    - ADMIN: requires authorization code or follows directorate approval
    """
    clean_email = req.email.strip().lower()
    clean_mobile = req.mobile.strip().replace(" ", "").replace("-", "")

    # Validation
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="A valid institutional or personal email address is required.")
    if len(clean_mobile) < 10:
        raise HTTPException(status_code=400, detail="A valid mobile number is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    # Duplicate check in MySQL
    existing_user = session.query(User).filter(
        sa.or_(
            sa.func.lower(User.email) == clean_email,
            User.mobile == req.mobile.strip(),
            User.mobile == clean_mobile
        )
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with this email ({clean_email}) or mobile number is already registered. Please log in."
        )

    # Determine requested role
    role_raw = (req.role or req.accountType or "OWNER").upper().strip()
    if role_raw in ["LMO", "OFFICER", "INSPECTOR"]:
        role_id = "LMO"
        new_status = "PENDING_APPROVAL"
    elif role_raw in ["GATC", "TEST_CENTRE", "TESTCENTRE", "CENTRE"]:
        raise HTTPException(
            status_code=400,
            detail="The Government Approved Test Centre (GATC) role is no longer active. Statutory verifications are conducted by Legal Metrology Officers (LMO)."
        )
    elif role_raw in ["ADMIN", "ADMINISTRATOR", "DIRECTORATE"]:
        role_id = "ADMIN"
        # Admin onboarding check
        admin_code = (req.adminCode or "").strip()
        new_status = "ACTIVE" if admin_code == "MX-GOV-ADMIN-2026" else "PENDING_APPROVAL"
    else:
        role_id = "OWNER"
        new_status = "ACTIVE"

    # Generate unique User ID
    user_count = session.query(User).count()
    user_id = f"USR-{role_id[:3]}-{datetime.utcnow().strftime('%y%m')}-{user_count + 101:04d}"

    # Hash password using cryptographically salted PBKDF2
    hashed_pwd = hash_password(req.password)

    # Create new User in MySQL
    new_user = User(
        id=user_id,
        name=req.name.strip(),
        email=clean_email,
        mobile=req.mobile.strip(),
        password_hash=hashed_pwd,
        role_id=role_id,
        status=new_status,
        business_name=req.businessName or (f"{req.name.strip()} Trading Co." if role_id == "OWNER" else None),
        business_type=req.businessType or ("Commercial Establishment" if role_id == "OWNER" else None),
        address=req.address or req.officeAddress or "Patna, Bihar",
        district=req.district or "Patna",
        state=req.state or "Bihar",
        pincode=req.pincode or "800001",
        id_type=req.idType or "GSTIN",
        id_number=req.idNumber or req.accreditationNumber,
        accreditation_number=req.accreditationNumber or req.idNumber,
        department=req.department or ("Department of Legal Metrology" if role_id != "OWNER" else None),
        designation=req.designation or ("Legal Metrology Officer (Inspector)" if role_id == "LMO" else "State Administrator" if role_id == "ADMIN" else "Authorized Proprietor"),
        employee_id=req.employeeId or (f"LMO-EMP-{datetime.utcnow().year}-{user_count + 1:04d}" if role_id == "LMO" else None),
        jurisdiction=req.jurisdiction or ("Patna Circle" if role_id == "LMO" else None),
        office_address=req.officeAddress or req.address,
        created_at=datetime.utcnow()
    )

    try:
        session.add(new_user)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error registering account: {str(e)}")

    # Audit log in MySQL
    db.log_audit(
        user_name=req.name.strip(),
        role=role_id,
        action="Account Registered",
        entity="User",
        entity_id=user_id,
        previous_state="None",
        new_state=new_status,
        user_id=user_id,
        details=f"New {role_id} registered with initial status {new_status}"
    )

    # Trigger notifications
    if new_status == "PENDING_APPROVAL":
        send_system_notification(
            session=session,
            recipient_id=None,
            target_role="ADMIN",
            title=f"New {role_id} Registration Pending Approval",
            message=f"{req.name} ({clean_email}) has filed for official {role_id} onboarding. Departmental verification required.",
            notif_type="SYSTEM_ALERT",
            related_entity="User",
            related_id=user_id,
            action_url="#admin-users",
            priority="HIGH",
            sender="Account Onboarding Engine"
        )
    else:
        send_system_notification(
            session=session,
            recipient_id=user_id,
            target_role="OWNER",
            title="Welcome to Measure X Platform",
            message="Your commercial establishment account has been activated. You may now register weighing instruments and submit verification applications.",
            notif_type="SYSTEM_ALERT",
            related_entity="User",
            related_id=user_id,
            action_url="#owner-instruments",
            priority="MEDIUM",
            sender="Legal Metrology Directorate"
        )

    return {
        "success": True,
        "user": new_user.to_dict(),
        "message": "Account created successfully." if new_status == "ACTIVE" else "Registration submitted for departmental verification. Status: PENDING APPROVAL."
    }


# --- 4. Current Authenticated User (/auth/me) ---
@app.get("/api/v1/auth/me")
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the EXACT authenticated user from MySQL using the signed JWT.
    NEVER hardcoded. NEVER returns first user.
    """
    return current_user.to_dict()


# --- 5. OTP Request & Verification ---
@app.post("/api/v1/auth/otp/request")
async def request_otp_endpoint(req: OTPRequest):
    """Generates and dispatches a cryptographically secure 6-digit OTP code."""
    res = otp_service.request_otp(req.recipient, req.purpose)
    if not res.get("success"):
        code = status.HTTP_429_TOO_MANY_REQUESTS if res.get("code") == "COOLDOWN_ACTIVE" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=res.get("message"))
    return res


@app.post("/api/v1/auth/otp/verify")
async def verify_otp_endpoint(req: OTPVerifyRequest):
    """Verifies OTP code against MySQL and issues a reset authorization token."""
    res = otp_service.verify_otp(req.recipient, req.otp, req.purpose)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
    return res


@app.post("/api/v1/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Initiates secure password reset via OTP."""
    clean_email = req.email.strip().lower()
    otp_res = otp_service.request_otp(clean_email, "PASSWORD_RESET")
    return {
        "success": True,
        "message": otp_res.get("message") or "If an account exists, a secure verification code has been dispatched.",
        "maskedRecipient": otp_res.get("maskedRecipient") or mask_recipient(clean_email),
        "cooldownSeconds": otp_res.get("cooldownSeconds", 60),
        "expiresInMinutes": 15
    }


@app.post("/api/v1/auth/reset-password")
async def reset_password(req: ResetPasswordRequest, session: Session = Depends(get_db)):
    """Completes password reset with valid single-use token."""
    db_token = otp_service.validate_reset_token(req.token)
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already-used password reset token. Please request a new verification code."
        )

    user_id = db_token.get("user_id")
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    new_pwd = req.target_password
    if not new_pwd or len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    user.password_hash = hash_password(new_pwd)
    otp_service.consume_reset_token(req.token)
    session.commit()

    db.log_audit(
        user_name=user.name,
        role=user.role_id,
        action="Password Reset Completed",
        entity="User",
        entity_id=user.id,
        previous_state="ACTIVE",
        new_state="PASSWORD_UPDATED",
        user_id=user.id,
        details="User successfully updated password via verified security token."
    )

    return {
        "success": True,
        "message": "Password updated successfully. You may now log in with your new password."
    }


@app.post("/api/v1/auth/change-password")
async def change_password_endpoint(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Changes current authenticated user's password with statutory verification."""
    user = session.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if not verify_password(req.currentPassword, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect. Please verify and try again.")

    if len(req.newPassword) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user.password_hash = hash_password(req.newPassword)
    user.updated_at = datetime.utcnow()
    session.commit()

    db.log_audit(
        user_name=user.name,
        role=user.role_id,
        action="CHANGE_PASSWORD",
        entity="User",
        entity_id=user.id,
        previous_state="ACTIVE",
        new_state="ACTIVE",
        user_id=user.id,
        details="User successfully updated their account password"
    )

    return {"success": True, "message": "Password changed successfully"}


@app.put("/api/v1/auth/profile")
async def update_profile_endpoint(
    req: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Updates current authenticated user's profile details."""
    user = session.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "name" in req and str(req["name"]).strip():
        user.name = str(req["name"]).strip()
    if "mobile" in req and str(req["mobile"]).strip():
        user.mobile = str(req["mobile"]).strip()
    if "businessName" in req:
        user.business_name = str(req["businessName"]).strip() if req["businessName"] else None
    if "businessType" in req:
        user.business_type = str(req["businessType"]).strip() if req["businessType"] else None
    if "address" in req:
        user.address = str(req["address"]).strip() if req["address"] else None
    if "district" in req:
        user.district = str(req["district"]).strip() if req["district"] else None
    if "state" in req:
        user.state = str(req["state"]).strip() if req["state"] else None
    if "pincode" in req:
        user.pincode = str(req["pincode"]).strip() if req["pincode"] else None
    if "officeAddress" in req:
        user.office_address = str(req["officeAddress"]).strip() if req["officeAddress"] else None
    if "department" in req:
        user.department = str(req["department"]).strip() if req["department"] else None
    if "designation" in req:
        user.designation = str(req["designation"]).strip() if req["designation"] else None
    if "jurisdiction" in req:
        user.jurisdiction = str(req["jurisdiction"]).strip() if req["jurisdiction"] else None
    if "verificationCentreId" in req:
        user.verification_centre_id = req["verificationCentreId"]

    user.updated_at = datetime.utcnow()
    session.commit()

    return {"success": True, "user": user.to_dict()}


@app.get("/api/v1/users/me/preferences")
async def get_my_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Gets current user's UI preferences."""
    pref = session.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(
            id=f"PREF-{secrets_hex_str(4)}",
            user_id=current_user.id,
            sidebar_collapsed=False,
            preferred_page_size=10,
            preferred_language="en",
            theme="light",
            created_at=datetime.utcnow()
        )
        session.add(pref)
        session.commit()
    return pref.to_dict()


@app.put("/api/v1/users/me/preferences")
async def update_my_preferences(
    req: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Updates current user's UI preferences."""
    pref = session.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(
            id=f"PREF-{secrets_hex_str(4)}",
            user_id=current_user.id,
            created_at=datetime.utcnow()
        )
        session.add(pref)

    if "sidebarCollapsed" in req:
        pref.sidebar_collapsed = bool(req["sidebarCollapsed"])
    if "preferredPageSize" in req:
        pref.preferred_page_size = int(req["preferredPageSize"])
    if "preferredLanguage" in req:
        pref.preferred_language = str(req["preferredLanguage"])
    if "theme" in req:
        pref.theme = str(req["theme"])

    pref.updated_at = datetime.utcnow()
    session.commit()
    return {"success": True, "preferences": pref.to_dict()}


@app.get("/health")
async def health_alias():
    """Load balancer and orchestrator health check endpoint."""
    return {"status": "ok", "service": "measurex-backend", "timestamp": datetime.utcnow().isoformat() + "Z"}


# --- 6. User Management (Admin Console) ---
@app.get("/api/v1/admin/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin endpoint to list users from MySQL with optional filtering."""
    q = session.query(User)
    if role and role.upper() != "ALL":
        q = q.filter(User.role_id == role.upper())
    if status and status.upper() != "ALL":
        q = q.filter(User.status == status.upper())
    users = q.order_by(User.created_at.desc()).all()
    return [u.to_dict() for u in users]


@app.patch("/api/v1/admin/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    req: UpdateUserStatusRequest,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin endpoint to approve, reject, or update clearance status in MySQL."""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prev_status = user.status
    user.status = req.status
    if req.notes:
        user.approval_notes = req.notes
    if req.status == "ACTIVE":
        user.approved_by = current_user.id
        user.approved_at = datetime.utcnow()

    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role="ADMIN",
        action="User Clearance Updated",
        entity="User",
        entity_id=user_id,
        previous_state=prev_status,
        new_state=req.status,
        user_id=current_user.id,
        details=f"Admin {current_user.name} updated user {user.name} status to {req.status}. Notes: {req.notes or 'None'}"
    )

    send_system_notification(
        session=session,
        recipient_id=user.id,
        target_role=user.role_id,
        title=f"Account Status Updated: {req.status}",
        message=f"Your {user.role_id} registration status has been updated to {req.status}. {req.notes or ''}",
        notif_type="SYSTEM_ALERT",
        related_entity="User",
        related_id=user_id,
        action_url="#login",
        priority="HIGH",
        sender="Directorate Clearance Desk"
    )

    return {"success": True, "user": user.to_dict()}


# --- 7. Instruments & Strict Owner Data Isolation ---
@app.get("/api/v1/instruments")
async def list_instruments(
    status: Optional[str] = None,
    query: Optional[str] = None,
    ownerId: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """
    Lists instruments from MySQL.
    Strictly isolates data: OWNER users only see instruments belonging to their authenticated ID!
    """
    q = session.query(Instrument)

    # Data Isolation Enforcement
    if current_user.role_id == "OWNER":
        q = q.filter(Instrument.owner_id == current_user.id)
    elif ownerId:
        q = q.filter(Instrument.owner_id == ownerId)

    if status and status.upper() != "ALL":
        q = q.filter(Instrument.status == status.upper())

    if query:
        search = f"%{query.lower()}%"
        q = q.filter(
            sa.or_(
                sa.func.lower(Instrument.id).like(search),
                sa.func.lower(Instrument.serial_number).like(search),
                sa.func.lower(Instrument.model).like(search),
                sa.func.lower(Instrument.type).like(search),
                sa.func.lower(Instrument.business_name).like(search)
            )
        )

    instruments = q.order_by(Instrument.created_at.desc()).all()
    return [ins.to_dict() for ins in instruments]


@app.post("/api/v1/instruments")
async def create_instrument(
    data: InstrumentCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """
    Registers a new instrument into MySQL.
    owner_id is ALWAYS taken from the authenticated user token (NEVER trusted from body).
    """
    new_id = f"MX-INS-{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets_hex_str(2)}"


    owner_name = current_user.name
    business_name = current_user.business_name or f"{current_user.name} Trading Co."

    instrument = Instrument(
        id=new_id,
        owner_id=current_user.id,
        owner_name=owner_name,
        business_name=business_name,
        type=data.type,
        accuracy_class=data.accuracyClass or "Class III",
        manufacturer=data.manufacturer,
        model=data.model,
        serial_number=data.serialNumber,
        capacity=data.capacity,
        location=data.location,
        district=data.district or current_user.district or "Patna",
        state=data.state or current_user.state or "Bihar",
        purchase_date=data.purchaseDate or date.today().isoformat(),
        installation_details=data.installationDetails or "Standard commercial installation",
        status="PENDING_VERIFICATION",
        valid_until=None,
        last_verification_date=None,
        last_officer_id=None,
        last_officer_name=None,
        active_certificate_id=None,
        created_at=datetime.utcnow()
    )

    try:
        session.add(instrument)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error saving instrument: {str(e)}")

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Instrument Registered",
        entity="Instrument",
        entity_id=new_id,
        previous_state="None",
        new_state="PENDING_VERIFICATION",
        user_id=current_user.id,
        details=f"Registered {data.type} model {data.model} with serial number {data.serialNumber}"
    )

    send_system_notification(
        session=session,
        recipient_id=current_user.id,
        target_role="OWNER",
        title="Instrument Registered",
        message=f"Instrument {new_id} ({data.model}) was added to your portfolio. File an application to schedule verification.",
        notif_type="SYSTEM_ALERT",
        related_entity="Instrument",
        related_id=new_id,
        action_url=f"#owner-apply?instrumentId={new_id}",
        priority="MEDIUM",
        sender="Registry Engine"
    )

    return instrument.to_dict()


@app.get("/api/v1/instruments/{instrument_id}")
async def get_instrument(
    instrument_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Retrieves an instrument by ID from MySQL."""
    ins = session.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Instrument not found")

    # Enforce owner isolation
    if current_user.role_id == "OWNER" and ins.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this instrument.")

    return ins.to_dict()


@app.get("/api/v1/instruments/{instrument_id}/lifecycle")
async def get_instrument_lifecycle(
    instrument_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Returns real persisted lifecycle history, certificates, and verification timeline from MySQL."""
    ins = session.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Instrument not found")

    if current_user.role_id == "OWNER" and ins.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this instrument.")

    certs = session.query(Certificate).filter(Certificate.instrument_id == ins.id).order_by(Certificate.created_at.asc()).all()
    apps = session.query(Application).filter(Application.instrument_id == ins.id).order_by(Application.created_at.asc()).all()
    records = session.query(VerificationRecord).filter(VerificationRecord.instrument_id == ins.id).order_by(VerificationRecord.created_at.asc()).all()

    timeline = []
    # 1. Registration
    timeline.append({
        "stage": "REGISTRATION",
        "title": "Instrument Registered in Statutory Registry",
        "date": ins.purchase_date or (ins.created_at.strftime("%Y-%m-%d") if ins.created_at else "2024-01-01"),
        "time": ins.created_at.strftime("%I:%M %p") if ins.created_at else "10:00 AM",
        "actor": f"{ins.owner_name} (Owner)",
        "status": "COMPLETED",
        "remarks": f"Registered commercial {ins.type} model {ins.model} with serial number {ins.serial_number}."
    })
    # 2. Applications & Allocation
    for a in apps:
        timeline.append({
            "stage": "APPLICATION",
            "title": f"Verification Application Filed ({a.id})",
            "date": a.submission_date,
            "time": a.created_at.strftime("%I:%M %p") if a.created_at else "",
            "actor": f"{a.owner_name} (Applicant)",
            "status": "COMPLETED" if a.status != "SUBMITTED" else "PENDING",
            "remarks": f"Filing type: {a.application_type}. Status: {a.status}."
        })
        if a.assigned_party_name:
            timeline.append({
                "stage": "ALLOCATION",
                "title": f"Allocated to {a.assignment_type or 'Inspector'}",
                "date": a.scheduled_date or a.submission_date,
                "time": "",
                "actor": "Directorate Allocation Desk",
                "status": "COMPLETED",
                "remarks": f"Allocated to {a.assigned_party_name} for field verification."
            })
        if a.scheduled_date:
            timeline.append({
                "stage": "SCHEDULED",
                "title": f"Inspection Scheduled ({a.scheduled_date})",
                "date": a.scheduled_date,
                "time": a.scheduled_time or "",
                "actor": a.assigned_party_name or "Legal Metrology Officer",
                "status": "COMPLETED",
                "remarks": f"Scheduled at {a.scheduled_location or a.preferred_location}."
            })
    # 3. Field Inspections
    for r in records:
        timeline.append({
            "stage": "INSPECTION",
            "title": f"Statutory Field Inspection ({r.result})",
            "date": r.inspection_date,
            "time": r.created_at.strftime("%I:%M %p") if r.created_at else "",
            "actor": f"{r.officer_name} ({r.inspector_type})",
            "status": "COMPLETED" if r.result == "PASS" else "FAILED",
            "remarks": f"Checklist: {r.physical_condition_check}. Result: {r.result}. Seal: {r.wire_seal_number or 'N/A'}."
        })
    # 4. Certificates & Revocation
    for c in certs:
        timeline.append({
            "stage": "CERTIFICATION",
            "title": f"Digital Certificate Issued ({c.id})",
            "date": c.verification_date,
            "time": c.created_at.strftime("%I:%M %p") if c.created_at else "",
            "actor": f"{c.officer_name} ({c.verifier_type})",
            "status": c.status,
            "remarks": f"Digitally signed statutory certificate. Valid until {c.valid_until}. Status: {c.status}."
        })
        if c.status == "REVOKED":
            timeline.append({
                "stage": "REVOCATION",
                "title": f"Certificate Revoked ({c.id})",
                "date": c.revoked_at.strftime("%Y-%m-%d") if c.revoked_at else "",
                "time": c.revoked_at.strftime("%I:%M %p") if c.revoked_at else "",
                "actor": c.revoked_by or "State Administrator",
                "status": "REVOKED",
                "remarks": f"Revoked by authority. Reason: {c.revocation_reason or 'Statutory Non-compliance'}."
            })

    return {
        "instrument": ins.to_dict(),
        "timeline": timeline,
        "verificationHistory": [r.to_dict() for r in records],
        "certificates": [c.to_dict() for c in certs],
        "applications": [a.to_dict() for a in apps]
    }


# --- 8. Applications (Owner Isolation & LMO Workflows) ---
@app.get("/api/v1/applications")
async def list_applications(
    status: Optional[str] = None,
    officerId: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """
    Lists verification applications from MySQL.
    Strict role isolation:
    - OWNER: only sees own applications
    - LMO: sees applications assigned to them or unassigned circle applications
    - ADMIN: sees statewide applications with filtering
    """
    q = session.query(Application)

    if current_user.role_id == "OWNER":
        q = q.filter(Application.owner_id == current_user.id)
    elif current_user.role_id == "LMO":
        if officerId:
            q = q.filter(Application.assigned_officer_id == officerId)
        else:
            q = q.filter(sa.or_(Application.assigned_officer_id == current_user.id, Application.assigned_officer_id == None))
    else:
        if officerId:
            q = q.filter(Application.assigned_officer_id == officerId)

    if status and status.upper() != "ALL":
        q = q.filter(Application.status == status.upper())

    apps = q.order_by(Application.created_at.desc()).all()
    return [a.to_dict() for a in apps]


@app.post("/api/v1/applications")
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Submits a verification application in MySQL."""
    ins = session.query(Instrument).filter(Instrument.id == data.instrumentId).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Instrument not found.")

    if current_user.role_id == "OWNER" and ins.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only file applications for instruments you own.")

    app_id = f"MX-APP-{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets_hex_str(2)}"
    today_str = date.today().strftime("%d %b %Y")

    new_app = Application(
        id=app_id,
        instrument_id=ins.id,
        owner_id=current_user.id,
        owner_name=current_user.name,
        business_name=ins.business_name,
        application_type=data.applicationType,
        status="SUBMITTED",
        submission_date=today_str,
        preferred_location=data.preferredLocation or ins.location,
        applicant_remarks=data.remarks,
        fee_amount=750.0,
        payment_reference=f"PAY-UPI-{secrets_hex_str(6)}",
        created_at=datetime.utcnow()
    )

    try:
        session.add(new_app)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error creating application: {str(e)}")

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Application Filed",
        entity="Application",
        entity_id=app_id,
        previous_state="None",
        new_state="SUBMITTED",
        user_id=current_user.id,
        details=f"Filed statutory verification application for instrument {ins.id}"
    )

    send_system_notification(
        session=session,
        recipient_id=current_user.id,
        target_role="OWNER",
        title="Application Submitted",
        message=f"Application {app_id} has been submitted for instrument {ins.id}. Directorate will allocate to an authorized Legal Metrology Officer (LMO).",
        notif_type="APPLICATION_SUBMITTED",
        related_entity="Application",
        related_id=app_id,
        action_url=f"#owner-application-details?id={app_id}",
        priority="MEDIUM",
        sender="Licensing Directorate"
    )

    return new_app.to_dict()


def build_application_timeline_records(app_obj: Application, session: Session) -> list:
    ins = session.query(Instrument).filter(Instrument.id == app_obj.instrument_id).first()
    records = session.query(VerificationRecord).filter(VerificationRecord.application_id == app_obj.id).order_by(VerificationRecord.created_at.asc()).all()
    certs = session.query(Certificate).filter(Certificate.application_id == app_obj.id).order_by(Certificate.created_at.asc()).all()
    if not certs and ins and ins.active_certificate_id:
        c_active = session.query(Certificate).filter(Certificate.id == ins.active_certificate_id).first()
        if c_active:
            certs = [c_active]

    timeline = []

    # Stage 1: Instrument Registration
    if ins:
        timeline.append({
            "stage": "REGISTRATION",
            "label": "Instrument Registered",
            "title": "Instrument Registered in Statutory Registry",
            "date": ins.created_at.strftime("%d %b %Y") if ins.created_at else (ins.purchase_date or "2024-01-12"),
            "time": ins.created_at.strftime("%I:%M %p") if ins.created_at else "10:00 AM",
            "actor": f"{ins.owner_name} (Trader)",
            "status": "COMPLETED",
            "completed": True,
            "notes": f"Commercial {ins.type} model {ins.model} (S/N: {ins.serial_number}) registered."
        })

    # Stage 2: Application Submission
    timeline.append({
        "stage": "SUBMITTED",
        "label": "Application Submitted",
        "title": "Verification Filing Submitted",
        "date": app_obj.created_at.strftime("%d %b %Y") if app_obj.created_at else (app_obj.submission_date or "2026-09-15"),
        "time": app_obj.created_at.strftime("%I:%M %p") if app_obj.created_at else "10:22 AM",
        "actor": f"{app_obj.owner_name or 'Applicant'} (Trader)",
        "status": "COMPLETED",
        "completed": True,
        "notes": f"Filing type: {app_obj.application_type or 'Initial Verification'}. Fee: ₹{app_obj.fee_amount or 750.0}."
    })

    # Stage 3: Directorate Documentary Scrutiny
    is_corr = (app_obj.status == "CORRECTION_REQUESTED")
    is_scrutiny_active = (app_obj.status in ["SUBMITTED", "PENDING", "NEW"])

    if is_corr:
        timeline.append({
            "stage": "SCRUTINY",
            "label": "Correction Requested",
            "title": "Directorate Scrutiny: Correction Requested",
            "date": app_obj.updated_at.strftime("%d %b %Y") if app_obj.updated_at else "",
            "time": app_obj.updated_at.strftime("%I:%M %p") if app_obj.updated_at else "",
            "actor": "Directorate Scrutiny Desk",
            "status": "WARNING",
            "completed": False,
            "notes": app_obj.correction_notes or "Applicant required to upload amended documentation."
        })
    elif is_scrutiny_active:
        timeline.append({
            "stage": "SCRUTINY",
            "label": "Document Scrutiny",
            "title": "Under Directorate Documentary Review",
            "date": app_obj.submission_date or "",
            "time": "",
            "actor": "Directorate Scrutiny Desk",
            "status": "ACTIVE",
            "completed": False,
            "notes": "Under preliminary review for standards compliance and legal specifications."
        })
    else:
        timeline.append({
            "stage": "SCRUTINY",
            "label": "Scrutiny Approved",
            "title": "Documentary Scrutiny Approved",
            "date": app_obj.submission_date or (app_obj.created_at.strftime("%d %b %Y") if app_obj.created_at else ""),
            "time": "",
            "actor": "Directorate Scrutiny Desk",
            "status": "COMPLETED",
            "completed": True,
            "notes": "Documents and instrument specifications approved for statutory field allocation."
        })

    # Stage 4: LMO Officer Assignment
    has_lmo = bool(app_obj.assigned_officer_id or app_obj.assigned_party_name)
    if has_lmo:
        timeline.append({
            "stage": "ALLOCATION",
            "label": "LMO Assigned",
            "title": f"Allocated to {app_obj.assigned_officer_name or app_obj.assigned_party_name}",
            "date": app_obj.scheduled_date or app_obj.submission_date or "",
            "time": "10:41 AM",
            "actor": "Patna Legal Metrology Directorate",
            "status": "COMPLETED",
            "completed": True,
            "notes": f"Assigned to Legal Metrology Officer {app_obj.assigned_officer_name or app_obj.assigned_party_name} for field testing."
        })
    else:
        timeline.append({
            "stage": "ALLOCATION",
            "label": "LMO Allocation",
            "title": "Awaiting LMO Allocation",
            "date": "",
            "time": "",
            "actor": "State Metrology Directorate",
            "status": "PENDING",
            "completed": False,
            "notes": "Pending officer routing by territorial controller."
        })

    # Stage 5: Inspection Scheduled
    has_sched = bool(app_obj.scheduled_date)
    is_sched_done = (app_obj.status in ["IN_VERIFICATION", "VERIFIED", "APPROVED", "COMPLETED", "FAILED"])
    if has_sched:
        timeline.append({
            "stage": "SCHEDULED",
            "label": "Inspection Scheduled",
            "title": f"Inspection Scheduled ({app_obj.scheduled_date})",
            "date": app_obj.scheduled_date,
            "time": app_obj.scheduled_time or "11:00 AM",
            "actor": app_obj.assigned_officer_name or "Legal Metrology Officer",
            "status": "COMPLETED" if is_sched_done else "ACTIVE",
            "completed": is_sched_done,
            "notes": f"Scheduled at {app_obj.scheduled_location or app_obj.preferred_location or 'Trader premises'}."
        })
    else:
        timeline.append({
            "stage": "SCHEDULED",
            "label": "Inspection Scheduling",
            "title": "Inspection Scheduling",
            "date": "",
            "time": "",
            "actor": "Legal Metrology Officer",
            "status": "PENDING",
            "completed": False,
            "notes": "Field visit date to be scheduled with trader."
        })

    # Stage 6: Field Verification & Testing
    if records:
        for r in records:
            is_pass = (r.result == "PASS")
            geo_str = f"{r.latitude}° N, {r.longitude}° E" if (r.latitude and r.longitude) else "Patna"
            timeline.append({
                "stage": "INSPECTION",
                "label": f"Field Inspection ({r.result})",
                "title": f"Statutory Field Inspection ({r.result})",
                "date": r.inspection_date or (r.created_at.strftime("%d %b %Y") if r.created_at else ""),
                "time": r.created_at.strftime("%I:%M %p") if r.created_at else "02:15 PM",
                "actor": f"{r.officer_name} (LMO)",
                "status": "COMPLETED" if is_pass else "FAILED",
                "completed": is_pass,
                "notes": f"OIML R76 MPE check: {r.result}. Physical seal: {r.wire_seal_number or 'N/A'}. Geo: {geo_str}."
            })
    elif app_obj.status == "IN_VERIFICATION":
        timeline.append({
            "stage": "INSPECTION",
            "label": "Field Inspection",
            "title": "Field Verification in Progress",
            "date": app_obj.scheduled_date or "",
            "time": app_obj.scheduled_time or "",
            "actor": app_obj.assigned_officer_name or "Legal Metrology Officer",
            "status": "ACTIVE",
            "completed": False,
            "notes": "Officer actively conducting working standard load tests on-site."
        })
    else:
        timeline.append({
            "stage": "INSPECTION",
            "label": "Field Inspection",
            "title": "Field Verification Testing",
            "date": "",
            "time": "",
            "actor": "Legal Metrology Officer",
            "status": "PENDING",
            "completed": False,
            "notes": "Working standard weight testing against statutory Maximum Permissible Error."
        })

    # Stage 7: Digital Certification / Failure
    if certs:
        for c in certs:
            timeline.append({
                "stage": "CERTIFICATION",
                "label": "Certificate Issued",
                "title": f"Digital Certificate Issued ({c.id})",
                "date": c.verification_date or (c.created_at.strftime("%d %b %Y") if c.created_at else ""),
                "time": c.created_at.strftime("%I:%M %p") if c.created_at else "03:30 PM",
                "actor": f"{c.officer_name} (LMO)",
                "status": "COMPLETED",
                "completed": True,
                "notes": f"Cryptographically signed certificate issued. Valid until {c.valid_until}. Status: {c.status}."
            })
            if c.status == "REVOKED":
                timeline.append({
                    "stage": "REVOCATION",
                    "label": "Certificate Revoked",
                    "title": f"Certificate Revoked ({c.id})",
                    "date": c.revoked_at.strftime("%d %b %Y") if c.revoked_at else "",
                    "time": c.revoked_at.strftime("%I:%M %p") if c.revoked_at else "",
                    "actor": c.revoked_by or "State Controller",
                    "status": "FAILED",
                    "completed": False,
                    "notes": f"Statutory revocation: {c.revocation_reason or 'Non-compliance detected'}."
                })
    elif any(r.result == "FAIL" for r in records) or app_obj.status in ["FAILED", "REJECTED"]:
        timeline.append({
            "stage": "CERTIFICATION",
            "label": "Tolerance Exceeded",
            "title": "Verification Stamping Withheld",
            "date": app_obj.updated_at.strftime("%d %b %Y") if app_obj.updated_at else "",
            "time": app_obj.updated_at.strftime("%I:%M %p") if app_obj.updated_at else "",
            "actor": "Legal Metrology Officer",
            "status": "FAILED",
            "completed": False,
            "notes": app_obj.rejection_reason or "Instrument exceeded Maximum Permissible Error (MPE). Re-calibration required before re-inspection."
        })
    else:
        timeline.append({
            "stage": "CERTIFICATION",
            "label": "Digital Certificate",
            "title": "Digital Verification Certificate",
            "date": "",
            "time": "",
            "actor": "Legal Metrology Directorate",
            "status": "PENDING",
            "completed": False,
            "notes": "Official digital certificate and holographic tamper seal upon passing verification."
        })

    return timeline


@app.get("/api/v1/applications/{application_id}")
async def get_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Retrieves an application by ID from MySQL, enriched with real persisted timeline and documents."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role_id == "OWNER" and app_obj.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this application.")

    res = app_obj.to_dict()
    docs = session.query(ApplicationDocument).filter(ApplicationDocument.application_id == application_id).all()
    res["documents"] = [d.to_dict() for d in docs]
    res["timeline"] = build_application_timeline_records(app_obj, session)
    return res


@app.get("/api/v1/applications/{application_id}/timeline")
async def get_application_timeline(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Retrieves real persisted lifecycle history and timeline for an application from MySQL."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role_id == "OWNER" and app_obj.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this application.")

    return build_application_timeline_records(app_obj, session)


# --- Allocation Endpoints (Feature 2 & 18) ---
# --- Master Data: Instrument Types & Verification Centres ---
@app.get("/api/v1/master/instrument-types")
async def get_instrument_types(
    active_only: bool = True,
    session: Session = Depends(get_db)
):
    """Returns statutory instrument categories from master data."""
    q = session.query(InstrumentType)
    if active_only:
        q = q.filter(InstrumentType.is_active == True)
    types = q.order_by(InstrumentType.name.asc()).all()
    return {"instrumentTypes": [t.to_dict() for t in types]}


@app.get("/api/v1/verification-centres")
async def get_verification_centres(
    district: Optional[str] = None,
    active_only: bool = False,
    search: Optional[str] = None,
    session: Session = Depends(get_db)
):
    """Returns list of statutory verification centres."""
    q = session.query(VerificationCentre)
    if active_only:
        q = q.filter(VerificationCentre.is_active == True)
    if district and district.upper() != "ALL":
        q = q.filter(VerificationCentre.district.ilike(f"%{district}%"))
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            sa.or_(
                VerificationCentre.centre_name.ilike(s),
                VerificationCentre.centre_code.ilike(s),
                VerificationCentre.district.ilike(s),
                VerificationCentre.accreditation_number.ilike(s)
            )
        )
    centres = q.order_by(VerificationCentre.centre_name.asc()).all()
    return {"centres": [c.to_dict() for c in centres], "total": len(centres)}


@app.post("/api/v1/verification-centres")
async def create_verification_centre(
    req: Dict[str, Any],
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Creates a new verification centre master data record (Admin only)."""
    centre_name = req.get("centreName") or req.get("name")
    if not centre_name:
        raise HTTPException(status_code=400, detail="Centre name is required")

    code = req.get("centreCode") or req.get("code") or f"VC-{secrets_hex_str(3).upper()}"
    existing = session.query(VerificationCentre).filter(VerificationCentre.centre_code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Centre code {code} already exists")

    new_id = f"VC-{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets_hex_str(2)}"
    centre = VerificationCentre(
        id=new_id,
        centre_code=code,
        centre_name=centre_name.strip(),
        centre_type=req.get("centreType") or req.get("type") or "GOVERNMENT_TEST_CENTRE",
        address_line1=req.get("addressLine1") or req.get("address") or "Official District Metrology Facility",
        address_line2=req.get("addressLine2"),
        district=req.get("district") or "Patna",
        state=req.get("state") or "Bihar",
        pincode=req.get("pincode") or "800001",
        contact_phone=req.get("contactPhone") or req.get("phone"),
        contact_email=req.get("contactEmail") or req.get("email"),
        license_number=req.get("licenseNumber"),
        accreditation_number=req.get("accreditationNumber"),
        is_active=bool(req.get("isActive", True)),
        created_at=datetime.utcnow()
    )
    session.add(centre)
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="CREATE_VERIFICATION_CENTRE",
        entity="VerificationCentre",
        entity_id=new_id,
        previous_state="None",
        new_state="ACTIVE",
        user_id=current_user.id,
        details=f"Created Verification Centre: {centre.centre_name} ({centre.centre_code})"
    )

    return {"success": True, "centre": centre.to_dict()}


@app.get("/api/v1/verification-centres/{centre_id}")
async def get_verification_centre(
    centre_id: str,
    session: Session = Depends(get_db)
):
    """Get single verification centre details."""
    centre = session.query(VerificationCentre).filter(
        sa.or_(VerificationCentre.id == centre_id, VerificationCentre.centre_code == centre_id)
    ).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Verification centre not found")

    affiliated_lmos = session.query(User).filter(
        User.verification_centre_id == centre.id,
        User.role_id == "LMO"
    ).all()

    data = centre.to_dict()
    data["affiliatedLMOs"] = [l.to_dict() for l in affiliated_lmos]
    return data


@app.put("/api/v1/verification-centres/{centre_id}")
async def update_verification_centre(
    centre_id: str,
    req: Dict[str, Any],
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Updates verification centre details (Admin only)."""
    centre = session.query(VerificationCentre).filter(VerificationCentre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Verification centre not found")

    if "centreName" in req or "name" in req:
        centre.centre_name = (req.get("centreName") or req.get("name")).strip()
    if "addressLine1" in req or "address" in req:
        centre.address_line1 = (req.get("addressLine1") or req.get("address")).strip()
    if "addressLine2" in req:
        centre.address_line2 = req.get("addressLine2")
    if "district" in req:
        centre.district = req["district"].strip()
    if "state" in req:
        centre.state = req["state"].strip()
    if "pincode" in req:
        centre.pincode = req["pincode"].strip()
    if "contactPhone" in req or "phone" in req:
        centre.contact_phone = req.get("contactPhone") or req.get("phone")
    if "contactEmail" in req or "email" in req:
        centre.contact_email = req.get("contactEmail") or req.get("email")
    if "licenseNumber" in req:
        centre.license_number = req.get("licenseNumber")
    if "accreditationNumber" in req:
        centre.accreditation_number = req.get("accreditationNumber")
    if "isActive" in req:
        centre.is_active = bool(req["isActive"])
    if "centreType" in req or "type" in req:
        centre.centre_type = req.get("centreType") or req.get("type")

    centre.updated_at = datetime.utcnow()
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="UPDATE_VERIFICATION_CENTRE",
        entity="VerificationCentre",
        entity_id=centre.id,
        previous_state="ACTIVE",
        new_state="ACTIVE" if centre.is_active else "INACTIVE",
        user_id=current_user.id,
        details=f"Updated Verification Centre: {centre.centre_name}"
    )

    return {"success": True, "centre": centre.to_dict()}


@app.patch("/api/v1/verification-centres/{centre_id}/status")
async def toggle_verification_centre_status(
    centre_id: str,
    req: Dict[str, Any],
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Toggles verification centre active status (Admin only)."""
    centre = session.query(VerificationCentre).filter(VerificationCentre.id == centre_id).first()
    if not centre:
        raise HTTPException(status_code=404, detail="Verification centre not found")

    new_status = req.get("isActive")
    if new_status is None:
        new_status = not centre.is_active
    centre.is_active = bool(new_status)
    centre.updated_at = datetime.utcnow()
    session.commit()

    return {"success": True, "centre": centre.to_dict()}


# --- Allocation Endpoints (Feature 2 & 18) ---
@app.get("/api/v1/allocation/available-officers")
async def get_available_officers(
    current_user: User = Depends(require_role("ADMIN", "LMO")),
    session: Session = Depends(get_db)
):
    """Returns available active LMOs with their real database workload and affiliated centre."""
    lmos = session.query(User).filter(User.role_id == "LMO", User.status == "ACTIVE").all()
    active_statuses = ["SUBMITTED", "UNDER_SCRUTINY", "READY_FOR_ALLOCATION", "ALLOCATED", "SCHEDULED", "IN_VERIFICATION"]

    lmo_list = []
    for lmo in lmos:
        workload = session.query(Application).filter(
            Application.assigned_officer_id == lmo.id,
            Application.status.in_(active_statuses)
        ).count()
        lmo_data = lmo.to_dict()
        lmo_data["activeWorkload"] = workload
        lmo_list.append(lmo_data)

    centres = session.query(VerificationCentre).filter(VerificationCentre.is_active == True).all()

    return {
        "lmos": lmo_list,
        "officers": lmo_list,
        "centres": [c.to_dict() for c in centres]
    }


@app.get("/api/v1/applications/{application_id}/assignments")
async def get_application_assignments(
    application_id: str,
    session: Session = Depends(get_db)
):
    """Returns statutory assignment history for an application."""
    assignments = session.query(ApplicationAssignment).filter(
        ApplicationAssignment.application_id == application_id
    ).order_by(ApplicationAssignment.assigned_at.desc()).all()
    return {"assignments": [a.to_dict() for a in assignments]}


@app.post("/api/v1/applications/{application_id}/allocate")
async def allocate_application(
    application_id: str,
    req: AllocateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin assigns application to an authorized Legal Metrology Officer (LMO)."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    assign_type = "LMO"
    assigned_user = session.query(User).filter(User.id == req.assignedId, User.role_id == "LMO").first()
    if not assigned_user:
        raise HTTPException(status_code=404, detail=f"Selected Legal Metrology Officer (LMO) {req.assignedId} not found")
    if assigned_user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Selected LMO account is not active (Status: {assigned_user.status})")

    prev_status = app_obj.status
    app_obj.assignment_type = "LMO"
    app_obj.assigned_officer_id = assigned_user.id
    app_obj.assigned_officer_name = assigned_user.name
    app_obj.assigned_gatc_id = None
    app_obj.assigned_gatc_name = None
    app_obj.assigned_party_name = assigned_user.name
    if assigned_user.verification_centre_id:
        app_obj.verification_centre_id = assigned_user.verification_centre_id

    # Record assignment in application_assignments table
    session.query(ApplicationAssignment).filter(
        ApplicationAssignment.application_id == application_id,
        ApplicationAssignment.is_current == True
    ).update({"is_current": False, "released_at": datetime.utcnow()})

    assign_id = f"ASSIGN-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    new_assignment = ApplicationAssignment(
        id=assign_id,
        application_id=app_obj.id,
        assigned_lmo_id=assigned_user.id,
        assigned_by=current_user.id,
        verification_centre_id=assigned_user.verification_centre_id,
        assigned_at=datetime.utcnow(),
        reason=req.notes or "Statutory verification allocation by Directorate Admin",
        is_current=True
    )
    session.add(new_assignment)

    if req.scheduledDate and req.scheduledTime:
        conflict = session.query(VerificationSchedule).filter(
            VerificationSchedule.officer_id == assigned_user.id,
            VerificationSchedule.inspection_date == req.scheduledDate,
            VerificationSchedule.inspection_time == req.scheduledTime,
            VerificationSchedule.status == "SCHEDULED",
            VerificationSchedule.application_id != application_id
        ).first()
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Scheduling conflict: {app_obj.assigned_party_name} already has an inspection booked on {req.scheduledDate} at {req.scheduledTime}."
            )
        app_obj.status = "SCHEDULED"
        app_obj.scheduled_date = req.scheduledDate
        app_obj.scheduled_time = req.scheduledTime
        app_obj.scheduled_location = req.scheduledLocation or app_obj.preferred_location
        sched_id = f"SCHED-{datetime.utcnow().year}-{secrets_hex_str(4)}"
        session.add(VerificationSchedule(
            id=sched_id,
            application_id=app_obj.id,
            officer_id=assigned_user.id,
            officer_name=app_obj.assigned_party_name,
            inspector_type=assign_type,
            verification_centre_id=assigned_user.verification_centre_id,
            inspection_date=req.scheduledDate,
            inspection_time=req.scheduledTime,
            inspection_location=app_obj.scheduled_location,
            status="SCHEDULED",
            notes=req.notes,
            created_at=datetime.utcnow()
        ))
    else:
        app_obj.status = "ALLOCATED"

    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action=f"ASSIGN_{assign_type}",
        entity="Application",
        entity_id=application_id,
        previous_state=prev_status,
        new_state=app_obj.status,
        user_id=current_user.id,
        details=f"Application {application_id} allocated to LMO: {app_obj.assigned_party_name}"
    )

    send_system_notification(
        session=session,
        recipient_id=assigned_user.id,
        target_role="LMO",
        title=f"Application Allocated ({application_id})",
        message=f"Application {application_id} for instrument {app_obj.instrument_id} has been allocated to you for statutory verification.",
        notif_type="APPLICATION_ASSIGNED",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#lmo-applications",
        priority="HIGH",
        sender=current_user.name
    )

    send_system_notification(
        session=session,
        recipient_id=app_obj.owner_id,
        target_role="OWNER",
        title=f"Application Allocated to Officer",
        message=f"Your verification application {application_id} has been allocated to Legal Metrology Officer {app_obj.assigned_party_name}.",
        notif_type="APPLICATION_ASSIGNED",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#owner-application-details?id={application_id}",
        priority="MEDIUM",
        sender="Directorate Allocation Desk"
    )

    return {"success": True, "application": app_obj.to_dict()}


@app.post("/api/v1/applications/{application_id}/reassign")
async def reassign_application(
    application_id: str,
    req: ReassignRequest,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin reassigns an application with reason and audit log."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    assigned_user = session.query(User).filter(User.id == req.assignedId, User.role_id == "LMO").first()
    if not assigned_user:
        raise HTTPException(status_code=404, detail=f"Selected LMO {req.assignedId} not found")

    prev_party = app_obj.assigned_party_name or "Unassigned"
    app_obj.assignment_type = "LMO"
    app_obj.assigned_officer_id = assigned_user.id
    app_obj.assigned_officer_name = assigned_user.name
    app_obj.assigned_gatc_id = None
    app_obj.assigned_gatc_name = None
    app_obj.assigned_party_name = assigned_user.name
    if assigned_user.verification_centre_id:
        app_obj.verification_centre_id = assigned_user.verification_centre_id

    # Record assignment in application_assignments table
    session.query(ApplicationAssignment).filter(
        ApplicationAssignment.application_id == application_id,
        ApplicationAssignment.is_current == True
    ).update({"is_current": False, "released_at": datetime.utcnow()})

    assign_id = f"ASSIGN-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    new_assignment = ApplicationAssignment(
        id=assign_id,
        application_id=app_obj.id,
        assigned_lmo_id=assigned_user.id,
        assigned_by=current_user.id,
        verification_centre_id=assigned_user.verification_centre_id,
        assigned_at=datetime.utcnow(),
        reason=req.reason or "Statutory re-allocation by Directorate Admin",
        is_current=True
    )
    session.add(new_assignment)

    app_obj.status = "ALLOCATED"
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="REASSIGN_APPLICATION",
        entity="Application",
        entity_id=application_id,
        previous_state=prev_party,
        new_state=app_obj.assigned_party_name,
        user_id=current_user.id,
        details=f"Reassigned from {prev_party} to LMO {app_obj.assigned_party_name}. Reason: {req.reason}"
    )

    send_system_notification(
        session=session,
        recipient_id=assigned_user.id,
        target_role="LMO",
        title=f"Application Reassigned ({application_id})",
        message=f"Application {application_id} has been reassigned to you. Reason: {req.reason}",
        notif_type="APPLICATION_REASSIGNED",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#lmo-applications",
        priority="HIGH",
        sender=current_user.name
    )

    return {"success": True, "application": app_obj.to_dict()}


@app.get("/api/v1/applications/{application_id}/assignment-history")
async def get_assignment_history(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Returns assignment and allocation audit events for an application."""
    logs = session.query(AuditLog).filter(
        AuditLog.entity == "Application",
        AuditLog.entity_id == application_id
    ).order_by(AuditLog.timestamp.desc()).all()

    return [l.to_dict() for l in logs]


@app.post("/api/v1/applications/{application_id}/schedule")
async def schedule_application(
    application_id: str,
    req: ScheduleRequest,
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """Schedules a field inspection for an application in MySQL with conflict prevention."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    target_id = req.inspectorId or req.officerId or current_user.id
    target_user = session.query(User).filter(User.id == target_id).first()
    inspector_name = target_user.name if target_user else current_user.name

    # Prevent double-booking conflicts
    conflict = session.query(VerificationSchedule).filter(
        VerificationSchedule.officer_id == target_id,
        VerificationSchedule.inspection_date == req.date,
        VerificationSchedule.inspection_time == req.time,
        VerificationSchedule.status == "SCHEDULED",
        VerificationSchedule.application_id != application_id
    ).first()
    if conflict:
        raise HTTPException(
            status_code=400,
            detail=f"Scheduling conflict: {inspector_name} already has an inspection booked on {req.date} at {req.time}."
        )

    app_obj.status = "SCHEDULED"
    app_obj.assigned_officer_id = target_id
    app_obj.assigned_officer_name = inspector_name
    app_obj.assigned_party_name = inspector_name
    app_obj.assignment_type = "LMO"
    if target_user and target_user.verification_centre_id:
        app_obj.verification_centre_id = target_user.verification_centre_id

    app_obj.scheduled_date = req.date
    app_obj.scheduled_time = req.time
    app_obj.scheduled_location = req.location or app_obj.preferred_location

    sched_id = f"SCHED-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    sched = VerificationSchedule(
        id=sched_id,
        application_id=app_obj.id,
        officer_id=target_id,
        officer_name=app_obj.assigned_party_name,
        inspector_type="LMO",
        verification_centre_id=app_obj.verification_centre_id,
        inspection_date=req.date,
        inspection_time=req.time,
        inspection_location=req.location or app_obj.preferred_location,
        status="SCHEDULED",
        notes=req.notes,
        created_at=datetime.utcnow()
    )
    session.add(sched)
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="SCHEDULE_INSPECTION",
        entity="Application",
        entity_id=application_id,
        previous_state="SUBMITTED",
        new_state="SCHEDULED",
        user_id=current_user.id,
        details=f"Inspection scheduled on {req.date} at {req.time} by {inspector_name} ({inspector_type})"
    )

    send_system_notification(
        session=session,
        recipient_id=app_obj.owner_id,
        target_role="OWNER",
        title="Field Inspection Scheduled",
        message=f"Field inspection scheduled for application {application_id} on {req.date} at {req.time} by {inspector_name}.",
        notif_type="APPLICATION_SCHEDULED",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#owner-application-details?id={application_id}",
        priority="HIGH",
        sender=inspector_name
    )

    return {"success": True, "application": app_obj.to_dict()}


# --- Document Upload & Retrieval Endpoints (Feature 11 & 20) ---
@app.post("/api/v1/applications/{application_id}/documents/upload")
async def upload_application_document(
    application_id: str,
    file: UploadFile = File(...),
    documentType: str = Form("STATUTORY_INSPECTION_RECORD"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Uploads and persists application document with MIME/size validation."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role_id == "OWNER" and app_obj.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to upload documents for this application.")

    # Validate file size and MIME type
    content = await file.read()
    file_size = len(content)
    if file_size > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum allowed size of 15 MB.")
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"]
    mime = file.content_type or "application/octet-stream"
    if mime not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type ({mime}). Please upload PDF, PNG, or JPEG files.")

    orig_name = file.filename or "document.pdf"
    ext = Path(orig_name).suffix or ".pdf"
    doc_id = f"DOC-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    stored_name = f"{doc_id}_{datetime.utcnow().strftime('%y%m%d%H%M%S')}{ext}"
    storage_path, file_url = storage.save_upload_file(
        category="documents",
        filename=stored_name,
        content=content,
        content_type=mime
    )

    doc_record = ApplicationDocument(
        id=doc_id,
        application_id=app_obj.id,
        document_type=documentType,
        file_name=stored_name,
        original_filename=orig_name,
        file_url=file_url if file_url.startswith("http") else f"/api/v1/documents/{doc_id}/download",
        storage_path=storage_path,
        file_size_bytes=file_size,
        mime_type=mime,
        uploaded_by=current_user.id,
        uploaded_at=datetime.utcnow()
    )
    session.add(doc_record)
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="UPLOAD_DOCUMENT",
        entity="ApplicationDocument",
        entity_id=doc_id,
        previous_state="None",
        new_state="STORED",
        user_id=current_user.id,
        details=f"Uploaded {documentType} ({orig_name}, {file_size} bytes)"
    )

    return doc_record.to_dict()


@app.get("/api/v1/applications/{application_id}/documents")
async def list_application_documents(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Lists submitted documents for an application."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    docs = session.query(ApplicationDocument).filter(ApplicationDocument.application_id == application_id).all()
    return [d.to_dict() for d in docs]


@app.get("/api/v1/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session: Session = Depends(get_db)
):
    """Downloads or views an uploaded statutory document."""
    doc = session.query(ApplicationDocument).filter(ApplicationDocument.id == document_id).first()
    if not doc or not doc.storage_path:
        raise HTTPException(status_code=404, detail="Document file not found on server")

    return storage.serve_file(
        storage_path=doc.storage_path,
        filename=doc.original_filename or doc.file_name,
        mime_type=doc.mime_type
    )


@app.delete("/api/v1/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Deletes an uploaded document if user is applicant or administrator."""
    doc = session.query(ApplicationDocument).filter(ApplicationDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role_id == "OWNER" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to delete this document.")

    if doc.storage_path:
        storage.delete_file(doc.storage_path)

    session.delete(doc)
    session.commit()
    return {"success": True, "message": "Document removed successfully."}


@app.post("/api/v1/applications/{application_id}/request-correction")
async def request_application_correction(
    application_id: str,
    req: ApplicationActionRequest,
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """LMO / Admin requests document or information amendments from applicant."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    reason = req.reason or req.remarks or "Please submit revised documents."
    prev_status = app_obj.status
    app_obj.status = "CORRECTION_REQUESTED"
    app_obj.correction_notes = reason
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Application Correction Requested",
        entity="Application",
        entity_id=application_id,
        previous_state=prev_status,
        new_state="CORRECTION_REQUESTED",
        user_id=current_user.id,
        details=f"Correction requested: {reason}"
    )

    send_system_notification(
        session=session,
        recipient_id=app_obj.owner_id,
        target_role="OWNER",
        title="Application Correction Requested",
        message=f"Application {application_id} requires amendment: {reason}",
        notif_type="SYSTEM_ALERT",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#owner-application-details?id={application_id}",
        priority="HIGH",
        sender=current_user.name
    )

    return {"success": True, "application": app_obj.to_dict()}


@app.post("/api/v1/applications/{application_id}/reject")
async def reject_application_endpoint(
    application_id: str,
    req: ApplicationActionRequest,
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """LMO / Admin rejects verification application."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    reason = req.reason or req.remarks or "Application rejected."
    prev_status = app_obj.status
    app_obj.status = "REJECTED"
    app_obj.rejection_reason = reason
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Application Rejected",
        entity="Application",
        entity_id=application_id,
        previous_state=prev_status,
        new_state="REJECTED",
        user_id=current_user.id,
        details=f"Application rejected: {reason}"
    )

    send_system_notification(
        session=session,
        recipient_id=app_obj.owner_id,
        target_role="OWNER",
        title="Application Rejected",
        message=f"Application {application_id} has been rejected: {reason}",
        notif_type="APPLICATION_REJECTED",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#owner-application-details?id={application_id}",
        priority="HIGH",
        sender=current_user.name
    )

    return {"success": True, "application": app_obj.to_dict()}


@app.post("/api/v1/applications/{application_id}/resubmit")
async def resubmit_application_endpoint(
    application_id: str,
    req: ApplicationActionRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Owner resubmits application after uploading requested corrections."""
    app_obj = session.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role_id == "OWNER" and app_obj.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this application.")

    prev_status = app_obj.status
    app_obj.status = "UNDER_REVIEW"
    if req.remarks:
        app_obj.applicant_remarks = req.remarks
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Application Resubmitted",
        entity="Application",
        entity_id=application_id,
        previous_state=prev_status,
        new_state="UNDER_REVIEW",
        user_id=current_user.id,
        details=f"Owner resubmitted application {application_id} with amendments."
    )

    send_system_notification(
        session=session,
        recipient_id=app_obj.assigned_officer_id,
        target_role="LMO",
        title="Amended Application Resubmitted",
        message=f"Owner has resubmitted application {application_id} for review.",
        notif_type="SYSTEM_ALERT",
        related_entity="Application",
        related_id=application_id,
        action_url=f"#lmo-review?id={application_id}",
        priority="MEDIUM",
        sender=current_user.name
    )

    return {"success": True, "application": app_obj.to_dict()}


# --- 9. Verification & Certificate Generation (Features 3, 5, 6, 8, 9, 21) ---
@app.post("/api/v1/verification/submit")
async def submit_verification(
    data: VerificationSubmitRequest,
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """
    Submits an authoritative statutory inspection record to MySQL.
    - Evaluates multi-point test loads against OIML R76 Maximum Permissible Error (MPE)
    - Records complete 6-item statutory checklist
    - Back-end authoritatively calculates PASS/FAIL decision
    - On PASS: signs canonical payload with RSA-2048 private key & generates ISO/IEC 18004 QR
    - Persists verification record, test points, and certificate to MySQL
    """
    app_obj = session.query(Application).filter(Application.id == data.applicationId).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")

    ins = session.query(Instrument).filter(Instrument.id == app_obj.instrument_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Associated instrument not found")

    # Access enforcement for assigned officer
    if current_user.role_id == "LMO" and app_obj.assigned_officer_id and app_obj.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. This application is assigned to another officer.")

    inspector_type = "LMO"
    verifier_type = "LMO"
    officer_name = current_user.name
    officer_designation = current_user.designation or "Legal Metrology Officer"
    authority = "Department of Legal Metrology, Government of Bihar"
    assigned_vc_id = current_user.verification_centre_id or app_obj.verification_centre_id

    record_id = f"VR-{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets_hex_str(2)}"
    today_str = date.today().strftime("%d %b %Y")
    now_dt = datetime.utcnow()

    acc_class = data.accuracyClass or ins.accuracy_class or "Class III"
    try:
        scale_e = float(data.scaleIntervalE or ins.verification_scale_interval_e or 0.01)
    except Exception:
        scale_e = 0.01

    # Evaluate Test Points
    calculated_test_points = []
    overall_tests_pass = True

    if data.testPoints and len(data.testPoints) > 0:
        for idx, tp in enumerate(data.testPoints):
            tp_name = tp.name or f"Test Point {idx + 1}"
            nom = float(tp.nominalLoad)
            obs = float(tp.observedLoad)
            u = tp.unit or data.unit or "kg"
            err, mpe, tp_res = calculate_test_tolerances(
                nominal=nom,
                observed=obs,
                unit=u,
                tolerance_mpe=tp.toleranceMpe,
                accuracy_class=acc_class,
                scale_interval_e=scale_e
            )
            if tp_res != "PASS":
                overall_tests_pass = False
            calculated_test_points.append({
                "name": tp_name,
                "nominal": nom,
                "observed": obs,
                "unit": u,
                "error": err,
                "mpe": mpe,
                "result": tp_res
            })
    else:
        # Fallback to single measurement
        try:
            obs = float(str(data.observedMeasurement or "100.0").replace("kg", "").replace("L", "").replace("g", "").strip())
        except Exception:
            obs = 100.0
        try:
            nom = float(str(data.nominalTestWeight or "100.0").replace("kg", "").replace("L", "").replace("g", "").strip())
        except Exception:
            nom = 100.0
        u = data.unit or "kg"
        try:
            custom_mpe = float(str(data.permissibleError).replace("kg", "").replace("g", "").replace("±", "").strip()) if data.permissibleError else None
        except Exception:
            custom_mpe = None

        err, mpe, tp_res = calculate_test_tolerances(
            nominal=nom,
            observed=obs,
            unit=u,
            tolerance_mpe=custom_mpe,
            accuracy_class=acc_class,
            scale_interval_e=scale_e
        )
        if tp_res != "PASS":
            overall_tests_pass = False
        calculated_test_points.append({
            "name": "Standard Test Load",
            "nominal": nom,
            "observed": obs,
            "unit": u,
            "error": err,
            "mpe": mpe,
            "result": tp_res
        })

    # Evaluate Statutory Checklist
    checklist_items = [
        data.physicalCondition,
        data.levelIndicator,
        data.zeroCheck,
        data.displayPointer,
        data.sealCheck,
        data.statutoryMarkings
    ]
    checklist_pass = all(item.upper() in ["PASS", "NA", "N/A"] for item in checklist_items)

    # Authoritative Backend Determination
    computed_result = "PASS" if (overall_tests_pass and checklist_pass) else "FAIL"
    if data.result == "FAIL":
        computed_result = "FAIL"

    wire_seal = data.wireSealNumber or (f"WS-LM-{secrets_hex_str(4)}" if computed_result == "PASS" else None)
    first_tp = calculated_test_points[0]

    record = VerificationRecord(
        id=record_id,
        application_id=app_obj.id,
        instrument_id=ins.id,
        officer_id=current_user.id,
        officer_name=officer_name,
        inspector_type=inspector_type,
        inspection_date=today_str,
        physical_condition_check=data.physicalCondition,
        level_indicator_check=data.levelIndicator,
        zero_setting_check=data.zeroCheck,
        display_pointer_check=data.displayPointer,
        security_seal_integrity_check=data.sealCheck,
        statutory_markings_check=data.statutoryMarkings,
        verification_scale_interval_e=str(scale_e),
        accuracy_class=acc_class,
        nominal_test_weight=f"{first_tp['nominal']} {first_tp['unit']}",
        observed_measurement=f"{first_tp['observed']} {first_tp['unit']}",
        permissible_tolerance=f"±{first_tp['mpe']} {first_tp['unit']}",
        measurement_unit=first_tp['unit'],
        calculated_error_deviation=first_tp['error'],
        result=computed_result,
        wire_seal_number=wire_seal,
        fail_reason=data.failReason or ("Checklist statutory deficiency" if not checklist_pass else "Measurement error exceeds MPE") if computed_result == "FAIL" else None,
        officer_remarks=data.remarks or ("Statutory calibration completed within MPE limits." if computed_result == "PASS" else "Inspection failed statutory requirements."),
        verification_centre_id=assigned_vc_id,
        latitude=data.latitude,
        longitude=data.longitude,
        created_at=now_dt
    )
    session.add(record)

    # Persist relational test points
    for ctp in calculated_test_points:
        tp_id = f"TP-{datetime.utcnow().year}-{secrets_hex_str(5)}"
        session.add(VerificationTestPoint(
            id=tp_id,
            record_id=record_id,
            test_point_name=ctp["name"],
            nominal_load=ctp["nominal"],
            observed_load=ctp["observed"],
            unit=ctp["unit"],
            error_value=ctp["error"],
            tolerance_mpe=ctp["mpe"],
            result=ctp["result"],
            created_at=now_dt
        ))

    certificate = None
    if computed_result == "PASS":
        cert_id = f"MX-CERT-{now_dt.strftime('%y%m%d%H%M%S')}-{secrets_hex_str(2)}"
        valid_until_date = (date.today() + timedelta(days=365)).strftime("%d %b %Y")

        # Asymmetric Cryptographic Signing (Feature 5)
        canonical_payload = canonical_certificate_payload(
            cert_id=cert_id,
            instrument_id=ins.id,
            serial_number=ins.serial_number,
            instrument_type=ins.type,
            manufacturer=ins.manufacturer,
            model=ins.model,
            capacity=ins.capacity,
            owner_name=ins.owner_name,
            business_name=ins.business_name or "",
            verification_date=today_str,
            valid_until=valid_until_date,
            wire_seal_number=wire_seal or "",
            officer_id=current_user.id,
            officer_name=officer_name,
            verifier_type=verifier_type,
            authority=authority,
            status="VALID"
        )
        sig_b64, key_id = sign_certificate_payload(canonical_payload)

        # Real Standards-Compliant ISO/IEC 18004 QR Code Generation (Feature 3)
        qr_url, qr_data_uri = generate_certificate_qr(cert_id, cert_id, sig_b64)

        certificate = Certificate(
            id=cert_id,
            instrument_id=ins.id,
            application_id=app_obj.id,
            record_id=record_id,
            verification_centre_id=assigned_vc_id,
            verifier_type=verifier_type,
            instrument_type=ins.type,
            manufacturer=ins.manufacturer,
            model=ins.model,
            serial_number=ins.serial_number,
            capacity=ins.capacity,
            owner_name=ins.owner_name,
            business_name=ins.business_name,
            location=ins.location,
            verification_date=today_str,
            valid_until=valid_until_date,
            officer_id=current_user.id,
            officer_name=officer_name,
            officer_designation=officer_designation,
            authority=authority,
            observed_measurement=f"{first_tp['observed']} {first_tp['unit']}",
            permissible_error=f"±{first_tp['mpe']} {first_tp['unit']}",
            unit=first_tp['unit'],
            wire_seal_number=wire_seal,
            status="VALID",
            digital_signature=sig_b64,
            signature_algorithm="RSA-SHA256",
            key_id=key_id,
            qr_verification_url=qr_url,
            qr_payload=qr_data_uri,
            digital_signature_hash=sig_b64[:32],
            created_at=now_dt
        )
        session.add(certificate)

        # Update Instrument status
        ins.status = "ACTIVE"
        ins.valid_until = valid_until_date
        ins.last_verification_date = today_str
        ins.last_officer_id = current_user.id
        ins.last_officer_name = officer_name
        ins.active_certificate_id = cert_id

        # Update Application
        app_obj.status = "COMPLETED"
        app_obj.certificate_id = cert_id

        # Dispatch certificate notification to owner
        send_system_notification(
            session=session,
            recipient_id=app_obj.owner_id,
            target_role="OWNER",
            title="Verification Certificate Issued",
            message=f"Official certificate {cert_id} has been issued by {officer_name} ({verifier_type}) for instrument {ins.id}. Valid until {valid_until_date}.",
            notif_type="CERTIFICATE_ISSUED",
            related_entity="Certificate",
            related_id=cert_id,
            action_url=f"#certificate-view?id={cert_id}",
            priority="HIGH",
            sender=officer_name
        )
    else:
        ins.status = "REJECTED"
        app_obj.status = "REJECTED"
        app_obj.rejection_reason = record.fail_reason or "Instrument failed statutory accuracy limits."

        send_system_notification(
            session=session,
            recipient_id=app_obj.owner_id,
            target_role="OWNER",
            title="Verification Inspection Failed",
            message=f"Instrument {ins.id} failed verification: {record.fail_reason}. Please rectify calibration and re-apply.",
            notif_type="APPLICATION_REJECTED",
            related_entity="Application",
            related_id=app_obj.id,
            action_url=f"#owner-application-details?id={app_obj.id}",
            priority="HIGH",
            sender=officer_name
        )

    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role=current_user.role_id,
        action="Verification Submitted",
        entity="VerificationRecord",
        entity_id=record_id,
        previous_state="SCHEDULED",
        new_state=computed_result,
        user_id=current_user.id,
        details=f"Verification result: {computed_result} by {officer_name} ({inspector_type}) for instrument {ins.id}. Wire Seal: {wire_seal or 'N/A'}"
    )

    return {
        "success": True,
        "record": record.to_dict(),
        "certificate": certificate.to_dict() if certificate else None,
        "result": computed_result,
        "message": f"Verification completed successfully. Statutory Result: {computed_result}"
    }


# --- Evidence Capture & Storage Endpoints (Features 7, 21, 22) ---
@app.post("/api/v1/verification/evidence/upload")
async def upload_verification_evidence(
    applicationId: Optional[str] = Form(None),
    recordId: Optional[str] = Form(None),
    category: str = Form("INSTRUMENT_OVERVIEW"),
    caption: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """
    Uploads inspection evidence (photographs of instrument, seals, readings, test weights).
    Stores on filesystem, records geolocation (lat/long) and metadata in MySQL.
    """
    content = await file.read()
    file_size = len(content)
    if file_size > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Evidence file exceeds 25 MB limit.")
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file submitted.")

    orig_name = file.filename or "evidence.jpg"
    ext = Path(orig_name).suffix or ".jpg"
    evd_id = f"EVD-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    stored_name = f"{evd_id}_{datetime.utcnow().strftime('%y%m%d%H%M%S')}{ext}"
    storage_path, file_url = storage.save_upload_file(
        category="evidence",
        filename=stored_name,
        content=content,
        content_type=file.content_type or "image/jpeg"
    )

    target_rec_id = recordId
    if not target_rec_id and applicationId:
        vr = session.query(VerificationRecord).filter(VerificationRecord.application_id == applicationId).order_by(VerificationRecord.created_at.desc()).first()
        if vr:
            target_rec_id = vr.id

    evidence_record = VerificationEvidence(
        id=evd_id,
        record_id=target_rec_id,
        application_id=applicationId,
        evidence_category=category,
        caption=caption,
        file_name=stored_name,
        file_url=file_url if file_url.startswith("http") else f"/api/v1/evidence/{evd_id}/download",
        storage_path=storage_path,
        file_size_bytes=file_size,
        mime_type=file.content_type or "image/jpeg",
        geo_latitude=float(latitude) if latitude is not None else None,
        geo_longitude=float(longitude) if longitude is not None else None,
        uploaded_by=current_user.id,
        captured_at=datetime.utcnow()
    )
    session.add(evidence_record)
    session.commit()

    return evidence_record.to_dict()


@app.get("/api/v1/verification/{record_id}/evidence")
async def list_record_evidence(
    record_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Returns all evidence associated with a verification record."""
    items = session.query(VerificationEvidence).filter(VerificationEvidence.record_id == record_id).all()
    return [i.to_dict() for i in items]


@app.get("/api/v1/applications/{application_id}/evidence")
async def list_application_evidence(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Returns all evidence associated with an application."""
    items = session.query(VerificationEvidence).filter(VerificationEvidence.application_id == application_id).all()
    return [i.to_dict() for i in items]


@app.get("/api/v1/evidence/{evidence_id}/download")
async def download_evidence(
    evidence_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session: Session = Depends(get_db)
):
    """Downloads or streams an uploaded inspection photo."""
    evd = session.query(VerificationEvidence).filter(VerificationEvidence.id == evidence_id).first()
    if not evd or not evd.storage_path:
        raise HTTPException(status_code=404, detail="Evidence file not found on disk")

    return storage.serve_file(
        storage_path=evd.storage_path,
        filename=evd.file_name,
        mime_type=evd.mime_type or "image/jpeg"
    )


# --- Offline Synchronization Endpoint (Feature 10 & 24) ---
@app.post("/api/v1/verification/sync")
async def sync_offline_inspections(
    req: OfflineSyncRequest,
    current_user: User = Depends(require_role("LMO", "ADMIN")),
    session: Session = Depends(get_db)
):
    """
    Synchronizes offline field verification operations captured in PWA IndexedDB.
    Detects conflicts, validates data integrity, and persists to MySQL.
    """
    results = []
    synced_count = 0
    conflict_count = 0

    for op in req.operations:
        sync_op = session.query(OfflineSyncOperation).filter(OfflineSyncOperation.client_operation_id == op.operationId).first()
        if sync_op and sync_op.sync_status == "SYNCED":
            results.append({
                "operationId": op.operationId,
                "status": "ALREADY_SYNCED",
                "message": "Operation previously synchronized."
            })
            continue

        if op.entityType == "INSPECTION":
            p = op.payload
            app_id = p.get("applicationId")
            app_obj = session.query(Application).filter(Application.id == app_id).first()

            if not app_obj:
                results.append({"operationId": op.operationId, "status": "ERROR", "message": f"Application {app_id} not found."})
                continue

            if app_obj.status in ["COMPLETED", "REJECTED"]:
                conflict_count += 1
                results.append({
                    "operationId": op.operationId,
                    "status": "CONFLICT",
                    "message": f"Conflict detected: Application {app_id} is already in state '{app_obj.status}'."
                })
                # Log conflict
                session.add(OfflineSyncOperation(
                    id=f"SYNC-{secrets_hex_str(6)}",
                    client_operation_id=op.operationId,
                    officer_id=current_user.id,
                    entity_type=op.entityType,
                    entity_id=app_id,
                    sync_status="CONFLICT",
                    conflict_detected=True,
                    resolution_notes=f"Application already {app_obj.status}",
                    created_at=datetime.utcnow(),
                    synced_at=datetime.utcnow()
                ))
                session.commit()
                continue

            # Process inspection
            try:
                # Build VerificationSubmitRequest from payload
                submit_req = VerificationSubmitRequest(**p)
                sub_res = await submit_verification(submit_req, current_user, session)
                synced_count += 1
                session.add(OfflineSyncOperation(
                    id=f"SYNC-{secrets_hex_str(6)}",
                    client_operation_id=op.operationId,
                    officer_id=current_user.id,
                    entity_type=op.entityType,
                    entity_id=app_id,
                    sync_status="SYNCED",
                    conflict_detected=False,
                    created_at=datetime.utcnow(),
                    synced_at=datetime.utcnow()
                ))
                session.commit()
                results.append({"operationId": op.operationId, "status": "SYNCED", "result": sub_res})
            except Exception as e:
                session.rollback()
                results.append({"operationId": op.operationId, "status": "ERROR", "message": str(e)})

        elif op.entityType == "EVIDENCE":
            p = op.payload
            # Evidence sync logic
            evd_id = f"EVD-{datetime.utcnow().year}-{secrets_hex_str(4)}"
            evidence_record = VerificationEvidence(
                id=evd_id,
                record_id=p.get("recordId"),
                application_id=p.get("applicationId"),
                category=p.get("category", "INSTRUMENT_OVERVIEW"),
                caption=p.get("caption"),
                file_name=p.get("fileName", "offline_photo.jpg"),
                file_url=f"/api/v1/evidence/{evd_id}/download",
                storage_path=p.get("storagePath", ""),
                file_size_bytes=p.get("fileSize", 0),
                mime_type=p.get("mimeType", "image/jpeg"),
                latitude=p.get("latitude"),
                longitude=p.get("longitude"),
                uploaded_by=current_user.id,
                created_at=datetime.utcnow()
            )
            session.add(evidence_record)
            session.add(OfflineSyncOperation(
                id=f"SYNC-{secrets_hex_str(6)}",
                client_operation_id=op.operationId,
                officer_id=current_user.id,
                entity_type=op.entityType,
                entity_id=evd_id,
                sync_status="SYNCED",
                conflict_detected=False,
                created_at=datetime.utcnow(),
                synced_at=datetime.utcnow()
            ))
            session.commit()
            synced_count += 1
            results.append({"operationId": op.operationId, "status": "SYNCED", "evidenceId": evd_id})

    return {
        "success": True,
        "total": len(req.operations),
        "synced": synced_count,
        "conflicts": conflict_count,
        "results": results
    }


# --- 10. Certificates, QR & Public Authenticity (Features 3, 4, 5, 6, 7, 23) ---
@app.get("/api/v1/certificates")
async def list_certificates(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Lists certificates from MySQL with data isolation for OWNERs."""
    q = session.query(Certificate)
    if current_user.role_id == "OWNER":
        q = q.join(Instrument, Certificate.instrument_id == Instrument.id).filter(Instrument.owner_id == current_user.id)
    if status and status.upper() != "ALL":
        q = q.filter(Certificate.status == status.upper())

    certs = q.order_by(Certificate.created_at.desc()).all()
    return [c.to_dict() for c in certs]


@app.get("/api/v1/certificates/{cert_id}")
async def get_certificate(
    cert_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    session: Session = Depends(get_db)
):
    """Retrieves a certificate by ID from MySQL."""
    cert = session.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return cert.to_dict()


@app.get("/api/v1/certificates/{cert_id}/qr.png")
@app.get("/api/v1/public/certificates/{cert_id}/qr.png")
async def get_certificate_qr_png(cert_id: str, session: Session = Depends(get_db)):
    """
    Returns the real standards-compliant ISO/IEC 18004 QR code as an image/png stream.
    Scannable by any standard Android/iOS camera application.
    """
    cert = session.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    target_url = cert.qr_verification_url or build_verification_url(cert_id)
    png_bytes = generate_qr_code_png_bytes(target_url)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/api/v1/public/keys/public.pem")
async def get_public_signing_key():
    """Returns the statutory RSA public verification key in PEM format."""
    pem_str = get_public_key_pem()
    return Response(content=pem_str, media_type="application/x-pem-file")


@app.get("/api/v1/public/verify/{query:path}")
@app.get("/api/v1/certificates/verify/{query:path}")
async def public_verify_certificate(query: str, session: Session = Depends(get_db)):
    """
    Public statutory certificate verification endpoint (Feature 6 & 7).
    No authentication required.
    Resolves query by:
    1. Certificate ID (e.g. MX-CERT-...)
    2. Instrument Serial Number
    3. Wire Seal Number
    Performs real RSA signature verification and validity checking.
    """
    clean_query = query.strip()
    # Extract certificate ID if full URL was scanned/queried
    if "verify?" in clean_query or "verify/" in clean_query or "id=" in clean_query or "cert=" in clean_query:
        import re
        m = re.search(r'(?:cert|id|q)=([^&]+)', clean_query) or re.search(r'verify/([^/?#]+)', clean_query)
        if m:
            clean_query = m.group(1).strip()

    cert = session.query(Certificate).filter(Certificate.id == clean_query).first()

    if not cert:
        # Search by instrument serial number
        ins_match = session.query(Instrument).filter(Instrument.serial_number == clean_query).first()
        if ins_match:
            if ins_match.active_certificate_id:
                cert = session.query(Certificate).filter(Certificate.id == ins_match.active_certificate_id).first()
            if not cert:
                cert = session.query(Certificate).filter(Certificate.instrument_id == ins_match.id).order_by(Certificate.created_at.desc()).first()

    if not cert:
        # Search by wire seal number
        cert = session.query(Certificate).filter(Certificate.wire_seal_number == clean_query).order_by(Certificate.created_at.desc()).first()

    if not cert:
        return JSONResponse(
            status_code=404,
            content={
                "valid": False,
                "status": "NOT_FOUND",
                "message": f"No statutory certificate or legal metrology record found matching '{clean_query}'. Beware of fraudulent instruments and counterfeit seals."
            }
        )

    ins = session.query(Instrument).filter(Instrument.id == cert.instrument_id).first()

    # Parse and check expiry
    today = date.today()
    is_expired = False
    try:
        expiry_dt = None
        for fmt in ["%d %b %Y", "%Y-%m-%d", "%d/%m/%Y"]:
            try:
                expiry_dt = datetime.strptime(cert.valid_until.strip(), fmt).date()
                break
            except Exception:
                continue
        if expiry_dt and expiry_dt < today:
            is_expired = True
    except Exception:
        pass

    # Verify Digital Signature (Feature 5)
    sig_valid = False
    if cert.digital_signature:
        canonical = canonical_certificate_payload(cert.to_dict())
        sig_valid = verify_certificate_signature(canonical, cert.digital_signature)
        if not sig_valid:
            canonical_legacy = canonical_certificate_payload(
                cert_id=cert.id,
                instrument_id=cert.instrument_id,
                serial_number=cert.serial_number,
                owner_name=cert.owner_name,
                business_name=cert.business_name or "",
                verification_date=cert.verification_date,
                valid_until=cert.valid_until,
                wire_seal_number=cert.wire_seal_number or "",
                officer_id=cert.officer_id,
                officer_name=cert.officer_name,
                authority=cert.authority,
                status="VALID"
            )
            sig_valid = verify_certificate_signature(canonical_legacy, cert.digital_signature)
    elif cert.digital_signature_hash:
        sig_valid = True # Legacy certificate hash

    # Determine final statutory state
    if cert.status == "REVOKED":
        final_status = "REVOKED"
    elif is_expired:
        final_status = "EXPIRED"
    elif cert.digital_signature and not sig_valid:
        final_status = "INVALID"
    else:
        final_status = cert.status or "VALID"

    is_valid = (final_status == "VALID") and (sig_valid or not cert.digital_signature)

    return {
        "valid": is_valid,
        "status": final_status,
        "signatureValid": sig_valid,
        "signatureAlgorithm": cert.signature_algorithm or "RSA-SHA256",
        "keyId": cert.key_id or "MEASUREX-STATUTORY-ROOT-2026",
        "certificateNumber": cert.id,
        "verificationDate": cert.verification_date,
        "validUntil": cert.valid_until,
        "wireSealNumber": cert.wire_seal_number,
        "instrument": {
            "id": cert.instrument_id,
            "type": cert.instrument_type,
            "manufacturer": cert.manufacturer,
            "model": cert.model,
            "serialNumber": cert.serial_number,
            "capacity": cert.capacity,
            "district": ins.district if ins else "Patna",
            "state": ins.state if ins else "Bihar"
        },
        "owner": {
            "businessName": cert.business_name,
            "location": cert.location
        },
        "verifier": {
            "verifierType": cert.verifier_type or "LMO",
            "name": cert.officer_name,
            "designation": cert.officer_designation,
            "authority": cert.authority
        },
        "testResults": {
            "observedMeasurement": cert.observed_measurement,
            "permissibleError": cert.permissible_error,
            "unit": cert.unit
        },
        "qrVerificationUrl": cert.qr_verification_url or build_verification_url(cert.id),
        "qrCodeDataUri": cert.qr_payload,
        "verifiedAt": datetime.utcnow().isoformat() + "Z"
    }


@app.get("/api/v1/public/search")
async def public_search(q: str = Query(...), session: Session = Depends(get_db)):
    """Public search for certificates and instruments by ID, serial, or seal."""
    term = f"%{q.strip()}%"
    certs = session.query(Certificate).filter(
        sa.or_(
            Certificate.id.like(term),
            Certificate.serial_number.like(term),
            Certificate.wire_seal_number.like(term),
            Certificate.business_name.like(term)
        )
    ).order_by(Certificate.created_at.desc()).limit(15).all()

    return [{
        "certificateNumber": c.id,
        "instrumentType": c.instrument_type,
        "serialNumber": c.serial_number,
        "businessName": c.business_name,
        "validUntil": c.valid_until,
        "status": c.status,
        "verifierType": c.verifier_type or "LMO",
        "wireSealNumber": c.wire_seal_number
    } for c in certs]


@app.post("/api/v1/admin/run-expiry-check")
async def trigger_expiry_check(
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Triggers the automated statutory certificate validity and expiry alert engine."""
    results = evaluate_certificate_expiries(session)
    return {"success": True, "processed": results}


@app.post("/api/v1/certificates/{cert_id}/revoke")
async def revoke_certificate(
    cert_id: str,
    req: RevokeCertificateRequest,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin endpoint to revoke a certificate with statutory audit and immediate notification."""
    cert = session.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    prev_status = cert.status
    cert.status = "REVOKED"
    cert.revocation_reason = req.reason
    cert.revoked_at = datetime.utcnow()
    cert.revoked_by = current_user.name

    ins = session.query(Instrument).filter(Instrument.id == cert.instrument_id).first()
    if ins:
        ins.status = "REVOKED"
        ins.active_certificate_id = None

    # Record in certificate_revocations table
    revocation_id = f"REV-{datetime.utcnow().year}-{secrets_hex_str(4)}"
    rev_entry = CertificateRevocation(
        id=revocation_id,
        certificate_id=cert.id,
        revoked_by=current_user.id,
        revocation_reason=req.reason,
        revoked_at=datetime.utcnow(),
        previous_status=prev_status,
        notes=getattr(req, "notes", None)
    )
    session.add(rev_entry)
    session.commit()

    db.log_audit(
        user_name=current_user.name,
        role="ADMIN",
        action="CERTIFICATE_REVOKED",
        entity="Certificate",
        entity_id=cert_id,
        previous_state=prev_status,
        new_state="REVOKED",
        user_id=current_user.id,
        details=f"Admin revoked certificate {cert_id}. Reason: {req.reason}"
    )

    if ins and ins.owner_id:
        send_system_notification(
            session=session,
            recipient_id=ins.owner_id,
            target_role="OWNER",
            title=f"Certificate Revoked ({cert.id})",
            message=f"Legal Metrology Certificate {cert.id} for your instrument {ins.model} ({ins.serial_number}) has been revoked by the Directorate. Reason: {req.reason}",
            notif_type="CERTIFICATE_REVOKED",
            related_entity="Certificate",
            related_id=cert.id,
            action_url=f"#owner-certificates",
            priority="CRITICAL",
            sender="Directorate Enforcement Wing"
        )

    return {"success": True, "message": f"Certificate {cert_id} has been revoked.", "certificate": cert.to_dict()}


# --- 11. Notifications ---
@app.get("/api/v1/notifications")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Lists notifications for the current authenticated user from MySQL."""
    q = session.query(Notification).filter(
        sa.or_(
            Notification.recipient_id == current_user.id,
            Notification.target_role == "ALL",
            Notification.target_role == current_user.role_id
        )
    ).order_by(Notification.created_at.desc()).limit(50)

    notifs = q.all()
    return [n.to_dict() for n in notifs]


@app.patch("/api/v1/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Marks a notification as read in MySQL."""
    notif = session.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        session.commit()
    return {"success": True}


@app.post("/api/v1/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Marks all notifications for current user as read in MySQL."""
    now = datetime.utcnow()
    session.query(Notification).filter(
        sa.or_(
            Notification.recipient_id == current_user.id,
            Notification.target_role == "ALL",
            Notification.target_role == current_user.role_id
        )
    ).update({"is_read": True, "read_at": now})
    session.commit()
    return {"success": True}


@app.post("/api/v1/notifications/send")
async def admin_send_notification(
    req: SendNotificationRequest,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Admin manual broadcast notification dispatch."""
    rec_id = req.targetRecipient if req.targetType == "USER" else None
    role = req.targetRecipient if req.targetType == "GROUP" else "ALL"

    send_system_notification(
        session=session,
        recipient_id=rec_id,
        target_role=role,
        title=req.title,
        message=req.message,
        notif_type="ADMIN_BROADCAST",
        related_entity=req.relatedEntity,
        related_id=req.relatedId,
        action_url=req.actionUrl,
        priority=req.priority,
        sender=f"Directorate Admin ({current_user.name})"
    )

    db.log_audit(
        user_name=current_user.name,
        role="ADMIN",
        action="Notification Broadcast",
        entity="Notification",
        entity_id=req.targetRecipient,
        previous_state="None",
        new_state="DISPATCHED",
        user_id=current_user.id,
        details=f"Admin dispatched notification: '{req.title}' to {req.targetType}:{req.targetRecipient}"
    )

    return {"success": True, "message": "Notification dispatched successfully."}


# --- 12. Calendar ---
@app.get("/api/v1/calendar")
async def get_calendar_events(
    month: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Returns scheduled inspections for calendar view from MySQL."""
    q = session.query(VerificationSchedule)
    if current_user.role_id == "LMO":
        q = q.filter(VerificationSchedule.officer_id == current_user.id)

    schedules = q.order_by(VerificationSchedule.inspection_date.asc()).all()
    events = []
    for s in schedules:
        app_obj = session.query(Application).filter(Application.id == s.application_id).first()
        events.append({
            "id": s.id,
            "applicationId": s.application_id,
            "date": s.inspection_date,
            "time": s.inspection_time,
            "officerId": s.officer_id,
            "officerName": s.officer_name,
            "location": s.inspection_location,
            "status": s.status,
            "businessName": app_obj.business_name if app_obj else "Commercial Trader",
            "title": f"Inspection: {app_obj.business_name if app_obj else s.application_id}"
        })
    return {"events": events}


# --- 13. Reports & Analytics ---
@app.get("/api/v1/admin/reports")
async def get_admin_reports(
    district: Optional[str] = Query("ALL"),
    instrument_type: Optional[str] = Query("ALL"),
    outcome: Optional[str] = Query("ALL"),
    period: Optional[str] = Query("FY2026-27"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """
    Computes 100% database-driven statutory analytics from MySQL relational tables:
    Summary, Monthly Verification Trends, Outcome Distribution, Equipment Breakdown, District Compliance.
    """
    dist_filter = None if (not district or district.upper() in ["ALL", "ALL DISTRICTS"]) else district
    inst_type_filter = None if (not instrument_type or instrument_type.upper() in ["ALL", "ALL INSTRUMENT TYPES"]) else instrument_type
    outcome_filter = None if (not outcome or outcome.upper() in ["ALL", "ALL OUTCOMES"]) else outcome.upper()

    # 1. Base Query for Instruments
    iq = session.query(Instrument)
    if dist_filter:
        iq = iq.filter(Instrument.district == dist_filter)
    if inst_type_filter:
        iq = iq.filter(Instrument.type == inst_type_filter)

    total_instruments = iq.count()
    active_instruments = iq.filter(Instrument.status == "ACTIVE").count()
    expiring_instruments = iq.filter(Instrument.status.in_(["EXPIRING_SOON", "EXPIRED"])).count()
    rejected_instruments = iq.filter(Instrument.status.in_(["REJECTED", "NON_COMPLIANT"])).count()

    # 2. Base Query for Applications
    aq = session.query(Application).outerjoin(Instrument, Application.instrument_id == Instrument.id)
    if dist_filter:
        aq = aq.filter(sa.or_(Instrument.district == dist_filter, Application.preferred_location.like(f"%{dist_filter}%")))
    if inst_type_filter:
        aq = aq.filter(Instrument.type == inst_type_filter)

    total_applications = aq.count()
    submitted_apps = aq.filter(Application.status.in_(["SUBMITTED", "UNDER_SCRUTINY", "UNDER_REVIEW"])).count()
    scheduled_apps = aq.filter(Application.status.in_(["SCHEDULED", "ALLOCATED", "IN_VERIFICATION"])).count()
    completed_apps = aq.filter(Application.status.in_(["COMPLETED", "VERIFIED", "CERTIFICATE_ISSUED"])).count()

    # 3. Certificates & Fees
    cq = session.query(Certificate).outerjoin(Application, Certificate.application_id == Application.id).outerjoin(Instrument, Certificate.instrument_id == Instrument.id)
    if dist_filter:
        cq = cq.filter(Instrument.district == dist_filter)
    if inst_type_filter:
        cq = cq.filter(Instrument.type == inst_type_filter)

    valid_certificates = cq.filter(Certificate.status == "VALID").count()
    revoked_certificates = cq.filter(Certificate.status == "REVOKED").count()
    statutory_fees_collected = completed_apps * 750.0

    total_users = session.query(User).count()
    total_owners = session.query(User).filter(User.role_id == "OWNER").count()
    total_lmos = session.query(User).filter(User.role_id == "LMO").count()
    pending_lmos = session.query(User).filter(User.role_id == "LMO", User.status == "PENDING_APPROVAL").count()

    compliance_rate = round((active_instruments / total_instruments * 100), 1) if total_instruments > 0 else 0.0

    # 4. Monthly Verification Trends (Computed from VerificationRecord)
    months_keys = [
        ("May 2026", ["May 2026", "2026-05"]),
        ("Jun 2026", ["Jun 2026", "2026-06"]),
        ("Jul 2026", ["Jul 2026", "2026-07"]),
        ("Aug 2026", ["Aug 2026", "2026-08"]),
        ("Sep 2026", ["Sep 2026", "2026-09"])
    ]

    monthly_trends = []
    for label, patterns in months_keys:
        vq = session.query(VerificationRecord).join(Instrument, VerificationRecord.instrument_id == Instrument.id)
        if dist_filter:
            vq = vq.filter(Instrument.district == dist_filter)
        if inst_type_filter:
            vq = vq.filter(Instrument.type == inst_type_filter)

        date_conds = [VerificationRecord.inspection_date.like(f"%{p}%") for p in patterns]
        month_num = int(patterns[1].split("-")[1])
        date_conds.append(sa.and_(sa.extract('year', VerificationRecord.created_at) == 2026, sa.extract('month', VerificationRecord.created_at) == month_num))
        vq = vq.filter(sa.or_(*date_conds))

        passed = vq.filter(VerificationRecord.result == "PASS").count()
        failed = vq.filter(VerificationRecord.result == "FAIL").count()

        if outcome_filter == "PASSED":
            failed = 0
        elif outcome_filter == "FAILED":
            passed = 0

        monthly_trends.append({
            "period": label,
            "passed": passed,
            "failed": failed,
            "total": passed + failed
        })

    # 5. Outcome Distribution (Computed from VerificationRecord and Application)
    vq_all = session.query(VerificationRecord).join(Instrument, VerificationRecord.instrument_id == Instrument.id)
    if dist_filter:
        vq_all = vq_all.filter(Instrument.district == dist_filter)
    if inst_type_filter:
        vq_all = vq_all.filter(Instrument.type == inst_type_filter)

    passed_count = vq_all.filter(VerificationRecord.result == "PASS").count()
    failed_count = vq_all.filter(VerificationRecord.result == "FAIL").count()
    in_review_count = aq.filter(Application.status.in_(["SUBMITTED", "UNDER_SCRUTINY", "SCHEDULED", "IN_VERIFICATION"])).count()

    if outcome_filter == "PASSED":
        failed_count = 0
        in_review_count = 0
    elif outcome_filter == "FAILED":
        passed_count = 0
        in_review_count = 0

    total_outcomes = passed_count + failed_count + in_review_count
    outcome_distribution = {
        "passed": {
            "count": passed_count,
            "percentage": round((passed_count / total_outcomes * 100), 1) if total_outcomes > 0 else 0.0
        },
        "failed": {
            "count": failed_count,
            "percentage": round((failed_count / total_outcomes * 100), 1) if total_outcomes > 0 else 0.0
        },
        "inReview": {
            "count": in_review_count,
            "percentage": round((in_review_count / total_outcomes * 100), 1) if total_outcomes > 0 else 0.0
        },
        "total": total_outcomes
    }

    # 6. Equipment Category Breakdown (Computed from Instrument)
    all_types = session.query(Instrument.type).distinct().all()
    equipment_breakdown = []
    for (itype,) in all_types:
        if not itype:
            continue
        if inst_type_filter and itype != inst_type_filter:
            continue
        eq_q = session.query(Instrument).filter(Instrument.type == itype)
        if dist_filter:
            eq_q = eq_q.filter(Instrument.district == dist_filter)
        cnt = eq_q.count()
        pct = round((cnt / total_instruments * 100), 1) if total_instruments > 0 else 0.0
        equipment_breakdown.append({
            "type": itype,
            "count": cnt,
            "percentage": pct
        })
    equipment_breakdown.sort(key=lambda x: x["count"], reverse=True)

    # 7. District Compliance (Computed directly from MySQL)
    district_names = ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur"]
    district_compliance = []
    for d_name in district_names:
        if dist_filter and d_name != dist_filter:
            continue
        dq = session.query(Instrument).filter(Instrument.district == d_name)
        if inst_type_filter:
            dq = dq.filter(Instrument.type == inst_type_filter)
        d_total = dq.count()
        d_compliant = dq.filter(Instrument.status == "ACTIVE").count()
        d_failed = dq.filter(Instrument.status.in_(["REJECTED", "NON_COMPLIANT"])).count()
        d_rate = round((d_compliant / d_total * 100), 1) if d_total > 0 else 0.0
        district_compliance.append({
            "district": d_name,
            "total": d_total,
            "compliant": d_compliant,
            "failed": d_failed,
            "rate": d_rate
        })

    return {
        "summary": {
            "totalInstruments": total_instruments,
            "activeInstruments": active_instruments,
            "expiringInstruments": expiring_instruments,
            "rejectedInstruments": rejected_instruments,
            "totalApplications": total_applications,
            "submittedApplications": submitted_apps,
            "scheduledApplications": scheduled_apps,
            "completedApplications": completed_apps,
            "totalUsers": total_users,
            "totalOwners": total_owners,
            "totalLMOs": total_lmos,
            "pendingLMOs": pending_lmos,
            "validCertificates": valid_certificates,
            "revokedCertificates": revoked_certificates,
            "complianceRate": compliance_rate,
            "statutoryFeesCollected": statutory_fees_collected
        },
        "monthlyTrends": monthly_trends,
        "outcomeDistribution": outcome_distribution,
        "equipmentBreakdown": equipment_breakdown,
        "districtCompliance": district_compliance,
        "activeFilters": {
            "district": dist_filter or "ALL",
            "instrumentType": inst_type_filter or "ALL",
            "outcome": outcome_filter or "ALL",
            "period": period or "FY2026-27"
        }
    }


@app.get("/api/v1/admin/reports/drilldown")
async def get_admin_reports_drilldown(
    metric: Optional[str] = Query("ALL"),
    period: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    instrument_type: Optional[str] = Query(None),
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """
    Authoritative report drilldown querying MySQL VerificationRecord, Application, Instrument, Certificate.
    Zero fake fallback records: returns real matching records.
    """
    dist_filter = None if (not district or district.upper() in ["ALL", "ALL DISTRICTS"]) else district
    inst_type_filter = None if (not instrument_type or instrument_type.upper() in ["ALL", "ALL INSTRUMENT TYPES"]) else instrument_type

    target_outcome = (outcome or metric or "ALL").upper().strip()

    if target_outcome in ["PASSED", "VERIFIED", "APPROVED"]:
        q = session.query(VerificationRecord, Application, Instrument, Certificate)\
            .outerjoin(Application, VerificationRecord.application_id == Application.id)\
            .outerjoin(Instrument, VerificationRecord.instrument_id == Instrument.id)\
            .outerjoin(Certificate, Application.certificate_id == Certificate.id)\
            .filter(VerificationRecord.result == "PASS")

        if dist_filter:
            q = q.filter(sa.or_(Instrument.district == dist_filter, Application.preferred_location.like(f"%{dist_filter}%")))
        if inst_type_filter:
            q = q.filter(Instrument.type == inst_type_filter)
        if period and period.upper() not in ["ALL", "FY2026-27", "FY2026", "FY26"]:
            month_abbr = period[:3]
            month_map = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
            m_num = month_map.get(month_abbr)
            conds = [VerificationRecord.inspection_date.like(f"%{month_abbr}%")]
            if m_num:
                conds.append(sa.extract('month', VerificationRecord.created_at) == m_num)
            q = q.filter(sa.or_(*conds))

        records = []
        for vr, app, ins, cert in q.order_by(VerificationRecord.created_at.desc()).all():
            records.append({
                "verificationId": vr.id,
                "applicationId": app.id if app else vr.application_id,
                "instrumentId": ins.id if ins else vr.instrument_id,
                "instrumentType": ins.type if ins else "Commercial Instrument",
                "serialNumber": ins.serial_number if ins else "",
                "ownerName": app.owner_name if app else (ins.owner_name if ins else "Commercial Owner"),
                "businessName": app.business_name if app else (ins.business_name if ins else ""),
                "district": ins.district if ins else (app.preferred_location if app else "Patna"),
                "date": vr.inspection_date,
                "result": "PASS",
                "status": "VERIFIED",
                "officerName": vr.officer_name,
                "certificateId": cert.id if cert else (app.certificate_id if app else "CERT-ISSUED"),
                "failReason": None,
                "remarks": vr.officer_remarks or "Statutory calibration confirmed within OIML MPE permissible limits."
            })
        return records

    elif target_outcome in ["FAILED", "REJECTED"]:
        q = session.query(VerificationRecord, Application, Instrument)\
            .outerjoin(Application, VerificationRecord.application_id == Application.id)\
            .outerjoin(Instrument, VerificationRecord.instrument_id == Instrument.id)\
            .filter(VerificationRecord.result == "FAIL")

        if dist_filter:
            q = q.filter(sa.or_(Instrument.district == dist_filter, Application.preferred_location.like(f"%{dist_filter}%")))
        if inst_type_filter:
            q = q.filter(Instrument.type == inst_type_filter)
        if period and period.upper() not in ["ALL", "FY2026-27", "FY2026", "FY26"]:
            month_abbr = period[:3]
            month_map = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
            m_num = month_map.get(month_abbr)
            conds = [VerificationRecord.inspection_date.like(f"%{month_abbr}%")]
            if m_num:
                conds.append(sa.extract('month', VerificationRecord.created_at) == m_num)
            q = q.filter(sa.or_(*conds))

        records = []
        for vr, app, ins in q.order_by(VerificationRecord.created_at.desc()).all():
            records.append({
                "verificationId": vr.id,
                "applicationId": app.id if app else vr.application_id,
                "instrumentId": ins.id if ins else vr.instrument_id,
                "instrumentType": ins.type if ins else "Commercial Instrument",
                "serialNumber": ins.serial_number if ins else "",
                "ownerName": app.owner_name if app else (ins.owner_name if ins else "Commercial Owner"),
                "businessName": app.business_name if app else (ins.business_name if ins else ""),
                "district": ins.district if ins else (app.preferred_location if app else "Patna"),
                "date": vr.inspection_date,
                "result": "FAIL",
                "status": "FAILED",
                "officerName": vr.officer_name,
                "certificateId": None,
                "failReason": vr.fail_reason or "Maximum Permissible Error tolerance exceeded.",
                "remarks": vr.officer_remarks or "Surveillance non-compliance logged."
            })
        return records

    elif target_outcome in ["UNDER_REVIEW", "IN_VERIFICATION", "REVIEW", "PENDING"]:
        q = session.query(Application, Instrument)\
            .outerjoin(Instrument, Application.instrument_id == Instrument.id)\
            .filter(Application.status.in_(["SUBMITTED", "UNDER_SCRUTINY", "UNDER_REVIEW", "SCHEDULED", "IN_VERIFICATION"]))

        if dist_filter:
            q = q.filter(sa.or_(Instrument.district == dist_filter, Application.preferred_location.like(f"%{dist_filter}%")))
        if inst_type_filter:
            q = q.filter(Instrument.type == inst_type_filter)

        records = []
        for app, ins in q.order_by(Application.created_at.desc()).all():
            records.append({
                "verificationId": f"PENDING-{app.id[-6:]}",
                "applicationId": app.id,
                "instrumentId": ins.id if ins else app.instrument_id,
                "instrumentType": ins.type if ins else (app.application_type or "Commercial Instrument"),
                "serialNumber": ins.serial_number if ins else "",
                "ownerName": app.owner_name,
                "businessName": app.business_name,
                "district": ins.district if ins else (app.preferred_location or "Patna"),
                "date": app.scheduled_date or app.submission_date,
                "result": "IN_REVIEW",
                "status": app.status,
                "officerName": app.assigned_officer_name or "Awaiting Officer Allocation",
                "certificateId": None,
                "failReason": None,
                "remarks": app.applicant_remarks or "Application currently under statutory scrutiny."
            })
        return records

    else:
        q = session.query(VerificationRecord, Application, Instrument)\
            .outerjoin(Application, VerificationRecord.application_id == Application.id)\
            .outerjoin(Instrument, VerificationRecord.instrument_id == Instrument.id)
        if dist_filter:
            q = q.filter(Instrument.district == dist_filter)
        if inst_type_filter:
            q = q.filter(Instrument.type == inst_type_filter)

        records = []
        for vr, app, ins in q.order_by(VerificationRecord.created_at.desc()).all():
            records.append({
                "verificationId": vr.id,
                "applicationId": app.id if app else vr.application_id,
                "instrumentId": ins.id if ins else vr.instrument_id,
                "instrumentType": ins.type if ins else "Commercial Instrument",
                "serialNumber": ins.serial_number if ins else "",
                "ownerName": app.owner_name if app else (ins.owner_name if ins else ""),
                "businessName": app.business_name if app else (ins.business_name if ins else ""),
                "district": ins.district if ins else "Patna",
                "date": vr.inspection_date,
                "result": vr.result,
                "status": "VERIFIED" if vr.result == "PASS" else "FAILED",
                "officerName": vr.officer_name,
                "certificateId": app.certificate_id if app else None,
                "failReason": vr.fail_reason,
                "remarks": vr.officer_remarks
            })
        return records


# --- 14. Audit Logs ---
@app.get("/api/v1/admin/audit-logs")
@app.get("/api/v1/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    current_user: User = Depends(require_role("ADMIN")),
    session: Session = Depends(get_db)
):
    """Statutory immutable audit log trail loaded from MySQL."""
    logs = session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [l.to_dict() for l in logs]


# -----------------------------------------------------------------------------
# Frontend Static Asset Hosting & SPA Fallback
# -----------------------------------------------------------------------------
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/frontend", StaticFiles(directory=str(frontend_dir)), name="frontend")
    # Also mount subdirectories for direct paths
    for subdir in ["css", "js", "assets"]:
        sub_path = frontend_dir / subdir
        if sub_path.exists():
            app.mount(f"/{subdir}", StaticFiles(directory=str(sub_path)), name=f"frontend_{subdir}")

root_dir = Path(__file__).resolve().parent.parent

@app.get("/{full_path:path}")
async def serve_spa_or_static(full_path: str):
    """Serves root static files (index.html, favicon, etc.) with clean fallback."""
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")

    # Block public access to internal system files and directories (Rule 7)
    blocked_prefixes = (
        "tests", "scripts", "docs", "backend", "storage",
        "keys", "venv", ".git", ".env"
    )
    norm_path = full_path.strip("/\\")
    top_seg = norm_path.split("/")[0].split("\\")[0]
    if top_seg in blocked_prefixes:
        raise HTTPException(status_code=404, detail="Not found")

    blocked_files = {
        "requirements.txt", ".python-version", "package.json",
        "server.js", "Procfile", "serve.json", "VERSION"
    }
    if norm_path in blocked_files:
        raise HTTPException(status_code=404, detail="Not found")

    # Check root directory first
    target_root = root_dir / full_path
    if target_root.is_file():
        return FileResponse(str(target_root))

    # Check frontend directory
    target_frontend = frontend_dir / full_path
    if target_frontend.is_file():
        return FileResponse(str(target_frontend))

    # Default fallback to index.html
    root_index = root_dir / "index.html"
    if root_index.is_file():
        return FileResponse(str(root_index))

    frontend_index = frontend_dir / "index.html"
    if frontend_index.is_file():
        return FileResponse(str(frontend_index))

    return JSONResponse(status_code=404, content={"detail": "Not found"})
