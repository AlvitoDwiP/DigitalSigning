import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

def record_audit(
    db: Session,
    actor_id: Optional[uuid.UUID],
    action: str,
    target_id: Optional[uuid.UUID],
    status: str = "SUCCESS",
    target_type: str = "user",
    commit: bool = False
) -> AuditLog:
    """Helper untuk pencatatan audit log terpusat agar konsisten, efisien, dan reusable."""
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        status=status
    )
    db.add(audit)
    if commit:
        db.commit()
    return audit
