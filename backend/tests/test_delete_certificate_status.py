from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog


def test_delete_user_certificate_is_deprecated_and_rejected(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    user = seed_users["user"]
    active_cert = db_session.query(Certificate).filter(
        Certificate.user_id == user.id,
        Certificate.status == "ACTIVE"
    ).first()
    assert active_cert is not None
    cert_id = active_cert.id

    # 1. DELETE endpoint should reject with DEPRECATED_OPERATION
    res = client.delete(f"/api/v1/users/{user.id}/certificates/{cert_id}", headers=auth_headers["admin"])
    assert res.status_code == 400
    assert res.json().get("error", {}).get("code") == "DEPRECATED_OPERATION" or res.json().get("detail", {}).get("code") == "DEPRECATED_OPERATION"

    # 2. Revoke endpoint should be used instead
    mock_revoke = {
        "serial_number": active_cert.serial_number,
        "status": "REVOKED",
        "revocation_reason": "keyCompromise"
    }
    with patch("app.services.pki.pki_api_client.revoke_certificate", return_value=mock_revoke):
        revoke_res = client.post(
            f"/api/v1/users/{user.id}/certificates/{cert_id}/revoke",
            json={"reason": "keyCompromise", "admin_password": "Password123!"},
            headers=auth_headers["admin"]
        )
        assert revoke_res.status_code == 200
        assert revoke_res.json()["data"]["status"] == "REVOKED"

    # 3. Check in DB: cert still exists and status is REVOKED (retains history & audit trail)
    db_session.refresh(active_cert)
    assert active_cert.status == "REVOKED"
    assert active_cert.revocation_reason == "keyCompromise"
    assert active_cert.revoked_at is not None

    # Check GET /users/{user_id}: active_certificate is None, but certificate_history has the revoked cert
    detail_res = client.get(f"/api/v1/users/{user.id}", headers=auth_headers["admin"])
    assert detail_res.status_code == 200
    data = detail_res.json()["data"]
    assert data["active_certificate"] is None
    history_statuses = [c["status"] for c in data["certificate_history"]]
    assert "REVOKED" in history_statuses

    # Check AuditLog: CERTIFICATE_REVOKED is logged
    audit_logs = db_session.query(AuditLog).filter(
        AuditLog.action == "CERTIFICATE_REVOKED",
        AuditLog.target_id == user.id
    ).all()
    assert len(audit_logs) >= 1
