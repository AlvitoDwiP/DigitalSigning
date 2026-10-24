"""Add certificate_number and yearly counters

Revision ID: 0002_cert_number
Revises: 0001_initial_schema
Create Date: 2026-10-24 12:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0002_cert_number'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create certificate_yearly_counters table
    op.create_table(
        'certificate_yearly_counters',
        sa.Column('year', sa.Integer(), primary_key=True),
        sa.Column('last_sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )

    # 2. Add new columns to certificates table (initially nullable for data backfill)
    op.add_column('certificates', sa.Column('certificate_number', sa.String(length=64), nullable=True))
    op.add_column('certificates', sa.Column('sequence_number', sa.Integer(), nullable=True))
    op.add_column('certificates', sa.Column('issued_year', sa.Integer(), nullable=True))

    # 3. Data backfill for existing certificates partitioned by year chronologically
    op.execute("""
        WITH ranked_certs AS (
            SELECT 
                id,
                EXTRACT(YEAR FROM issued_at)::integer AS yr,
                UPPER(TRIM(serial_number)) AS clean_hex,
                ROW_NUMBER() OVER (
                    PARTITION BY EXTRACT(YEAR FROM issued_at) 
                    ORDER BY issued_at ASC, id ASC
                ) AS seq
            FROM certificates
        )
        UPDATE certificates c
        SET 
            issued_year = r.yr,
            sequence_number = r.seq,
            certificate_number = 'DS-' || r.yr::text || '-' || r.clean_hex || '-' || LPAD(r.seq::text, 4, '0')
        FROM ranked_certs r
        WHERE c.id = r.id;
    """)

    # 4. Initialize certificate_yearly_counters with existing maximum sequence numbers
    op.execute("""
        INSERT INTO certificate_yearly_counters (year, last_sequence, updated_at)
        SELECT 
            issued_year, 
            MAX(sequence_number) AS last_sequence, 
            NOW()
        FROM certificates
        WHERE issued_year IS NOT NULL
        GROUP BY issued_year
        ON CONFLICT (year) DO UPDATE
        SET last_sequence = EXCLUDED.last_sequence,
            updated_at = NOW();
    """)

    # 5. Alter columns to NOT NULL now that data is populated
    op.alter_column('certificates', 'certificate_number', nullable=False)
    op.alter_column('certificates', 'sequence_number', nullable=False)
    op.alter_column('certificates', 'issued_year', nullable=False)

    # 6. Create constraints and indexes
    op.create_unique_constraint('uq_certificates_certificate_number', 'certificates', ['certificate_number'])
    op.create_index('certificates_year_seq_idx', 'certificates', ['issued_year', 'sequence_number'], unique=True)
    op.create_index('certificates_issuer_serial_idx', 'certificates', ['issuer', 'serial_number'])


def downgrade() -> None:
    op.drop_index('certificates_issuer_serial_idx', table_name='certificates')
    op.drop_index('certificates_year_seq_idx', table_name='certificates')
    op.drop_constraint('uq_certificates_certificate_number', 'certificates', type_='unique')
    op.drop_column('certificates', 'issued_year')
    op.drop_column('certificates', 'sequence_number')
    op.drop_column('certificates', 'certificate_number')
    op.drop_table('certificate_yearly_counters')
