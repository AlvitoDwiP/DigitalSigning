import uuid
import io
import random
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import create_access_token, get_password_hash


def test_user_forbidden_on_administrative_endpoints(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Role USER ditolak HTTP 403 pada endpoint administratif:
    - GET /api/v1/users (list)
    - GET /api/v1/users/{id} (detail)
    - POST /api/v1/users/generate (create single)
    - POST /api/v1/users/generate-bulk/validate (validate bulk csv)
    - POST /api/v1/users/generate-bulk (create bulk)
    - DELETE /api/v1/users/{id} (delete user)
    - GET /api/v1/audit-logs (audit log)
    Memastikan PKI Engine tidak pernah dipanggil pada request yang ditolak.
    """
    user_headers = auth_headers["user"]
    target_id = seed_users["admin"].id

    # 1. GET /api/v1/users (list)
    res_list = client.get("/api/v1/users", headers=user_headers)
    assert res_list.status_code == 403

    # 2. GET /api/v1/users/{id} (detail)
    res_detail = client.get(f"/api/v1/users/{target_id}", headers=user_headers)
    assert res_detail.status_code == 403

    # 3. POST /api/v1/users/generate (single generation)
    with patch("app.api.endpoints.users.pki_api_client.generate_single") as mock_pki:
        res_gen = client.post(
            "/api/v1/users/generate",
            json={
                "name": "Budi Forbidden",
                "nik": "9999888877665544",
                "email": "budi_forbidden@mkri.go.id",
                "organization": "Mahkamah Konstitusi",
                "ou": "Hukum",
                "password": "Password123!",
                "pfx_password": "Passphrase123!"
            },
            headers=user_headers
        )
        assert res_gen.status_code == 403
        mock_pki.assert_not_called()

    # 4. POST /api/v1/users/generate-bulk/validate
    csv_file = io.BytesIO(b"name,nik,email,organization,ou,password,pfx_password\nTest,1234567890123456,test@mkri.go.id,MK,IT,Pass123!,Pfx123!\n")
    res_val_bulk = client.post(
        "/api/v1/users/generate-bulk/validate",
        files={"file": ("test.csv", csv_file, "text/csv")},
        headers=user_headers
    )
    assert res_val_bulk.status_code == 403

    # 5. POST /api/v1/users/generate-bulk
    with patch("app.api.endpoints.users.pki_api_client.generate_bulk") as mock_bulk_pki:
        csv_file_exec = io.BytesIO(b"name,nik,email,organization,ou,password,pfx_password\nTest,1234567890123456,test@mkri.go.id,MK,IT,Pass123!,Pfx123!\n")
        res_bulk = client.post(
            "/api/v1/users/generate-bulk",
            files={"file": ("test.csv", csv_file_exec, "text/csv")},
            headers=user_headers
        )
        assert res_bulk.status_code == 403
        mock_bulk_pki.assert_not_called()

    # 6. DELETE /api/v1/users/{id}
    with patch("app.api.endpoints.users.pki_api_client.delete_user_materials") as mock_del_pki:
        res_del = client.delete(f"/api/v1/users/{target_id}", headers=user_headers)
        assert res_del.status_code == 403
        mock_del_pki.assert_not_called()

    # 7. GET /api/v1/audit-logs
    res_audit = client.get("/api/v1/audit-logs", headers=user_headers)
    assert res_audit.status_code == 403


def test_user_cannot_change_other_user_pfx_password_idor(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Role USER ditolak HTTP 403 jika mencoba mengganti passphrase sertifikat milik user lain (IDOR protection).
    PKI Engine tidak boleh dieksekusi.
    """
    other_user = seed_users["admin"]
    with patch("app.api.endpoints.users.pki_api_client.change_p12_passphrase_user") as mock_pki_user, \
         patch("app.api.endpoints.users.pki_api_client.change_p12_passphrase_admin") as mock_pki_admin:
        res = client.post(
            f"/api/v1/users/{other_user.id}/pfx-password",
            json={
                "old_password": "OldPassphrase123!",
                "new_password": "NewPassphrase123!",
                "confirm_password": "NewPassphrase123!"
            },
            headers=auth_headers["user"]
        )
        assert res.status_code == 403
        data = res.json()
        error_code = data.get("error", {}).get("code") or data.get("detail", {}).get("code")
        assert error_code == "FORBIDDEN"
        mock_pki_user.assert_not_called()
        mock_pki_admin.assert_not_called()


def test_user_can_access_own_account_endpoints(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    USER tetap dapat menggunakan endpoint akun pribadi yang memang diizinkan oleh spesifikasi:
    - GET /api/v1/account
    - PATCH /api/v1/account
    - POST /api/v1/account/password
    - POST /api/v1/account/pfx-password
    """
    user_headers = auth_headers["user"]
    current_u = seed_users["user"]

    # 1. GET /api/v1/account
    res_get = client.get("/api/v1/account", headers=user_headers)
    assert res_get.status_code == 200
    assert res_get.json()["data"]["email"] == current_u.email

    # 2. PATCH /api/v1/account
    res_patch = client.patch(
        "/api/v1/account",
        json={"ou": "Kepaniteraan dan Sekretariat Jenderal"},
        headers=user_headers
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["data"]["ou"] == "Kepaniteraan dan Sekretariat Jenderal"

    # 3. POST /api/v1/account/password
    res_pass = client.post(
        "/api/v1/account/password",
        json={
            "old_password": "Password123!",
            "new_password": "UpdatedPassword123!",
            "confirm_password": "UpdatedPassword123!"
        },
        headers=user_headers
    )
    assert res_pass.status_code == 200
    assert res_pass.json()["success"] is True

    # Kembalikan password agar fixture/sesi berikutnya konsisten
    client.post(
        "/api/v1/account/password",
        json={
            "old_password": "UpdatedPassword123!",
            "new_password": "Password123!",
            "confirm_password": "Password123!"
        },
        headers=user_headers
    )

    # 4. POST /api/v1/account/pfx-password (dengan mock pki_api_client)
    with patch("app.api.endpoints.account.pki_api_client.change_p12_passphrase_user") as mock_pfx_user:
        res_pfx = client.post(
            "/api/v1/account/pfx-password",
            json={
                "old_password": "OldPassphrase123!",
                "new_password": "NewPassphrase123!",
                "confirm_password": "NewPassphrase123!"
            },
            headers=user_headers
        )
        assert res_pfx.status_code == 200
        assert res_pfx.json()["success"] is True
        mock_pfx_user.assert_called_once_with(
            nik=current_u.nik,
            old_password="OldPassphrase123!",
            new_password="NewPassphrase123!"
        )


def test_only_super_admin_can_manage_admins(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Hanya SUPER_ADMIN yang dapat mengakses /api/v1/admins/*; ADMIN dan USER ditolak HTTP 403.
    """
    user_headers = auth_headers["user"]
    admin_headers = auth_headers["admin"]
    super_admin_headers = auth_headers["super_admin"]
    target_user_id = seed_users["user"].id

    # 1. USER mengakses GET /api/v1/admins -> 403
    assert client.get("/api/v1/admins", headers=user_headers).status_code == 403
    # 2. ADMIN mengakses GET /api/v1/admins -> 403
    assert client.get("/api/v1/admins", headers=admin_headers).status_code == 403
    # 3. SUPER_ADMIN mengakses GET /api/v1/admins -> 200
    assert client.get("/api/v1/admins", headers=super_admin_headers).status_code == 200

    # 4. USER mencoba assign admin -> 403
    assert client.post(f"/api/v1/admins/{target_user_id}", headers=user_headers).status_code == 403
    # 5. ADMIN mencoba assign admin -> 403
    assert client.post(f"/api/v1/admins/{target_user_id}", headers=admin_headers).status_code == 403

    # 6. USER mencoba remove admin -> 403
    assert client.delete(f"/api/v1/admins/{seed_users['admin'].id}", headers=user_headers).status_code == 403
    # 7. ADMIN mencoba remove admin -> 403
    assert client.delete(f"/api/v1/admins/{seed_users['admin'].id}", headers=admin_headers).status_code == 403


def test_role_change_in_db_takes_immediate_effect_with_old_jwt(client: TestClient, db_session: Session):
    """
    Perubahan role di database langsung memengaruhi otorisasi request berikutnya
    meskipun JWT lama masih digunakan (karena deps.py memeriksa user role dari DB setiap request).
    """
    # 1. Buat temporary user dengan role "USER"
    test_user_id = uuid.uuid4()
    numeric_suffix = f"{random.randint(10000000, 99999999):08d}"
    temp_user = User(
        id=test_user_id,
        name="Dynamic Role User",
        nik=f"99990000{numeric_suffix}",
        email=f"dynamic_{uuid.uuid4().hex[:6]}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="IT",
        password_hash=get_password_hash("Password123!"),
        role="USER",
        status="ACTIVE"
    )
    db_session.add(temp_user)
    db_session.commit()

    try:
        # 2. Buat JWT token untuk temp_user saat rolenya masih USER
        jwt_token = create_access_token(subject=str(temp_user.id))
        headers = {"Authorization": f"Bearer {jwt_token}"}

        # 3. Request ke endpoint admin -> ditolak 403
        res1 = client.get("/api/v1/users", headers=headers)
        assert res1.status_code == 403

        # 4. Ubah role di database menjadi "ADMIN"
        temp_user.role = "ADMIN"
        db_session.commit()

        # 5. Request lagi ke endpoint admin DENGAN TOKEN JWT LAMA YANG SAMA -> diterima 200
        res2 = client.get("/api/v1/users", headers=headers)
        assert res2.status_code == 200
        assert res2.json()["success"] is True

        # 6. Ubah role di database kembali menjadi "USER"
        temp_user.role = "USER"
        db_session.commit()

        # 7. Request lagi dengan token yang sama -> langsung ditolak 403 lagi
        res3 = client.get("/api/v1/users", headers=headers)
        assert res3.status_code == 403

    finally:
        # Cleanup
        db_session.delete(temp_user)
        db_session.commit()


def test_regenerate_permissions_and_password_verification(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Regenerate sertifikat:
    - USER mencoba me-regenerate pengguna LAIN ditolak HTTP 403 (tanpa memanggil PKI)
    - USER mencoba me-regenerate miliknya sendiri dengan password salah ditolak HTTP 400
    - USER me-regenerate miliknya sendiri dengan password benar berhasil HTTP 200
    - ADMIN dengan password salah ditolak HTTP 400 (tanpa memanggil PKI)
    - ADMIN dengan password benar berhasil (memanggil PKI stage & commit)
    """
    target_user = seed_users["user"]
    admin_user = seed_users["admin"]

    # 1. USER mencoba regenerate sertifikat pengguna LAIN -> 403 FORBIDDEN, PKI tidak dipanggil
    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage_u, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit") as mock_commit_u:
        res_u = client.post(
            f"/api/v1/users/{admin_user.id}/certificates/regenerate",
            json={"password": "Password123!"},
            headers=auth_headers["user"]
        )
        assert res_u.status_code == 403
        assert res_u.json()["error"]["code"] == "FORBIDDEN"
        mock_stage_u.assert_not_called()
        mock_commit_u.assert_not_called()

    # 2. USER mencoba regenerate sertifikat miliknya sendiri dengan password SALAH -> 400
    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage_w_u, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit") as mock_commit_w_u:
        res_w_u = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"password": "SalahPassword999!"},
            headers=auth_headers["user"]
        )
        assert res_w_u.status_code == 400
        assert res_w_u.json()["error"]["code"] == "INVALID_CREDENTIALS"
        mock_stage_w_u.assert_not_called()
        mock_commit_w_u.assert_not_called()

    # 3. USER mencoba regenerate sertifikat miliknya sendiri dengan password BENAR -> 200 SUCCESS
    mock_stage_res_user = {
        "staging_token": "token-regen-user-own",
        "target_user_dir": "/path/dir",
        "target_archive_p12": "/path/archive.p12",
        "metadata": {
            "serial_number": "SER-USER-OWN-123",
            "subject": f"CN={target_user.name}",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef1234",
            "certificate_path": "/path/user_new.crt",
            "p12_reference": "/path/user_new.p12",
            "issued_at": "2026-10-01T00:00:00Z",
            "expires_at": "2028-10-01T00:00:00Z",
        }
    }
    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage", return_value=mock_stage_res_user) as mock_stage_u_s, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit", return_value={"status": "SUCCESS"}) as mock_commit_u_s:
        res_u_s = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"password": "Password123!"},
            headers=auth_headers["user"]
        )
        assert res_u_s.status_code == 200
        assert res_u_s.json()["success"] is True
        mock_stage_u_s.assert_called_once()
        mock_commit_u_s.assert_called_once()

    # 4. ADMIN mencoba regenerate dengan password salah -> 400 INVALID_CREDENTIALS, PKI tidak dipanggil
    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage") as mock_stage_w, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit") as mock_commit_w:
        res_w = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "WrongPassword999!"},
            headers=auth_headers["admin"]
        )
        assert res_w.status_code == 400
        assert res_w.json()["error"]["code"] == "INVALID_CREDENTIALS"
        mock_stage_w.assert_not_called()
        mock_commit_w.assert_not_called()

    # 5. ADMIN mencoba regenerate dengan password benar -> 200 SUCCESS
    mock_stage_res = {
        "staging_token": "token-regen-auth-test",
        "target_user_dir": "/path/dir",
        "target_archive_p12": "/path/archive.p12",
        "metadata": {
            "serial_number": "SER-AUTH-TEST-123",
            "subject": f"CN={target_user.name}",
            "issuer": "Intermediate CA",
            "fingerprint_sha256": "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            "certificate_path": "/path/cert.crt",
            "p12_reference": "/path/cert.p12",
            "issued_at": "2026-10-01T00:00:00Z",
            "expires_at": "2028-10-01T00:00:00Z",
        }
    }
    with patch("app.api.endpoints.users.pki_api_client.regenerate_stage", return_value=mock_stage_res) as mock_stage_s, \
         patch("app.api.endpoints.users.pki_api_client.regenerate_commit", return_value={"status": "SUCCESS"}) as mock_commit_s:
        res_s = client.post(
            f"/api/v1/users/{target_user.id}/certificates/regenerate",
            json={"admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res_s.status_code == 200
        assert res_s.json()["success"] is True
        mock_stage_s.assert_called_once()
        mock_commit_s.assert_called_once()


def test_dashboard_view_mode_and_role_safety(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Mode Pengguna untuk Admin:
    - ADMIN mode=user mendapatkan personal user dashboard data
    - ADMIN default (tanpa mode) tetap mendapatkan admin dashboard data
    - SUPER_ADMIN mode=user ditolak 403 Forbidden (Super Admin tidak diizinkan user mode/TTE)
    - USER mode=admin ditolak 403 Forbidden
    - ADMIN mode=invalid ditolak 400 Bad Request
    """
    admin_headers = auth_headers["admin"]
    super_admin_headers = auth_headers["super_admin"]
    user_headers = auth_headers["user"]

    # 1. ADMIN default -> admin dashboard
    res_admin_default = client.get("/api/v1/dashboard/", headers=admin_headers)
    assert res_admin_default.status_code == 200
    data_admin = res_admin_default.json()["data"]
    assert "statistics" in data_admin
    assert "total_user" in data_admin["statistics"]
    assert "recent_activities" in data_admin

    # 2. ADMIN mode=user -> user dashboard
    res_admin_user_mode = client.get("/api/v1/dashboard/?mode=user", headers=admin_headers)
    assert res_admin_user_mode.status_code == 200
    data_user_mode = res_admin_user_mode.json()["data"]
    assert "user" in data_user_mode
    assert data_user_mode["user"]["id"] == str(seed_users["admin"].id)
    assert "has_active_certificate" in data_user_mode
    assert "total_users" not in data_user_mode

    # 3. SUPER_ADMIN mode=user -> ditolak 403
    res_sa_user_mode = client.get("/api/v1/dashboard/?mode=user", headers=super_admin_headers)
    assert res_sa_user_mode.status_code == 403
    assert res_sa_user_mode.json()["error"]["code"] == "FORBIDDEN"

    # 4. USER mode=admin -> ditolak 403
    res_user_admin_mode = client.get("/api/v1/dashboard/?mode=admin", headers=user_headers)
    assert res_user_admin_mode.status_code == 403
    assert res_user_admin_mode.json()["error"]["code"] == "FORBIDDEN"

    # 5. ADMIN mode=invalid -> ditolak 400
    res_invalid_mode = client.get("/api/v1/dashboard/?mode=unknown", headers=admin_headers)
    assert res_invalid_mode.status_code == 400


def test_super_admin_forbidden_from_signatures_endpoints(client: TestClient, auth_headers: dict):
    """
    SUPER_ADMIN secara tegas dilarang mengakses seluruh endpoint penandatanganan:
    - POST /api/v1/signatures -> 403 Forbidden
    - POST /api/v1/signatures/sign -> 403 Forbidden
    """
    super_admin_headers = auth_headers["super_admin"]

    # 1. Root signatures endpoint
    res_root = client.post("/api/v1/signatures", headers=super_admin_headers)
    assert res_root.status_code == 403
    assert res_root.json()["error"]["code"] == "FORBIDDEN"

    # 2. Sign document endpoint
    res_sign = client.post(
        "/api/v1/signatures/sign",
        headers=super_admin_headers,
        files={"pdf": ("doc.pdf", b"%PDF-1.4...", "application/pdf")},
        data={"passphrase": "secret"}
    )
    assert res_sign.status_code == 403
    assert res_sign.json()["error"]["code"] == "FORBIDDEN"

