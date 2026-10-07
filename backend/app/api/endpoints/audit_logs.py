from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any

from app.api import deps
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter()

@router.get("/", response_model=dict)
def get_audit_logs(
    search: Optional[str] = Query(None, description="Search across action, target_type, status"),
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

    if action:
        query = query.filter(AuditLog.action == action)
    if status:
        query = query.filter(AuditLog.status == status)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (AuditLog.action.ilike(search_pattern)) |
            (AuditLog.target_type.ilike(search_pattern)) |
            (AuditLog.status.ilike(search_pattern))
        )

    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    formatted_items = [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id) if log.target_id else None,
            "status": log.status,
            "created_at": log.created_at.isoformat()
        }
        for log in items
    ]

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
