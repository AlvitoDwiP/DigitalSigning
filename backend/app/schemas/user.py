from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid

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

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    password_hash: str

from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re

class GenerateUserRequest(BaseModel):
    name: str
    nik: str
    email: EmailStr
    organization: str
    ou: str
    password: str
    pfx_password: Optional[str] = "Mkri006!"
    confirm_pfx_password: Optional[str] = "Mkri006!"

    @field_validator('pfx_password', 'confirm_pfx_password', mode='before')
    @classmethod
    def default_pfx_passwords(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return "Mkri006!"
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
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[^a-zA-Z0-9]', v):
            raise ValueError('Password must contain at least one non-alphanumeric character')
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
