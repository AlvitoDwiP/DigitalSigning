import re
import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator
from app.core.config import settings


def validate_password_policy(pwd: str) -> List[str]:
    """Validasi kebijakan password: min 8 karakter, 1 huruf besar, 1 non-alphanumeric."""
    errors = []
    if len(pwd) < 8:
        errors.append("Password must be at least 8 characters")
    if not re.search(r'[A-Z]', pwd):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r'[^a-zA-Z0-9]', pwd):
        errors.append("Password must contain at least one non-alphanumeric character")
    return errors


class UserBase(BaseModel):
    name: str
    email: EmailStr
    organization: Optional[str] = None
    ou: Optional[str] = None
    role: str = "USER"
    status: str = "ACTIVE"


class UserCreate(UserBase):
    nik: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserInDBBase(UserBase):
    id: uuid.UUID
    nik: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class User(UserInDBBase):
    pass


class UserInDB(UserInDBBase):
    password_hash: str


class GenerateUserRequest(BaseModel):
    name: str
    nik: str
    email: EmailStr
    organization: str
    ou: str
    password: Optional[str] = None
    pfx_password: Optional[str] = None
    confirm_pfx_password: Optional[str] = None

    @field_validator('password', mode='before')
    @classmethod
    def default_password(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return getattr(settings, "DEFAULT_USER_PASS", "Konstitusi100%")
        return v

    @field_validator('pfx_password', 'confirm_pfx_password', mode='before')
    @classmethod
    def default_credentials(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return getattr(settings, "DEFAULT_PFX_PASS", "Mkri006!")
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Nama pengguna wajib diisi')
        return v.strip()

    @field_validator('nik')
    @classmethod
    def validate_nik(cls, v: str) -> str:
        if not re.match(r'^[0-9]{16}$', v):
            raise ValueError('NIK must be exactly 16 digits')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        errs = validate_password_policy(v)
        if errs:
            raise ValueError(errs[0])
        return v

    @model_validator(mode='after')
    def validate_name_not_email(self):
        if self.name and self.email:
            if self.name.strip().lower() == str(self.email).strip().lower():
                raise ValueError('Nama pengguna dan email tidak boleh sama')
        return self


class GenerateUserResponseData(BaseModel):
    user: User
    certificate: dict


class GenerateUserResponse(BaseModel):
    success: bool
    data: GenerateUserResponseData


class ChangeUserPfxPasswordRequest(BaseModel):
    new_password: str
    confirm_password: str
    old_password: Optional[str] = None
