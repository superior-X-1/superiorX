# Measure X — REST API Specification

**Base URL**: `http://localhost:8000/api/v1`  
**Authentication**: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`)  
**Data Format**: `application/json`

---

## 1. System Health

### `GET /health`
Validates backend availability and active MySQL connection.

- **Auth Required**: No
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "database": "mysql",
  "database_connected": true,
  "version": "2.4.0-master",
  "timestamp": "2026-09-24T22:00:00.000000"
}
```

---

## 2. Authentication & Session

### `POST /auth/register`
Creates a new user in MySQL with securely hashed credentials.

- **Auth Required**: No
- **Request Body**:
```json
{
  "name": "Yaseen Test",
  "email": "yaseen.test@example.com",
  "mobile": "+91 9000000001",
  "password": "Password@123",
  "role": "OWNER",
  "businessName": "Yaseen Trading Corporation",
  "businessType": "Wholesale Mandi Trader",
  "address": "Shop 42, Mandi Complex",
  "district": "Patna",
  "state": "Bihar",
  "pincode": "800001"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "user": {
    "id": "USR-OWN-2609-0106",
    "name": "Yaseen Test",
    "email": "yaseen.test@example.com",
    "mobile": "+91 90000 00001",
    "role": "OWNER",
    "status": "ACTIVE",
    "businessName": "Yaseen Trading Corporation"
  },
  "message": "Account created successfully."
}
```

### `POST /auth/login`
Authenticates a user against MySQL and issues a signed HMAC-SHA256 JWT.

- **Auth Required**: No
- **Request Body**:
```json
{
  "email": "yaseen.test@example.com",
  "password": "Password@123"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "USR-OWN-2609-0106",
    "name": "Yaseen Test",
    "email": "yaseen.test@example.com",
    "mobile": "+91 90000 00001",
    "role": "OWNER",
    "status": "ACTIVE"
  }
}
```

### `GET /auth/me`
Retrieves the exact authenticated user from MySQL using the Bearer JWT.

- **Auth Required**: Yes (`Bearer <token>`)
- **Response `200 OK`**:
```json
{
  "id": "USR-OWN-2609-0106",
  "name": "Yaseen Test",
  "email": "yaseen.test@example.com",
  "mobile": "+91 90000 00001",
  "role": "OWNER",
  "status": "ACTIVE",
  "businessName": "Yaseen Trading Corporation",
  "district": "Patna",
  "state": "Bihar"
}
```

---

## 3. Commercial Instruments

### `GET /instruments`
Lists instruments. When called by an `OWNER`, automatically isolates to instruments where `owner_id == current_user.id`. When called by `LMO` or `ADMIN`, returns all instruments.

- **Auth Required**: Yes
- **Query Params**: `status` (optional, e.g. `ACTIVE`, `EXPIRING_SOON`, `PENDING_VERIFICATION`)
- **Response `200 OK`**:
```json
[
  {
    "id": "MX-INS-260924163020-B29D",
    "ownerId": "USR-OWN-2609-0106",
    "ownerName": "Yaseen Test",
    "businessName": "Yaseen Trading Corporation",
    "type": "Electronic Weighbridge (Class III)",
    "manufacturer": "Avery India Ltd.",
    "model": "E-WB-60T",
    "serialNumber": "AV-2024-WB-901",
    "capacity": "60,000 kg",
    "accuracyClass": "Class III",
    "location": "Warehouse Platform 1",
    "status": "ACTIVE",
    "validUntil": "24 Sep 2027"
  }
]
```

### `POST /instruments`
Registers a new weighing instrument in MySQL. Automatically associates `owner_id = current_user.id`.

- **Auth Required**: Yes (`OWNER`, `ADMIN`)
- **Request Body**:
```json
{
  "type": "Electronic Platform Scale",
  "manufacturer": "Essae-Teraoka Ltd.",
  "model": "DS-215",
  "serialNumber": "ES-2024-PS-108",
  "capacity": "150 kg",
  "accuracyClass": "Class III",
  "location": "Retail Weighing Counter",
  "businessName": "Yaseen Trading Corporation"
}
```

---

## 4. Verification Applications

### `GET /applications`
Lists verification applications with role-based filtering (`OWNER` sees only their applications; `LMO` sees circle/assigned applications; `ADMIN` sees state-wide).

- **Auth Required**: Yes
- **Query Params**: `status` (optional, e.g. `SUBMITTED`, `SCHEDULED`, `COMPLETED`)

### `POST /applications`
Submits an application for verification/re-verification.

- **Auth Required**: Yes (`OWNER`)
- **Request Body**:
```json
{
  "instrumentId": "MX-INS-260924163020-B29D",
  "applicationType": "RE_VERIFICATION",
  "preferredLocation": "Mandi Weighing Bay 2",
  "remarks": "Annual statutory calibration"
}
```
- **Response `200 OK`**:
```json
{
  "id": "MX-APP-260924163021-294C",
  "instrumentId": "MX-INS-260924163020-B29D",
  "ownerId": "USR-OWN-2609-0106",
  "ownerName": "Yaseen Test",
  "status": "SUBMITTED",
  "feeAmount": 750.0,
  "paymentReference": "PAY-UPI-0E833C923F3F",
  "submissionDate": "24 Sep 2026"
}
```

### `POST /applications/{id}/schedule`
Schedules a field inspection for a submitted application.

- **Auth Required**: Yes (`LMO`, `ADMIN`)
- **Request Body**:
```json
{
  "officerId": "USR-LMO-2609-0111",
  "date": "28 Sep 2026",
  "time": "11:30 AM",
  "location": "Mandi Weighing Bay 2"
}
```

---

## 5. Field Inspection & Verification

### `POST /verification/submit`
Submits physical testing results. If `result == 'PASS'`, generates an official digital certificate with a SHA-256 digital signature hash and QR code payload.

- **Auth Required**: Yes (`LMO`, `ADMIN`)
- **Request Body**:
```json
{
  "applicationId": "MX-APP-260924163021-294C",
  "physicalCondition": "PASS",
  "zeroCheck": "PASS",
  "accuracyTest": "PASS",
  "sealCheck": "PASS",
  "observedMeasurement": "100.01 kg",
  "permissibleError": "±0.05 kg",
  "unit": "kg",
  "result": "PASS",
  "wireSealNumber": "WS-PAT-2026-9021",
  "remarks": "Within Class III MPE statutory tolerance."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "record": {
    "id": "VR-260924163332-01A2",
    "applicationId": "MX-APP-260924163021-294C",
    "result": "PASS"
  },
  "certificate": {
    "id": "MX-CERT-260924163332-0430",
    "instrumentId": "MX-INS-260924163020-B29D",
    "validUntil": "24 Sep 2027",
    "wireSealNumber": "WS-PAT-2026-9021",
    "status": "VALID",
    "qrPayload": "https://measurex.gov.in/verify/MX-CERT-260924163332-0430?sig=...",
    "digitalSignatureHash": "00ec39bc3055f210fa44da99c81e5aa96fbf3116baa77d6f19b82bb2b4449c90"
  }
}
```

---

## 6. Certificates & Public QR Verification

### `GET /certificates`
Lists certificates with owner data isolation.

- **Auth Required**: Yes

### `GET /certificates/{id}`
Returns details for a specific certificate.

- **Auth Required**: Yes

### `GET /public/verify/{certificate_id}`
Public consumer endpoint to instantly verify any physical QR certificate stamp on an instrument. No login required.

- **Auth Required**: No
- **Response `200 OK`**:
```json
{
  "valid": true,
  "certificateId": "MX-CERT-260924163332-0430",
  "status": "VALID",
  "instrumentId": "MX-INS-260924163020-B29D",
  "instrumentType": "Electronic Weighbridge (Class III)",
  "manufacturer": "Avery India Ltd.",
  "serialNumber": "AV-2024-WB-901",
  "ownerName": "Yaseen Test",
  "businessName": "Yaseen Trading Corporation",
  "verificationDate": "24 Sep 2026",
  "validUntil": "24 Sep 2027",
  "officerName": "Candidate Officer Vivek",
  "wireSealNumber": "WS-PAT-2026-9021",
  "digitalSignatureHash": "00ec39bc3055f210fa44da99c81e5aa96fbf3116baa77d6f19b82bb2b4449c90"
}
```

---

## 7. Directorate Administration

### `GET /admin/users`
Lists registered users with role and status filtering.

- **Auth Required**: Yes (`ADMIN`)
- **Query Params**: `role` (`OWNER`, `LMO`), `status` (`ACTIVE`, `PENDING_APPROVAL`, `REJECTED`)

### `PATCH /admin/users/{user_id}/status`
Approves or rejects onboarding applications (e.g. approving a newly registered LMO).

- **Auth Required**: Yes (`ADMIN`)
- **Request Body**:
```json
{
  "status": "ACTIVE",
  "notes": "Credentials and circle jurisdiction verified."
}
```

### `GET /audit/logs`
Returns the tamper-evident statutory audit trail.

- **Auth Required**: Yes (`ADMIN`, `LMO`)
- **Query Params**: `limit` (default 50)
