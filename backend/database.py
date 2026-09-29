"""
Measure X — Database Connection, Engine & Lifecycle Layer.
Compliant with:
- Supabase PostgreSQL (Production, psycopg3 driver)
- Cloud Connection Pooling & Pre-ping Health Recovery
- Backward-compatible MySQL / SQLite fallback for local development
- OIML D31 & Legal Metrology Act, 2009 statutory requirements
"""

import os
import sys
import hashlib
import secrets
import urllib.parse
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
from dotenv import load_dotenv

import sqlalchemy as sa
from sqlalchemy import (
    Column, String, Text, Integer, Float, Double, Boolean, DateTime,
    ForeignKey, Index, UniqueConstraint, func, or_, and_
)
from sqlalchemy.orm import sessionmaker, scoped_session

# Load environment configuration
env_path = Path(__file__).resolve().parent / ".env"
root_env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

# Re-export Base and all ORM models from backend.models
from backend.models import (
    Base,
    Role,
    VerificationCentre,
    User,
    UserPreference,
    OwnerProfile,
    LMOProfile,
    PasswordResetToken,
    OTPRecord,
    InstrumentType,
    Instrument,
    Application,
    ApplicationAssignment,
    ApplicationDocument,
    VerificationSchedule,
    VerificationRecord,
    VerificationTestPoint,
    VerificationEvidence,
    Certificate,
    CertificateRevocation,
    OfflineSyncOperation,
    Notification,
    AuditLog,
    SystemSetting
)


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
# Database URL & Connection Resolver
# -----------------------------------------------------------------------------
def resolve_database_url() -> str:
    """
    Resolves the canonical database connection URL.
    Priority 1: DATABASE_URL environment variable (Supabase PostgreSQL / Cloud)
    Priority 2: DB_HOST / DB_USER MySQL configuration
    Priority 3: Local SQLite database file for zero-config local testing
    """
    raw_url = os.environ.get("DATABASE_URL")
    if raw_url:
        url = raw_url.strip()
        # Normalization for psycopg driver (PostgreSQL)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    # Fallback to MySQL if explicit DB_HOST or DB_USER provided
    db_host = os.environ.get("DB_HOST")
    if db_host:
        db_port = int(os.environ.get("DB_PORT", "3306"))
        db_name = os.environ.get("DB_NAME", "measurex")
        db_user = os.environ.get("DB_USER", "root")
        db_password = os.environ.get("DB_PASSWORD", "")
        encoded_password = urllib.parse.quote_plus(db_password)
        return f"mysql+pymysql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"

    # Default local development SQLite database
    local_sqlite = Path(__file__).resolve().parent / "measurex.db"
    return f"sqlite:///{local_sqlite}"


DATABASE_URL = resolve_database_url()


# -----------------------------------------------------------------------------
# Database Manager
# -----------------------------------------------------------------------------
class DatabaseManager:
    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or resolve_database_url()
        is_sqlite = self.db_url.startswith("sqlite")
        is_postgres = "postgresql" in self.db_url or "postgres" in self.db_url

        engine_kwargs: Dict[str, Any] = {
            "echo": False
        }

        if is_sqlite:
            engine_kwargs["connect_args"] = {"check_same_thread": False}
            if ":memory:" in self.db_url:
                from sqlalchemy.pool import StaticPool
                engine_kwargs["poolclass"] = StaticPool
        elif is_postgres:
            # Supabase PostgreSQL connection pooling configuration
            engine_kwargs["pool_pre_ping"] = True
            engine_kwargs["pool_recycle"] = int(os.environ.get("DB_POOL_RECYCLE", 300))
            engine_kwargs["pool_size"] = int(os.environ.get("DB_POOL_SIZE", 10))
            engine_kwargs["max_overflow"] = int(os.environ.get("DB_MAX_OVERFLOW", 20))
        else:
            # MySQL / other relational
            engine_kwargs["pool_pre_ping"] = True
            engine_kwargs["pool_recycle"] = 3600
            engine_kwargs["pool_size"] = int(os.environ.get("DB_POOL_SIZE", 15))
            engine_kwargs["max_overflow"] = int(os.environ.get("DB_MAX_OVERFLOW", 30))

        self.engine = sa.create_engine(self.db_url, **engine_kwargs)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.Session = scoped_session(self.session_factory)

        # In local development with MySQL configured, verify server is actually reachable
        if not is_postgres and not is_sqlite and os.environ.get("ENVIRONMENT") != "production":
            try:
                with self.engine.connect() as conn:
                    conn.execute(sa.text("SELECT 1"))
            except Exception as e:
                print(f"[MeasureX DB] Notice: Local MySQL server unreachable ({e}). Gracefully falling back to local SQLite database.")
                local_sqlite = Path(__file__).resolve().parent / "measurex.db"
                self.db_url = f"sqlite:///{local_sqlite}"
                self.engine = sa.create_engine(self.db_url, connect_args={"check_same_thread": False})
                self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
                self.Session = scoped_session(self.session_factory)

        self.init_database()

    def get_session(self):
        """Returns an isolated, thread-safe and async-safe SQLAlchemy session."""
        return self.session_factory()

    def init_database(self):
        """Creates all relational tables if not already existing, and seeds baseline records."""
        self.run_migrations()
        self.seed_baseline_data()

    def run_migrations(self):
        """
        Safely applies non-destructive schema migrations for new columns and tables.
        Guarantees existing PostgreSQL/MySQL data is preserved intact.
        """
        try:
            Base.metadata.create_all(self.engine)
            inspector = sa.inspect(self.engine)
            existing_tables = set(inspector.get_table_names())
            is_postgres = "postgresql" in str(self.engine.url) or "postgres" in str(self.engine.url)

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
                ("verification_evidence", "file_size_bytes", "INTEGER NULL"),
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
                                if is_postgres:
                                    conn.execute(sa.text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def}"))
                                else:
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
                session.query(User).filter(User.role_id == "GATC").update({
                    "role_id": "LMO",
                    "status": "DEACTIVATED",
                    "verification_centre_id": "VC-PAT-001"
                }, synchronize_session=False)
                session.query(Role).filter(Role.id == "GATC").delete(synchronize_session=False)
                session.commit()
            except Exception:
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
                        centre_name="Bhagalpur District Verification Facility",
                        centre_type="DISTRICT_LABORATORY",
                        address_line1="Kachhari Road, Near Central Jail",
                        address_line2=None,
                        district="Bhagalpur",
                        state="Bihar",
                        pincode="812001",
                        contact_phone="0641-2401882",
                        contact_email="bhagalpur.centre@metrology.bihar.gov.in",
                        license_number="LM-TEST-BHA-2024-001",
                        accreditation_number="NABL-TC-9311",
                        is_active=True
                    )
                ]
                for c in centres:
                    session.add(c)
                session.commit()

            # Seed Default Demo Accounts if table is empty
            if session.query(User).count() == 0:
                demo_accounts = [
                    {
                        "id": "USR-ADMIN-001",
                        "name": "State Directorate Administrator",
                        "email": "admin@measurex.gov.in",
                        "mobile": "9876543210",
                        "password_hash": hash_password("Admin@12345"),
                        "role_id": "ADMIN",
                        "status": "ACTIVE",
                        "designation": "Director of Legal Metrology",
                        "department": "Department of Consumer Affairs & Legal Metrology",
                        "employee_id": "DLM-BIH-001",
                        "jurisdiction": "Statewide (Bihar)"
                    },
                    {
                        "id": "USR-LMO-001",
                        "name": "Inspector Rajesh Kumar (LMO Patna)",
                        "email": "lmo.patna@measurex.gov.in",
                        "mobile": "9876543211",
                        "password_hash": hash_password("Lmo@12345"),
                        "role_id": "LMO",
                        "status": "ACTIVE",
                        "designation": "Legal Metrology Officer, Circle-1",
                        "department": "Legal Metrology Inspectorate",
                        "employee_id": "LMO-PAT-042",
                        "jurisdiction": "Patna Urban",
                        "verification_centre_id": "VC-PAT-001"
                    },
                    {
                        "id": "USR-TRADER-001",
                        "name": "Amit Sharma (Patna Agro Industries)",
                        "email": "trader@measurex.gov.in",
                        "mobile": "9876543212",
                        "password_hash": hash_password("Trader@12345"),
                        "role_id": "OWNER",
                        "status": "ACTIVE",
                        "business_name": "Patna Agro Industries Pvt Ltd",
                        "business_type": "Grain Milling & Food Processing",
                        "address": "Plot 12, Fatuha Industrial Area, Patna",
                        "district": "Patna",
                        "state": "Bihar",
                        "pincode": "803201"
                    }
                ]
                for acc in demo_accounts:
                    session.add(User(**acc))
                session.commit()

        except Exception as e:
            session.rollback()
            print(f"[MeasureX DB] Baseline seed warning: {e}", file=sys.stderr)
        finally:
            session.close()

    def log_audit(self, user_name: str, role: str, action: str, entity: str, entity_id: str,
                  previous_state: str, new_state: str, user_id: Optional[str] = None,
                  channel: str = "Secure Portal Web", details: str = "", client_ip: str = "127.0.0.1"):
        """Logs an immutable statutory audit entry."""
        session = self.get_session()
        try:
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


# Backward compatibility aliases
MySQLDatabaseManager = DatabaseManager

# Global Singleton Database Manager instance
db = DatabaseManager()
