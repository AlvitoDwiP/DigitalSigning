"""Add REVOKED to certificate status check constraint and add revocation columns

Revision ID: 0004_revoked_cert_status
Revises: 0003_deleted_cert_status
Create Date: 2026-11-02 14:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0004_revoked_cert_status'
down_revision: Union[str, None] = '0003_deleted_cert_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;")
    op.execute("ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'REPLACED', 'DELETED', 'REVOKED'));")
    op.add_column("certificates", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("certificates", sa.Column("revocation_reason", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("certificates", "revocation_reason")
    op.drop_column("certificates", "revoked_at")
    op.execute("ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;")
    op.execute("ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'REPLACED', 'DELETED'));")

