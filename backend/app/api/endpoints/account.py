from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
from pydantic import BaseModel
from typing import Optional

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.schemas.user import User as UserSchema
from app.services.pki_client import pki_client
from app.core.security import verify_password, get_password_hash
import re

router = APIRouter()

def validate_password_policy(pwd: str) -> Optional[str]:
    if len(pwd) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', pwd):
        return "Password must contain at least one uppercase letter"
    if not re.search(r'[^a-zA-Z0-9]', pwd):
        return "Password must contain at least one non-alphanumeric character"
    return None

class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    organization: Optional[str] = None
    ou: Optional[str] = None

class ChangeAccountLoginPasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str

class ChangeAccountPfxPasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


@router.get("/", response_model=dict)
def get_account(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return {"success": True, "data": UserSchema.model_validate(current_user).model_dump()}

@router.patch("/", response_model=dict)
def update_account(
    req: UpdateAccountRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    try:
        target_name = req.name.strip() if req.name is not None else current_user.name
        target_email = req.email.strip() if req.email is not None else current_user.email

        # Check nama dan email sama
        if target_name.lower() == target_email.lower():
            raise HTTPException(
                status_code=400,
                detail={"code": "NAME_EMAIL_MATCH", "message": "Nama pengguna dan email tidak boleh sama"}
            )

        if req.name is not None:
            clean_name = req.name.strip()
            if not clean_name:
                raise HTTPException(status_code=400, detail={"code": "INVALID_NAME", "message": "Nama lengkap tidak boleh kosong"})
            existing_name = db.query(User).filter(
                func.lower(User.name) == func.lower(clean_name),
                User.id != current_user.id
            ).first()
            if existing_name:
                raise HTTPException(status_code=409, detail={"code": "INVALID_NAME", "message": "Nama pengguna sudah digunakan"})
            current_user.name = clean_name

        if req.email is not None:
            clean_email = req.email.strip()
            if not clean_email:
                raise HTTPException(status_code=400, detail={"code": "INVALID_EMAIL", "message": "Email tidak boleh kosong"})
            existing_email = db.query(User).filter(
                func.lower(User.email) == func.lower(clean_email),
                User.id != current_user.id
            ).first()
            if existing_email:
                raise HTTPException(status_code=409, detail={"code": "INVALID_EMAIL", "message": "Email already exists"})
            current_user.email = clean_email

        if req.organization is not None:
            current_user.organization = req.organization.strip()
        if req.ou is not None:
            current_user.ou = req.ou.strip()
            
        db.commit()
        db.refresh(current_user)
        return {"success": True, "data": UserSchema.model_validate(current_user).model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Failed to update account"})

@router.post("/pfx-password", response_model=dict)
def change_account_pfx_password(
    req: ChangeAccountPfxPasswordRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    active_cert = db.query(Certificate).filter(Certificate.user_id == current_user.id, Certificate.status == "ACTIVE").first()
    if not active_cert:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Certificate not found"})
        
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Konfirmasi password tidak cocok"})
        
    if req.old_password == req.new_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password baru tidak boleh sama dengan password lama"})
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password baru minimal 8 karakter"})
        
    try:
        pki_client.change_p12_passphrase_user(
            nik=current_user.nik,
            old_password=req.old_password,
            new_password=req.new_password
        )
    except Exception:
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="PFX_PASSWORD_CHANGED",
            target_type="user",
            target_id=current_user.id,
            status="FAILED"
        )
        db.add(audit)
        db.commit()
        raise
        
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="PFX_PASSWORD_CHANGED",
        target_type="user",
        target_id=current_user.id,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()
    
    return {"success": True, "message": "Passphrase berhasil diubah"}

@router.post("/password", response_model=dict)
def change_account_login_password(
    req: ChangeAccountLoginPasswordRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password lama salah"})
        
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Konfirmasi password tidak cocok"})
        
    if req.old_password == req.new_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password baru tidak boleh sama dengan password lama"})
        
    policy_err = validate_password_policy(req.new_password)
    if policy_err:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": policy_err})
        
    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()
    
    return {"success": True, "message": "Password login berhasil diubah"}

