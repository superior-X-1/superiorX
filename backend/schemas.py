"""
Measure X — Pydantic Request & Response Data Schemas.
Statutory validation schemas for FastAPI endpoints.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    mobile: str
    password: str
    accountType: Optional[str] = None
    role: Optional[str] = None
    businessName: Optional[str] = None
    testCentreName: Optional[str] = None
    businessType: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    idType: Optional[str] = None
    idNumber: Optional[str] = None
    accreditationNumber: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    employeeId: Optional[str] = None
    jurisdiction: Optional[str] = None
    officeAddress: Optional[str] = None
    adminCode: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Optional[str] = None
    newPassword: Optional[str] = None

    @property
    def target_password(self) -> str:
        return self.new_password or self.newPassword or ""


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class OTPRequest(BaseModel):
    recipient: str
    purpose: str = "PASSWORD_RESET"


class OTPVerifyRequest(BaseModel):
    recipient: str
    otp: str
    purpose: str = "PASSWORD_RESET"


class SendNotificationRequest(BaseModel):
    targetType: str = "GROUP"  # 'USER', 'GROUP', 'ALL'
    targetRecipient: str
    title: str
    message: str
    priority: str = "MEDIUM"
    actionUrl: Optional[str] = None
    relatedEntity: Optional[str] = None
    relatedId: Optional[str] = None


class UpdateUserStatusRequest(BaseModel):
    status: str
    notes: Optional[str] = None


class InstrumentCreate(BaseModel):
    type: str
    manufacturer: str
    model: str
    serialNumber: str
    capacity: str
    location: str
    accuracyClass: Optional[str] = "Class III"
    verificationScaleIntervalE: Optional[str] = None
    minimumCapacity: Optional[str] = None
    purchaseDate: Optional[str] = None
    installationDetails: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None


class ApplicationCreate(BaseModel):
    instrumentId: str
    applicationType: str = "RE_VERIFICATION"
    preferredLocation: str
    remarks: Optional[str] = None


class ScheduleRequest(BaseModel):
    officerId: Optional[str] = None
    inspectorId: Optional[str] = None
    inspectorType: Optional[str] = "LMO"
    date: str
    time: str
    location: Optional[str] = None
    notes: Optional[str] = None


class AllocateRequest(BaseModel):
    assignmentType: Optional[str] = "LMO"
    assignedId: str  # officerId
    assignedName: Optional[str] = None
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    scheduledLocation: Optional[str] = None
    notes: Optional[str] = None


class ReassignRequest(BaseModel):
    assignmentType: Optional[str] = "LMO"
    assignedId: str
    assignedName: Optional[str] = None
    reason: str


class TestPointInput(BaseModel):
    name: str = "Test Point"
    nominalLoad: float
    observedLoad: float
    unit: str = "kg"
    toleranceMpe: Optional[float] = None


class VerificationSubmitRequest(BaseModel):
    applicationId: str
    inspectorType: Optional[str] = "LMO"
    physicalCondition: str = "PASS"  # PASS / FAIL / NA
    levelIndicator: str = "PASS"  # PASS / FAIL / NA
    zeroCheck: str = "PASS"  # PASS / FAIL / NA
    displayPointer: str = "PASS"  # PASS / FAIL / NA
    sealCheck: str = "PASS"  # PASS / FAIL / NA
    statutoryMarkings: str = "PASS"  # PASS / FAIL / NA
    testPoints: Optional[List[TestPointInput]] = None
    nominalTestWeight: Optional[str] = None
    observedMeasurement: Optional[str] = None
    permissibleError: Optional[str] = None
    unit: str = "kg"
    scaleIntervalE: Optional[str] = None
    accuracyClass: Optional[str] = "Class III"
    wireSealNumber: Optional[str] = None
    result: Optional[str] = None
    failReason: Optional[str] = None
    remarks: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RevokeCertificateRequest(BaseModel):
    reason: str


class ApplicationActionRequest(BaseModel):
    reason: Optional[str] = None
    remarks: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = None


class OfflineSyncItem(BaseModel):
    operationId: str
    entityType: str  # "INSPECTION" or "EVIDENCE"
    entityId: str
    payload: Dict[str, Any]


class OfflineSyncRequest(BaseModel):
    operations: List[OfflineSyncItem]
