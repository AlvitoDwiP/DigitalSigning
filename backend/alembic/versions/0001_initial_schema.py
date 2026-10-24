"""Initial Phase 1 Schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-06 14:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('nik', sa.String(length=16), nullable=False, unique=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('organization', sa.String(length=255), nullable=False),
        sa.Column('ou', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint("nik ~ '^[0-9]{16}$'", name='users_nik_format'),
        sa.CheckConstraint("role IN ('SUPER_ADMIN', 'ADMIN', 'USER')", name='users_role_check'),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name='users_status_check')
    )
    op.create_index('users_status_idx', 'users', ['status'])
    op.create_index('users_role_idx', 'users', ['role'])

    # 2. Create certificates table
    op.create_table(
        'certificates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('serial_number', sa.String(length=255), nullable=False, unique=True),
        sa.Column('subject', sa.Text(), nullable=False),
        sa.Column('issuer', sa.Text(), nullable=False),
        sa.Column('fingerprint_sha256', sa.String(length=64), nullable=False, unique=True),
        sa.Column('certificate_path', sa.Text(), nullable=False),
        sa.Column('p12_reference', sa.Text(), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('replaced_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('certificates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint("status IN ('ACTIVE', 'EXPIRED', 'REPLACED')", name='certificates_status_check'),
        sa.CheckConstraint('expires_at > issued_at', name='certificates_validity_check')
    )
    op.create_index('certificates_user_idx', 'certificates', ['user_id'])
    op.create_index('certificates_status_idx', 'certificates', ['status'])
    op.create_index('certificates_expires_at_idx', 'certificates', ['expires_at'])
    
    # Partial Unique Index: 1 ACTIVE certificate per user
    op.create_index(
        'one_active_certificate_per_user',
        'certificates',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'")
    )

    # 3. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint("status IN ('SUCCESS', 'FAILED')", name='audit_logs_status_check')
    )
    op.create_index('audit_logs_created_at_idx', 'audit_logs', ['created_at'])
    op.create_index('audit_logs_action_idx', 'audit_logs', ['action'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('certificates')
    op.drop_table('users')
