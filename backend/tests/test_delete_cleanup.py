import uuid
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.models.user import User
from app.models.certificate import Certificate
from app.core.config import BASE_DIR
from app.services.pki_cleanup import cleanup_local_pki_materials


def test_cleanup_local_pki_materials(tmp_path, monkeypatch):
    """
    Test bahwa pembersihan file lokal menghapus berkas p12 di sign-api/p12
    dan seluruh berkas di folder issued.
    """
    fake_archive = tmp_path / "sign-api" / "p12"
    fake_issued = tmp_path / "pki" / "issued"
    fake_archive.mkdir(parents=True)
    fake_issued.mkdir(parents=True)

    nik_test = "3510999988887777"
    
    # 1. Buat fake p12 di archive
    archive_p12 = fake_archive / f"{nik_test}.p12"
    archive_p12.write_bytes(b"dummy p12 archive content")

    # 2. Buat folder user di issued
    user_folder = fake_issued / "mkri--test-user"
    user_folder.mkdir()
    (user_folder / f"{nik_test}.p12").write_bytes(b"dummy issued p12")
    (user_folder / "mkri--test-user.crt").write_text("dummy crt")
    (user_folder / "mkri--test-user.key").write_text("dummy key")
    (user_folder / "mkri--test-user.csr").write_text("dummy csr")
    (user_folder / "mkri--test-user.pfx").write_bytes(b"dummy pfx")
    (user_folder / "mkri--test-user-meta.txt").write_text(f"NIK : {nik_test}\nPerson : Test User")

    monkeypatch.setattr("app.services.pki_cleanup.get_local_pki_dirs", lambda: (fake_archive, fake_issued))

    deleted = cleanup_local_pki_materials(nik_test)

    assert not archive_p12.exists()
    assert not user_folder.exists()
    assert len(deleted) > 0


def test_delete_user_and_cert_endpoint(client: TestClient, db_session, auth_headers, seed_users):
    """
    Test integrasi bahwa pemanggilan endpoint DELETE /api/v1/users/{id}
    menghapus user dari DB dan memanggil mekanisme cleanup berkas PKI.
    """
    admin_headers = auth_headers["admin"]
    target_user = seed_users["user"]
    target_id = target_user.id
    target_id_str = str(target_id)

    # Verifikasi user & cert ada sebelum delete
    assert db_session.query(User).filter(User.id == target_id).first() is not None

    with patch("app.api.endpoints.users.cleanup_local_pki_materials") as mock_cleanup, \
         patch("app.api.endpoints.users.pki_api_client.delete_user_materials") as mock_pki:
        res = client.delete(f"/api/v1/users/{target_id_str}", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["success"] is True
        mock_cleanup.assert_called_once()

    # Verifikasi user dan cert terhapus dari DB
    db_session.rollback()
    assert db_session.query(User).filter(User.id == target_id).first() is None
    assert db_session.query(Certificate).filter(Certificate.user_id == target_id).first() is None

