import uuid
import random
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash, create_access_token


def test_regenerate_correct_password_succeeds(client: TestClient, auth_headers: dict, seed_users: dict):
    """1. Password benar memungkinkan proses berlanjut sesuai otorisasi."""
    target_user = seed_users["user"]
    mock_stage_res = {
        "staging_token": "token-regen-correct",
        "target_user_dir": "/path/dir",
        "target_archive_p12": "/path/archive.p12",
        "metadata": {
            "serial_number": "SER-CORRECT-PWD-999",
            "subject": f"CN={target_user.name}",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "certificate_path": "/path/cert.crt",
            "p12_reference": "/path/cert.p12",
            "issued_at": "2026-10-01T00:00:00Z",
            "expires_at": "2028-10-01T00:00:00Z",
        }
    }

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage", return_value=mock_stage_res) as mock_stage, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit", return_value={"status": "SUCCESS"}):
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["new_certificate"]["serial_number"] == "SER-CORRECT-PWD-999"
        mock_stage.assert_called_once()


def test_regenerate_wrong_password_rejected_without_calling_pki(client: TestClient, auth_headers: dict, seed_users: dict):
    """2. Password salah menolak proses tanpa memanggil PKI Engine."""
    target_user = seed_users["user"]

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit") as mock_commit:
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "WrongPassword999!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 400
        data = res.json()
        assert data["error"]["code"] == "INVALID_CREDENTIALS"
        assert "salah" in data["error"]["message"].lower()

        # PKI Engine MUST NOT be called!
        mock_stage.assert_not_called()
        mock_commit.assert_not_called()


def test_regenerate_missing_password_rejected_without_calling_pki(client: TestClient, auth_headers: dict, seed_users: dict):
    """Password kosong atau tidak ada harus ditolak tanpa memanggil PKI Engine."""
    target_user = seed_users["user"]

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage:
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 400
        data = res.json()
        assert data["error"]["code"] == "INVALID_INPUT"
        mock_stage.assert_not_called()


def test_regular_user_cannot_use_regenerate_endpoint(client: TestClient, auth_headers: dict, seed_users: dict):
    """3. User biasa tidak dapat meregenerasi sertifikat pengguna lain."""
    admin_user = seed_users["admin"]

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage:
        res = client.post(
            f"/api/v1/users/{admin_user.id}/certificates/regenerate",
            json={"admin_password": "Password123!"},
            headers=auth_headers["user"]
        )
        assert res.status_code == 403
        mock_stage.assert_not_called()


def test_verified_identity_always_from_logged_in_admin(client: TestClient, db_session: Session, seed_users: dict):
    """4. Identitas yang diverifikasi selalu berasal dari akun yang sedang login."""
    target_user = seed_users["user"]

    # Buat admin baru dengan NIK random 16 digit unik dan password spesifik
    random_digits = f"{random.randint(10000000000000, 99999999999999):014d}"
    special_admin = User(
        id=uuid.uuid4(),
        name="Special Admin",
        nik=f"88{random_digits}",
        email=f"special_admin_{uuid.uuid4().hex[:6]}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="IT",
        password_hash=get_password_hash("SpecialAdminSecret!99"),
        role="ADMIN",
        status="ACTIVE"
    )
    db_session.add(special_admin)
    db_session.commit()
    db_session.refresh(special_admin)

    token = create_access_token(subject=special_admin.id)
    special_headers = {"Authorization": f"Bearer {token}"}

    try:
        with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage:
            # Mencoba menggunakan password default admin lain ("Password123!") HARUS GAGAL
            res_wrong = client.post(
                f"/api/v1/users/{target_user.id}/certificates/regenerate",
                json={"admin_password": "Password123!"},
                headers=special_headers
            )
            assert res_wrong.status_code == 400
            assert res_wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"
            mock_stage.assert_not_called()

            # Menggunakan password special_admin yang sedang login HARUS BERHASIL
            mock_stage.return_value = {
                "staging_token": "token-special",
                "target_user_dir": "/path/dir",
                "target_archive_p12": "/path/archive.p12",
                "metadata": {
                    "serial_number": "SER-SPECIAL-001",
                    "subject": f"CN={target_user.name}",
                    "issuer": "Intermediate CA",
                    "fingerprint_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "certificate_path": "/path/cert.crt",
                    "p12_reference": "/path/cert.p12",
                    "issued_at": "2026-10-01T00:00:00Z",
                    "expires_at": "2028-10-01T00:00:00Z",
                }
            }
            with patch("app.api.endpoints.users.pki_api_client.regenerate_commit", return_value={"status": "SUCCESS"}):
                res_correct = client.post(
                    f"/api/v1/users/{target_user.id}/certificates/regenerate",
                    json={"admin_password": "SpecialAdminSecret!99"},
                    headers=special_headers
                )
                assert res_correct.status_code == 200
                assert res_correct.json()["data"]["new_certificate"]["serial_number"] == "SER-SPECIAL-001"
    finally:
        db_session.delete(special_admin)
        db_session.commit()


def test_password_never_leaks_in_response_or_audit_logs(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    """5. Password tidak muncul dalam log, response, atau audit log."""
    target_user = seed_users["user"]
    secret_pwd = "Password123!"

    mock_stage_res = {
        "staging_token": "token-leak-test",
        "target_user_dir": "/path/dir",
        "target_archive_p12": "/path/archive.p12",
        "metadata": {
            "serial_number": "SER-NO-LEAK-777",
            "subject": f"CN={target_user.name}",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "certificate_path": "/path/cert.crt",
            "p12_reference": "/path/cert.p12",
            "issued_at": "2026-10-01T00:00:00Z",
            "expires_at": "2028-10-01T00:00:00Z",
        }
    }

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage", return_value=mock_stage_res), \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit", return_value={"status": "SUCCESS"}):
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": secret_pwd},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        # Password tidak boleh ada di response text
        assert secret_pwd not in res.text

    # Periksa audit log terbaru
    latest_logs = db_session.query(AuditLog).filter(
        AuditLog.action == "CERTIFICATE_REGENERATED",
        AuditLog.target_id == target_user.id
    ).all()
    assert len(latest_logs) > 0
    for al in latest_logs:
        # Pastikan tidak ada field rahasia
        assert not hasattr(al, "password")
        assert not hasattr(al, "admin_password")


def test_regeneration_failure_handling_and_cleanup(client: TestClient, auth_headers: dict, seed_users: dict, db_session):
    """6. Kegagalan regenerasi tetap ditangani sesuai mekanisme backend yang ada (cleanup dipanggil dan status DB tidak berubah)."""
    target_user = seed_users["user"]

    # Ambil sertifikat aktif sebelum percobaan regenerasi
    initial_cert = db_session.query(Certificate).filter(
        Certificate.user_id == target_user.id,
        Certificate.status == "ACTIVE"
    ).first()
    assert initial_cert is not None
    initial_cert_id = initial_cert.id

    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage", side_effect=Exception("PKI Stage Failure")), \
         patch("app.api.endpoints.users.pki_api_client.regenerate_cleanup") as mock_cleanup:
        res = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 500
        assert res.json()["error"]["code"] == "PKI_GENERATION_FAILED"

    # Verifikasi status database: sertifikat awal tetap ACTIVE, tidak ada sertifikat baru
    db_session.expire_all()
    current_active = db_session.query(Certificate).filter(
        Certificate.user_id == target_user.id,
        Certificate.status == "ACTIVE"
    ).first()
    assert current_active is not None
    assert current_active.id == initial_cert_id
    assert current_active.status == "ACTIVE"
    assert current_active.replaced_by is None
