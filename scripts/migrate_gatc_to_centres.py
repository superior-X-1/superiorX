"""
MeasureX — Migration Script: GATC Role Elimination & Verification Centres Architecture
Transforms legacy GATC records into physical Verification Centre master data entities,
deactivates legacy GATC users, maps historical references, and permanently removes
the GATC role from the database.
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy as sa
from sqlalchemy import text
from backend.database import db

def run_gatc_migration():
    print("=" * 60)
    print("MEASUREX GATC ROLE ELIMINATION & CENTRES MIGRATION")
    print("=" * 60)

    engine = db.engine

    # Step 1: Ensure new tables exist via DDL
    print("[Step 1] Creating new tables if they do not exist...")
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS verification_centres (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            centre_code VARCHAR(50) NOT NULL UNIQUE,
            centre_name VARCHAR(200) NOT NULL,
            centre_type VARCHAR(100) NOT NULL DEFAULT 'GOVERNMENT_TEST_CENTRE',
            address_line1 TEXT NOT NULL,
            address_line2 TEXT NULL,
            district VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            pincode VARCHAR(20) NOT NULL,
            contact_phone VARCHAR(30) NULL,
            contact_email VARCHAR(150) NULL,
            license_number VARCHAR(100) NULL,
            accreditation_number VARCHAR(100) NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_vc_district (district),
            INDEX idx_vc_code (centre_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS instrument_types (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(150) NOT NULL,
            description TEXT NULL,
            default_verification_interval_months INT NOT NULL DEFAULT 12,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_inst_type_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS application_assignments (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            application_id VARCHAR(50) NOT NULL,
            assigned_lmo_id VARCHAR(50) NOT NULL,
            assigned_by VARCHAR(50) NOT NULL,
            verification_centre_id VARCHAR(50) NULL,
            assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            released_at DATETIME NULL,
            reason TEXT NULL,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            INDEX idx_app_assign_app (application_id),
            INDEX idx_app_assign_lmo (assigned_lmo_id),
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_lmo_id) REFERENCES users(id),
            FOREIGN KEY (assigned_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS certificate_revocations (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            certificate_id VARCHAR(50) NOT NULL,
            revoked_by VARCHAR(50) NOT NULL,
            revocation_reason TEXT NOT NULL,
            revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            previous_status VARCHAR(50) NOT NULL DEFAULT 'VALID',
            notes TEXT NULL,
            INDEX idx_cert_revoc_cert (certificate_id),
            FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE,
            FOREIGN KEY (revoked_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS user_preferences (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL UNIQUE,
            sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
            preferred_page_size INT NOT NULL DEFAULT 10,
            preferred_language VARCHAR(20) NOT NULL DEFAULT 'en',
            theme VARCHAR(20) NOT NULL DEFAULT 'light',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_pref_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS owner_profiles (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL UNIQUE,
            business_registration_number VARCHAR(100) NULL,
            gst_number VARCHAR(50) NULL,
            pan_number VARCHAR(50) NULL,
            trade_license_number VARCHAR(100) NULL,
            contact_person VARCHAR(150) NULL,
            authorized_signatory VARCHAR(150) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_owner_prof_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS lmo_profiles (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL UNIQUE,
            verification_centre_id VARCHAR(50) NULL,
            badge_number VARCHAR(100) NULL,
            warrant_number VARCHAR(100) NULL,
            posting_date VARCHAR(50) NULL,
            active_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_lmo_prof_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
    ]

    with engine.begin() as conn:
        for stmt in ddl_statements:
            conn.execute(text(stmt))

    # Step 2: Ensure new columns exist on existing tables
    print("[Step 2] Ensuring new columns exist on existing tables...")
    inspector = sa.inspect(engine)
    cols_to_add = [
        ("users", "verification_centre_id", "VARCHAR(50) NULL"),
        ("applications", "verification_centre_id", "VARCHAR(50) NULL"),
        ("certificates", "verification_centre_id", "VARCHAR(50) NULL"),
        ("verification_schedules", "verification_centre_id", "VARCHAR(50) NULL"),
        ("verification_records", "verification_centre_id", "VARCHAR(50) NULL"),
    ]

    with engine.begin() as conn:
        for table, col, col_def in cols_to_add:
            existing_cols = [c["name"] for c in inspector.get_columns(table)]
            if col not in existing_cols:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                print(f"  Added {table}.{col}")

    # Step 3: Seed Canonical Verification Centres
    print("[Step 3] Seeding Canonical Verification Centres...")
    centres = [
        ("VC-PAT-001", "PAT-CENTRAL-01", "Patna Central Legal Metrology Test Centre", "CENTRAL_LABORATORY",
         "Plot 14, Industrial Area, Patliputra", "Near Polytechnic Ground", "Patna", "Bihar", "800013",
         "0612-2589012", "patna.centre@metrology.bihar.gov.in", "LM-TEST-PAT-2024-001", "NABL-TC-8891", 1),
        ("VC-PAT-002", "PAT-NORTH-02", "Patna North Secondary Verification Centre", "SECONDARY_STANDARD_LAB",
         "Circle Office Compound, Bailey Road", None, "Patna", "Bihar", "800001",
         "0612-2234567", "patnanorth.centre@metrology.bihar.gov.in", "LM-TEST-PAT-2024-002", "NABL-TC-8892", 1),
        ("VC-GAY-001", "GAY-DIST-01", "Gaya District Legal Metrology Centre", "DISTRICT_LABORATORY",
         "Collectorate Compound, Civil Lines", None, "Gaya", "Bihar", "823001",
         "0631-2220199", "gaya.centre@metrology.bihar.gov.in", "LM-TEST-GAY-2024-001", "NABL-TC-9102", 1),
        ("VC-MUZ-001", "MUZ-REG-01", "Muzaffarpur Regional Metrology Laboratory", "REGIONAL_STANDARD_LAB",
         "Bela Industrial Estate, Phase 2", None, "Muzaffarpur", "Bihar", "842005",
         "0621-2273412", "muzaffarpur.centre@metrology.bihar.gov.in", "LM-TEST-MUZ-2024-001", "NABL-TC-9204", 1),
        ("VC-BHA-001", "BHA-DIST-01", "Bhagalpur Legal Metrology Inspection Centre", "DISTRICT_LABORATORY",
         "Station Road, Near Court Compound", None, "Bhagalpur", "Bihar", "812001",
         "0641-2401822", "bhagalpur.centre@metrology.bihar.gov.in", "LM-TEST-BHA-2024-001", "NABL-TC-9311", 1),
    ]

    with engine.begin() as conn:
        for c in centres:
            conn.execute(text("""
                INSERT INTO verification_centres 
                (id, centre_code, centre_name, centre_type, address_line1, address_line2, district, state, pincode, contact_phone, contact_email, license_number, accreditation_number, is_active, created_at, updated_at)
                VALUES (:id, :code, :name, :ctype, :a1, :a2, :dist, :state, :pin, :phone, :email, :lic, :acc, :act, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                centre_name = VALUES(centre_name),
                district = VALUES(district),
                state = VALUES(state),
                is_active = VALUES(is_active)
            """), {
                "id": c[0], "code": c[1], "name": c[2], "ctype": c[3],
                "a1": c[4], "a2": c[5], "dist": c[6], "state": c[7], "pin": c[8],
                "phone": c[9], "email": c[10], "lic": c[11], "acc": c[12], "act": c[13]
            })
    print("  Seeded 5 Verification Centres.")

    # Step 4: Seed Canonical Instrument Types
    print("[Step 4] Seeding Canonical Instrument Types...")
    inst_types = [
        ("INST-TYPE-EPS", "EPS", "Electronic Platform Scale", "Non-automatic electronic platform weighing instrument used in warehouses, retail, and wholesale mandis.", 12, 1),
        ("INST-TYPE-CWM", "CWM", "Counter Weighing Machine", "Compact electronic or mechanical counter scale used for retail and commercial weighing.", 12, 1),
        ("INST-TYPE-WBG", "WBG", "Weighbridge / Truck Scale", "Heavy-capacity platform weighbridge for motor vehicles and freight rail wagons.", 12, 1),
        ("INST-TYPE-FDU", "FDU", "Fuel Dispensing Unit", "Continuous liquid measuring system for petrol, diesel, and motor fuels at dispensing stations.", 12, 1),
        ("INST-TYPE-PAB", "PAB", "Precision Analytical Balance", "Class I and Class II high precision micro-balance used in jewellery, bullion, and pharmaceutical testing.", 12, 1),
        ("INST-TYPE-AGF", "AGF", "Automatic Gravimetric Filling Instrument", "Automated packaging and bagging weighing instrument for pre-packaged commodities.", 12, 1),
        ("INST-TYPE-SPB", "SPB", "Spring Balance", "Mechanical extension spring scale used for domestic and agricultural weighing.", 12, 1),
        ("INST-TYPE-NWI", "NWI", "Non-Automatic Weighing Instrument (NAWI)", "General non-automatic weighing instrument compliant with OIML R76 statutory guidelines.", 12, 1),
    ]

    with engine.begin() as conn:
        for it in inst_types:
            conn.execute(text("""
                INSERT INTO instrument_types (id, code, name, description, default_verification_interval_months, is_active, created_at, updated_at)
                VALUES (:id, :code, :name, :desc, :interval_m, :act, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                description = VALUES(description),
                is_active = VALUES(is_active)
            """), {
                "id": it[0], "code": it[1], "name": it[2], "desc": it[3], "interval_m": it[4], "act": it[5]
            })
    print("  Seeded 8 Instrument Types.")

    # Step 5: Migrate existing applications, certificates, schedules, records referencing GATC
    print("[Step 5] Migrating applications, certificates, and schedules referencing GATC to centres...")
    with engine.begin() as conn:
        # Default centre for migration: VC-PAT-001 (Patna Central Legal Metrology Test Centre)
        default_centre_id = "VC-PAT-001"

        # Update applications
        app_res = conn.execute(text("""
            UPDATE applications 
            SET verification_centre_id = :centre_id
            WHERE verification_centre_id IS NULL
        """), {"centre_id": default_centre_id})
        print(f"  Linked {app_res.rowcount} applications to default centre.")

        # Update certificates
        cert_res = conn.execute(text("""
            UPDATE certificates 
            SET verification_centre_id = :centre_id,
                verifier_type = 'LMO',
                authority = 'Department of Legal Metrology, Government of Bihar'
            WHERE verifier_type = 'GATC' OR verification_centre_id IS NULL
        """), {"centre_id": default_centre_id})
        print(f"  Updated {cert_res.rowcount} certificates to LMO/Centre.")

        # Update verification schedules
        sched_res = conn.execute(text("""
            UPDATE verification_schedules 
            SET inspector_type = 'LMO',
                verification_centre_id = :centre_id
            WHERE inspector_type = 'GATC' OR verification_centre_id IS NULL
        """), {"centre_id": default_centre_id})
        print(f"  Updated {sched_res.rowcount} verification schedules.")

        # Update verification records
        vr_res = conn.execute(text("""
            UPDATE verification_records 
            SET inspector_type = 'LMO',
                verification_centre_id = :centre_id
            WHERE inspector_type = 'GATC' OR verification_centre_id IS NULL
        """), {"centre_id": default_centre_id})
        print(f"  Updated {vr_res.rowcount} verification records.")

    # Step 6: Deactivate legacy GATC users and reassign role_id to 'LMO' (with DEACTIVATED status)
    print("[Step 6] Deactivating legacy GATC users...")
    with engine.begin() as conn:
        gatc_users_res = conn.execute(text("""
            UPDATE users 
            SET role_id = 'LMO',
                status = 'DEACTIVATED',
                verification_centre_id = 'VC-PAT-001',
                approval_notes = CONCAT(COALESCE(approval_notes, ''), ' [GATC role phased out; account archived and deactivated]')
            WHERE role_id = 'GATC'
        """))
        print(f"  Deactivated and archived {gatc_users_res.rowcount} legacy GATC user accounts.")

    # Step 7: Delete GATC role from roles table
    print("[Step 7] Deleting GATC role from roles table...")
    with engine.begin() as conn:
        del_res = conn.execute(text("DELETE FROM roles WHERE id = 'GATC'"))
        print(f"  Deleted GATC role from roles table (affected rows: {del_res.rowcount}).")

        # Verify active roles
        roles = conn.execute(text("SELECT id, name FROM roles ORDER BY id")).fetchall()
        print(f"  Current active roles in database: {[r[0] for r in roles]}")
        assert [r[0] for r in roles] == ['ADMIN', 'LMO', 'OWNER', 'PUBLIC'], f"Unexpected roles: {roles}"

    print("=" * 60)
    print("MIGRATION COMPLETED SUCCESSFULLY! ZERO GATC ROLES REMAINING.")
    print("=" * 60)

if __name__ == "__main__":
    run_gatc_migration()
