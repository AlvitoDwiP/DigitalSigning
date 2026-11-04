from fastapi.testclient import TestClient
from unittest.mock import patch
from app.main import app

client = TestClient(app)

AUTH_HEADER = {"X-Internal-Token": "dev-internal-pki-secret-token-2026"}

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    assert res.json()["service"] == "pki-service"

def test_missing_internal_token_returns_401():
    res = client.post("/internal/v1/pki/certificates/single", json={})
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED_SERVICE"

def test_invalid_internal_token_returns_403():
    res = client.post(
        "/internal/v1/pki/certificates/single",
        json={},
        headers={"X-Internal-Token": "wrong-token-abc"}
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "FORBIDDEN_SERVICE"

def test_single_cert_validation_and_success():
    mock_cert_data = {
        "serial_number": "12345678",
        "subject": "CN=Test",
        "issuer": "Intermediate CA",
        "fingerprint_sha256": "abcdef",
        "issued_at": "2026-10-01",
        "expires_at": "2028-10-01",
        "certificate_path": "/path/cert.crt",
        "p12_reference": "/path/cert.p12"
    }
    with patch("app.services.pki_engine.generate_single", return_value=mock_cert_data) as mock_gen:
        res = client.post(
            "/internal/v1/pki/certificates/single",
            json={
                "name": "Budi Santoso",
                "nik": "1234567890123456",
                "email": "budi@mkri.go.id",
                "organization": "Mahkamah Konstitusi",
                "ou": "Kepaniteraan",
                "pfx_password": "Passphrase123!"
            },
            headers=AUTH_HEADER
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["data"]["serial_number"] == "12345678"
        mock_gen.assert_called_once()

def test_bulk_cert_success():
    mock_bulk = {
        "results": [
            {"nik": "1234567890123456", "status": "SUCCESS"}
        ]
    }
    with patch("app.services.pki_engine.generate_bulk", return_value=mock_bulk):
        res = client.post(
            "/internal/v1/pki/certificates/bulk",
            json={
                "requests": [
                    {
                        "name": "Budi Santoso",
                        "nik": "1234567890123456",
                        "email": "budi@mkri.go.id",
                        "organization": "Mahkamah Konstitusi",
                        "ou": "Kepaniteraan",
                        "pfx_password": "Passphrase123!"
                    }
                ]
            },
            headers=AUTH_HEADER
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert len(res.json()["data"]["results"]) == 1

def test_regenerate_stage_commit_cleanup():
    mock_stage = {
        "staging_token": "/path/.staging_123",
        "target_user_dir": "/path/user",
        "target_archive_p12": "/path/user.p12",
        "metadata": {"serial_number": "SN999"}
    }
    with patch("app.services.pki_engine.generate_staged", return_value=mock_stage):
        res_stage = client.post(
            "/internal/v1/pki/certificates/regenerate/stage",
            json={
                "name": "Budi Santoso",
                "nik": "1234567890123456",
                "email": "budi@mkri.go.id",
                "organization": "Mahkamah Konstitusi",
                "ou": "Kepaniteraan",
                "pfx_password": "Passphrase123!"
            },
            headers=AUTH_HEADER
        )
        assert res_stage.status_code == 200
        assert res_stage.json()["data"]["staging_token"] == "/path/.staging_123"

    with patch("app.services.pki_engine.commit_staged", return_value=True):
        res_commit = client.post(
            "/internal/v1/pki/certificates/regenerate/commit",
            json={
                "staging_token": "/path/.staging_123",
                "target_user_dir": "/path/user",
                "target_archive_p12": "/path/user.p12"
            },
            headers=AUTH_HEADER
        )
        assert res_commit.status_code == 200
        assert res_commit.json()["data"]["status"] == "SUCCESS"

    with patch("app.services.pki_engine.cleanup_staged", return_value=True):
        res_clean = client.post(
            "/internal/v1/pki/certificates/regenerate/cleanup",
            json={"staging_token": "/path/.staging_123"},
            headers=AUTH_HEADER
        )
        assert res_clean.status_code == 200

def test_delete_materials():
    with patch("app.services.pki_engine.delete_user_pki_materials", return_value={"deleted": ["/path/1.p12"]}):
        res = client.delete(
            "/internal/v1/pki/materials/1234567890123456",
            headers=AUTH_HEADER
        )
        assert res.status_code == 200
        assert res.json()["data"]["deleted"] == ["/path/1.p12"]

def test_revoke_certificate_route():
    mock_revoke = {
        "serial_number": "1001",
        "status": "REVOKED",
        "revocation_reason": "keyCompromise",
        "certificate_path": "/path/cert.crt"
    }
    with patch("app.services.pki_engine.revoke_certificate", return_value=mock_revoke) as mock_r:
        res = client.post(
            "/internal/v1/pki/certificates/revoke",
            json={"identifier": "1001", "reason": "keyCompromise"},
            headers=AUTH_HEADER
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["data"]["status"] == "REVOKED"
        assert res.json()["data"]["revocation_reason"] == "keyCompromise"
        mock_r.assert_called_once_with(identifier="1001", reason="keyCompromise")

def test_verify_certificate_route():
    mock_verify = {
        "serial_number": "1001",
        "certificate_path": "/path/cert.crt",
        "is_valid": True,
        "status": "VALID",
        "message": "Certificate is valid and active"
    }
    with patch("app.services.pki_engine.verify_certificate", return_value=mock_verify) as mock_v:
        res = client.post(
            "/internal/v1/pki/certificates/verify",
            json={"identifier": "1001"},
            headers=AUTH_HEADER
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["data"]["is_valid"] is True
        mock_v.assert_called_once_with(identifier="1001")

def test_crl_routes():
    mock_crl_info = {
        "crl_pem_path": "/path/intermediate-ca.crl",
        "crl_der_path": "/path/intermediate-ca.crl.der",
        "crl_number": "0x1000",
        "last_update": "Nov 2 2026",
        "next_update": "Dec 2 2026"
    }
    with patch("app.services.pki_engine.generate_crl", return_value=mock_crl_info):
        res_gen = client.post("/internal/v1/pki/crl/generate", headers=AUTH_HEADER)
        assert res_gen.status_code == 200
        assert res_gen.json()["data"]["crl_number"] == "0x1000"

    with patch("app.services.pki_engine.get_crl_content", return_value=b"-----BEGIN X509 CRL-----"):
        # Internal CRL
        res_crl = client.get("/internal/v1/pki/crl?format=pem", headers=AUTH_HEADER)
        assert res_crl.status_code == 200
        assert b"BEGIN X509 CRL" in res_crl.content

        # Public CRL (no token required)
        res_pub = client.get("/crl?format=pem")
        assert res_pub.status_code == 200
        assert b"BEGIN X509 CRL" in res_pub.content

