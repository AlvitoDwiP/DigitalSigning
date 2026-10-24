import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CertificateBase(BaseModel):
    serial_number: str
    certificate_number: str
    sequence_number: Optional[int] = None
    issued_year: Optional[int] = None
    subject: str
    issuer: str
    fingerprint_sha256: str
    issued_at: datetime
    expires_at: datetime
    status: str


class CertificateResponse(CertificateBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class CertificateInDB(CertificateBase):
    id: uuid.UUID
    user_id: uuid.UUID
    certificate_path: str
    p12_reference: str
    replaced_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegenerateCertificateRequest(BaseModel):
    admin_password: Optional[str] = None
    password: Optional[str] = None
    pfx_password: Optional[str] = None
    confirm_pfx_password: Optional[str] = None


class RegenerateCertificateNewCertData(BaseModel):
    id: uuid.UUID
    serial_number: str
    certificate_number: str
    issued_at: datetime
    expires_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class RegenerateCertificateData(BaseModel):
    old_certificate_id: uuid.UUID
    new_certificate: RegenerateCertificateNewCertData


class RegenerateCertificateResponse(BaseModel):
    success: bool = True
    data: RegenerateCertificateData


class PublicCertificateItem(CertificateBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class PublicCertificateDetail(PublicCertificateItem):
    is_valid: bool
