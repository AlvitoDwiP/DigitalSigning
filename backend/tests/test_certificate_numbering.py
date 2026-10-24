import uuid
import concurrent.futures
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.certificate import Certificate, CertificateYearlyCounter
from app.models.user import User
from app.services.certificate_counter import allocate_certificate_number, format_certificate_number
from app.core.database import SessionLocal


def test_format_certificate_number_standard():
    """1, 2, 3: Format DS-YYYY-HEX-SEQ, uppercase hex, dan 4-digit padding."""
    # Test lowercase hex diubah ke uppercase
    formatted = format_certificate_number(year=2026, serial_hex="11a2", seq=1)
    assert formatted == "DS-2026-11A2-0001"

    # Test padding 4 digit
    formatted_99 = format_certificate_number(year=2026, serial_hex="ABCD", seq=99)
    assert formatted_99 == "DS-2026-ABCD-0099"

    # Test lebih dari 9999 tidak terpotong (no truncation)
    formatted_10k = format_certificate_number(year=2026, serial_hex="ABCD", seq=10000)
    assert formatted_10k == "DS-2026-ABCD-10000"


def test_counter_yearly_reset(db_session: Session):
    """4: Reset counter pada pergantian tahun."""
    test_year_1 = 2030
    test_year_2 = 2031

    date_2030 = datetime(test_year_1, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    date_2031 = datetime(test_year_2, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # Bersihkan jika ada residual
    db_session.query(CertificateYearlyCounter).filter(
        CertificateYearlyCounter.year.in_([test_year_1, test_year_2])
    ).delete(synchronize_session=False)
    db_session.commit()

    # Alokasi tahun 2030
    cert_num_1, seq_1, yr_1 = allocate_certificate_number(db_session, date_2030, "A1")
    assert yr_1 == 2030
    assert seq_1 == 1
    assert cert_num_1 == "DS-2030-A1-0001"

    cert_num_2, seq_2, yr_2 = allocate_certificate_number(db_session, date_2030, "A2")
    assert yr_2 == 2030
    assert seq_2 == 2
    assert cert_num_2 == "DS-2030-A2-0002"

    # Alokasi tahun 2031 (Harus reset ke 0001)
    cert_num_3, seq_3, yr_3 = allocate_certificate_number(db_session, date_2031, "B1")
    assert yr_3 == 2031
    assert seq_3 == 1
    assert cert_num_3 == "DS-2031-B1-0001"

    db_session.rollback()


def test_concurrency_no_duplicate_sequence(db_session: Session):
    """5: Penerbitan bersamaan (concurrent) tanpa duplikasi nomor urut."""
    test_year = 2040
    num_threads = 15

    # Bersihkan tahun uji
    db_session.query(CertificateYearlyCounter).filter(CertificateYearlyCounter.year == test_year).delete()
    db_session.commit()

    date_test = datetime(test_year, 5, 10, tzinfo=timezone.utc)
    results = []

    def allocate_task(thread_id: int):
        thread_db = SessionLocal()
        try:
            cert_num, seq, yr = allocate_certificate_number(thread_db, date_test, f"FF{thread_id:02X}")
            thread_db.commit()
            return (cert_num, seq, yr)
        except Exception:
            thread_db.rollback()
            raise
        finally:
            thread_db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(allocate_task, i) for i in range(num_threads)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    sequences = [r[1] for r in results]
    cert_numbers = [r[0] for r in results]

    # Pastikan jumlah sequence sama dengan jumlah thread dan semua unik berurutan 1..N
    assert len(sequences) == num_threads
    assert len(set(sequences)) == num_threads
    assert sorted(sequences) == list(range(1, num_threads + 1))
    assert len(set(cert_numbers)) == num_threads


def test_database_unique_constraints(db_session: Session):
    """10: Constraint keunikan database (certificate_number & year+seq)."""
    test_year = 2095
    now = datetime(test_year, 1, 1, tzinfo=timezone.utc)
    unique_suffix = uuid.uuid4().hex[:6]
    numeric_nik = f"99{abs(hash(unique_suffix)) % 10000000000000:014d}"

    # Bersihkan tahun uji jika ada
    db_session.query(Certificate).filter(Certificate.issued_year == test_year).delete()
    db_session.commit()

    test_user = User(
        id=uuid.uuid4(),
        name=f"User UQ {unique_suffix}",
        nik=numeric_nik,
        email=f"uq_{unique_suffix}@mkri.go.id",
        organization="MKRI",
        ou="IT",
        password_hash="hashed",
        role="USER",
        status="ACTIVE"
    )
    db_session.add(test_user)
    db_session.commit()

    # 1. Uji keunikan certificate_number
    cert1 = Certificate(
        id=uuid.uuid4(),
        user_id=test_user.id,
        serial_number=f"SER-UQ1-{unique_suffix}",
        certificate_number=f"DS-{test_year}-UQ1-{unique_suffix}",
        sequence_number=1,
        issued_year=test_year,
        subject=f"CN={test_user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FINGERPRINTUQ1{unique_suffix}".ljust(64, '0')[:64],
        certificate_path="/path/test1.crt",
        p12_reference="/path/test1.p12",
        issued_at=now,
        expires_at=now + timedelta(days=365),
        status="ACTIVE"
    )
    db_session.add(cert1)
    db_session.commit()

    cert2_dup_num = Certificate(
        id=uuid.uuid4(),
        user_id=test_user.id,
        serial_number=f"SER-UQ2-{unique_suffix}",
        certificate_number=f"DS-{test_year}-UQ1-{unique_suffix}",  # DUPLIKAT
        sequence_number=2,
        issued_year=test_year,
        subject=f"CN={test_user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FINGERPRINTUQ2{unique_suffix}".ljust(64, '0')[:64],
        certificate_path="/path/test2.crt",
        p12_reference="/path/test2.p12",
        issued_at=now,
        expires_at=now + timedelta(days=365),
        status="REPLACED"
    )
    db_session.add(cert2_dup_num)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # 2. Uji keunikan kombinasi (issued_year, sequence_number)
    # cert1 sudah ada di DB dengan (issued_year=test_year, sequence_number=1)

    cert3_dup_seq = Certificate(
        id=uuid.uuid4(),
        user_id=test_user.id,
        serial_number=f"SER-UQ3-{unique_suffix}",
        certificate_number=f"DS-{test_year}-UQ3-{unique_suffix}",
        sequence_number=1,  # DUPLIKAT SEQ DI TAHUN test_year
        issued_year=test_year,
        subject=f"CN={test_user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FINGERPRINTUQ3{unique_suffix}".ljust(64, '0')[:64],
        certificate_path="/path/test3.crt",
        p12_reference="/path/test3.p12",
        issued_at=now,
        expires_at=now + timedelta(days=365),
        status="REPLACED"
    )
    db_session.add(cert3_dup_seq)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Cleanup test_year records
    db_session.query(Certificate).filter(Certificate.issued_year == test_year).delete()
    db_session.query(User).filter(User.id == test_user.id).delete()
    db_session.commit()


def test_public_api_search_and_verification(client: TestClient, auth_headers: dict, db_session: Session):
    """9: Pencarian dan verifikasi sertifikat via nomor baru dan serial lama."""
    now = datetime.now(timezone.utc)
    unique_suffix = uuid.uuid4().hex[:6]
    numeric_nik = f"88{abs(hash(unique_suffix)) % 10000000000000:014d}"
    dyn_seq = abs(hash(unique_suffix)) % 50000 + 20000

    verify_user = User(
        id=uuid.uuid4(),
        name=f"Verify User {unique_suffix}",
        nik=numeric_nik,
        email=f"verify_{unique_suffix}@mkri.go.id",
        organization="MKRI",
        ou="IT",
        password_hash="hashed",
        role="USER",
        status="ACTIVE"
    )
    db_session.add(verify_user)
    db_session.commit()

    test_cert = Certificate(
        id=uuid.uuid4(),
        user_id=verify_user.id,
        serial_number=f"HEX-{unique_suffix}",
        certificate_number=f"DS-2026-HEX{unique_suffix.upper()}-{dyn_seq:04d}",
        sequence_number=dyn_seq,
        issued_year=2026,
        subject=f"CN=Verifikasi Test {unique_suffix}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FPVERIFY{unique_suffix}".ljust(64, '0')[:64],
        certificate_path="/path/v.crt",
        p12_reference="/path/v.p12",
        issued_at=now,
        expires_at=now + timedelta(days=365),
        status="ACTIVE"
    )
    db_session.add(test_cert)
    db_session.commit()

    # 1. Verifikasi via nomor sertifikat publik baru
    res1 = client.get(f"/api/v1/certificates/{test_cert.certificate_number}", headers=auth_headers["admin"])
    assert res1.status_code == 200
    data1 = res1.json()["data"]
    assert data1["id"] == str(test_cert.id)
    assert data1["certificate_number"] == test_cert.certificate_number
    assert data1["serial_number"] == test_cert.serial_number
    assert data1["is_valid"] is True

    # 2. Verifikasi via serial X.509 lama
    res2 = client.get(f"/api/v1/certificates/{test_cert.serial_number}", headers=auth_headers["admin"])
    assert res2.status_code == 200
    data2 = res2.json()["data"]
    assert data2["id"] == str(test_cert.id)
    assert data2["certificate_number"] == test_cert.certificate_number

    # 3. Pencarian via query parameter search pada list endpoint
    res3 = client.get(f"/api/v1/certificates?search={test_cert.certificate_number}", headers=auth_headers["admin"])
    assert res3.status_code == 200
    items3 = res3.json()["data"]["items"]
    assert any(item["certificate_number"] == test_cert.certificate_number for item in items3)

    # 3. Pencarian via query parameter search pada list endpoint
    res3 = client.get(f"/api/v1/certificates?search={test_cert.certificate_number}", headers=auth_headers["admin"])
    assert res3.status_code == 200
    items3 = res3.json()["data"]["items"]
    assert any(item["certificate_number"] == test_cert.certificate_number for item in items3)


def test_regenerate_creates_new_number_and_keeps_old(client: TestClient, auth_headers: dict, db_session: Session, seed_users: dict, monkeypatch):
    """6: Regenerate menghasilkan nomor baru dan tidak menimpa nomor lama."""
    user = seed_users["user"]
    admin = seed_users["admin"]
    now = datetime.now(timezone.utc)
    unique_suffix = uuid.uuid4().hex[:6]

    # Pastikan user punya active cert awal
    old_cert = Certificate(
        id=uuid.uuid4(),
        user_id=user.id,
        serial_number=f"SER-OLD-{unique_suffix}",
        certificate_number=f"DS-2026-OLD{unique_suffix.upper()}-7701",
        sequence_number=7701,
        issued_year=2026,
        subject=f"CN={user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FPOLD{unique_suffix}".ljust(64, '0')[:64],
        certificate_path="/path/old.crt",
        p12_reference="/path/old.p12",
        issued_at=now - timedelta(days=10),
        expires_at=now + timedelta(days=355),
        status="ACTIVE"
    )
    # Matikan active cert lain dari user ini
    db_session.query(Certificate).filter(Certificate.user_id == user.id).update({"status": "REPLACED"})
    db_session.add(old_cert)
    db_session.commit()

    # Mock PKI Engine call
    new_serial = f"11A{unique_suffix[:2].upper()}"
    def mock_regenerate_stage(payload):
        return {
            "staging_token": "/tmp/staged",
            "target_user_dir": "/tmp/target",
            "target_archive_p12": "/tmp/archive.p12",
            "metadata": {
                "serial_number": new_serial,
                "subject": f"/C=ID/O={user.organization}/OU={user.ou}/CN={user.name}/emailAddress={user.email}",
                "issuer": "Intermediate CA",
                "fingerprint_sha256": f"FPNEW{unique_suffix}".ljust(64, '0')[:64],
                "certificate_path": "/tmp/target/new.crt",
                "p12_reference": "/tmp/target/new.p12",
                "issued_at": now.isoformat(),
                "expires_at": (now + timedelta(days=730)).isoformat()
            }
        }

    monkeypatch.setattr("app.services.pki_api_client.regenerate_stage", mock_regenerate_stage)
    monkeypatch.setattr("app.services.pki_api_client.regenerate_commit", lambda *args, **kwargs: True)

    payload = {
        "admin_password": "Password123!",
        "pfx_password": "NewPassphrase123!",
        "confirm_pfx_password": "NewPassphrase123!"
    }

    res = client.post(f"/api/v1/users/{user.id}/certificates/regenerate", json=payload, headers=auth_headers["admin"])
    assert res.status_code == 200, res.text
    res_data = res.json()["data"]

    new_cert_data = res_data["new_certificate"]
    assert new_cert_data["serial_number"] == new_serial
    assert "certificate_number" in new_cert_data
    assert new_cert_data["certificate_number"].startswith(f"DS-2026-{new_serial}-")
    assert new_cert_data["certificate_number"] != old_cert.certificate_number

    # Cek di database
    db_session.refresh(old_cert)
    assert old_cert.status == "REPLACED"
    assert old_cert.certificate_number == f"DS-2026-OLD{unique_suffix.upper()}-7701"  # Tetap utuh!
    assert old_cert.replaced_by == uuid.UUID(new_cert_data["id"])

    new_db_cert = db_session.query(Certificate).filter(Certificate.id == uuid.UUID(new_cert_data["id"])).first()
    assert new_db_cert is not None
    assert new_db_cert.status == "ACTIVE"
    assert new_db_cert.certificate_number == new_cert_data["certificate_number"]
    assert new_db_cert.serial_number == new_serial
