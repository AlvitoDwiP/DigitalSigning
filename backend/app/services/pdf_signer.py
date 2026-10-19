import io
import os
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone

from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat import backends
from endesive.pdf import cms
from PIL import Image

from app.core.config import settings


class PDFSignerError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def sanitize_nik(nik: str) -> str:
    cleaned = (nik or "").strip()
    if not re.fullmatch(r"\d{16}", cleaned):
        raise PDFSignerError("INVALID_IDENTIFIER", "NIK harus berupa 16 digit angka.")
    return cleaned


def get_p12_archive_dir() -> Path:
    env_path = Path(settings.P12_ARCHIVE_DIR)
    if env_path.exists():
        return env_path.resolve()
    # Fallback saat dieksekusi di luar Docker container (host lokal)
    from app.core.config import BASE_DIR
    local_path = (BASE_DIR / "sign-api" / "p12").resolve()
    local_path.mkdir(parents=True, exist_ok=True)
    return local_path


def resolve_p12_path(nik: str) -> Path:
    safe_nik = sanitize_nik(nik)
    p12_dir = get_p12_archive_dir()
    target = (p12_dir / f"{safe_nik}.p12").resolve()

    try:
        target.relative_to(p12_dir)
    except Exception:
        raise PDFSignerError("FORBIDDEN", "Akses path sertifikat di luar direktori yang diizinkan.")

    if not target.is_file():
        raise PDFSignerError(
            "CERTIFICATE_NOT_FOUND",
            f"Berkas sertifikat digital (.p12) untuk NIK {safe_nik} tidak ditemukan."
        )
    return target


def parse_bounding_box(
    llx: Optional[float],
    lly: Optional[float],
    urx: Optional[float],
    ury: Optional[float]
) -> Tuple[float, float, float, float]:
    """
    Validasi dan normalisasi 4 koordinat PDF box:
    llx: Lower-Left X, lly: Lower-Left Y, urx: Upper-Right X, ury: Upper-Right Y.
    """
    if None in (llx, lly, urx, ury):
        # Default bounding box jika tidak ditentukan
        return (36.0, 36.0, 186.0, 186.0)

    try:
        x0 = float(llx)
        y0 = float(lly)
        x1 = float(urx)
        y1 = float(ury)
    except (ValueError, TypeError):
        raise PDFSignerError("INVALID_COORDINATES", "Koordinat stempel harus bernilai numerik.")

    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0

    if x1 <= x0 or y1 <= y0:
        raise PDFSignerError("INVALID_COORDINATES", "Dimensi stempel tidak valid (urx harus > llx dan ury harus > lly).")

    return (x0, y0, x1, y1)


def load_p12_credentials(p12_path: Path, password: Optional[str]):
    pwd = password if password is not None else ""
    if not pwd:
        raise PDFSignerError("INVALID_PASSPHRASE", "Passphrase sertifikat (.p12) wajib diisi.")

    try:
        with open(p12_path, "rb") as f:
            content = f.read()
            if not content:
                raise PDFSignerError("CORRUPT_CERTIFICATE", "Berkas .p12 kosong.")
            key, cert, othercerts = pkcs12.load_key_and_certificates(
                content,
                pwd.encode("utf-8"),
                backends.default_backend()
            )
    except ValueError:
        raise PDFSignerError(
            "INVALID_PASSPHRASE",
            "Passphrase sertifikat salah atau berkas P12 tidak dapat dibuka."
        )
    except Exception as e:
        if isinstance(e, PDFSignerError):
            raise
        raise PDFSignerError("CORRUPT_CERTIFICATE", f"Gagal memuat berkas P12: {str(e)}")

    if key is None or cert is None:
        raise PDFSignerError("CORRUPT_CERTIFICATE", "Berkas P12 tidak memuat private key atau sertifikat yang valid.")

    return key, cert, (othercerts or [])


def sign_pdf(
    pdf_bytes: bytes,
    nik: str,
    passphrase: str,
    page: int = 1,
    llx: Optional[float] = None,
    lly: Optional[float] = None,
    urx: Optional[float] = None,
    ury: Optional[float] = None,
    stamp_bytes: Optional[bytes] = None,
    stamp_filename: Optional[str] = None,
    reason: str = "Digital Signature Platform",
    location: str = "Jakarta"
) -> bytes:
    """
    Menandatangani PDF menggunakan pustaka endesive secara in-process.
    Menerapkan pembersihan berkas temporary stempel secara terjamin.
    """
    if not pdf_bytes or len(pdf_bytes) < 4 or not pdf_bytes.startswith(b"%PDF"):
        raise PDFSignerError("INVALID_PDF", "Berkas yang diunggah bukan berkas PDF yang valid.")

    if page < 1:
        raise PDFSignerError("INVALID_PAGE", "Halaman penandatanganan harus minimal 1.")

    p12_path = resolve_p12_path(nik)
    key, cert, othercerts = load_p12_credentials(p12_path, passphrase)
    rect = parse_bounding_box(llx, lly, urx, ury)
    x0, y0, x1, y1 = rect
    w = max(0.0, x1 - x0)
    h = max(0.0, y1 - y0)

    tmp_stamp_path: Optional[str] = None
    try:
        if stamp_bytes and len(stamp_bytes) > 0:
            # Validasi format gambar menggunakan Pillow
            try:
                with Image.open(io.BytesIO(stamp_bytes)) as img:
                    img_format = (img.format or "").upper()
                    if img_format not in ("PNG", "JPEG", "JPG"):
                        raise PDFSignerError("INVALID_IMAGE", "Berkas stempel harus berformat PNG atau JPEG.")
            except Exception as img_err:
                if isinstance(img_err, PDFSignerError):
                    raise
                raise PDFSignerError("INVALID_IMAGE", "Berkas stempel visual tidak dapat diproses atau rusak.")

            ext = ".png" if (stamp_filename and stamp_filename.lower().endswith(".png")) else ".jpg"
            tmp = NamedTemporaryFile(delete=False, suffix=ext)
            tmp.write(stamp_bytes)
            tmp.flush()
            tmp.close()
            tmp_stamp_path = tmp.name

        signing_date = datetime.now(timezone.utc).strftime("D:%Y%m%d%H%M%S+00'00'")

        if tmp_stamp_path:
            signature_manual = [["image", "sigimg", 0, 0, w, h, True, True]]
            manual_images = {"sigimg": tmp_stamp_path}
        else:
            signature_manual = []
            manual_images = {}

        dct: Dict[str, Any] = {
            "auto_sigfield": True,
            "sigpage": page - 1,  # endesive menggunakan 0-based page index
            "signaturebox": (x0, y0, x1, y1),
            "signform": False,
            "sigfield": "Signature",
            "signature_manual": signature_manual,
            "manual_images": manual_images,
            "manual_fonts": {},
            "aligned": 0,
            "sigflags": 3,
            "sigflagsft": 132,
            "reason": reason,
            "location": location,
            "contact": "",
            "signingdate": signing_date,
            "date": signing_date,
        }

        try:
            signed_tail = cms.sign(pdf_bytes, dct, key, cert, othercerts, "sha256")
            return pdf_bytes + signed_tail
        except Exception as sign_err:
            raise PDFSignerError("SIGNING_FAILED", f"Gagal menyematkan tanda tangan digital: {str(sign_err)}")

    finally:
        # Bersihkan file stempel sementara jika ada
        if tmp_stamp_path and os.path.exists(tmp_stamp_path):
            try:
                os.remove(tmp_stamp_path)
            except OSError:
                pass
