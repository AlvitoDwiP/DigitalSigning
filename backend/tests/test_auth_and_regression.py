import pytest
from fastapi.testclient import TestClient


def test_auth_login_success(client: TestClient, seed_users: dict):
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


def test_auth_login_invalid_password(client: TestClient, seed_users: dict):
    response = client.post("/api/v1/auth/login", json={
        "email": seed_users["admin"].email,
        "password": "WrongPassword!"
    })
    assert response.status_code in [400, 401]


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
