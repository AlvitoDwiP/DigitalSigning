import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def test_get_admins_as_super_admin(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/admins", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "items" in data["data"]
    admin_emails = [item["email"] for item in data["data"]["items"]]
    assert seed_users["admin"].email in admin_emails
    assert seed_users["super_admin"].email not in admin_emails
    assert seed_users["user"].email not in admin_emails


def test_get_admins_forbidden_for_admin_and_user(client: TestClient, auth_headers: dict):
    res_admin = client.get("/api/v1/admins", headers=auth_headers["admin"])
    assert res_admin.status_code == 403

    res_user = client.get("/api/v1/admins", headers=auth_headers["user"])
    assert res_user.status_code == 403


def test_get_admin_candidates(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/admins/candidates", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    candidate_emails = [item["email"] for item in data["data"]["items"]]
    assert seed_users["user"].email in candidate_emails
    assert seed_users["admin"].email not in candidate_emails
    assert seed_users["super_admin"].email not in candidate_emails


def test_assign_admin_success(client: TestClient, auth_headers: dict, seed_users: dict, db_session: Session):
    user_to_promote = seed_users["user"]
    response = client.post(f"/api/v1/admins/{user_to_promote.id}", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["role"] == "ADMIN"

    # Verify audit log in database
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "ADMIN_ASSIGNED",
        AuditLog.target_id == user_to_promote.id
    ).first()
    assert audit is not None
    assert audit.status == "SUCCESS"
    assert audit.user_id == seed_users["super_admin"].id


def test_assign_admin_already_admin(client: TestClient, auth_headers: dict, seed_users: dict):
    already_admin = seed_users["admin"]
    response = client.post(f"/api/v1/admins/{already_admin.id}", headers=auth_headers["super_admin"])
    assert response.status_code == 400
    data = response.json()
    code = data.get("error", {}).get("code") or data.get("detail", {}).get("code")
    assert code == "ALREADY_ADMIN"


def test_assign_admin_not_found(client: TestClient, auth_headers: dict):
    fake_id = uuid.uuid4()
    response = client.post(f"/api/v1/admins/{fake_id}", headers=auth_headers["super_admin"])
    assert response.status_code == 404


def test_remove_admin_success(client: TestClient, auth_headers: dict, seed_users: dict, db_session: Session):
    admin_to_demote = seed_users["admin"]
    response = client.delete(f"/api/v1/admins/{admin_to_demote.id}", headers=auth_headers["super_admin"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["role"] == "USER"

    # Verify audit log in database
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "ADMIN_REMOVED",
        AuditLog.target_id == admin_to_demote.id
    ).first()
    assert audit is not None
    assert audit.status == "SUCCESS"
    assert audit.user_id == seed_users["super_admin"].id


def test_remove_admin_not_an_admin(client: TestClient, auth_headers: dict, seed_users: dict):
    not_admin = seed_users["user"]
    response = client.delete(f"/api/v1/admins/{not_admin.id}", headers=auth_headers["super_admin"])
    assert response.status_code == 400
    data = response.json()
    code = data.get("error", {}).get("code") or data.get("detail", {}).get("code")
    assert code == "NOT_AN_ADMIN"


def test_remove_admin_not_found(client: TestClient, auth_headers: dict):
    fake_id = uuid.uuid4()
    response = client.delete(f"/api/v1/admins/{fake_id}", headers=auth_headers["super_admin"])
    assert response.status_code == 404
