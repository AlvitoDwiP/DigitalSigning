"""Add DELETED to certificate status check constraint

Revision ID: 0003_deleted_cert_status
Revises: 0002_cert_number
Create Date: 2026-10-27 20:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0003_deleted_cert_status'
down_revision: Union[str, None] = '0002_cert_number'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;")
    op.execute("ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'REPLACED', 'DELETED'));")


def downgrade() -> None:
    op.execute("ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;")
    op.execute("ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'REPLACED'));")
