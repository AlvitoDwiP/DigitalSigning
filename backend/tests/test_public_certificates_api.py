import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.certificate import Certificate


def test_public_certificates_list_requires_authentication(client: TestClient):
    """
    Memastikan endpoint GET /api/v1/certificates menolak permintaan tanpa autentikasi (401).
    """
    response = client.get("/api/v1/certificates")
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert "error" in data


def test_public_certificates_list_invalid_token(client: TestClient):
    """
    Memastikan endpoint GET /api/v1/certificates menolak permintaan dengan Bearer token palsu/rusak (401).
    """
    headers = {"Authorization": "Bearer invalid.token.payload"}
    response = client.get("/api/v1/certificates", headers=headers)
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False


def test_public_certificates_list_inactive_user_rejected(client: TestClient, seed_users: dict):
    """
    Memastikan akun tidak aktif (INACTIVE) tidak dapat mengakses endpoint publik baca sertifikat (401).
    """
    from app.core.security import create_access_token
    inactive_token = create_access_token(subject=str(seed_users["inactive"].id))
    response = client.get("/api/v1/certificates", headers={"Authorization": f"Bearer {inactive_token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False


def test_public_certificates_list_success_all_roles(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Memastikan pengguna terautentikasi (USER, ADMIN, SUPER_ADMIN) dapat membaca daftar sertifikat.
    """
    for role_key in ["user", "admin", "super_admin"]:
        response = client.get("/api/v1/certificates", headers=auth_headers[role_key])
        assert response.status_code == 200, f"Role {role_key} failed to list certificates"
        data = response.json()
        assert data["success"] is True
        assert "items" in data["data"]
        assert "pagination" in data["data"]
        pagination = data["data"]["pagination"]
        assert pagination["page"] == 1
        assert pagination["limit"] == 20
        assert pagination["total"] >= 2
        assert isinstance(data["data"]["items"], list)


def test_public_certificates_list_status_filter_and_validation(client: TestClient, auth_headers: dict):
    """
    Memastikan filter status bekerja dan input status tidak valid menghasilkan HTTP 400.
    """
    # 1. Filter valid: ACTIVE
    res_active = client.get("/api/v1/certificates?status=ACTIVE", headers=auth_headers["user"])
    assert res_active.status_code == 200
    for item in res_active.json()["data"]["items"]:
        assert item["status"] == "ACTIVE"

    # 2. Filter invalid: DUMMY_STATUS
    res_invalid = client.get("/api/v1/certificates?status=DUMMY_STATUS", headers=auth_headers["user"])
    assert res_invalid.status_code == 400
    data_err = res_invalid.json()
    assert data_err["success"] is False
    assert data_err["error"]["code"] == "INVALID_INPUT"


def test_public_certificates_list_search(client: TestClient, auth_headers: dict, seed_users: dict):
    """
    Memastikan parameter pencarian 'search' berfungsi pada serial_number, subject, dan fingerprint.
    """
    # Cari nama admin yang ada di subject
    query_name = seed_users["admin"].name
    response = client.get(f"/api/v1/certificates?search={query_name}", headers=auth_headers["user"])
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) >= 1
    assert any(query_name in item["subject"] for item in items)


def test_public_certificates_list_pagination(client: TestClient, auth_headers: dict):
    """
    Memastikan pagination membatasi jumlah data dan parameter limit maksimal 100 ditegakkan.
    """
    # Limit = 1
    res = client.get("/api/v1/certificates?page=1&limit=1", headers=auth_headers["user"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["items"]) == 1
    assert data["pagination"]["limit"] == 1

    # Limit > 100 ditolak validasi schema
    res_overflow = client.get("/api/v1/certificates?limit=101", headers=auth_headers["user"])
    assert res_overflow.status_code == 400
    assert res_overflow.json()["error"]["code"] == "INVALID_INPUT"


def test_public_certificates_no_sensitive_fields_leaked(client: TestClient, auth_headers: dict):
    """
    MEMASTIKAN RESPON TIDAK PERNAH MEMBOCORKAN PRIVATE KEY, FILE P12, PATH BERKAS,
    PASSPHRASE, PASSWORD HASH, ATAU IDENTIFIER PRIBADI USER.
    """
    response = client.get("/api/v1/certificates", headers=auth_headers["user"])
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert len(items) > 0

    forbidden_keys = {
        "certificate_path",
        "p12_reference",
        "private_key",
        "p12",
        "pfx",
        "passphrase",
        "password",
        "password_hash",
        "nik"
    }

    for item in items:
        found_forbidden = forbidden_keys.intersection(set(item.keys()))
        assert not found_forbidden, f"Sensitif keys leaked in item: {found_forbidden}"
        # Pastikan field wajib publik tersedia
        assert "id" in item
        assert "serial_number" in item
        assert "subject" in item
        assert "issuer" in item
        assert "fingerprint_sha256" in item
        assert "status" in item
        assert "issued_at" in item
        assert "expires_at" in item


def test_public_certificate_get_by_uuid(client: TestClient, auth_headers: dict, db_session: Session, seed_users: dict):
    """
    Menguji GET /api/v1/certificates/{identifier} menggunakan UUID sertifikat.
    """
    cert = db_session.query(Certificate).filter(Certificate.user_id == seed_users["user"].id).first()
    assert cert is not None

    response = client.get(f"/api/v1/certificates/{cert.id}", headers=auth_headers["user"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    res_cert = data["data"]
    assert res_cert["id"] == str(cert.id)
    assert res_cert["serial_number"] == cert.serial_number
    assert res_cert["status"] == cert.status
    assert "is_valid" in res_cert
    assert "certificate_path" not in res_cert
    assert "p12_reference" not in res_cert


def test_public_certificate_get_by_serial_number(client: TestClient, auth_headers: dict, db_session: Session, seed_users: dict):
    """
    Menguji GET /api/v1/certificates/{identifier} menggunakan nomor seri (serial_number).
    """
    cert = db_session.query(Certificate).filter(Certificate.user_id == seed_users["user"].id).first()
    assert cert is not None

    response = client.get(f"/api/v1/certificates/{cert.serial_number}", headers=auth_headers["admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["id"] == str(cert.id)


def test_public_certificate_get_by_fingerprint(client: TestClient, auth_headers: dict, db_session: Session, seed_users: dict):
    """
    Menguji GET /api/v1/certificates/{identifier} menggunakan SHA-256 fingerprint.
    """
    cert = db_session.query(Certificate).filter(Certificate.user_id == seed_users["user"].id).first()
    assert cert is not None

    response = client.get(f"/api/v1/certificates/{cert.fingerprint_sha256}", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["id"] == str(cert.id)


def test_public_certificate_get_not_found(client: TestClient, auth_headers: dict):
    """
    Menguji respons 404 ketika sertifikat dengan identifier acak tidak ditemukan.
    """
    # 1. Non-existent UUID
    fake_uuid = str(uuid.uuid4())
    res_uuid = client.get(f"/api/v1/certificates/{fake_uuid}", headers=auth_headers["user"])
    assert res_uuid.status_code == 404
    assert res_uuid.json()["error"]["code"] == "CERTIFICATE_NOT_FOUND"

    # 2. Non-existent serial
    res_serial = client.get("/api/v1/certificates/NON_EXISTENT_SERIAL_9999", headers=auth_headers["user"])
    assert res_serial.status_code == 404
    assert res_serial.json()["error"]["code"] == "CERTIFICATE_NOT_FOUND"


def test_public_certificates_readonly_no_mutation(client: TestClient, auth_headers: dict):
    """
    MEMASTIKAN ENDPOINT PUBLIK HANYA MENERIMA OPERASI READ (GET) DAN MENOLAK MUTASI (POST, PUT, DELETE).
    """
    res_post = client.post("/api/v1/certificates", headers=auth_headers["admin"], json={"name": "Test"})
    assert res_post.status_code == 405

    res_put = client.put("/api/v1/certificates", headers=auth_headers["admin"], json={"status": "EXPIRED"})
    assert res_put.status_code == 405

    res_delete = client.delete("/api/v1/certificates", headers=auth_headers["super_admin"])
    assert res_delete.status_code == 405
