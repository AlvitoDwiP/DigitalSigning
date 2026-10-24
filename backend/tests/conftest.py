import pytest
import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.api import deps


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[deps.get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_users(db_session: Session):
    # Pure numeric suffix for NIK format (16 digits)
    num_suffix = f"{random.randint(100000, 999999):06d}"
    str_suffix = uuid.uuid4().hex[:6]

    super_admin = User(
        id=uuid.uuid4(),
        name=f"Super Admin {str_suffix}",
        nik=f"1111222233{num_suffix}",
        email=f"superadmin_{str_suffix}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="IT",
        password_hash=get_password_hash("Password123!"),
        role="SUPER_ADMIN",
        status="ACTIVE"
    )
    admin_user = User(
        id=uuid.uuid4(),
        name=f"Admin User {str_suffix}",
        nik=f"2222333344{num_suffix}",
        email=f"admin_{str_suffix}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="TTE",
        password_hash=get_password_hash("Password123!"),
        role="ADMIN",
        status="ACTIVE"
    )
    regular_user = User(
        id=uuid.uuid4(),
        name=f"Regular User {str_suffix}",
        nik=f"3333444455{num_suffix}",
        email=f"user_{str_suffix}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="Kepaniteraan",
        password_hash=get_password_hash("Password123!"),
        role="USER",
        status="ACTIVE"
    )
    inactive_user = User(
        id=uuid.uuid4(),
        name=f"Inactive User {str_suffix}",
        nik=f"4444555566{num_suffix}",
        email=f"inactive_{str_suffix}@mkri.go.id",
        organization="Mahkamah Konstitusi",
        ou="Umum",
        password_hash=get_password_hash("Password123!"),
        role="USER",
        status="INACTIVE"
    )

    db_session.add_all([super_admin, admin_user, regular_user, inactive_user])
    db_session.commit()

    # Certificates
    now = datetime.now(timezone.utc)
    user_issued_year = (now - timedelta(days=700)).year
    seq_base = int(num_suffix) * 10
    cert_admin = Certificate(
        id=uuid.uuid4(),
        user_id=admin_user.id,
        serial_number=f"SER-ADM-{str_suffix}",
        certificate_number=f"DS-{now.year}-ADM{str_suffix[:4].upper()}-{seq_base + 1:04d}",
        sequence_number=seq_base + 1,
        issued_year=now.year,
        subject=f"CN={admin_user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FINGERPRINTADMIN{str_suffix}0000000000000000000000000000000000000000"[:64],
        certificate_path="/path/admin.crt",
        p12_reference="/path/admin.p12",
        issued_at=now - timedelta(days=100),
        expires_at=now + timedelta(days=630),
        status="ACTIVE"
    )

    cert_user = Certificate(
        id=uuid.uuid4(),
        user_id=regular_user.id,
        serial_number=f"SER-USR-{str_suffix}",
        certificate_number=f"DS-{user_issued_year}-USR{str_suffix[:4].upper()}-{seq_base + 2:04d}",
        sequence_number=seq_base + 2,
        issued_year=user_issued_year,
        subject=f"CN={regular_user.name}",
        issuer="Intermediate CA",
        fingerprint_sha256=f"FINGERPRINTUSER{str_suffix}0000000000000000000000000000000000000000"[:64],
        certificate_path="/path/user.crt",
        p12_reference="/path/user.p12",
        issued_at=now - timedelta(days=700),
        expires_at=now + timedelta(days=30),  # Expiring soon (30 days)
        status="ACTIVE"
    )

    db_session.add_all([cert_admin, cert_user])
    db_session.commit()

    created_user_ids = [super_admin.id, admin_user.id, regular_user.id, inactive_user.id]

    yield {
        "super_admin": super_admin,
        "admin": admin_user,
        "user": regular_user,
        "inactive": inactive_user,
        "cert_admin": cert_admin,
        "cert_user": cert_user,
    }

    # Cleanup created users
    cleanup_session = SessionLocal()
    try:
        cleanup_session.query(Certificate).filter(Certificate.user_id.in_(created_user_ids)).delete(synchronize_session=False)
        cleanup_session.query(AuditLog).filter(AuditLog.target_id.in_(created_user_ids)).delete(synchronize_session=False)
        cleanup_session.query(User).filter(User.id.in_(created_user_ids)).delete(synchronize_session=False)
        cleanup_session.commit()
    except Exception:
        cleanup_session.rollback()
    finally:
        cleanup_session.close()


@pytest.fixture
def auth_headers(seed_users):
    super_admin_token = create_access_token(subject=str(seed_users["super_admin"].id))
    admin_token = create_access_token(subject=str(seed_users["admin"].id))
    user_token = create_access_token(subject=str(seed_users["user"].id))

    return {
        "super_admin": {"Authorization": f"Bearer {super_admin_token}"},
        "admin": {"Authorization": f"Bearer {admin_token}"},
        "user": {"Authorization": f"Bearer {user_token}"},
    }
