from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import re

class GenerateSingleRequest(BaseModel):
    name: str
    nik: str
    email: EmailStr
    organization: str
    ou: str
    pfx_password: str

    @field_validator("name", "nik", "email", "organization", "ou", "pfx_password", mode="before")
    @classmethod
    def no_newlines_or_tabs(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v or "\t" in v):
            raise ValueError("Input cannot contain newline, carriage return, or tab characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

class GenerateSingleResponse(BaseModel):
    serial_number: str
    subject: str
    issuer: str
    fingerprint_sha256: str
    issued_at: str
    expires_at: str
    certificate_path: str
    p12_reference: str

class GenerateBulkRequestItem(BaseModel):
    name: str
    nik: str
    email: EmailStr
    organization: str
    ou: str
    pfx_password: str

    @field_validator("name", "nik", "email", "organization", "ou", "pfx_password", mode="before")
    @classmethod
    def no_newlines_or_tabs(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v or "\t" in v):
            raise ValueError("Input cannot contain newline, carriage return, or tab characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

class GenerateBulkRequest(BaseModel):
    requests: List[GenerateBulkRequestItem]

class GenerateBulkResultItem(BaseModel):
    nik: str
    status: str
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class GenerateBulkResponse(BaseModel):
    results: List[GenerateBulkResultItem]

class ChangeP12PassphraseRequest(BaseModel):
    nik: str
    new_password: str

    @field_validator("nik", "new_password", mode="before")
    @classmethod
    def no_newlines(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v or "\t" in v):
            raise ValueError("Input cannot contain newline, carriage return, or tab characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

class ChangeP12PassphraseUserRequest(BaseModel):
    nik: str
    old_password: str
    new_password: str

    @field_validator("nik", "old_password", "new_password", mode="before")
    @classmethod
    def no_newlines_or_tabs(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v or "\t" in v):
            raise ValueError("Input cannot contain newline, carriage return, or tab characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

class ChangeP12PassphraseAdminRequest(BaseModel):
    nik: str
    new_password: str

    @field_validator("nik", "new_password", mode="before")
    @classmethod
    def no_newlines_or_tabs(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v or "\t" in v):
            raise ValueError("Input cannot contain newline, carriage return, or tab characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

class RegenerateStageResponse(BaseModel):
    staging_token: str
    target_user_dir: str
    target_archive_p12: str
    metadata: GenerateSingleResponse

class RegenerateCommitRequest(BaseModel):
    staging_token: str
    target_user_dir: str
    target_archive_p12: str

class RegenerateCleanupRequest(BaseModel):
    staging_token: str

