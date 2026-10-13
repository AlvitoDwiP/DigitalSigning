import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.core.config import Settings


def test_auth_login_success(client: TestClient, db_session: Session, seed_users: dict):
    response = client.post("/api/v1/auth/login", json={
        "email": seed_users["admin"].email,
        "password": "Password123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert data["data"]["user"]["email"] == seed_users["admin"].email
    assert "password_hash" not in data["data"]["user"]

    # Verifikasi audit log tercatat
    audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.user_id == seed_users["admin"].id, AuditLog.action == "LOGIN")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert audit.status == "SUCCESS"
    assert audit.target_type == "user"
    assert audit.target_id == seed_users["admin"].id


def test_auth_login_invalid_password(client: TestClient, seed_users: dict):
    response = client.post("/api/v1/auth/login", json={
        "email": seed_users["admin"].email,
        "password": "WrongPassword!"
    })
    assert response.status_code in [400, 401]


def test_auth_invalid_token_returns_401(client: TestClient):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.expired.token"}
    )
    assert response.status_code == 401
    assert "WWW-Authenticate" in response.headers


def test_production_config_rejects_default_secrets():
    # Production mode harus menolak default/insecure SECRET_KEY
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="dev-secret-key-digital-signature-platform-2026",
            PKI_SERVICE_TOKEN="strong-random-pki-service-token-production-32bytes",
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        )

    # Production mode harus menolak default/insecure PKI_SERVICE_TOKEN
    with pytest.raises(ValueError, match="PKI_SERVICE_TOKEN"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="strong-random-secret-key-production-32bytes-long",
            PKI_SERVICE_TOKEN="dev-pki-service-token-2026",
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        )


def test_auth_me(client: TestClient, auth_headers: dict, seed_users: dict):
    response = client.get("/api/v1/auth/me", headers=auth_headers["user"])
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == seed_users["user"].email
    assert data["data"]["role"] == "USER"


def test_auth_logout(client: TestClient, auth_headers: dict):
    response = client.post("/api/v1/auth/logout", headers=auth_headers["user"])
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_dashboard_admin_and_user(client: TestClient, auth_headers: dict):
    # Admin dashboard
    res_admin = client.get("/api/v1/dashboard", headers=auth_headers["admin"])
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["success"] is True
    assert "statistics" in data_admin["data"]
    assert "expiry_buckets" in data_admin["data"]

    # User dashboard
    res_user = client.get("/api/v1/dashboard", headers=auth_headers["user"])
    assert res_user.status_code == 200
    data_user = res_user.json()
    assert data_user["success"] is True
    assert "active_certificate" in data_user["data"]
    assert "user" in data_user["data"]
    # User must not receive system statistics
    assert "statistics" not in data_user["data"]


def test_signing_endpoint_reserved_501(client: TestClient, auth_headers: dict):
    response = client.post("/api/v1/signatures", headers=auth_headers["user"])
    assert response.status_code in [404, 501]

