import re
from typing import List, Optional
from pydantic import BaseModel, field_validator
from app.core.config import settings

class SingleCertRequest(BaseModel):
    name: str
    nik: str
    email: str
    organization: str
    ou: str
    pfx_password: Optional[str] = None

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not re.fullmatch(r"\d{16}", cleaned):
            raise ValueError("NIK must be exactly 16 numeric digits.")
        return cleaned

    @field_validator("pfx_password", mode="before")
    @classmethod
    def validate_pfx_password(cls, v: Optional[str]) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
        if len(v) < 6:
            raise ValueError("Passphrase must be at least 6 characters.")
        if "\n" in v or "\r" in v or "\t" in v:
            raise ValueError("Passphrase cannot contain newline or tab characters.")
        return v

class BulkCertRequest(BaseModel):
    requests: List[SingleCertRequest]

class RegenerateStageRequest(BaseModel):
    name: str
    nik: str
    email: str
    organization: str
    ou: str
    pfx_password: Optional[str] = None

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not re.fullmatch(r"\d{16}", cleaned):
            raise ValueError("NIK must be exactly 16 numeric digits.")
        return cleaned

    @field_validator("pfx_password", mode="before")
    @classmethod
    def validate_pfx_password(cls, v: Optional[str]) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
        if len(v) < 6:
            raise ValueError("Passphrase must be at least 6 characters.")
        if "\n" in v or "\r" in v or "\t" in v:
            raise ValueError("Passphrase cannot contain newline or tab characters.")
        return v

class RegenerateCommitRequest(BaseModel):
    staging_token: str
    target_user_dir: str
    target_archive_p12: str

class RegenerateCleanupRequest(BaseModel):
    staging_token: str

class ChangePassphraseUserRequest(BaseModel):
    nik: str
    old_password: str
    new_password: str

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not re.fullmatch(r"\d{16}", cleaned):
            raise ValueError("NIK must be exactly 16 numeric digits.")
        return cleaned

class ChangePassphraseAdminRequest(BaseModel):
    nik: str
    new_password: str

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not re.fullmatch(r"\d{16}", cleaned):
            raise ValueError("NIK must be exactly 16 numeric digits.")
        return cleaned
