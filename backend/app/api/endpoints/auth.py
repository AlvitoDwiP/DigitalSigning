from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserLogin

router = APIRouter()

@router.post("/login", response_model=dict)
def login_access_token(
    login_data: UserLogin,
    db: Session = Depends(deps.get_db)
):
    """
    Login using email and password.
    """
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not security.verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif user.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = security.create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    is_default_password = security.verify_password(settings.DEFAULT_USER_PASS, user.password_hash)

    return {
        "success": True,
        "data": {
            "user": {
                "id": str(user.id),
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "must_change_password": is_default_password
            },
            "token": token
        }
    }

@router.post("/logout")
def logout():
    """
    Mengakhiri session/token pengguna.
    Karena JWT stateless, client cukup menghapus token di sisi mereka.
    """
    return {
        "success": True,
        "message": "Logout berhasil"
    }

@router.get("/me", response_model=dict)
def read_users_me(current_user: User = Depends(deps.get_current_user)):
    """
    Mengambil informasi user yang sedang login.
    """
    is_default_password = security.verify_password(settings.DEFAULT_USER_PASS, current_user.password_hash)
    return {
        "success": True,
        "data": {
            "id": str(current_user.id),
            "name": current_user.name,
            "nik": current_user.nik,
            "email": current_user.email,
            "organization": current_user.organization,
            "ou": current_user.ou,
            "role": current_user.role,
            "status": current_user.status,
            "must_change_password": is_default_password
        }
    }
