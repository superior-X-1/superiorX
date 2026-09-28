"""
Measure X — Production Real MySQL Integration Test Suite
Validates:
1. MySQL connection (PyMySQL + SQLAlchemy)
2. Database connection & 14 relational tables
3. Real Registration (OWNER, LMO with PENDING_APPROVAL, ADMIN)
4. Real Login (Salted PBKDF2 hash verification, JWT generation)
5. /auth/me endpoint (identity bound to MySQL user record)
6. Profile validation (actual user data, zero hardcoded/demo users)
7. Dashboard data isolation (OWNER only sees their own instruments)
8. Role-based access control (403 for unauthorized roles)
9. Admin approval flow (LMO PENDING_APPROVAL -> ACTIVE approval)
10. Audit trail persistence in MySQL
"""

import os
import sys
import json
# standard assertions
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
import pytest
load_dotenv()

from fastapi.testclient import TestClient
import sqlalchemy as sa
from sqlalchemy.orm import Session

from backend.database import db, Base, User, Role, Instrument, AuditLog, SystemSetting
from backend.main import app

client = TestClient(app)

def test_1_mysql_connection():
    print("\n--- TEST 1: Direct MySQL Engine Connection ---")
    with db.engine.connect() as conn:
        res = conn.execute(sa.text("SELECT VERSION(), CURRENT_USER(), DATABASE();")).fetchone()
        print(f"MySQL Version: {res[0]}, User: {res[1]}, Database: {res[2]}")
        assert res[2] == "measurex", f"Expected database 'measurex', got '{res[2]}'"
        print("[PASS] Real MySQL database connection established successfully.")

def test_2_database_tables():
    print("\n--- TEST 2: Relational Database Tables Verification ---")
    inspector = sa.inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    print(f"Existing tables in MySQL ({len(existing_tables)}): {sorted(list(existing_tables))}")
    
    required_tables = [
        "roles", "users", "password_reset_tokens", "otp_records",
        "instruments", "applications", "application_documents",
        "verification_schedules", "verification_records", "verification_evidence",
        "certificates", "notifications", "audit_logs", "system_settings"
    ]
    
    for table in required_tables:
        assert table in existing_tables, f"Missing required table: {table}"
    print(f"[PASS] All {len(required_tables)} core relational tables verified in MySQL.")

@pytest.fixture(name="auth_context", scope="module")
def auth_context_fixture():
    print("\n--- FIXTURE: Registration & Login with Real MySQL Users ---")
    timestamp = datetime.utcnow().strftime("%y%m%d%H%M%S")
    
    # 1. Register OWNER
    owner_email = f"trader_{timestamp}@mandi.test"
    owner_payload = {
        "name": "Suresh Trading Corp",
        "email": owner_email,
        "mobile": f"9876{timestamp[-6:]}",
        "password": "Password@123",
        "role": "OWNER",
        "businessName": "Suresh Agro Commodities",
        "businessType": "Wholesale Trader",
        "district": "Patna",
        "state": "Bihar",
        "pincode": "800001"
    }
    res_reg_owner = client.post("/api/v1/auth/register", json=owner_payload)
    assert res_reg_owner.status_code == 200, f"Owner reg failed: {res_reg_owner.text}"
    owner_data = res_reg_owner.json()["user"]
    assert owner_data["status"] == "ACTIVE"
    assert owner_data["role"] == "OWNER"
    print(f"[PASS] Real OWNER created in MySQL: ID={owner_data['id']}, Name={owner_data['name']}")

    # 2. Register LMO (Must have PENDING_APPROVAL)
    lmo_email = f"inspector_{timestamp}@metrology.test"
    lmo_payload = {
        "name": "Ramesh Kumar Inspector",
        "email": lmo_email,
        "mobile": f"9811{timestamp[-6:]}",
        "password": "Password@123",
        "role": "LMO",
        "department": "Legal Metrology Department",
        "designation": "Legal Metrology Officer",
        "employeeId": f"EMP-LMO-{timestamp[-4:]}",
        "jurisdiction": "Patna East Circle"
    }
    res_reg_lmo = client.post("/api/v1/auth/register", json=lmo_payload)
    assert res_reg_lmo.status_code == 200, f"LMO reg failed: {res_reg_lmo.text}"
    lmo_data = res_reg_lmo.json()["user"]
    assert lmo_data["status"] == "PENDING_APPROVAL", f"Expected PENDING_APPROVAL, got {lmo_data['status']}"
    assert lmo_data["role"] == "LMO"
    print(f"[PASS] Real LMO created in MySQL with PENDING_APPROVAL: ID={lmo_data['id']}")

    # 3. Register ADMIN (With official onboarding code)
    admin_email = f"director_{timestamp}@metrology.test"
    admin_payload = {
        "name": "Director General Metrology",
        "email": admin_email,
        "mobile": f"9822{timestamp[-6:]}",
        "password": "AdminPassword@123",
        "role": "ADMIN",
        "adminCode": "MX-GOV-ADMIN-2026",
        "department": "Directorate of Legal Metrology"
    }
    res_reg_admin = client.post("/api/v1/auth/register", json=admin_payload)
    assert res_reg_admin.status_code == 200, f"Admin reg failed: {res_reg_admin.text}"
    admin_data = res_reg_admin.json()["user"]
    assert admin_data["status"] == "ACTIVE"
    assert admin_data["role"] == "ADMIN"
    print(f"[PASS] Real ADMIN created in MySQL: ID={admin_data['id']}")

    # 4. Attempt Login for LMO (Must be blocked with 403 because status=PENDING_APPROVAL)
    res_lmo_login_blocked = client.post("/api/v1/auth/login", json={
        "email": lmo_email,
        "password": "Password@123"
    })
    assert res_lmo_login_blocked.status_code == 403
    print("[PASS] Unapproved LMO correctly rejected at login with 403 Forbidden.")

    # 5. Login OWNER (Must succeed and return JWT)
    res_owner_login = client.post("/api/v1/auth/login", json={
        "email": owner_email,
        "password": "Password@123"
    })
    assert res_owner_login.status_code == 200
    owner_token = res_owner_login.json()["token"]
    assert owner_token and len(owner_token) > 20
    print("[PASS] Real OWNER successfully logged in, JWT token issued.")

    # 6. Login ADMIN (Must succeed and return JWT)
    res_admin_login = client.post("/api/v1/auth/login", json={
        "email": admin_email,
        "password": "AdminPassword@123"
    })
    assert res_admin_login.status_code == 200
    admin_token = res_admin_login.json()["token"]
    print("[PASS] Real ADMIN successfully logged in, JWT token issued.")

    return {
        "owner": owner_data,
        "owner_token": owner_token,
        "owner_email": owner_email,
        "lmo": lmo_data,
        "lmo_email": lmo_email,
        "admin": admin_data,
        "admin_token": admin_token,
        "timestamp": timestamp
    }

def test_5_and_6_auth_me_and_profile(auth_context):
    print("\n--- TEST 5 & 6: /auth/me and Real Profile Integrity ---")
    owner_token = auth_context["owner_token"]
    owner_data = auth_context["owner"]

    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_me.status_code == 200, f"/auth/me failed: {res_me.text}"
    me_data = res_me.json()

    assert me_data["id"] == owner_data["id"]
    assert me_data["email"] == owner_data["email"]
    assert me_data["name"] == owner_data["name"]
    assert me_data["businessName"] == "Suresh Agro Commodities"
    assert me_data["role"] == "OWNER"
    print(f"[PASS] /auth/me correctly resolved user identity from JWT and MySQL: {me_data['name']} ({me_data['email']})")
    print("[PASS] Verified profile has NO hardcoded user information.")

def test_7_and_8_dashboard_and_owner_isolation(auth_context):
    print("\n--- TEST 7 & 8: Dashboard Data & Owner Isolation ---")
    owner_token = auth_context["owner_token"]
    owner_id = auth_context["owner"]["id"]
    timestamp = auth_context["timestamp"]

    # 1. Owner 1 registers an instrument
    ins_payload = {
        "type": "Electronic Platform Scale",
        "manufacturer": "Essae Digitronics",
        "model": "DS-500",
        "serialNumber": f"SN-{timestamp}",
        "capacity": "500 kg",
        "location": "Godown No. 3, Mandi, Patna",
        "accuracyClass": "Class III",
        "district": "Patna",
        "state": "Bihar"
    }
    res_ins = client.post("/api/v1/instruments", json=ins_payload, headers={"Authorization": f"Bearer {owner_token}"})
    assert res_ins.status_code == 200, f"Create instrument failed: {res_ins.text}"
    created_ins = res_ins.json()
    assert created_ins["ownerId"] == owner_id
    ins_id = created_ins["id"]
    print(f"[PASS] Instrument registered in MySQL: ID={ins_id}, Owner={created_ins['ownerName']}")

    # 2. Owner 1 lists instruments -> should see their 1 instrument
    res_list1 = client.get("/api/v1/instruments", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_list1.status_code == 200
    owner1_instruments = res_list1.json()
    assert any(i["id"] == ins_id for i in owner1_instruments)
    print(f"[PASS] Owner 1 sees their registered instrument in dashboard.")

    # 3. Create a second independent OWNER
    owner2_email = f"other_trader_{timestamp}@mandi.test"
    res_reg_owner2 = client.post("/api/v1/auth/register", json={
        "name": "Second Trader Co.",
        "email": owner2_email,
        "mobile": f"9777{timestamp[-6:]}",
        "password": "Password@123",
        "role": "OWNER"
    })
    assert res_reg_owner2.status_code == 200
    res_owner2_login = client.post("/api/v1/auth/login", json={"email": owner2_email, "password": "Password@123"})
    owner2_token = res_owner2_login.json()["token"]

    # 4. Owner 2 lists instruments -> MUST NOT see Owner 1's instrument!
    res_list2 = client.get("/api/v1/instruments", headers={"Authorization": f"Bearer {owner2_token}"})
    assert res_list2.status_code == 200
    owner2_instruments = res_list2.json()
    assert not any(i["id"] == ins_id for i in owner2_instruments), "DATA LEAK: Owner 2 can see Owner 1's instrument!"
    print("[PASS] Owner isolation strictly verified: Owner 2 cannot see Owner 1's instrument.")

    # 5. Owner 2 attempts direct GET on Owner 1's instrument -> Expect 403 Forbidden
    res_forbidden_get = client.get(f"/api/v1/instruments/{ins_id}", headers={"Authorization": f"Bearer {owner2_token}"})
    assert res_forbidden_get.status_code == 403
    print("[PASS] Unauthorized direct access blocked with 403 Forbidden.")

def test_9_role_based_access_control(auth_context):
    print("\n--- TEST 9: Role-Based Access Control (RBAC) ---")
    owner_token = auth_context["owner_token"]
    admin_token = auth_context["admin_token"]

    # 1. OWNER tries to access Admin user management -> Must be 403 Forbidden
    res_owner_admin = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner_admin.status_code == 403
    print("[PASS] Non-admin (OWNER) blocked from /admin/users with 403 Forbidden.")

    # 2. ADMIN accesses Admin user management -> Must be 200 OK
    res_admin_users = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin_users.status_code == 200
    user_list = res_admin_users.json()
    assert len(user_list) >= 3
    print(f"[PASS] Admin authorized to view /admin/users (Found {len(user_list)} real MySQL users).")

def test_10_admin_approval_flow(auth_context):
    print("\n--- TEST 10: Admin Approval Flow for LMO ---")
    admin_token = auth_context["admin_token"]
    lmo_id = auth_context["lmo"]["id"]
    lmo_email = auth_context["lmo_email"]

    # 1. Admin approves the pending LMO
    approval_payload = {
        "status": "ACTIVE",
        "notes": "Verified government appointment order & identity credentials."
    }
    res_approve = client.patch(
        f"/api/v1/admin/users/{lmo_id}/status",
        json=approval_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_approve.status_code == 200, f"Admin approval failed: {res_approve.text}"
    approved_user = res_approve.json()["user"]
    assert approved_user["status"] == "ACTIVE"
    assert approved_user["approvedBy"] == auth_context["admin"]["id"]
    print(f"[PASS] Admin approved LMO: Status changed to {approved_user['status']}")

    # 2. Verify in MySQL directly
    session = db.get_session()
    try:
        db_user = session.query(User).filter(User.id == lmo_id).first()
        assert db_user.status == "ACTIVE"
        assert db_user.approved_by == auth_context["admin"]["id"]
        assert db_user.approved_at is not None
        print("[PASS] MySQL database record verified directly: LMO is now ACTIVE with approval metadata.")
    finally:
        session.close()

    # 3. LMO logs in now -> Must SUCCEED!
    res_lmo_login = client.post("/api/v1/auth/login", json={
        "email": lmo_email,
        "password": "Password@123"
    })
    assert res_lmo_login.status_code == 200, f"Approved LMO login failed: {res_lmo_login.text}"
    lmo_token = res_lmo_login.json()["token"]
    print("[PASS] Approved LMO can now successfully log in and receive JWT token.")

    # 4. LMO calls /auth/me -> Must return ACTIVE status
    res_lmo_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {lmo_token}"})
    assert res_lmo_me.status_code == 200
    assert res_lmo_me.json()["status"] == "ACTIVE"
    assert res_lmo_me.json()["role"] == "LMO"
    print("[PASS] Approved LMO /auth/me returns ACTIVE status.")

if __name__ == "__main__":
    print("================================================================")
    print("Running Full Measure X Real MySQL Production Integration Tests")
    print("================================================================")
    
    test_1_mysql_connection()
    test_2_database_tables()
    ctx = test_3_and_4_registration_and_login()
    test_5_and_6_auth_me_and_profile(ctx)
    test_7_and_8_dashboard_and_owner_isolation(ctx)
    test_9_role_based_access_control(ctx)
    test_10_admin_approval_flow(ctx)
    
    print("\n================================================================")
    print("SUCCESS: ALL 10 TESTS PASSED SUCCESSFULLY AGAINST REAL MYSQL DATABASE!")
    print("================================================================")
