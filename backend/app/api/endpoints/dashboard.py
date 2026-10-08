from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog

router = APIRouter()

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
def get_dashboard(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)

    # 1. Admin / Super Admin Dashboard
    if current_user.role in ["SUPER_ADMIN", "ADMIN"]:
        total_user = db.query(User).count()
        active_certs_count = db.query(Certificate).filter(Certificate.status == "ACTIVE").count()
        expired_certs_count = db.query(Certificate).filter(Certificate.status == "EXPIRED").count()

        # Expiring certificates: active certs expiring within <= 30 days (closest first, max 5)
        limit_30_days = now + timedelta(days=30)
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

        # Expiry buckets (for ACTIVE certificates)
        within_30 = db.query(Certificate).filter(
            Certificate.status == "ACTIVE",
            Certificate.expires_at <= now + timedelta(days=30),
            Certificate.expires_at >= now
        ).count()

        d31_to_60 = db.query(Certificate).filter(
            Certificate.status == "ACTIVE",
            Certificate.expires_at > now + timedelta(days=30),
            Certificate.expires_at <= now + timedelta(days=60)
        ).count()

        d61_to_90 = db.query(Certificate).filter(
            Certificate.status == "ACTIVE",
            Certificate.expires_at > now + timedelta(days=60),
            Certificate.expires_at <= now + timedelta(days=90)
        ).count()

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
