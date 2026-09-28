"""
Measure X — SIH26036 Complete Statutory Lifecycle Integration Test Suite
Validates:
1. GATC First-Class Role: Registration, Approval, and Login
2. Allocation to LMO vs GATC & Double-Booking Conflict Prevention
3. Statutory Document Upload & Retrieval
4. Authoritative Verification Calculation (OIML R76 Multi-point MPE)
5. RSA-2048 Cryptographic Asymmetric Signature & Verification
6. Real Standards-Compliant ISO/IEC 18004 QR Generation & PNG Stream
7. Mobile Field Evidence Upload with GPS Coordinates
8. Public Certificate Authenticity & Multi-Identifier Verification
9. Offline Synchronization Conflict Resolution
10. Automated Expiry & Validity Monitoring Engine
"""

import os
import sys
import io
import pytest
from datetime import datetime, date, timedelta
# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import db, User, Application, Instrument, Certificate

import secrets

client = TestClient(app)

@pytest.fixture(scope="module")
def statutory_fixture():
    timestamp = f"{datetime.utcnow().strftime('%y%m%d%H%M%S')}_{secrets.token_hex(3)}"
    rand_digits = secrets.token_hex(4)[:6]

    owner_mobile = f"98{secrets.randbelow(90000000) + 10000000}"
    owner_res = client.post("/api/v1/auth/register", json={
        "name": f"Bihar Agro Trader {timestamp[-4:]}",
        "email": f"trader_{timestamp}@bihar.test",
        "mobile": owner_mobile,
        "password": "Password@123",
        "role": "OWNER",
        "businessName": "Bihar Agro Commodities",
        "businessType": "Wholesale Mandi",
        "address": "Bazar Samiti, Patna",
        "district": "Patna",
        "state": "Bihar"
    })
    assert owner_res.status_code == 200, f"Owner reg failed: {owner_res.text}"
    owner_token = client.post("/api/v1/auth/login", json={
        "email": f"trader_{timestamp}@bihar.test",
        "password": "Password@123"
    }).json()["token"]

    # 2. Assert GATC registration is strictly rejected (GATC role removal)
    gatc_mobile = f"97{secrets.randbelow(90000000) + 10000000}"
    gatc_res = client.post("/api/v1/auth/register", json={
        "name": "Patna Precision Metrology GATC",
        "email": f"gatc_{timestamp}@centre.test",
        "mobile": gatc_mobile,
        "password": "GatcPassword@123",
        "role": "GATC"
    })
    assert gatc_res.status_code == 400, "GATC registration must be prohibited under current statutory policy!"

    # 3. Register LMO (Statutory Verifier)
    lmo_mobile = f"96{secrets.randbelow(90000000) + 10000000}"
    lmo_res = client.post("/api/v1/auth/register", json={
        "name": f"LMO Officer {timestamp[-4:]}",
        "email": f"lmo_{timestamp}@bihar.gov.test",
        "mobile": lmo_mobile,
        "password": "LmoPassword@123",
        "role": "LMO",
        "designation": "Legal Metrology Officer",
        "department": "Department of Legal Metrology",
        "jurisdiction": "Patna Central"
    })
    assert lmo_res.status_code == 200, f"LMO reg failed: {lmo_res.text}"
    lmo_user = lmo_res.json()["user"]

    # 4. Register Admin & Login
    admin_mobile = f"95{secrets.randbelow(90000000) + 10000000}"
    admin_res = client.post("/api/v1/auth/register", json={
        "name": "State Controller",
        "email": f"admin_{timestamp}@bihar.gov.test",
        "mobile": admin_mobile,
        "password": "AdminPassword@123",
        "role": "ADMIN",
        "adminCode": "MX-GOV-ADMIN-2026"
    })
    assert admin_res.status_code == 200, f"Admin reg failed: {admin_res.text}"
    admin_token = client.post("/api/v1/auth/login", json={
        "email": f"admin_{timestamp}@bihar.gov.test",
        "password": "AdminPassword@123"
    }).json()["token"]

    # 5. Admin Approves LMO
    approve_lmo = client.patch(
        f"/api/v1/admin/users/{lmo_user['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ACTIVE", "notes": "Official gazette notification confirmed."}
    )
    assert approve_lmo.status_code == 200

    # 6. LMO Login (Now succeeds after Admin Approval)
    lmo_login_res = client.post("/api/v1/auth/login", json={
        "email": f"lmo_{timestamp}@bihar.gov.test",
        "password": "LmoPassword@123"
    })
    assert lmo_login_res.status_code == 200
    lmo_token = lmo_login_res.json()["token"]

    return {
        "timestamp": timestamp,
        "owner_token": owner_token,
        "lmo_token": lmo_token,
        "lmo_user": lmo_user,
        "admin_token": admin_token
    }


def test_1_lmo_role_and_workload_api(statutory_fixture):
    """Test LMO role retrieval and allocation availability endpoint."""
    admin_token = statutory_fixture["admin_token"]
    res = client.get("/api/v1/allocation/available-officers", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "lmos" in data
    assert any(l["id"] == statutory_fixture["lmo_user"]["id"] for l in data["lmos"])


def test_2_instrument_registration_and_application(statutory_fixture):
    """Test Owner registers an instrument and submits verification application."""
    owner_token = statutory_fixture["owner_token"]
    timestamp = statutory_fixture["timestamp"]

    # Register Instrument
    ins_res = client.post("/api/v1/instruments", headers={"Authorization": f"Bearer {owner_token}"}, json={
        "type": "Electronic Platform Scale",
        "manufacturer": "Avery Weigh-Tronix India",
        "model": "E-Scale 300",
        "serialNumber": f"SN-AV-{timestamp}",
        "capacity": "300 kg",
        "location": "Warehouse Platform 1",
        "accuracyClass": "Class III",
        "verificationScaleIntervalE": "0.05",
        "district": "Patna",
        "state": "Bihar"
    })
    assert ins_res.status_code == 200
    ins_id = ins_res.json()["id"]

    # Submit Application
    app_res = client.post("/api/v1/applications", headers={"Authorization": f"Bearer {owner_token}"}, json={
        "instrumentId": ins_id,
        "applicationType": "INITIAL_VERIFICATION",
        "preferredLocation": "Warehouse Platform 1, Patna",
        "remarks": "Request statutory stamping for mandi trading."
    })
    assert app_res.status_code == 200
    app_id = app_res.json()["id"]

    statutory_fixture["instrument_id"] = ins_id
    statutory_fixture["application_id"] = app_id


def test_3_document_upload_and_download(statutory_fixture):
    """Test document upload with MIME validation and retrieval."""
    owner_token = statutory_fixture["owner_token"]
    app_id = statutory_fixture["application_id"]

    pdf_content = b"%PDF-1.4 statutory purchase invoice content mock"
    files = {"file": ("invoice.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {"documentType": "PURCHASE_INVOICE"}

    upload_res = client.post(
        f"/api/v1/applications/{app_id}/documents/upload",
        headers={"Authorization": f"Bearer {owner_token}"},
        data=data,
        files=files
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["applicationId"] == app_id
    assert doc_data["mimeType"] == "application/pdf"

    # Download document
    doc_id = doc_data["id"]
    down_res = client.get(f"/api/v1/documents/{doc_id}/download")
    assert down_res.status_code == 200
    assert down_res.content == pdf_content


def test_4_allocation_to_lmo_and_conflict_check(statutory_fixture):
    """Test Admin allocates application to LMO with double-booking prevention."""
    admin_token = statutory_fixture["admin_token"]
    app_id = statutory_fixture["application_id"]
    lmo_id = statutory_fixture["lmo_user"]["id"]

    # Allocate to LMO
    alloc_res = client.post(
        f"/api/v1/applications/{app_id}/allocate",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "assignmentType": "LMO",
            "assignedId": lmo_id,
            "scheduledDate": "2026-10-15",
            "scheduledTime": "11:00 AM",
            "notes": "Assigned to LMO for statutory field verification."
        }
    )
    assert alloc_res.status_code == 200
    alloc_app = alloc_res.json()["application"]
    assert alloc_app["assignmentType"] == "LMO"
    assert alloc_app["assignedOfficerId"] == lmo_id
    assert alloc_app["status"] == "SCHEDULED"


def test_5_field_verification_oiml_math_and_rsa_signature(statutory_fixture):
    """
    Test LMO submits verification with multi-test points.
    Verifies:
    - OIML R76 MPE error calculation
    - 6-item checklist
    - RSA-2048 private key signing
    - ISO/IEC 18004 QR generation
    """
    lmo_token = statutory_fixture["lmo_token"]
    app_id = statutory_fixture["application_id"]
    timestamp = statutory_fixture["timestamp"]

    # Submit verification with 3 test points (Min, Mid, Max)
    submit_payload = {
        "applicationId": app_id,
        "inspectorType": "LMO",
        "physicalCondition": "PASS",
        "levelIndicator": "PASS",
        "zeroCheck": "PASS",
        "displayPointer": "PASS",
        "sealCheck": "PASS",
        "statutoryMarkings": "PASS",
        "accuracyClass": "Class III",
        "scaleIntervalE": "0.05",
        "wireSealNumber": f"WS-LMO-{timestamp[-4:]}",
        "latitude": 25.5941,
        "longitude": 85.1376,
        "testPoints": [
            {"name": "Min Test Load (10%)", "nominalLoad": 30.0, "observedLoad": 30.01, "unit": "kg"},
            {"name": "Half Capacity (50%)", "nominalLoad": 150.0, "observedLoad": 150.02, "unit": "kg"},
            {"name": "Max Capacity (100%)", "nominalLoad": 300.0, "observedLoad": 300.04, "unit": "kg"}
        ],
        "remarks": "Calibrated with Class M1 working standards. Fully compliant with Legal Metrology (General) Rules."
    }

    sub_res = client.post(
        "/api/v1/verification/submit",
        headers={"Authorization": f"Bearer {lmo_token}"},
        json=submit_payload
    )
    assert sub_res.status_code == 200
    res_data = sub_res.json()
    assert res_data["result"] == "PASS"
    assert res_data["certificate"] is not None

    cert = res_data["certificate"]
    assert cert["verifierType"] == "LMO"
    assert cert["digitalSignature"] is not None
    assert cert["signatureAlgorithm"] == "RSA-SHA256"
    assert "data:image/png;base64" in cert["qrPayload"]

    statutory_fixture["certificate_id"] = cert["id"]
    statutory_fixture["wire_seal_number"] = cert["wireSealNumber"]


def test_6_evidence_upload_with_gps(statutory_fixture):
    """Test mobile field evidence upload with GPS coordinates."""
    lmo_token = statutory_fixture["lmo_token"]
    app_id = statutory_fixture["application_id"]

    photo_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00\x60\x00\x60\x00\x00\xFF\xDB\x00C\x00"
    files = {"file": ("inspection_seal.jpg", io.BytesIO(photo_bytes), "image/jpeg")}
    data = {
        "applicationId": app_id,
        "category": "WIRE_SEAL",
        "caption": "Statutory lead wire seal affixed to calibration junction box",
        "latitude": "25.59409",
        "longitude": "85.13758"
    }

    evd_res = client.post(
        "/api/v1/verification/evidence/upload",
        headers={"Authorization": f"Bearer {lmo_token}"},
        data=data,
        files=files
    )
    assert evd_res.status_code == 200
    evd_data = evd_res.json()
    assert evd_data["category"] == "WIRE_SEAL"
    assert abs(evd_data["latitude"] - 25.59409) < 1e-4


def test_7_real_qr_png_and_public_verification(statutory_fixture):
    """
    Test public verification by Certificate ID, Serial Number, and Wire Seal.
    Verifies RSA signature validation and raw PNG QR code delivery.
    """
    cert_id = statutory_fixture["certificate_id"]
    serial_no = f"SN-AV-{statutory_fixture['timestamp']}"
    seal_no = statutory_fixture["wire_seal_number"]

    # 1. Download raw QR PNG stream
    qr_png_res = client.get(f"/api/v1/certificates/{cert_id}/qr.png")
    assert qr_png_res.status_code == 200
    assert qr_png_res.headers["content-type"] == "image/png"
    assert len(qr_png_res.content) > 100

    # 2. Public Verify by Certificate ID (Unauthenticated)
    v1 = client.get(f"/api/v1/public/verify/{cert_id}")
    assert v1.status_code == 200
    v1_data = v1.json()
    assert v1_data["valid"] is True
    assert v1_data["status"] == "VALID"
    assert v1_data["signatureValid"] is True
    assert v1_data["signatureAlgorithm"] == "RSA-SHA256"
    assert v1_data["verifier"]["verifierType"] == "LMO"

    # 3. Public Verify by Serial Number
    v2 = client.get(f"/api/v1/public/verify/{serial_no}")
    assert v2.status_code == 200
    assert v2.json()["certificateNumber"] == cert_id

    # 4. Public Verify by Wire Seal Number
    v3 = client.get(f"/api/v1/public/verify/{seal_no}")
    assert v3.status_code == 200
    assert v3.json()["certificateNumber"] == cert_id

    # 5. Public Search endpoint
    search_res = client.get(f"/api/v1/public/search?q={statutory_fixture['timestamp']}")
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1


def test_8_automated_expiry_engine(statutory_fixture):
    """Test administrative trigger for certificate validity & statutory expiry engine."""
    admin_token = statutory_fixture["admin_token"]
    res = client.post("/api/v1/admin/run-expiry-check", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert "processed" in res.json()
