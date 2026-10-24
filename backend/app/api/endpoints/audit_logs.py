from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, cast, String, and_
from datetime import datetime
from typing import Optional, Dict, Any, List
import re
import uuid

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog

router = APIRouter()

def extract_cn(subject: Optional[str]) -> Optional[str]:
    if not subject:
        return None
    match = re.search(r'(?:^|,\s*)CN=([^,]+)', subject, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return subject.replace("CN=", "").strip() or None

@router.get("/", response_model=dict)
def get_audit_logs(
    search: Optional[str] = Query(None, description="Search across action, target_type, status, actor, and ID"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter audit logs strictly related to a user (as actor, target, or cert owner)"),
    action: Optional[str] = Query(None, description="Filter by action enum"),
    status: Optional[str] = Query(None, description="Filter by status (SUCCESS/FAILED)"),
    start_date: Optional[datetime] = Query(None, description="Filter created_at >= start_date"),
    end_date: Optional[datetime] = Query(None, description="Filter created_at <= end_date"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
) -> Dict[str, Any]:
    query = db.query(AuditLog)

    if user_id:
        user_cert_ids = [
            c[0] for c in db.query(Certificate.id).filter(Certificate.user_id == user_id).all()
        ]
        user_conditions = [
            AuditLog.user_id == user_id,
            AuditLog.target_id == user_id,
        ]
        if user_cert_ids:
            user_conditions.append(
                and_(AuditLog.target_type == "certificate", AuditLog.target_id.in_(user_cert_ids))
            )
        query = query.filter(or_(*user_conditions))

    if action and isinstance(action, str):
        query = query.filter(AuditLog.action == action)
    if status and isinstance(status, str):
        query = query.filter(AuditLog.status == status)
    if start_date and isinstance(start_date, datetime):
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date and isinstance(end_date, datetime):
        # Jadikan inklusif hingga akhir hari jika waktu 00:00:00
        if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0:
            inclusive_end = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            inclusive_end = end_date
        query = query.filter(AuditLog.created_at <= inclusive_end)

    if search and isinstance(search, str):
        search_pattern = f"%{search}%"
        # Join User aktor agar bisa dicari berdasarkan nama dan email pelaku
        query = query.outerjoin(User, AuditLog.user_id == User.id).filter(
            or_(
                AuditLog.action.ilike(search_pattern),
                AuditLog.target_type.ilike(search_pattern),
                AuditLog.status.ilike(search_pattern),
                User.name.ilike(search_pattern),
                User.email.ilike(search_pattern),
                cast(AuditLog.id, String).ilike(search_pattern),
                cast(AuditLog.target_id, String).ilike(search_pattern)
            )
        )

    total = query.count()
    offset = (page - 1) * limit
    items: List[AuditLog] = (
        query.options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Resolusi target objek batch (hanya untuk batch 20 item saat ini)
    all_target_ids = [log.target_id for log in items if log.target_id]

    target_users_map = {}
    target_certs_map = {}

    if all_target_ids:
        found_users = db.query(User.id, User.name, User.email, User.nik).filter(User.id.in_(all_target_ids)).all()
        target_users_map = {u.id: u for u in found_users}

        found_certs = (
            db.query(Certificate.id, Certificate.subject, Certificate.serial_number, Certificate.certificate_number, Certificate.user_id)
            .filter(Certificate.id.in_(all_target_ids))
            .all()
        )
        cert_owner_ids = [c.user_id for c in found_certs if c.user_id]
        cert_owners_map = {}
        if cert_owner_ids:
            found_owners = db.query(User.id, User.name).filter(User.id.in_(cert_owner_ids)).all()
            cert_owners_map = {o.id: o.name for o in found_owners}

        for c in found_certs:
            owner_name = cert_owners_map.get(c.user_id) or extract_cn(c.subject)
            target_certs_map[c.id] = {
                "owner_name": owner_name,
                "serial_number": c.serial_number,
                "certificate_number": c.certificate_number,
                "user_id": c.user_id
            }

    formatted_items = []
    for log in items:
        # 1. Identitas Pelaku (Actor)
        actor_name = None
        actor_email = None
        actor_role = None
        if log.user:
            actor_name = log.user.name
            actor_email = log.user.email
            actor_role = log.user.role
        elif log.user_id:
            actor_name = f"ID: {str(log.user_id)[:8]}..."
            actor_role = "ADMIN"
        else:
            actor_name = "Admin Platform"
            actor_role = "ADMIN"

        # 2. Identitas Objek Terkait (Target)
        target_name = None
        target_type_effective = log.target_type
        target_id_effective = str(log.target_id) if log.target_id else None

        if log.target_id in target_users_map:
            u_info = target_users_map[log.target_id]
            target_name = u_info.name
            target_type_effective = "user"
        elif log.target_id in target_certs_map:
            c_info = target_certs_map[log.target_id]
            target_name = c_info["owner_name"]
            target_type_effective = "user"
            if c_info.get("user_id"):
                target_id_effective = str(c_info["user_id"])

        # Untuk aktivitas penerbitan/regenerasi sertifikat, jenis target terkait adalah pengguna
        if log.action in ["CERTIFICATE_REGENERATED", "CERTIFICATE_GENERATED"]:
            target_type_effective = "user"

        formatted_items.append({
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "actor_name": actor_name,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "action": log.action,
            "target_type": target_type_effective,
            "target_id": target_id_effective,
            "target_name": target_name,
            "status": log.status,
            "created_at": log.created_at.isoformat()
        })

    return {
        "success": True,
        "data": {
            "items": formatted_items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total
            }
        }
    }

