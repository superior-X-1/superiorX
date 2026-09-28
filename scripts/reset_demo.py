#!/usr/bin/env python3
"""
Measure X — Reset Demo Environment
SIH 26036: Online Verification System for Weighing and Measuring Instruments

Safely clears demo data and re-runs the authoritative demo seeder:
- Preserves any non-demo operational database records
- Re-seeds all 4 demo roles (Admin, LMO, GATC, Owner)
- Re-creates 14 real instruments, 23 applications, 16 verification records
- Re-signs all 10 certificates with RSA-2048 and regenerates ISO/IEC 18004 QR codes
- Re-generates all evidence SVG assets and application PDF documents
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from backend.database import (
    db, User, Instrument, Application, ApplicationDocument,
    VerificationSchedule, VerificationRecord, VerificationTestPoint,
    VerificationEvidence, Certificate, Notification, AuditLog
)
from scripts.seed_demo import seed_demo_environment


def reset_demo_environment():
    print("=================================================================")
    print("🔄 MEASURE X — RESETTING DEMO ENVIRONMENT")
    print("=================================================================")
    session = db.get_session()
    try:
        # Delete only records created for or referencing demo items
        print("1. Cleaning up demo test points and evidence...")
        session.query(VerificationTestPoint).filter(VerificationTestPoint.id.like("TP-VR-DEMO-%")).delete(synchronize_session=False)
        session.query(VerificationEvidence).filter(VerificationEvidence.id.like("EVD-DEMO-%")).delete(synchronize_session=False)

        print("2. Cleaning up demo certificates and documents...")
        session.query(Certificate).filter(Certificate.id.like("MX-CERT-DEMO-%")).delete(synchronize_session=False)
        session.query(ApplicationDocument).filter(ApplicationDocument.id.like("DOC-DEMO-%")).delete(synchronize_session=False)

        print("3. Cleaning up demo verification records and schedules...")
        session.query(VerificationRecord).filter(VerificationRecord.id.like("VR-DEMO-%")).delete(synchronize_session=False)
        session.query(VerificationSchedule).filter(VerificationSchedule.id.like("SCHED-DEMO-%")).delete(synchronize_session=False)

        print("4. Cleaning up demo applications and instruments...")
        session.query(Application).filter(Application.id.like("MX-APP-DEMO-%")).delete(synchronize_session=False)
        session.query(Instrument).filter(Instrument.id.like("INS-DEMO-%")).delete(synchronize_session=False)

        print("5. Cleaning up demo notifications and audit logs...")
        session.query(Notification).filter(Notification.id.like("NOTIF-DEMO-%")).delete(synchronize_session=False)
        session.query(AuditLog).filter(AuditLog.audit_code.like("AUD-DEMO-%")).delete(synchronize_session=False)

        session.commit()
        print("✓ Demo records safely cleared.")
    except Exception as e:
        session.rollback()
        print(f"⚠️ Warning during demo cleanup: {e}")
    finally:
        session.close()

    # Re-run full authoritative seed
    seed_demo_environment()


if __name__ == "__main__":
    reset_demo_environment()
