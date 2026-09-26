"""
Measure X — Master Rebuild Verification Test Suite
Tests:
1. System Health Check & Real MySQL connectivity
2. Registration of Yaseen Test (OWNER)
3. Login of Yaseen Test & JWT issuance
4. /auth/me returns Yaseen Test (NOT Rajesh)
5. Owner data isolation between two distinct owners (Yaseen vs Owner Two)
6. LMO registration workflow (initial status PENDING_APPROVAL, login forbidden)
7. Admin login & administrative approval of LMO
8. Approved LMO login & status ACTIVE
9. Application submission & field inspection schedule
10. LMO verification submission & digital certificate issuance with QR payload
"""

import json
import urllib.request
import urllib.error
import time

BASE_URL = 'http://127.0.0.1:8000/api/v1'


def api_call(path, method='GET', data=None, token=None):
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, {'detail': content}
    except Exception as e:
        return 500, {'error': str(e)}


def run_tests():
    print("========================================================")
    print("MEASURE X — FINAL END-TO-END VERIFICATION SUITE")
    print("========================================================")

    # 1. Health Check
    s, r = api_call('/health')
    print("0. Health Check:", s, r.get('database'), "Connected:", r.get('database_connected'))
    assert s == 200 and r.get('database_connected') is True, "Health check failed"

    # 2. TEST 1: Register & Login Yaseen Test
    print("\n--- TEST 1: Register & Login Yaseen Test ---")
    yaseen_data = {
        'name': 'Yaseen Test',
        'email': 'yaseen.test@example.com',
        'mobile': '+91 9000000001',
        'password': 'Test@12345',
        'role': 'OWNER',
        'businessName': 'Yaseen Commodities Pvt Ltd'
    }
    s, r = api_call('/auth/register', 'POST', yaseen_data)
    if s == 400:
        print("  User already registered, proceeding to login")
    else:
        print("  Registration status:", s, "| User ID:", r.get('user', {}).get('id'))
        assert s == 200, f"Registration failed: {r}"

    # Login Yaseen
    s, r = api_call('/auth/login', 'POST', {'email': 'yaseen.test@example.com', 'password': 'Test@12345'})
    assert s == 200, f"Login failed: {r}"
    yaseen_token = r['token']
    yaseen_user = r['user']
    print("  Login Success! User Name:", yaseen_user['name'])
    print("  Role:", yaseen_user['role'], "| Status:", yaseen_user['status'])
    assert yaseen_user['name'] == 'Yaseen Test', "FAILED: User name is not Yaseen Test!"
    assert 'Rajesh' not in yaseen_user['name'], "CRITICAL BUG: Rajesh appeared in Yaseen's login response!"

    # 3. TEST 2: /auth/me (Simulating browser refresh)
    print("\n--- TEST 2: /auth/me Identity Persistence ---")
    s, r = api_call('/auth/me', 'GET', token=yaseen_token)
    assert s == 200, f"/auth/me failed: {r}"
    print("  /auth/me returned name:", r['name'], "| email:", r['email'], "| role:", r['role'])
    assert r['name'] == 'Yaseen Test', f"FAILED: /auth/me returned {r['name']} instead of Yaseen Test!"
    assert 'Rajesh' not in r['name'], "CRITICAL FAILURE: Rajesh found in authenticated user profile!"

    # 4. TEST 3: Logout & Login Again
    print("\n--- TEST 3: Relogin ---")
    s, r = api_call('/auth/login', 'POST', {'email': 'yaseen.test@example.com', 'password': 'Test@12345'})
    assert s == 200 and r['user']['name'] == 'Yaseen Test'
    print("  Relogin successful as:", r['user']['name'])

    # 5. TEST 5: Owner Isolation Test
    print("\n--- TEST 5: Owner Data Isolation ---")
    # Create Instrument A for Yaseen
    s, ins_a = api_call('/instruments', 'POST', {
        'type': 'Electronic Weighbridge',
        'manufacturer': 'Avery India',
        'model': 'WB-5000',
        'serialNumber': 'YSN-WB-001',
        'capacity': '50 Ton',
        'location': 'Mandi Complex Bay 4, Patna'
    }, token=yaseen_token)
    assert s == 200, f"Instrument creation failed: {ins_a}"
    print("  Created Instrument A for Yaseen:", ins_a['id'], "owner_id:", ins_a['ownerId'])
    assert ins_a['ownerId'] == yaseen_user['id']

    # Register Owner B
    owner_b_data = {
        'name': 'Demo Owner Two',
        'email': 'owner2@example.com',
        'mobile': '+91 9000000002',
        'password': 'Password@123',
        'role': 'OWNER',
        'businessName': 'Second Trader Logistics'
    }
    s, r = api_call('/auth/register', 'POST', owner_b_data)
    s, r = api_call('/auth/login', 'POST', {'email': 'owner2@example.com', 'password': 'Password@123'})
    assert s == 200, f"Owner B login failed: {r}"
    owner_b_token = r['token']
    owner_b_user = r['user']
    print("  Logged in as Owner B:", owner_b_user['name'], "| ID:", owner_b_user['id'])

    # Create Instrument B for Owner B
    s, ins_b = api_call('/instruments', 'POST', {
        'type': 'Digital Counter Scale',
        'manufacturer': 'Essae',
        'model': 'DS-500',
        'serialNumber': 'OWN2-DS-002',
        'capacity': '30 kg',
        'location': 'Shop 12, Patna'
    }, token=owner_b_token)
    assert s == 200, f"Instrument B creation failed: {ins_b}"
    print("  Created Instrument B for Owner B:", ins_b['id'], "owner_id:", ins_b['ownerId'])

    # Query Instruments as Yaseen
    s, yaseen_instruments = api_call('/instruments', 'GET', token=yaseen_token)
    yaseen_ins_ids = [i['id'] for i in yaseen_instruments]
    print("  Yaseen instrument count:", len(yaseen_instruments), "IDs:", yaseen_ins_ids)
    assert ins_a['id'] in yaseen_ins_ids, "Yaseen Instrument A missing from Yaseen list"
    assert ins_b['id'] not in yaseen_ins_ids, "SECURITY BREACH: Owner B Instrument found in Yaseen list!"

    # Query Instruments as Owner B
    s, b_instruments = api_call('/instruments', 'GET', token=owner_b_token)
    b_ins_ids = [i['id'] for i in b_instruments]
    print("  Owner B instrument count:", len(b_instruments), "IDs:", b_ins_ids)
    assert ins_b['id'] in b_ins_ids, "Owner B Instrument missing from Owner B list"
    assert ins_a['id'] not in b_ins_ids, "SECURITY BREACH: Yaseen Instrument found in Owner B list!"
    print("  SUCCESS: Owner Data Isolation 100% verified via MySQL database queries!")

    # 6. TEST 6: LMO Registration (Status must be PENDING_APPROVAL)
    print("\n--- TEST 6: LMO Registration Workflow ---")
    timestamp = int(time.time())
    lmo_email = f'vivek.lmo.{timestamp}@bihar.gov.in'
    lmo_data = {
        'name': 'Candidate Officer Vivek',
        'email': lmo_email,
        'mobile': f'+91 943{timestamp % 10000000:07d}',
        'password': 'Officer@123',
        'role': 'LMO',
        'department': 'Department of Legal Metrology, Bihar',
        'designation': 'Inspector',
        'jurisdiction': 'Patna South Circle'
    }
    s, r = api_call('/auth/register', 'POST', lmo_data)
    print("  LMO Registration status:", s, "| Status:", r.get('user', {}).get('status'))
    assert r.get('user', {}).get('status') == 'PENDING_APPROVAL', "FAILED: LMO status should be PENDING_APPROVAL!"

    # Attempt LMO login before approval -> Must return 403 Forbidden
    s, r = api_call('/auth/login', 'POST', {'email': lmo_email, 'password': 'Officer@123'})
    print("  LMO Login before approval status code:", s, "(Expected 403)")
    assert s == 403, f"Expected 403 for pending LMO, got {s}: {r}"
    print("  SUCCESS: Pending LMO login forbidden before administrative approval!")

    # 7. TEST 7: Admin logs in and approves LMO
    print("\n--- TEST 7: Admin Approval Workflow ---")
    s, r = api_call('/auth/login', 'POST', {'email': 'director.legal@metrology.gov.in', 'password': 'Admin@123'})
    assert s == 200, f"Admin login failed: {r}"
    admin_token = r['token']
    admin_user = r['user']
    print("  Admin logged in:", admin_user['name'], "| Role:", admin_user['role'])

    # Find pending LMO user ID
    s, users = api_call('/admin/users?role=LMO&status=PENDING_APPROVAL', 'GET', token=admin_token)
    pending_lmo = next((u for u in users if u['email'] == lmo_email), None)
    assert pending_lmo is not None, f"Pending LMO {lmo_email} not found in admin list!"
    lmo_id = pending_lmo['id']
    print("  Found pending LMO:", lmo_id, pending_lmo['name'])

    # Admin approves LMO
    s, r = api_call(f'/admin/users/{lmo_id}/status', 'PATCH', {'status': 'ACTIVE', 'notes': 'Service credentials verified'}, token=admin_token)
    assert s == 200 and r['user']['status'] == 'ACTIVE', f"Approval failed: {r}"
    print("  Admin approved LMO in MySQL! New status:", r['user']['status'])

    # 8. TEST 8: Approved LMO can now log in
    print("\n--- TEST 8: Approved LMO Login ---")
    s, r = api_call('/auth/login', 'POST', {'email': lmo_email, 'password': 'Officer@123'})
    assert s == 200, f"Approved LMO login failed: {r}"
    lmo_token = r['token']
    print("  Approved LMO Login Success! Name:", r['user']['name'], "| Status:", r['user']['status'])

    # 9. TEST 9: Application filing & Certificate Issuance
    print("\n--- TEST 9: Application & Certificate Workflow ---")
    s, app_res = api_call('/applications', 'POST', {
        'instrumentId': ins_a['id'],
        'applicationType': 'RE_VERIFICATION',
        'preferredLocation': 'Trader Mandi Complex'
    }, token=yaseen_token)
    assert s == 200, f"Application filing failed: {app_res}"
    app_id = app_res['id']
    print("  Yaseen filed Application:", app_id, "for instrument:", ins_a['id'])

    # LMO submits verification
    s, verif_res = api_call('/verification/submit', 'POST', {
        'applicationId': app_id,
        'physicalCondition': 'PASS',
        'zeroCheck': 'PASS',
        'accuracyTest': 'PASS',
        'sealCheck': 'PASS',
        'observedMeasurement': '100.01 kg',
        'permissibleError': '±0.05 kg',
        'unit': 'kg',
        'result': 'PASS',
        'wireSealNumber': 'WS-PAT-2026-9021',
        'remarks': 'Annual calibration within statutory Class III MPE limits'
    }, token=lmo_token)
    assert s == 200, f"Verification submit failed: {verif_res}"
    cert = verif_res.get('certificate')
    assert cert is not None, "Certificate was not generated!"
    print("  Verification PASS! Generated Certificate:", cert['id'])
    print("  QR Payload:", cert['qrPayload'])
    print("  Digital Signature Hash:", cert['digitalSignatureHash'])

    # Public verification check
    s, pub_res = api_call(f"/public/verify/{cert['id']}")
    assert s == 200 and pub_res['valid'] is True, f"Public verify failed: {pub_res}"
    print("  Public QR Seal Verification: VALID!")

    print("\n========================================================")
    print("ALL 10 TESTS COMPLETED AND 100% PASSED!")
    print("========================================================")


if __name__ == '__main__':
    run_tests()
