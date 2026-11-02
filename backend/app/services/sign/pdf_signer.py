import io
import os
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone, timedelta

from cryptography import x509
from cryptography.x509.oid import NameOID
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


def get_issued_dir() -> Path:
    env_issued = getattr(settings, "ISSUED_DIR", None) or os.getenv("ISSUED_DIR")
    if env_issued and Path(env_issued).exists():
        return Path(env_issued).resolve()
    from app.core.config import BASE_DIR
    local_path = (BASE_DIR / "pki" / "issued").resolve()
    return local_path


def resolve_p12_path(nik: str) -> Path:
    safe_nik = sanitize_nik(nik)

    # 1. Prioritas utama: cari berkas .p12 langsung di subfolder direktori pki/issued/
    issued_dir = get_issued_dir()
    if issued_dir.exists():
        candidates = list(issued_dir.glob(f"*/{safe_nik}.p12"))
        if candidates and candidates[0].is_file():
            target = candidates[0].resolve()
            try:
                target.relative_to(issued_dir)
                return target
            except Exception:
                raise PDFSignerError("FORBIDDEN", "Akses path sertifikat di luar direktori yang diizinkan.")

    # 2. Fallback jika masih tersimpan di archive sign-api/p12 (kompatibilitas transisi)
    p12_dir = get_p12_archive_dir()
    target = (p12_dir / f"{safe_nik}.p12").resolve()
    if target.is_file():
        try:
            target.relative_to(p12_dir)
            return target
        except Exception:
            raise PDFSignerError("FORBIDDEN", "Akses path sertifikat di luar direktori yang diizinkan.")

    raise PDFSignerError(
        "CERTIFICATE_NOT_FOUND",
        f"Berkas sertifikat digital (.p12) untuk NIK {safe_nik} tidak ditemukan di direktori issued."
    )


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
    visible: bool = True,
    stamp_bytes: Optional[bytes] = None,
    stamp_filename: Optional[str] = None,
    reason: str = "Digital Signature Platform",
    location: str = "Jakarta"
) -> bytes:
    """
    Menandatangani PDF menggunakan pustaka endesive secara in-process.
    Mendukung mode Visible (dengan visual stamp/QR di koordinat tertentu)
    dan mode Invisible (tanda tangan kriptografis PAdES murni tanpa visual widget).
    Menerapkan pembersihan berkas temporary stempel secara terjamin.
    """
    if not pdf_bytes or len(pdf_bytes) < 4 or not pdf_bytes.startswith(b"%PDF"):
        raise PDFSignerError("INVALID_PDF", "Berkas yang diunggah bukan berkas PDF yang valid.")

    if page < 1:
        raise PDFSignerError("INVALID_PAGE", "Halaman penandatanganan harus minimal 1.")

    p12_path = resolve_p12_path(nik)
    key, cert, othercerts = load_p12_credentials(p12_path, passphrase)

    # Gunakan zona waktu WIB (UTC+7) agar jam penandatanganan di pembaca PDF (PDFgear / Acrobat) sesuai waktu lokal
    wib_tz = timezone(timedelta(hours=7))
    signing_date = datetime.now(wib_tz).strftime("D:%Y%m%d%H%M%S+07'00'")
    tmp_stamp_path: Optional[str] = None

    # Ekstrak Common Name (CN) dari sertifikat penandatangan untuk field /Name pada dictionary /Sig
    signer_cn = nik
    try:
        cn_attrs = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        if cn_attrs and cn_attrs[0].value:
            signer_cn = str(cn_attrs[0].value)
    except Exception:
        pass

    try:
        dct: Dict[str, Any] = {
            "auto_sigfield": True,
            "sigpage": page - 1,  # endesive menggunakan 0-based page index
            "signform": False,
            "sigfield": "Signature",
            "aligned": 0,
            "sigflags": 3,
            "sigflagsft": 132,
            "name": signer_cn,
            "reason": reason,
            "location": location,
            "contact": "",
            "signingdate": signing_date,
            "date": signing_date,
        }

        if visible:
            rect = parse_bounding_box(llx, lly, urx, ury)
            x0, y0, x1, y1 = rect
            w = max(0.0, x1 - x0)
            h = max(0.0, y1 - y0)

            if stamp_bytes and len(stamp_bytes) > 0:
                # Validasi format gambar menggunakan Pillow & beri latar putih bersih (RGB)
                # agar pembaca PDF (seperti PDFgear) tidak menampilkan blok highlight biru di balik alpha transparan
                try:
                    with Image.open(io.BytesIO(stamp_bytes)) as img:
                        img_format = (img.format or "").upper()
                        if img_format not in ("PNG", "JPEG", "JPG"):
                            raise PDFSignerError("INVALID_IMAGE", "Berkas stempel harus berformat PNG atau JPEG.")

                        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                            rgba_img = img.convert("RGBA")
                            white_bg = Image.new("RGB", rgba_img.size, (255, 255, 255))
                            white_bg.paste(rgba_img, mask=rgba_img.split()[3])
                            out_img = white_bg
                        else:
                            out_img = img.convert("RGB")

                        tmp = NamedTemporaryFile(delete=False, suffix=".png")
                        out_img.save(tmp, format="PNG")
                        tmp.flush()
                        tmp.close()
                        tmp_stamp_path = tmp.name
                except Exception as img_err:
                    if isinstance(img_err, PDFSignerError):
                        raise
                    raise PDFSignerError("INVALID_IMAGE", "Berkas stempel visual tidak dapat diproses atau rusak.")

            if tmp_stamp_path:
                signature_manual = [["image", "sigimg", 0, 0, w, h, True, True]]
                manual_images = {"sigimg": tmp_stamp_path}
            else:
                signature_manual = []
                manual_images = {}

            dct["signaturebox"] = (x0, y0, x1, y1)
            dct["signature_manual"] = signature_manual
            dct["manual_images"] = manual_images
            dct["manual_fonts"] = {}
        else:
            # Mode Invisible: tetap gunakan signaturebox (0, 0, 0, 0) agar endesive membuat
            # objek /AP /N bertipe StreamObject yang valid (bukan DictionaryObject kosong)
            # serta mendaftarkan anotasi /Sig ke /Annots sehingga terdeteksi di semua alat cek TTE
            dct["signaturebox"] = (0.0, 0.0, 0.0, 0.0)
            dct["signature_manual"] = []
            dct["manual_images"] = {}
            dct["manual_fonts"] = {}

        try:
            signed_tail = cms.sign(
                pdf_bytes,
                dct,
                key,
                cert,
                othercerts,
                "sha256",
            )
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
