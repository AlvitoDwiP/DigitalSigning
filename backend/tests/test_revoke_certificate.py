from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog


def test_revoke_certificate_endpoint(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    user = seed_users["user"]
    active_cert = db_session.query(Certificate).filter(
        Certificate.user_id == user.id,
        Certificate.status == "ACTIVE"
    ).first()
    assert active_cert is not None
    cert_id = active_cert.id
    serial = active_cert.serial_number

    mock_revoke_data = {
        "serial_number": serial,
        "status": "REVOKED",
        "revocation_reason": "keyCompromise",
        "certificate_path": active_cert.certificate_path,
        "crl_pem_path": "/path/intermediate-ca.crl",
        "crl_der_path": "/path/intermediate-ca.crl.der"
    }

    with patch("app.services.pki.pki_api_client.revoke_certificate", return_value=mock_revoke_data) as mock_pki:
        res = client.post(
            f"/api/v1/certificates/{cert_id}/revoke",
            json={"reason": "keyCompromise", "admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "REVOKED"
        assert data["revocation_reason"] == "keyCompromise"
        assert data["revoked_at"] is not None
        mock_pki.assert_called_once()

    # Database state verification
    db_session.refresh(active_cert)
    assert active_cert.status == "REVOKED"
    assert active_cert.revoked_at is not None
    assert active_cert.revocation_reason == "keyCompromise"

    # Audit log verification
    audit_logs = db_session.query(AuditLog).filter(
        AuditLog.action == "CERTIFICATE_REVOKED",
        AuditLog.target_id == user.id
    ).all()
    assert len(audit_logs) >= 1
    assert audit_logs[-1].status == "SUCCESS"

    # Attempting to revoke already revoked cert should fail with 400
    res_again = client.post(
        f"/api/v1/certificates/{cert_id}/revoke",
        json={"reason": "keyCompromise", "admin_password": "Password123!"},
        headers=auth_headers["admin"]
    )
    assert res_again.status_code == 400
    err_body = res_again.json().get("error") or res_again.json().get("detail")
    assert err_body["code"] == "ALREADY_REVOKED"


def test_verify_certificate_endpoint(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    user = seed_users["user"]
    cert = db_session.query(Certificate).filter(Certificate.user_id == user.id).first()
    assert cert is not None

    with patch("app.services.pki.pki_api_client.verify_certificate", return_value={"status": cert.status, "message": "OK"}):
        res = client.get(f"/api/v1/certificates/{cert.id}/verify")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["serial_number"] == cert.serial_number
        assert "is_valid" in data
        assert "crl_check" in data


def test_crl_distribution_endpoint(client: TestClient):
    with patch("app.services.pki.pki_api_client.get_crl", return_value=b"DUMMY_CRL_DER"):
        res = client.get("/api/v1/certificates/crl")
        assert res.status_code == 200
        assert res.content == b"DUMMY_CRL_DER"
        assert res.headers["content-type"] == "application/pkix-crl"

    with patch("app.services.pki.pki_api_client.get_crl", return_value=b"-----BEGIN X509 CRL-----"):
        res_pem = client.get("/api/v1/certificates/crl.pem")
        assert res_pem.status_code == 200
        assert b"BEGIN X509 CRL" in res_pem.content
        assert res_pem.headers["content-type"] == "application/x-pem-file"


def test_user_revoke_certificate_endpoint(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    user = seed_users["user"]
    # Create or use cert
    cert = db_session.query(Certificate).filter(Certificate.user_id == user.id).first()
    assert cert is not None

    # Reset to ACTIVE for test
    cert.status = "ACTIVE"
    cert.revoked_at = None
    cert.revocation_reason = None
    db_session.commit()

    mock_revoke = {
        "serial_number": cert.serial_number,
        "status": "REVOKED",
        "revocation_reason": "cessationOfOperation"
    }

    # Test without admin password should fail
    res_no_pass = client.post(
        f"/api/v1/users/{user.id}/certificates/{cert.id}/revoke",
        json={"reason": "cessationOfOperation", "admin_password": ""},
        headers=auth_headers["admin"]
    )
    assert res_no_pass.status_code == 400
    err_body = res_no_pass.json().get("error") or res_no_pass.json().get("detail")
    assert err_body["code"] in ["ADMIN_PASSWORD_REQUIRED", "INVALID_INPUT"]

    with patch("app.services.pki.pki_api_client.revoke_certificate", return_value=mock_revoke):
        res = client.post(
            f"/api/v1/users/{user.id}/certificates/{cert.id}/revoke",
            json={"reason": "cessationOfOperation", "admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "REVOKED"

    db_session.refresh(cert)
    assert cert.status == "REVOKED"
    assert cert.revocation_reason == "cessationOfOperation"

