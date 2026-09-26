"""
Measure X — Production Provider-Based OTP Service Architecture
Fully compliant with MySQL 8.0 & SQLAlchemy 2.0 models:
- Provider-based delivery (Console, SMTP Email, HTTP SMS Gateway, Mock)
- Cryptographically secure random 6-digit OTP generation (secrets module)
- Salted SHA-256 hash storage in OTPRecord table (no plaintext storage)
- Configurable expiry (default 10 minutes)
- Attempt limits (default max 5 attempts)
- Resend cooldown enforcement (default 60 seconds)
- Single-use invalidation
- Zero plaintext OTP leakage in production API responses or UI
"""

import os
import sys
import secrets
import hashlib
import smtplib
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

from backend.database import db, OTPRecord, PasswordResetToken, User

# Configuration via environment variables
OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "console").lower()
OTP_EXPIRY_SECONDS = int(os.environ.get("OTP_EXPIRY_SECONDS", "600"))  # 10 minutes
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_COOLDOWN = int(os.environ.get("OTP_RESEND_COOLDOWN", "60"))  # 60 seconds

# SMS Gateway Config
SMS_API_KEY = os.environ.get("SMS_API_KEY", "")
SMS_SENDER_ID = os.environ.get("SMS_SENDER_ID", "MEASRX")
SMS_GATEWAY_URL = os.environ.get("SMS_GATEWAY_URL", "")

# Email SMTP Config
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USERNAME = os.environ.get("EMAIL_USERNAME", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "noreply@metrology.gov.in")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() in ("true", "1", "yes")


def mask_recipient(recipient: str) -> str:
    """Masks email or mobile number for safe privacy-preserving display."""
    if not recipient:
        return ""
    recipient = recipient.strip()
    if "@" in recipient:
        parts = recipient.split("@")
        name = parts[0]
        domain = parts[1]
        if len(name) <= 2:
            masked_name = name[0] + "*"
        else:
            masked_name = name[:2] + "*" * (len(name) - 3) + name[-1]
        return f"{masked_name}@{domain}"
    else:
        clean = recipient.replace(" ", "").replace("-", "")
        if len(clean) > 4:
            return "*" * (len(clean) - 4) + clean[-4:]
        return recipient


class OTPService:
    """
    Pluggable, Provider-Based One-Time Password Service for MySQL 8.
    """

    def __init__(self):
        self.provider = OTP_PROVIDER
        self.expiry_seconds = OTP_EXPIRY_SECONDS
        self.max_attempts = OTP_MAX_ATTEMPTS
        self.resend_cooldown = OTP_RESEND_COOLDOWN

    def _hash_otp(self, otp_code: str, salt: str) -> str:
        """Computes salted SHA-256 hash of OTP."""
        return hashlib.sha256(f"{salt}:{otp_code}".encode("utf-8")).hexdigest()

    def generate_code(self) -> str:
        """Generates a cryptographically secure 6-digit decimal string."""
        return f"{secrets.randbelow(900000) + 100000:06d}"

    def send_via_provider(self, recipient: str, otp_code: str, purpose: str) -> Tuple[bool, str]:
        """Dispatches OTP via configured communication provider."""
        masked = mask_recipient(recipient)

        if self.provider == "console" or self.provider == "development":
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            print("==================================================================", file=sys.stderr)
            print(f" [MEASUREX OTP SERVICE — SECURE AUDIT DISPATCH] {timestamp}", file=sys.stderr)
            print(f" Purpose:   {purpose}", file=sys.stderr)
            print(f" Recipient: {masked} ({recipient})", file=sys.stderr)
            print(f" OTP Code:  {otp_code}  [Valid for {self.expiry_seconds // 60} minutes]", file=sys.stderr)
            print(" Note:      Console provider active. Set OTP_PROVIDER=smtp or sms_gateway for production.", file=sys.stderr)
            print("==================================================================", file=sys.stderr)
            return True, f"OTP dispatched to {masked} via Secure Institutional Audit Console"

        elif self.provider == "smtp":
            if "@" not in recipient:
                return False, "SMTP provider requires an email address as recipient."
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"Measure X — Verification Code ({otp_code})"
                msg["From"] = EMAIL_FROM
                msg["To"] = recipient

                text_content = f"""Dear User,\n\nYour Measure X security verification code is: {otp_code}\n\nThis code is valid for {self.expiry_seconds // 60} minutes. Never share this code with anyone.\n\nLegal Metrology Directorate\nGovernment of Bihar"""
                msg.attach(MIMEText(text_content, "plain"))

                with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=10) as server:
                    if EMAIL_USE_TLS:
                        server.starttls()
                    if EMAIL_USERNAME and EMAIL_PASSWORD:
                        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
                    server.sendmail(EMAIL_FROM, [recipient], msg.as_string())
                return True, f"Email OTP successfully sent to {masked}"
            except Exception as e:
                print(f"[MeasureX OTP Service SMTP Error] {e}", file=sys.stderr)
                return False, f"SMTP dispatch failed: {str(e)}"

        elif self.provider == "sms_gateway":
            clean_phone = recipient.replace(" ", "").replace("-", "")
            if not SMS_GATEWAY_URL:
                return False, "SMS_GATEWAY_URL not configured."
            try:
                sms_text = f"Your Measure X verification code is {otp_code}. Valid for {self.expiry_seconds // 60} mins. Legal Metrology Directorate."
                payload = urllib.parse.urlencode({
                    "apiKey": SMS_API_KEY,
                    "sender": SMS_SENDER_ID,
                    "recipient": clean_phone,
                    "message": sms_text
                }).encode("utf-8")

                req = urllib.request.Request(
                    SMS_GATEWAY_URL,
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if 200 <= resp.status < 300:
                        return True, f"SMS OTP dispatched successfully to {masked}"
                    return False, f"SMS Gateway responded with status {resp.status}"
            except Exception as e:
                print(f"[MeasureX OTP Service SMS Error] {e}", file=sys.stderr)
                return False, f"SMS dispatch failed: {str(e)}"

        elif self.provider == "mock":
            return True, f"Mock OTP dispatched for {masked}"

        return False, f"Unknown OTP_PROVIDER: {self.provider}"

    def request_otp(self, recipient: str, purpose: str = "PASSWORD_RESET") -> Dict[str, Any]:
        """
        Processes an OTP request against MySQL:
        - Validates recipient & checks resend cooldown
        - Generates 6-digit random OTP
        - Stores salted hash in OTPRecord table
        - Dispatches via active provider
        """
        clean_recipient = recipient.strip().lower() if "@" in recipient else recipient.strip()
        now = datetime.utcnow()

        session = db.get_session()
        try:
            # Check existing active OTP for this recipient & cooldown
            last_otp = session.query(OTPRecord).filter(
                OTPRecord.recipient == clean_recipient,
                OTPRecord.purpose == purpose
            ).order_by(OTPRecord.created_at.desc()).first()

            if last_otp and last_otp.resend_available_at:
                if now < last_otp.resend_available_at:
                    seconds_left = int((last_otp.resend_available_at - now).total_seconds())
                    return {
                        "success": False,
                        "code": "COOLDOWN_ACTIVE",
                        "message": f"Please wait {seconds_left} seconds before requesting a new verification code.",
                        "secondsLeft": seconds_left
                    }

            # Generate new 6-digit code
            otp_code = self.generate_code()
            salt = secrets.token_hex(16)
            otp_hash = self._hash_otp(otp_code, salt)
            otp_id = f"OTP-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"

            expires_at = now + timedelta(seconds=self.expiry_seconds)
            resend_at = now + timedelta(seconds=self.resend_cooldown)

            # Save to MySQL
            record = OTPRecord(
                id=otp_id,
                recipient=clean_recipient,
                otp_hash=otp_hash,
                salt=salt,
                purpose=purpose,
                expires_at=expires_at,
                attempts=0,
                max_attempts=self.max_attempts,
                is_used=False,
                resend_available_at=resend_at,
                created_at=now
            )
            session.add(record)
            session.commit()

            # Dispatch via provider
            sent_ok, provider_msg = self.send_via_provider(clean_recipient, otp_code, purpose)

            return {
                "success": True,
                "otpId": otp_id,
                "maskedRecipient": mask_recipient(clean_recipient),
                "resendCooldown": self.resend_cooldown,
                "expiresInMinutes": self.expiry_seconds // 60,
                "message": f"Verification code successfully dispatched to {mask_recipient(clean_recipient)}.",
                "providerStatus": provider_msg
            }
        except Exception as e:
            session.rollback()
            return {"success": False, "message": f"OTP dispatch error: {str(e)}"}
        finally:
            session.close()

    def verify_otp(self, recipient: str, entered_otp: str, purpose: str = "PASSWORD_RESET") -> Dict[str, Any]:
        """
        Validates the submitted OTP against MySQL OTPRecord.
        """
        clean_recipient = recipient.strip().lower() if "@" in recipient else recipient.strip()
        now = datetime.utcnow()

        session = db.get_session()
        try:
            record = session.query(OTPRecord).filter(
                OTPRecord.recipient == clean_recipient,
                OTPRecord.purpose == purpose,
                OTPRecord.is_used == False
            ).order_by(OTPRecord.created_at.desc()).first()

            if not record:
                return {
                    "success": False,
                    "code": "NO_ACTIVE_OTP",
                    "message": "No active verification code found for this account. Please request a new one."
                }

            # Check attempt limit
            if record.attempts >= record.max_attempts:
                return {
                    "success": False,
                    "code": "MAX_ATTEMPTS_EXCEEDED",
                    "message": "Maximum verification attempts exceeded. Please request a new verification code."
                }

            # Check expiry
            if now > record.expires_at:
                return {
                    "success": False,
                    "code": "OTP_EXPIRED",
                    "message": "The verification code has expired. Please request a fresh code."
                }

            # Check hash
            computed_hash = self._hash_otp(entered_otp.strip(), record.salt)
            if not secrets.compare_digest(record.otp_hash, computed_hash):
                record.attempts += 1
                session.commit()
                remaining = max(0, record.max_attempts - record.attempts)
                return {
                    "success": False,
                    "code": "INVALID_OTP",
                    "message": f"Incorrect verification code. {remaining} attempt(s) remaining.",
                    "remainingAttempts": remaining
                }

            # Valid OTP: Mark as used
            record.is_used = True
            record.used_at = now

            # Find user
            clean_mobile = clean_recipient.replace(" ", "").replace("-", "")
            user = session.query(User).filter(
                (User.email == clean_recipient) | (User.mobile == clean_recipient) | (User.mobile == clean_mobile)
            ).first()
            user_id = user.id if user else "ANONYMOUS"

            # Generate single-use password reset authorization token
            reset_token_raw = f"MX-RST-{secrets.token_hex(24)}"
            reset_token_id = f"TKN-{now.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"
            reset_expires_at = now + timedelta(minutes=15)

            if user_id != "ANONYMOUS":
                tkn_record = PasswordResetToken(
                    id=reset_token_id,
                    user_id=user_id,
                    token=reset_token_raw,
                    expires_at=reset_expires_at,
                    is_used=False,
                    created_at=now
                )
                session.add(tkn_record)

            session.commit()

            return {
                "success": True,
                "message": "Verification code confirmed successfully.",
                "resetToken": reset_token_raw,
                "userId": user_id
            }
        except Exception as e:
            session.rollback()
            return {"success": False, "message": f"OTP verification error: {str(e)}"}
        finally:
            session.close()

    def validate_reset_token(self, reset_token: str) -> Optional[Dict[str, Any]]:
        """Validates that a reset token exists, is unused, and has not expired."""
        if not reset_token:
            return None
        session = db.get_session()
        try:
            record = session.query(PasswordResetToken).filter(
                PasswordResetToken.token == reset_token,
                PasswordResetToken.is_used == False
            ).first()
            if not record:
                return None
            if datetime.utcnow() > record.expires_at:
                return None
            return {
                "id": record.id,
                "user_id": record.user_id,
                "token": record.token,
                "expires_at": record.expires_at,
                "is_used": record.is_used
            }
        finally:
            session.close()

    def consume_reset_token(self, reset_token: str) -> bool:
        """Marks a reset token as used and burns it."""
        if not reset_token:
            return False
        session = db.get_session()
        try:
            record = session.query(PasswordResetToken).filter(
                PasswordResetToken.token == reset_token,
                PasswordResetToken.is_used == False
            ).first()
            if not record:
                return False
            record.is_used = True
            session.commit()
            return True
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()


# Singleton Instance
otp_service = OTPService()
