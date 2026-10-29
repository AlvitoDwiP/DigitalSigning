import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class CertificateYearlyCounter(Base):
    __tablename__ = "certificate_yearly_counters"

    year = Column(Integer, primary_key=True)
    last_sequence = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    serial_number = Column(String(255), unique=True, nullable=False)
    certificate_number = Column(String(64), unique=True, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    issued_year = Column(Integer, nullable=False)
    subject = Column(Text, nullable=False)
    issuer = Column(Text, nullable=False)
    fingerprint_sha256 = Column(String(64), unique=True, nullable=False)
    certificate_path = Column(Text, nullable=False)
    p12_reference = Column(Text, nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False)
    replaced_by = Column(UUID(as_uuid=True), ForeignKey("certificates.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="certificates")
    replacement_certificate = relationship("Certificate", remote_side=[id])

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'EXPIRED', 'REPLACED', 'DELETED')", name="certificates_status_check"),
        CheckConstraint("expires_at > issued_at", name="certificates_validity_check"),
        Index("certificates_user_idx", "user_id"),
        Index("certificates_status_idx", "status"),
        Index("certificates_expires_at_idx", "expires_at"),
        Index("certificates_year_seq_idx", "issued_year", "sequence_number", unique=True),
        Index("certificates_issuer_serial_idx", "issuer", "serial_number"),
        Index(
            "one_active_certificate_per_user",
            "user_id",
            unique=True,
            postgresql_where=(status == "ACTIVE")
        ),
    )
