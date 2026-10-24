from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog

router = APIRouter()

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
def get_dashboard(
    mode: Optional[str] = Query(None, description="Mode tampilan dashboard: 'admin' atau 'user'"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    mode_clean = mode.lower().strip() if mode else None

    if mode_clean and mode_clean not in ["admin", "user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Mode tidak valid: '{mode}'. Gunakan 'admin' atau 'user'."}
        )

    # Validasi batasan mode sesuai role
    if mode_clean == "user" and current_user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role SUPER_ADMIN tidak memiliki akses ke mode pengguna."}
        )
    if mode_clean == "admin" and current_user.role == "USER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role USER tidak memiliki akses ke mode admin."}
        )

    # 1. Admin / Super Admin Dashboard (hanya jika bukan permintaan mode user)
    if current_user.role in ["SUPER_ADMIN", "ADMIN"] and mode_clean != "user":
        total_user = db.query(User).count()

        limit_30_days = now + timedelta(days=30)
        limit_60_days = now + timedelta(days=60)
        limit_90_days = now + timedelta(days=90)

        # Single aggregated query for certificate stats and expiry buckets
        cert_stats = db.query(
            func.count(case((Certificate.status == "ACTIVE", 1))).label("active"),
            func.count(case((Certificate.status == "EXPIRED", 1))).label("expired"),
            func.count(case((
                (Certificate.status == "ACTIVE") & (Certificate.expires_at >= now) & (Certificate.expires_at <= limit_30_days), 1
            ))).label("within_30"),
            func.count(case((
                (Certificate.status == "ACTIVE") & (Certificate.expires_at > limit_30_days) & (Certificate.expires_at <= limit_60_days), 1
            ))).label("d31_to_60"),
            func.count(case((
                (Certificate.status == "ACTIVE") & (Certificate.expires_at > limit_60_days) & (Certificate.expires_at <= limit_90_days), 1
            ))).label("d61_to_90"),
        ).first()

        active_certs_count = cert_stats.active if cert_stats else 0
        expired_certs_count = cert_stats.expired if cert_stats else 0
        within_30 = cert_stats.within_30 if cert_stats else 0
        d31_to_60 = cert_stats.d31_to_60 if cert_stats else 0
        d61_to_90 = cert_stats.d61_to_90 if cert_stats else 0

        # Expiring certificates: active certs expiring within <= 30 days (closest first, max 5)
        expiring_rows = (
            db.query(Certificate, User)
            .join(User, Certificate.user_id == User.id)
            .filter(
                Certificate.status == "ACTIVE",
                Certificate.expires_at <= limit_30_days,
                Certificate.expires_at >= now
            )
            .order_by(Certificate.expires_at.asc())
            .limit(5)
            .all()
        )

        expiring_certificates = [
            {
                "user_id": str(user.id),
                "name": user.name,
                "expires_at": cert.expires_at.isoformat()
            }
            for cert, user in expiring_rows
        ]

        # Recent activities (6 activities per DESIGN.md spec)
        recent_logs = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(6)
            .all()
        )

        recent_activities = [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": str(log.target_id) if log.target_id else None,
                "status": log.status,
                "created_at": log.created_at.isoformat()
            }
            for log in recent_logs
        ]

        return {
            "success": True,
            "data": {
                "statistics": {
                    "total_user": total_user,
                    "active": active_certs_count,
                    "expired": expired_certs_count
                },
                "expiring_certificates": expiring_certificates,
                "expiry_buckets": {
                    "within_30_days": within_30,
                    "31_to_60_days": d31_to_60,
                    "61_to_90_days": d61_to_90
                },
                "recent_activities": recent_activities
            }
        }

    # 2. User Dashboard (Personal data only, no system stats)
    active_cert = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id, Certificate.status == "ACTIVE")
        .first()
    )

    cert_data = None
    if active_cert:
        days_remaining = max(0, (active_cert.expires_at - now).days)
        cert_data = {
            "id": str(active_cert.id),
            "serial_number": active_cert.serial_number,
            "issued_at": active_cert.issued_at.isoformat(),
            "expires_at": active_cert.expires_at.isoformat(),
            "status": active_cert.status,
            "days_remaining": days_remaining
        }

    return {
        "success": True,
        "data": {
            "user": {
                "id": str(current_user.id),
                "name": current_user.name,
                "email": current_user.email,
                "nik": current_user.nik,
                "organization": current_user.organization,
                "ou": current_user.ou
            },
            "active_certificate": cert_data,
            "has_active_certificate": active_cert is not None
        }
    }
