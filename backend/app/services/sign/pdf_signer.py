import io
import os
import re
import uuid
import warnings
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timezone, timedelta

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat import backends
from endesive.pdf import cms, PyPDF2
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

# Konfigurasi batas piksel Pillow untuk mencegah serangan Decompression Bomb
Image.MAX_IMAGE_PIXELS = getattr(settings, "MAX_STAMP_PIXELS", 16777216)


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


def validate_pdf_structure(
    pdf_bytes: bytes,
    target_page: int,
    max_pages: Optional[int] = None
) -> Tuple[float, float, int]:
    """
    Validasi struktural berkas PDF:
    1. Memastikan magic bytes %PDF.
    2. Parsing struktur dokumen PDF menggunakan PyPDF2.
    3. Memastikan dokumen tidak terenkripsi / dilindungi kata sandi.
    4. Memastikan jumlah halaman >= 1 dan tidak melebihi batas kebijakan.
    5. Memastikan halaman target penandatanganan tersedia.
    6. Membaca dimensi halaman dan orientasi (portrait / landscape / rotation).
    Mengembalikan (page_width, page_height, total_pages).
    """
    if not pdf_bytes or len(pdf_bytes) < 4 or not pdf_bytes.startswith(b"%PDF"):
        raise PDFSignerError("INVALID_PDF", "Berkas yang diunggah bukan berkas PDF yang valid.")

    try:
        reader = PyPDF2.PdfFileReader(io.BytesIO(pdf_bytes), strict=False)
    except Exception:
        raise PDFSignerError("INVALID_PDF", "Struktur berkas PDF rusak atau tidak dapat diproses.")

    if reader.isEncrypted:
        raise PDFSignerError(
            "ENCRYPTED_PDF",
            "Dokumen PDF terenkripsi atau dilindungi kata sandi, tidak dapat ditandatangani."
        )

    try:
        num_pages = reader.numPages
    except Exception:
        raise PDFSignerError("INVALID_PDF", "Gagal membaca struktur halaman dokumen PDF.")

    if num_pages < 1:
        raise PDFSignerError("INVALID_PDF", "Dokumen PDF tidak memiliki halaman.")

    limit_pages = max_pages or getattr(settings, "MAX_PDF_PAGES", 1000)
    if num_pages > limit_pages:
        raise PDFSignerError(
            "PDF_PAGE_LIMIT_EXCEEDED",
            f"Jumlah halaman PDF ({num_pages}) melebihi batas maksimum yang diizinkan ({limit_pages} halaman)."
        )

    if target_page < 1 or target_page > num_pages:
        raise PDFSignerError(
            "INVALID_PAGE",
            f"Halaman target penandatanganan ({target_page}) tidak ditemukan pada dokumen (total {num_pages} halaman)."
        )

    try:
        page_obj = reader.getPage(target_page - 1)
        box = page_obj.cropBox if hasattr(page_obj, "cropBox") and page_obj.cropBox else page_obj.mediaBox
        raw_w = float(box.getWidth())
        raw_h = float(box.getHeight())
        rotate = int(page_obj.get("/Rotate", 0) or 0) % 360
        if rotate in (90, 270):
            page_w, page_h = raw_h, raw_w
        else:
            page_w, page_h = raw_w, raw_h
    except Exception:
        raise PDFSignerError("INVALID_PDF", "Gagal membaca dimensi halaman target dokumen PDF.")

    if page_w <= 0 or page_h <= 0:
        raise PDFSignerError("INVALID_PDF", "Dimensi halaman dokumen PDF tidak valid.")

    return (page_w, page_h, num_pages)


def parse_bounding_box(
    llx: Optional[float],
    lly: Optional[float],
    urx: Optional[float],
    ury: Optional[float],
    page_w: float = 612.0,
    page_h: float = 792.0
) -> Tuple[float, float, float, float]:
    """
    Validasi dan normalisasi 4 koordinat PDF box dalam batas halaman:
    llx: Lower-Left X, lly: Lower-Left Y, urx: Upper-Right X, ury: Upper-Right Y.
    Memastikan:
    - Koordinat bernilai numerik dan non-negatif.
    - llx < urx dan lly < ury.
    - Lebar dan tinggi area tanda tangan > 0.
    - Seluruh koordinat berada di dalam batas halaman (0 <= llx < urx <= page_w, 0 <= lly < ury <= page_h).
    """
    if llx is None and lly is None and urx is None and ury is None:
        # Default bounding box aman jika tidak ditentukan
        def_w = min(150.0, max(10.0, page_w - 72.0))
        def_h = min(150.0, max(10.0, page_h - 72.0))
        x0 = 36.0 if (36.0 + def_w) <= page_w else 0.0
        y0 = 36.0 if (36.0 + def_h) <= page_h else 0.0
        return (x0, y0, x0 + def_w, y0 + def_h)

    if None in (llx, lly, urx, ury):
        raise PDFSignerError(
            "INVALID_COORDINATES",
            "Keempat parameter koordinat stempel (llx, lly, urx, ury) harus diisi bersamaan."
        )

    try:
        x0 = float(llx)
        y0 = float(lly)
        x1 = float(urx)
        y1 = float(ury)
    except (ValueError, TypeError):
        raise PDFSignerError("INVALID_COORDINATES", "Koordinat stempel harus bernilai numerik.")

    if x0 < 0 or y0 < 0:
        raise PDFSignerError("INVALID_COORDINATES", "Koordinat tanda tangan tidak boleh bernilai negatif.")

    if x1 <= x0:
        raise PDFSignerError("INVALID_COORDINATES", "Dimensi stempel tidak valid: urx harus lebih besar dari llx.")
    if y1 <= y0:
        raise PDFSignerError("INVALID_COORDINATES", "Dimensi stempel tidak valid: ury harus lebih besar dari lly.")

    if (x1 - x0) <= 0 or (y1 - y0) <= 0:
        raise PDFSignerError("INVALID_COORDINATES", "Lebar dan tinggi area tanda tangan harus lebih besar dari nol.")

    if x0 >= page_w or y0 >= page_h or x1 > page_w or y1 > page_h:
        raise PDFSignerError(
            "INVALID_COORDINATES",
            f"Koordinat tanda tangan ({x0:.1f}, {y0:.1f}, {x1:.1f}, {y1:.1f}) berada di luar batas halaman ({page_w:.1f} x {page_h:.1f} pt)."
        )

    return (x0, y0, x1, y1)


def validate_and_prepare_stamp(
    stamp_bytes: bytes,
    stamp_filename: Optional[str] = None
) -> Tuple[str, float, float]:
    """
    Validasi keamanan dan persiapan gambar stempel visual:
    1. Pembatasan format: hanya PNG dan JPEG.
    2. Pemeriksaan ekstensi (jika ada) dan magic header.
    3. Perlindungan Decompression Bomb (Image.MAX_IMAGE_PIXELS & DecompressionBombError).
    4. Integritas berkas menggunakan Image.verify().
    5. Batasan dimensi (lebar/tinggi <= MAX_STAMP_WIDTH/HEIGHT) dan total piksel <= MAX_STAMP_PIXELS.
    6. Pembuatan berkas sementara berizin ketat (0600) dengan nama acak tak tertebak.
    Mengembalikan (tmp_path, width, height).
    """
    if not stamp_bytes or len(stamp_bytes) == 0:
        raise PDFSignerError("INVALID_IMAGE", "Berkas stempel kosong.")

    # Validasi ekstensi jika nama file diberikan
    if stamp_filename:
        ext = Path(stamp_filename).suffix.lower()
        if ext not in (".png", ".jpg", ".jpeg", ".heic"):
            raise PDFSignerError(
                "UNSUPPORTED_MEDIA_TYPE",
                "Format berkas stempel harus berupa PNG, JPEG, atau HEIC."
            )

    max_w = getattr(settings, "MAX_STAMP_WIDTH", 4096)
    max_h = getattr(settings, "MAX_STAMP_HEIGHT", 4096)
    max_pixels = getattr(settings, "MAX_STAMP_PIXELS", 16777216)

    # 1. Verifikasi integritas & format dengan Image.verify()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(stamp_bytes)) as verify_img:
                img_format = (verify_img.format or "").upper()
                if img_format not in ("PNG", "JPEG", "JPG"):
                    raise PDFSignerError(
                        "UNSUPPORTED_MEDIA_TYPE",
                        "Format berkas stempel harus berformat PNG atau JPEG."
                    )
                verify_img.verify()
    except Image.DecompressionBombError:
        raise PDFSignerError(
            "INVALID_IMAGE",
            "Ukuran gambar stempel melebihi batas keamanan piksel (decompression bomb terdeteksi)."
        )
    except Image.DecompressionBombWarning:
        raise PDFSignerError(
            "INVALID_IMAGE",
            "Ukuran gambar stempel berpotensi menimbulkan dekompresi berbahaya."
        )
    except PDFSignerError:
        raise
    except UnidentifiedImageError:
        raise PDFSignerError(
            "INVALID_IMAGE",
            "Berkas stempel visual tidak dapat diproses atau format tidak dikenali."
        )
    except Exception:
        raise PDFSignerError(
            "INVALID_IMAGE",
            "Berkas stempel visual tidak dapat diproses atau rusak."
        )

    # 2. Buka kembali untuk validasi dimensi & pemrosesan visual
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(stamp_bytes)) as img:
                w, h = img.size
                if w <= 0 or h <= 0:
                    raise PDFSignerError("INVALID_IMAGE", "Dimensi gambar stempel tidak valid.")
                if w > max_w or h > max_h:
                    raise PDFSignerError(
                        "INVALID_IMAGE",
                        f"Dimensi gambar stempel ({w}x{h}) melebihi batas maksimum ({max_w}x{max_h} px)."
                    )
                if (w * h) > max_pixels:
                    raise PDFSignerError(
                        "INVALID_IMAGE",
                        f"Total resolusi piksel stempel ({w * h}) melebihi batas maksimum ({max_pixels} px)."
                    )

                # Konversi latar belakang putih untuk transparansi agar bersih di reader PDF
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    rgba_img = img.convert("RGBA")
                    white_bg = Image.new("RGB", rgba_img.size, (255, 255, 255))
                    white_bg.paste(rgba_img, mask=rgba_img.split()[3])
                    out_img = white_bg
                else:
                    out_img = img.convert("RGB")

                # Buat berkas sementara dengan nama acak tak tertebak dan izin ketat 0600
                tmp = NamedTemporaryFile(
                    delete=False,
                    suffix=".png",
                    prefix=f"ds_stamp_{uuid.uuid4().hex[:8]}_"
                )
                try:
                    os.chmod(tmp.name, 0o600)
                except OSError:
                    pass
                out_img.save(tmp, format="PNG")
                tmp.flush()
                tmp.close()
                return tmp.name, float(w), float(h)
    except PDFSignerError:
        raise
    except Image.DecompressionBombError:
        raise PDFSignerError("INVALID_IMAGE", "Ukuran gambar stempel melebihi batas keamanan piksel.")
    except Exception as e:
        raise PDFSignerError("INVALID_IMAGE", f"Gagal memproses gambar stempel: {str(e)}")


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
    Menerapkan validasi struktural dokumen, batasan halaman, batasan koordinat,
    serta pembersihan berkas temporary stempel secara terjamin.
    """
    # 1. Validasi struktural berkas PDF, batasan halaman, dan dimensi target
    page_w, page_h, num_pages = validate_pdf_structure(
        pdf_bytes=pdf_bytes,
        target_page=page,
        max_pages=getattr(settings, "MAX_PDF_PAGES", 1000)
    )

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
            # 2. Validasi koordinat penempatan tanda tangan dalam batas halaman PDF
            rect = parse_bounding_box(llx, lly, urx, ury, page_w=page_w, page_h=page_h)
            x0, y0, x1, y1 = rect
            w = max(0.0, x1 - x0)
            h = max(0.0, y1 - y0)

            # 3. Validasi dan persiapan berkas stempel visual (jika disertakan)
            if stamp_bytes and len(stamp_bytes) > 0:
                tmp_stamp_path, _, _ = validate_and_prepare_stamp(
                    stamp_bytes=stamp_bytes,
                    stamp_filename=stamp_filename
                )

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
