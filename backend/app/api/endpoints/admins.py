import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.user import User as UserSchema

router = APIRouter()


@router.get("/", response_model=dict)
def get_admins(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN"]))
) -> Dict[str, Any]:
    """
    Mengambil daftar user yang saat ini memiliki role ADMIN.
    Hanya dapat diakses oleh SUPER_ADMIN.
    """
    admins = db.query(User).filter(User.role == "ADMIN").order_by(User.created_at.desc()).all()
    formatted_admins = [UserSchema.model_validate(u).model_dump() for u in admins]
    return {
        "success": True,
        "data": {
            "items": formatted_admins,
            "total": len(formatted_admins)
        }
    }


@router.get("/candidates", response_model=dict)
def get_admin_candidates(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN"]))
) -> Dict[str, Any]:
    """
    Mengambil daftar user yang dapat dijadikan ADMIN (user aktif yang bukan ADMIN).
    Hanya dapat diakses oleh SUPER_ADMIN.
    """
    candidates = (
        db.query(User)
        .filter(User.role == "USER", User.status == "ACTIVE")
        .order_by(User.created_at.desc())
        .all()
    )
    formatted_candidates = [UserSchema.model_validate(u).model_dump() for u in candidates]
    return {
        "success": True,
        "data": {
            "items": formatted_candidates,
            "total": len(formatted_candidates)
        }
    }


@router.post("/{user_id}", response_model=dict)
def assign_admin(
    user_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN"]))
) -> Dict[str, Any]:
    """
    Mengubah role user menjadi ADMIN (USER -> ADMIN).
    Hanya dapat diakses oleh SUPER_ADMIN.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found"}
        )

    if user.role == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_ADMIN", "message": "User is already an admin"}
        )

    if user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ROLE_TRANSITION", "message": "Cannot assign Super Admin as regular Admin"}
        )

    # Ubah role
    user.role = "ADMIN"

    # Buat audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="ADMIN_ASSIGNED",
        target_type="user",
        target_id=user.id,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "User berhasil ditetapkan sebagai Admin",
        "data": UserSchema.model_validate(user).model_dump()
    }


@router.delete("/{user_id}", response_model=dict)
def remove_admin(
    user_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN"]))
) -> Dict[str, Any]:
    """
    Menghapus status ADMIN dengan mengubah role menjadi USER (ADMIN -> USER).
    Hanya dapat diakses oleh SUPER_ADMIN.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found"}
        )

    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NOT_AN_ADMIN", "message": "User is not an admin"}
        )

    # Ubah role
    user.role = "USER"

    # Buat audit log
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="ADMIN_REMOVED",
        target_type="user",
        target_id=user.id,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Role Admin berhasil dihapus",
        "data": UserSchema.model_validate(user).model_dump()
    }
