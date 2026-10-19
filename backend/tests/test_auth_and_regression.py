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

    # Verifikasi audit log TIDAK mencatat aktivitas login/autentikasi
    audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.user_id == seed_users["admin"].id, AuditLog.action == "LOGIN")
        .first()
    )
    assert audit is None


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
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        )

    # Production mode menerima SECRET_KEY yang kuat tanpa memerlukan legacy PKI_SERVICE_TOKEN
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="strong-random-secret-key-production-32bytes-long",
        DATABASE_URL="postgresql://user:pass@localhost:5432/db",
    )
    assert prod_settings.SECRET_KEY == "strong-random-secret-key-production-32bytes-long"


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


def test_audit_log_pruning_max_limit(db_session: Session):
    from app.models.audit_log import prune_audit_logs
    from datetime import datetime, timezone, timedelta
    import uuid

    # Bersihkan audit log untuk isolasi pengujian batas
    db_session.query(AuditLog).delete()
    db_session.commit()

    base_time = datetime.now(timezone.utc)

    # Buat 7 audit log dengan urutan waktu sekuensial
    created_logs = []
    for i in range(7):
        log = AuditLog(
            id=uuid.uuid4(),
            action=f"OPERATIONAL_ACTION_{i}",
            target_type="user",
            status="SUCCESS",
            created_at=base_time + timedelta(seconds=i),
        )
        db_session.add(log)
        created_logs.append(log)
    db_session.commit()

    # Uji pruning dengan batas kapasitas 5 log (FIFO: log ke 6 dan 7 menggantikan 2 log pertama)
    deleted = prune_audit_logs(db_session, max_logs=5)
    db_session.commit()

    # Uji pruning otomatis via before_commit event listener
    from app.core.config import settings
    original_max = settings.MAX_AUDIT_LOGS
    try:
        settings.MAX_AUDIT_LOGS = 5
        # Tambah log baru ke-8: harus otomatis menggantikan log paling bawah (OPERATIONAL_ACTION_2)
        new_log = AuditLog(
            id=uuid.uuid4(),
            action="OPERATIONAL_ACTION_7",
            target_type="user",
            status="SUCCESS",
            created_at=base_time + timedelta(seconds=7),
        )
        db_session.add(new_log)
        db_session.commit()

        auto_remaining = (
            db_session.query(AuditLog)
            .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
            .all()
        )
        assert len(auto_remaining) == 5
        auto_actions = [l.action for l in auto_remaining]
        assert "OPERATIONAL_ACTION_2" not in auto_actions
        assert auto_actions == [
            "OPERATIONAL_ACTION_3",
            "OPERATIONAL_ACTION_4",
            "OPERATIONAL_ACTION_5",
            "OPERATIONAL_ACTION_6",
            "OPERATIONAL_ACTION_7",
        ]
    finally:
        settings.MAX_AUDIT_LOGS = original_max

