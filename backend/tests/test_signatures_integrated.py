import io
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12, BestAvailableEncryption
from PIL import Image

from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.core.config import settings


# PDF minimal yang valid secara sintaksis untuk pengujian
VALID_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
)


@pytest.fixture(scope="function")
def test_p12_materials(seed_users: dict):
    """
    Membuat file .p12 mandiri untuk seed_users['user'] di folder P12_ARCHIVE_DIR.
    Dibersihkan secara otomatis setelah tes selesai tanpa menyentuh CA aktif.
    """
    from app.services.pdf_signer import get_p12_archive_dir
    user = seed_users["user"]
    p12_dir = get_p12_archive_dir()
    p12_dir.mkdir(parents=True, exist_ok=True)
    p12_path = p12_dir / f"{user.nik}.p12"

    # Buat RSA private key
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Buat sertifikat X.509 uji
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, user.name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, user.organization or "Mahkamah Konstitusi"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(123456789)
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )

    # Serialisasi ke PKCS#12
    p12_bytes = pkcs12.serialize_key_and_certificates(
        name=user.nik.encode("utf-8"),
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=BestAvailableEncryption(b"CorrectPass123!")
    )

    with open(p12_path, "wb") as f:
        f.write(p12_bytes)

    yield {
        "p12_path": p12_path,
        "passphrase": "CorrectPass123!",
        "user": user,
        "cert": cert,
    }

    if p12_path.exists():
        p12_path.unlink()


def create_test_stamp_png() -> bytes:
    img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_user_can_sign_pdf_successfully(
    client: TestClient,
    auth_headers: dict,
    test_p12_materials: dict,
    db_session: Session
):
    """
    Role USER menandatangani dokumen PDF miliknya sendiri dengan passphrase benar.
    """
    user = test_p12_materials["user"]
    stamp_bytes = create_test_stamp_png()

    files = {
        "pdf": ("document.pdf", VALID_PDF, "application/pdf"),
        "stamp": ("stamp.png", stamp_bytes, "image/png"),
    }
    data = {
        "page": "1",
        "llx": "100",
        "lly": "100",
        "urx": "200",
        "ury": "200",
        "passphrase": test_p12_materials["passphrase"],
    }

    response = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data=data
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "Content-Disposition" in response.headers
    assert "signed" in response.headers["Content-Disposition"]
    assert response.headers["X-Signer-NIK"] == user.nik

    # Verifikasi berkas hasil tanda tangan memuat marker PDF & signature CMS
    signed_bytes = response.content
    assert signed_bytes.startswith(b"%PDF")
    assert b"/ByteRange" in signed_bytes
    assert b"/Contents" in signed_bytes

    # Verifikasi kriptografis: hash digest dokumen dan validitas matematis signature RSA-SHA256
    from endesive.pdf import verify as verify_pdf_signatures
    from cryptography.hazmat.primitives import serialization
    cert_pem = test_p12_materials["cert"].public_bytes(serialization.Encoding.PEM)
    crypto_results = verify_pdf_signatures(signed_bytes, [cert_pem])
    assert len(crypto_results) > 0, "Tidak ada tanda tangan CMS/PKCS#7 yang terdeteksi pada PDF."
    for hashok, signatureok, _ in crypto_results:
        assert hashok is True, "Integritas dokumen PDF gagal: hash digest tidak cocok."
        assert signatureok is True, "Tanda tangan kriptografis tidak valid secara matematis."

    # Verifikasi audit log DOCUMENT_SIGNED tercatat dengan benar
    audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.user_id == user.id, AuditLog.action == "DOCUMENT_SIGNED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert audit.status == "SUCCESS"
    assert audit.target_id == user.id


def test_sign_pdf_wrong_passphrase_rejected(
    client: TestClient,
    auth_headers: dict,
    test_p12_materials: dict,
    db_session: Session
):
    """
    Passphrase salah harus ditolak dengan HTTP 401 dan tidak mengembalikan PDF.
    """
    user = test_p12_materials["user"]
    files = {"pdf": ("document.pdf", VALID_PDF, "application/pdf")}
    data = {"passphrase": "WrongPassword123!"}

    response = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data=data
    )

    assert response.status_code == 401
    err = response.json()
    assert err["error"]["code"] == "INVALID_PASSPHRASE"

    # Audit log mencatat FAILED
    audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.user_id == user.id, AuditLog.action == "DOCUMENT_SIGNED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit is not None
    assert audit.status == "FAILED"


def test_sign_invalid_or_non_pdf_file_rejected(
    client: TestClient,
    auth_headers: dict,
    test_p12_materials: dict
):
    """
    Berkas non-PDF harus ditolak dengan HTTP 400 atau 415.
    """
    files = {"pdf": ("test.txt", b"Bukan file pdf sama sekali", "text/plain")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data=data
    )
    assert response.status_code in [400, 415]


def test_super_admin_forbidden_from_signing(
    client: TestClient,
    auth_headers: dict,
    test_p12_materials: dict
):
    """
    SUPER_ADMIN secara eksplisit dilarang menggunakan fitur penandatanganan (HTTP 403).
    """
    files = {"pdf": ("document.pdf", VALID_PDF, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["super_admin"],
        files=files,
        data=data
    )
    assert response.status_code == 403
    err = response.json()
    assert err["error"]["code"] == "FORBIDDEN"
    assert "SUPER_ADMIN" in err["error"]["message"]


def test_user_cannot_sign_as_other_user_idor_protection(
    client: TestClient,
    auth_headers: dict,
    test_p12_materials: dict,
    seed_users: dict
):
    """
    USER A mencoba memasukkan NIK USER B di form: sistem wajib mengabaikan NIK form
    dan selalu menandatangani menggunakan sertifikat akun USER A miliknya sendiri.
    """
    user = test_p12_materials["user"]
    admin = seed_users["admin"]

    files = {"pdf": ("document.pdf", VALID_PDF, "application/pdf")}
    # Mencoba inject NIK milik Admin
    data = {
        "passphrase": test_p12_materials["passphrase"],
        "nik": admin.nik,
    }

    response = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data=data
    )

    assert response.status_code == 200
    # Header membuktikan signer NIK adalah akun user login, bukan yang disuntikkan di form
    assert response.headers["X-Signer-NIK"] == user.nik
    assert response.headers["X-Signer-NIK"] != admin.nik


def test_corrupt_p12_file_handled_gracefully(
    client: TestClient,
    auth_headers: dict,
    seed_users: dict
):
    """
    Jika file P12 corrupt atau kosong, ditangani dengan aman tanpa crash 500 unhandled.
    """
    from app.services.pdf_signer import get_p12_archive_dir
    user = seed_users["user"]
    p12_path = get_p12_archive_dir() / f"{user.nik}.p12"
    p12_path.write_bytes(b"Bukan berkas p12 yang valid")

    try:
        files = {"pdf": ("document.pdf", VALID_PDF, "application/pdf")}
        data = {"passphrase": "SomePassword123!"}

        response = client.post(
            "/api/v1/signatures/sign",
            headers=auth_headers["user"],
            files=files,
            data=data
        )
        assert response.status_code in [400, 401]
    finally:
        if p12_path.exists():
            p12_path.unlink()
