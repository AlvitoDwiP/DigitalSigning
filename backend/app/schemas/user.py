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
