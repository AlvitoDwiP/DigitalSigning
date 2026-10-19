from typing import Optional
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint, Index, func, event
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Session
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        CheckConstraint("status IN ('SUCCESS', 'FAILED')", name="audit_logs_status_check"),
        Index("audit_logs_created_at_idx", "created_at"),
        Index("audit_logs_action_idx", "action"),
    )


def prune_audit_logs(session: Session, max_logs: Optional[int] = None) -> int:
    """
    Memastikan jumlah audit log di database tidak melebihi batas maksimum (default 5000).
    Jika jumlah melebihi max_logs, log paling bawah (terlama berdasarkan created_at ASC)
    akan dihapus sehingga kapasitas log tetap terjaga (FIFO / Circular log pruning).
    Mengembalikan jumlah baris yang dihapus.
    """
    if max_logs is None:
        from app.core.config import settings
        max_logs = settings.MAX_AUDIT_LOGS

    total = session.query(func.count(AuditLog.id)).scalar() or 0
    if total > max_logs:
        excess = total - max_logs
        oldest_records = (
            session.query(AuditLog.id)
            .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
            .limit(excess)
            .all()
        )
        if oldest_records:
            ids_to_delete = [r[0] for r in oldest_records]
            deleted_count = (
                session.query(AuditLog)
                .filter(AuditLog.id.in_(ids_to_delete))
                .delete(synchronize_session=False)
            )
            return deleted_count
    return 0


@event.listens_for(Session, "before_commit")
def auto_prune_audit_logs(session: Session) -> None:
    """
    Event listener otomatis sebelum commit session: jika terdapat record AuditLog baru
    yang ditambahkan dalam session, lakukan flush dan pruning agar kapasitas maksimal 5000
    selalu terjaga secara transparan.
    """
    if any(isinstance(obj, AuditLog) for obj in session.new):
        session.flush()
        prune_audit_logs(session)

