import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    nik = Column(String(16), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    organization = Column(String(255), nullable=False)
    ou = Column(String(100), nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    certificates = relationship("Certificate", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")

    __table_args__ = (
        CheckConstraint("nik ~ '^[0-9]{16}$'", name="users_nik_format"),
        CheckConstraint("role IN ('SUPER_ADMIN', 'ADMIN', 'USER')", name="users_role_check"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="users_status_check"),
        Index("users_status_idx", "status"),
        Index("users_role_idx", "role"),
    )
