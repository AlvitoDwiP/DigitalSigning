from pydantic import BaseModel, EmailStr, field_validator, StringConstraints
from typing_extensions import Annotated
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
    def no_newlines(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v):
            raise ValueError("Input cannot contain newline or carriage return characters")
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

class ChangeP12PassphraseRequest(BaseModel):
    nik: str
    new_password: str

    @field_validator("nik", "new_password", mode="before")
    @classmethod
    def no_newlines(cls, v: str) -> str:
        if isinstance(v, str) and ("\n" in v or "\r" in v):
            raise ValueError("Input cannot contain newline or carriage return characters")
        return v

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r"^[0-9]{16}$", v):
            raise ValueError("NIK must be exactly 16 digits")
        return v

