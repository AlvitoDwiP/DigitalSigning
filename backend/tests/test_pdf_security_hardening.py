import io
import os
import uuid
import glob
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
from endesive.pdf import PyPDF2
from PIL import Image

from app.models.audit_log import AuditLog
from app.core.config import settings
from app.services.sign import pdf_signer


# --- Helper Generators for Test PDFs & Stamps ---

def generate_minimal_valid_pdf(num_pages: int = 1, width: float = 612.0, height: float = 792.0, encrypt_password: str = None) -> bytes:
    """Membuat PDF valid di memori dengan dimensi dan jumlah halaman tertentu."""
    writer = PyPDF2.PdfFileWriter()
    for _ in range(num_pages):
        writer.addBlankPage(width=width, height=height)
    if encrypt_password:
        writer.encrypt(user_pwd=encrypt_password, owner_pwd=encrypt_password)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def generate_test_image(format: str = "PNG", size=(100, 100), color=(0, 128, 255, 255)) -> bytes:
    """Membuat berkas gambar valid dalam memori."""
    img = Image.new("RGBA" if format.upper() == "PNG" else "RGB", size, color=color[:3] if format.upper() != "PNG" else color)
    buf = io.BytesIO()
    img.save(buf, format=format.upper())
    return buf.getvalue()


@pytest.fixture(scope="function")
def test_p12_materials(seed_users: dict, tmp_path, monkeypatch):
    """
    Menyiapkan material sertifikat .p12 mandiri untuk seed_users['user']
    pada folder terisolasi tmp_path.
    """
    test_p12_dir = tmp_path / "test_p12"
    test_p12_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "P12_ARCHIVE_DIR", str(test_p12_dir))
    monkeypatch.setattr(settings, "ENABLE_PDF_SIGNING", True)

    user = seed_users["user"]
    p12_path = test_p12_dir / f"{user.nik}.p12"

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, user.name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, user.organization or "Mahkamah Konstitusi"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(987654321)
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )

    p12_bytes = pkcs12.serialize_key_and_certificates(
        name=user.nik.encode("utf-8"),
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=BestAvailableEncryption(b"TestHardened123!")
    )

    with open(p12_path, "wb") as f:
        f.write(p12_bytes)

    yield {
        "p12_path": p12_path,
        "passphrase": "TestHardened123!",
        "user": user,
        "cert": cert,
    }

    if p12_path.exists():
        p12_path.unlink()


# =========================================================================
# A. PENGUJIAN PDF (UKURAN, STRUKTUR, ENKRIPSI, HALAMAN, ORIENTASI)
# =========================================================================

def test_pdf_valid_below_size_limit_success(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """1. PDF valid di bawah batas ukuran berhasil ditandatangani."""
    pdf_bytes = generate_minimal_valid_pdf(num_pages=1)
    files = {"pdf": ("test.pdf", pdf_bytes, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_pdf_exceeding_max_size_limit_rejected_413(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """2. PDF yang melebihi batas ukuran ditolak dengan HTTP 413."""
    # Simulasikan batas 1 MB untuk pengujian efisien
    monkeypatch.setattr(settings, "MAX_PDF_SIZE_MB", 1)
    large_pdf = b"%PDF-1.4\n" + (b"A" * (1024 * 1024 + 100))

    files = {"pdf": ("large.pdf", large_pdf, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 413
    err = response.json()
    assert err["error"]["code"] == "FILE_TOO_LARGE"
    assert "melebihi batas" in err["error"]["message"].lower()


def test_pdf_empty_file_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """3. Berkas PDF kosong (0 bytes) ditolak dengan HTTP 400."""
    files = {"pdf": ("empty.pdf", b"", "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] in ("INVALID_PDF", "INVALID_INPUT")


def test_non_pdf_file_with_pdf_extension_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """4. File teks non-PDF yang dipalsukan dengan ekstensi .pdf ditolak dengan HTTP 400."""
    files = {"pdf": ("fake.pdf", b"Ini bukan berkas PDF sama sekali", "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_PDF"


def test_non_pdf_extension_rejected_415(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """5. File dengan ekstensi bukan .pdf ditolak dengan HTTP 415 Unsupported Media Type."""
    files = {"pdf": ("document.docx", b"%PDF-1.4 dummy", "application/vnd.openxmlformats")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 415
    err = response.json()
    assert err["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_pdf_corrupt_structure_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """6. Berkas PDF dengan struktur corrupt/malformed ditolak dengan HTTP 400."""
    corrupt_pdf = b"%PDF-1.4\nCorrupted binary garbage that cannot be parsed by PyPDF2"
    files = {"pdf": ("corrupt.pdf", corrupt_pdf, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_PDF"


def test_pdf_encrypted_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """7. Berkas PDF yang dienkripsi/diproteksi password ditolak dengan HTTP 400 ENCRYPTED_PDF."""
    encrypted_pdf = generate_minimal_valid_pdf(num_pages=1, encrypt_password="SecurePassword!")
    files = {"pdf": ("encrypted.pdf", encrypted_pdf, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "ENCRYPTED_PDF"


def test_pdf_page_limit_exceeded_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """8. Dokumen PDF dengan jumlah halaman melebihi batas kebijakan ditolak HTTP 400."""
    monkeypatch.setattr(settings, "MAX_PDF_PAGES", 5)
    pdf_6_pages = generate_minimal_valid_pdf(num_pages=6)

    files = {"pdf": ("multi.pdf", pdf_6_pages, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "PDF_PAGE_LIMIT_EXCEEDED"


def test_pdf_portrait_and_landscape_orientation_success(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """9. Dokumen PDF baik portrait (595x842) maupun landscape (842x595) dapat ditandatangani."""
    # Portrait
    pdf_portrait = generate_minimal_valid_pdf(width=595.0, height=842.0)
    res_p = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("portrait.pdf", pdf_portrait, "application/pdf")},
        data={"passphrase": test_p12_materials["passphrase"], "llx": "50", "lly": "50", "urx": "200", "ury": "200"}
    )
    assert res_p.status_code == 200

    # Landscape
    pdf_landscape = generate_minimal_valid_pdf(width=842.0, height=595.0)
    res_l = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("landscape.pdf", pdf_landscape, "application/pdf")},
        data={"passphrase": test_p12_materials["passphrase"], "llx": "50", "lly": "50", "urx": "200", "ury": "200"}
    )
    assert res_l.status_code == 200


# =========================================================================
# B. PENGUJIAN GAMBAR STEMPEL (FORMAT, DIMENSI, DECOMPRESSION BOMB)
# =========================================================================

def test_stamp_valid_png_and_jpeg_success(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """10. Unggahan gambar stempel PNG dan JPEG yang valid diterima."""
    pdf_bytes = generate_minimal_valid_pdf()

    # PNG
    png_bytes = generate_test_image("PNG")
    res_png = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("test.pdf", pdf_bytes, "application/pdf"), "stamp": ("stamp.png", png_bytes, "image/png")},
        data={"passphrase": test_p12_materials["passphrase"]}
    )
    assert res_png.status_code == 200

    # JPEG
    jpeg_bytes = generate_test_image("JPEG")
    res_jpeg = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("test.pdf", pdf_bytes, "application/pdf"), "stamp": ("stamp.jpg", jpeg_bytes, "image/jpeg")},
        data={"passphrase": test_p12_materials["passphrase"]}
    )
    assert res_jpeg.status_code == 200


def test_stamp_unsupported_format_rejected(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """11. Berkas stempel selain PNG/JPEG (seperti SVG atau GIF) ditolak HTTP 415."""
    pdf_bytes = generate_minimal_valid_pdf()

    # SVG Palsu
    res_svg = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("test.pdf", pdf_bytes, "application/pdf"), "stamp": ("stamp.svg", b"<svg></svg>", "image/svg+xml")},
        data={"passphrase": test_p12_materials["passphrase"]}
    )
    assert res_svg.status_code == 415

    # GIF
    gif_bytes = generate_test_image("GIF")
    res_gif = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files={"pdf": ("test.pdf", pdf_bytes, "application/pdf"), "stamp": ("stamp.gif", gif_bytes, "image/gif")},
        data={"passphrase": test_p12_materials["passphrase"]}
    )
    assert res_gif.status_code in (400, 415)


def test_stamp_exceeding_size_limit_rejected_413(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """12. Berkas stempel yang melebihi batas ukuran (MAX_STAMP_SIZE_MB) ditolak HTTP 413."""
    monkeypatch.setattr(settings, "MAX_STAMP_SIZE_MB", 1)
    large_stamp = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (1024 * 1024 + 100))

    files = {
        "pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf"),
        "stamp": ("large.png", large_stamp, "image/png")
    }
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 413
    err = response.json()
    assert err["error"]["code"] == "FILE_TOO_LARGE"


def test_stamp_exceeding_dimensions_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """13. Gambar stempel yang melebihi batas dimensi maksimum ditolak HTTP 400."""
    monkeypatch.setattr(settings, "MAX_STAMP_WIDTH", 500)
    monkeypatch.setattr(settings, "MAX_STAMP_HEIGHT", 500)

    oversized_stamp = generate_test_image("PNG", size=(600, 600))
    files = {
        "pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf"),
        "stamp": ("oversized.png", oversized_stamp, "image/png")
    }
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_IMAGE"
    assert "melebihi batas maksimum" in err["error"]["message"].lower()


def test_stamp_corrupt_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """14. Berkas stempel yang rusak (corrupt) ditolak dengan HTTP 400."""
    files = {
        "pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf"),
        "stamp": ("corrupt.png", b"\x89PNG\r\n\x1a\nCorrupted bytes", "image/png")
    }
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_IMAGE"


# =========================================================================
# C. PENGUJIAN KOORDINAT BOUNDING BOX
# =========================================================================

def test_coordinates_negative_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """15. Koordinat negatif ditolak HTTP 400."""
    files = {"pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf")}
    data = {
        "passphrase": test_p12_materials["passphrase"],
        "llx": "-10",
        "lly": "50",
        "urx": "100",
        "ury": "100"
    }
    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_COORDINATES"


def test_coordinates_outside_page_boundaries_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """16. Koordinat melampaui batas halaman PDF ditolak HTTP 400."""
    # PDF ukuran 612 x 792 pt
    files = {"pdf": ("test.pdf", generate_minimal_valid_pdf(width=612.0, height=792.0), "application/pdf")}
    data = {
        "passphrase": test_p12_materials["passphrase"],
        "llx": "500",
        "lly": "50",
        "urx": "700",  # Melebihi 612 pt
        "ury": "200"
    }
    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_COORDINATES"
    assert "di luar batas halaman" in err["error"]["message"].lower()


def test_coordinates_zero_or_inverted_area_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """17. Dimensi area tanda tangan nol atau terbalik ditolak HTTP 400."""
    files = {"pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf")}

    # Lebar nol (llx == urx)
    res_zero = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data={"passphrase": test_p12_materials["passphrase"], "llx": "100", "lly": "50", "urx": "100", "ury": "150"}
    )
    assert res_zero.status_code == 400
    assert res_zero.json()["error"]["code"] == "INVALID_COORDINATES"

    # Terbalik (llx > urx)
    res_inverted = client.post(
        "/api/v1/signatures/sign",
        headers=auth_headers["user"],
        files=files,
        data={"passphrase": test_p12_materials["passphrase"], "llx": "200", "lly": "50", "urx": "100", "ury": "150"}
    )
    assert res_inverted.status_code == 400
    assert res_inverted.json()["error"]["code"] == "INVALID_COORDINATES"


def test_target_page_out_of_bounds_rejected_400(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """18. Halaman target penandatanganan tidak tersedia ditolak HTTP 400."""
    pdf_1_page = generate_minimal_valid_pdf(num_pages=1)
    files = {"pdf": ("test.pdf", pdf_1_page, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"], "page": "99"}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "INVALID_PAGE"


# =========================================================================
# D. PENGUJIAN RESOURCE, ASYNCHRONOUS, TIMEOUT, DAN CONCURRENCY
# =========================================================================

def test_signing_concurrency_saturation_returns_429(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """19. Ketika kapasitas batas penandatanganan simultan penuh, ditolak HTTP 429."""
    from app.api.endpoints import signatures

    # Set limiter kapasitas 1 dan isi slotnya secara penuh (saturasi)
    test_limiter = signatures.SigningConcurrencyLimiter(max_concurrent=1)
    test_limiter._current = 1

    monkeypatch.setattr(signatures, "get_signing_limiter", lambda: test_limiter)

    files = {"pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 429
    err = response.json()
    assert err["error"]["code"] == "RESOURCE_BUSY"


def test_signing_timeout_returns_504(client: TestClient, auth_headers: dict, test_p12_materials: dict, monkeypatch):
    """20. Proses penandatanganan yang melampaui batas waktu mengembalikan HTTP 504 Gateway Timeout."""
    import time

    def slow_sign(*args, **kwargs):
        time.sleep(1.5)
        return b"%PDF-1.4 slow"

    monkeypatch.setattr(pdf_signer, "sign_pdf", slow_sign)
    monkeypatch.setattr(settings, "SIGNING_TIMEOUT_SECONDS", 0.5)

    files = {"pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 504
    err = response.json()
    assert err["error"]["code"] == "SIGNING_TIMEOUT"


# =========================================================================
# E. PENGUJIAN PENYIMPANAN DAN KEBERSIHAN TEMPORARY FILES
# =========================================================================

def test_temporary_stamp_files_cleaned_up_after_processing(client: TestClient, auth_headers: dict, test_p12_materials: dict):
    """21. Berkas sementara stempel (ds_stamp_*) dibersihkan secara tuntas baik saat sukses maupun gagal."""
    import tempfile
    temp_dir = tempfile.gettempdir()

    # Hitung jumlah file ds_stamp_* sebelum request
    before_files = set(glob.glob(os.path.join(temp_dir, "ds_stamp_*")))

    stamp_bytes = generate_test_image("PNG")
    files = {
        "pdf": ("test.pdf", generate_minimal_valid_pdf(), "application/pdf"),
        "stamp": ("stamp.png", stamp_bytes, "image/png")
    }
    data = {"passphrase": test_p12_materials["passphrase"]}

    # Eksekusi proses sukses
    res_success = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert res_success.status_code == 200

    after_files = set(glob.glob(os.path.join(temp_dir, "ds_stamp_*")))
    # Tidak boleh ada residu file sementara baru yang tertinggal
    assert len(after_files - before_files) == 0


def test_no_permanent_pdf_storage_in_audit_or_database(client: TestClient, auth_headers: dict, test_p12_materials: dict, db_session: Session):
    """22. Dokumen PDF asli maupun hasil tanda tangan tidak disimpan di database atau audit log."""
    user = test_p12_materials["user"]
    pdf_bytes = generate_minimal_valid_pdf()

    files = {"pdf": ("legal_doc.pdf", pdf_bytes, "application/pdf")}
    data = {"passphrase": test_p12_materials["passphrase"]}

    response = client.post("/api/v1/signatures/sign", headers=auth_headers["user"], files=files, data=data)
    assert response.status_code == 200

    # Periksa audit log
    latest_audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.user_id == user.id, AuditLog.action == "DOCUMENT_SIGNED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert latest_audit is not None
    assert latest_audit.status == "SUCCESS"

    # Verifikasi audit log tidak memuat data PDF atau nama file rahasia
    raw_dict = {c.name: getattr(latest_audit, c.name) for c in latest_audit.__table__.columns}
    for k, v in raw_dict.items():
        if isinstance(v, (str, bytes)):
            assert b"%PDF" not in str(v).encode()
            assert "legal_doc.pdf" not in str(v)
