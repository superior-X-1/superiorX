# Measure X — REST API Specification (SIH26036)

**Base URL**: `http://localhost:8000/api/v1`  
**Authentication**: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`)  
**Data Format**: `application/json` (except multipart file endpoints)

---

## 1. System Health & Cryptographic Keys

### `GET /health`
Validates backend availability, MySQL connectivity, and active RSA keypair status.
- **Auth Required**: No
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "database": "mysql",
  "database_connected": true,
  "signing_engine": "RSA-2048-PKCS1-V1_5",
  "key_id": "MEASUREX-RSA2048-2026-v1",
  "version": "2.5.0-sih26036"
}
```

### `GET /public/keys/public.pem`
Downloads the official RSA-2048 public key in PEM format for external statutory verification.
- **Auth Required**: No
- **Content-Type**: `application/x-pem-file`

---

## 2. Authentication & Stakeholder Onboarding

### `POST /auth/register`
Onboards stakeholders (OWNER, GATC, LMO).
- **Auth Required**: No
- **Request Body (GATC Example)**:
```json
{
  "name": "Patna Precision Metrology GATC",
  "email": "director@patnagatc.in",
  "mobile": "+91 98765 43210",
  "password": "SecurePassword@123",
  "role": "GATC",
  "businessName": "Patna Metrology Test Centre",
  "accreditationNumber": "NABL-TC-8891",
  "address": "Patliputra Industrial Estate",
  "district": "Patna",
  "state": "Bihar"
}
```
- **Response `200 OK`**: Returns user record with `status: "PENDING_APPROVAL"`.

### `POST /auth/login`
Authenticates credentials and returns a signed HMAC-SHA256 JWT.

---

## 3. Administrative Allocation Desk (SIH26036 Feature 2)

### `GET /allocation/available-officers`
Returns workload distribution across field LMOs and accredited GATCs.
- **Auth Required**: Yes (`ADMIN` or `LMO` or `GATC`)
- **Response `200 OK`**:
```json
{
  "lmos": [
    { "id": "USR-LMO-001", "name": "Rahul Kumar", "jurisdiction": "Patna Central", "activeInspectionsCount": 3 }
  ],
  "gatcs": [
    { "id": "USR-GATC-002", "name": "Patna Test Centre", "jurisdiction": "Patna Circle", "activeInspectionsCount": 1 }
  ]
}
```

### `POST /applications/{id}/allocate`
Statutoriily allocates an application to either an LMO or GATC.
- **Auth Required**: Yes (`ADMIN`)
- **Request Body**:
```json
{
  "assignmentType": "GATC",
  "gatcId": "USR-GATC-002",
  "notes": "Allocated for high-precision analytical balance verification"
}
```

### `POST /applications/{id}/reassign`
Reassigns an already allocated application with a mandatory statutory reason.

---

## 4. Field & Laboratory Verification (OIML R76 & RSA-2048)

### `POST /verification/submit`
Authoritatively evaluates multi-point measurement loads against OIML R76 MPE formulas, determines PASS/FAIL, signs the certificate with RSA-2048 private key, and generates ISO/IEC 18004 QR codes.
- **Auth Required**: Yes (`LMO` or `GATC` or `ADMIN`)
- **Request Body**:
```json
{
  "applicationId": "MX-APP-2026-9041",
  "result": "PASS",
  "verifierType": "GATC",
  "accuracyClass": "Class III",
  "scaleDivisionE": 0.01,
  "unit": "kg",
  "sealNumber": "GATC-BR-2026-8812",
  "testPoints": [
    { "loadStage": "MIN", "nominalLoad": 5.0, "observedValue": 5.003, "unit": "kg" },
    { "loadStage": "HALF", "nominalLoad": 25.0, "observedValue": 25.008, "unit": "kg" },
    { "loadStage": "MAX", "nominalLoad": 50.0, "observedValue": 50.012, "unit": "kg" }
  ],
  "environmentalConditions": {
    "temperature": 20.0,
    "humidity": 50.0,
    "pressure": 1013.2
  },
  "evidence": {
    "testBench": { "name": "bench.jpg", "url": "data:image/jpeg;base64,..." }
  }
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "decision": "PASS",
  "recordId": "VR-2026-9041",
  "certificate": {
    "id": "MX-CRT-2026-9041",
    "signatureAlgorithm": "RSA-2048-PKCS1-V1_5-SHA256",
    "digitalSignature": "iJ7...==",
    "keyId": "MEASUREX-RSA2048-2026-v1",
    "qrVerificationUrl": "http://localhost:3000/#verify?id=MX-CRT-2026-9041",
    "status": "VALID"
  }
}
```

---

## 5. Public Certificate Verification & Standards-Compliant QR Codes

### `GET /public/verify/{query}`
Public unauthenticated endpoint verifying certificate authenticity, RSA digital signature, revocation, and expiration status.
- **Auth Required**: No
- **Supported Query Identifiers**: Certificate ID, Instrument Serial, Wire Seal Number.
- **Response `200 OK`**:
```json
{
  "status": "VALID",
  "signatureValid": true,
  "keyId": "MEASUREX-RSA2048-2026-v1",
  "signatureAlgorithm": "RSA-2048-PKCS1-V1_5-SHA256",
  "certificate": {
    "certificateNumber": "MX-CRT-2026-9041",
    "instrumentType": "Electronic Weighing Scale (Platform)",
    "serialNumber": "AW-2026-9041",
    "capacity": "50 kg (e = 10 g)",
    "verificationDate": "2026-09-27",
    "validUntil": "2027-09-27",
    "verifierType": "GATC",
    "verifyingAuthority": "Patna Metrology Test Centre",
    "sealNumber": "GATC-BR-2026-8812"
  },
  "testPoints": [
    { "stage": "MIN", "nominal": 5.0, "observed": 5.003, "error": 0.003, "mpe": 0.010, "result": "PASS" }
  ]
}
```

### `GET /certificates/{id}/qr.png`
Direct HTTP PNG binary stream of standards-compliant ISO/IEC 18004 QR code encoding the public verification URL.
- **Auth Required**: No
- **Content-Type**: `image/png`

---

## 6. Offline PWA Synchronization

### `POST /verification/sync`
Batch ingestion endpoint for inspections captured while offline.
- **Auth Required**: Yes (`LMO` or `GATC` or `ADMIN`)
- **Request Body**:
```json
{
  "operations": [
    {
      "operationId": "SYNC-OP-001",
      "applicationId": "MX-APP-2026-9041",
      "data": { "result": "PASS", "sealNumber": "BR-LM-9941" },
      "capturedAt": "2026-09-27T10:15:00Z"
    }
  ]
}
```
