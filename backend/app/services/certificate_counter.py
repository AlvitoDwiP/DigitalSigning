"""Service untuk alokasi nomor sertifikat administratif tahunan secara aman (concurrency-safe).

Format: DS-YYYY-HEX-SEQ
Contoh: DS-2026-11A2-1284

- DS: Kode jenis sertifikat Digital Signature.
- YYYY: Tahun penerbitan sertifikat (otoritatif UTC).
- HEX: Serial number X.509 dari sertifikat OpenSSL dalam format heksadesimal uppercase.
- SEQ: Nomor urut administratif dalam tahun penerbitan, minimal 4 digit dengan leading zero.
       Jika melebihi 9999, digit bertambah tanpa truncation.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text


def format_certificate_number(year: int, serial_hex: str, seq: int) -> str:
    """Format string nomor sertifikat publik administratif sesuai spesifikasi."""
    clean_hex = serial_hex.strip().upper()
    seq_str = f"{seq:04d}"
    return f"DS-{year}-{clean_hex}-{seq_str}"


def allocate_certificate_number(db: Session, issued_at: datetime, serial_hex: str) -> tuple[str, int, int]:
    """Alokasikan nomor urut tahunan secara atomik menggunakan PostgreSQL row-level locking.
    
    Menjamin counter reset per tahun kalender (0001) dan aman terhadap race condition
    pada eksekusi concurrent tanpa menggunakan COUNT(*) + 1.
    
    Returns:
        tuple[str, int, int]: (certificate_number, sequence_number, issued_year)
    """
    # Pastikan zona waktu konsisten (UTC)
    if issued_at.tzinfo is None:
        year = issued_at.year
    else:
        year = issued_at.astimezone(timezone.utc).year

    # Operasi atomik row-level lock pada PostgreSQL: INSERT ... ON CONFLICT DO UPDATE
    stmt = text("""
        INSERT INTO certificate_yearly_counters (year, last_sequence, updated_at)
        VALUES (:year, 1, NOW())
        ON CONFLICT (year) DO UPDATE
        SET last_sequence = certificate_yearly_counters.last_sequence + 1,
            updated_at = NOW()
        RETURNING last_sequence;
    """)
    result = db.execute(stmt, {"year": year})
    seq = result.scalar_one()

    cert_num = format_certificate_number(year=year, serial_hex=serial_hex, seq=seq)
    return cert_num, seq, year
