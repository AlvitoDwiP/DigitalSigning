from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog


def test_delete_user_certificate_updates_status_and_logs(client: TestClient, db_session: Session, auth_headers: dict, seed_users: dict):
    user = seed_users["user"]
    active_cert = db_session.query(Certificate).filter(
        Certificate.user_id == user.id,
        Certificate.status == "ACTIVE"
    ).first()
    assert active_cert is not None
    cert_id = active_cert.id

    with patch("app.services.pki_api_client.delete_user_materials") as mock_pki_del, \
         patch("app.api.endpoints.users.cleanup_local_pki_materials") as mock_cleanup:
        res = client.delete(f"/api/v1/users/{user.id}/certificates/{cert_id}", headers=auth_headers["admin"])
        assert res.status_code == 200
        assert res.json()["success"] is True

    # Check in DB: cert still exists and status is DELETED
    db_session.refresh(active_cert)
    assert active_cert.status == "DELETED"

    # Check GET /users/{user_id}: active_certificate is None, but certificate_history has the deleted cert
    detail_res = client.get(f"/api/v1/users/{user.id}", headers=auth_headers["admin"])
    assert detail_res.status_code == 200
    data = detail_res.json()["data"]
    assert data["active_certificate"] is None
    history_statuses = [c["status"] for c in data["certificate_history"]]
    assert "DELETED" in history_statuses

    # Check AuditLog: CERTIFICATE_DELETED is logged
    audit_logs = db_session.query(AuditLog).filter(
        AuditLog.action == "CERTIFICATE_DELETED",
        AuditLog.target_id.in_([user.id, cert_id])
    ).all()
    assert len(audit_logs) >= 1
