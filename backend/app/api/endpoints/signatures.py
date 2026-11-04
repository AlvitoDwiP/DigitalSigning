import io
import os
import time
import uuid
import asyncio
import threading
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, Form, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from starlette.concurrency import run_in_threadpool
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.models.certificate import Certificate
from app.schemas.token import TokenPayload
from app.services.audit import record_audit
from app.services.sign import pdf_signer

router = APIRouter()
direct_router = APIRouter(tags=["Signatures Direct"])

oauth2_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)

HTTP_413_PAYLOAD_TOO_LARGE = getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413)


class SigningConcurrencyLimiter:
    """
    Concurrency limiter thread-safe untuk mengendalikan proses penandatanganan simultan.
    Mencegah kehabisan memori RAM, CPU spiking, dan bebas konflik event loop asyncio.
    """
    def __init__(self, max_concurrent: int = 10):
        self._max = max_concurrent
        self._current = 0
        self._lock = threading.Lock()

    async def acquire(self, timeout: float = 1.0) -> bool:
        deadline = time.time() + timeout
        while True:
            with self._lock:
                if self._current < self._max:
                    self._current += 1
                    return True
            if time.time() >= deadline:
                return False
            await asyncio.sleep(0.02)

    def release(self):
        with self._lock:
            if self._current > 0:
                self._current -= 1

    @property
    def current(self) -> int:
        with self._lock:
            return self._current

    @property
    def max_concurrent(self) -> int:
        return self._max


# Inisialisasi Limiter global
_signing_limiter: Optional[SigningConcurrencyLimiter] = None


def get_signing_limiter() -> SigningConcurrencyLimiter:
    global _signing_limiter
    if _signing_limiter is None:
        max_c = getattr(settings, "MAX_CONCURRENT_SIGNING", 10)
        _signing_limiter = SigningConcurrencyLimiter(max_concurrent=max_c)
    return _signing_limiter


async def read_upload_file_limited(
    upload_file: UploadFile,
    max_bytes: int,
    file_type: str = "PDF",
    chunk_size: int = 64 * 1024
) -> bytes:
    """
    Membaca berkas unggahan secara bertahap (chunked) dengan batas ukuran maksimum.
    Mencegah Denial of Service (DoS) dan kehabisan memori RAM:
    - Memeriksa header/atribut ukuran jika tersedia sebelum pembacaan.
    - Menghentikan pembacaan segera setelah akumulasi chunk melampaui batas max_bytes.
    - Mengembalikan HTTP 413 jika melebihi batas.
    - Menolak berkas kosong (HTTP 400).
    """
    # 1. Periksa atribut size jika sudah terdeteksi di awal
    if upload_file.size is not None and upload_file.size > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=HTTP_413_PAYLOAD_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"Ukuran berkas {file_type} melebihi batas maksimum ({max_mb} MB)."
            }
        )

    chunks = []
    total_size = 0

    try:
        while True:
            chunk = await upload_file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_bytes:
                max_mb = max_bytes // (1024 * 1024)
                raise HTTPException(
                    status_code=HTTP_413_PAYLOAD_TOO_LARGE,
                    detail={
                        "code": "FILE_TOO_LARGE",
                        "message": f"Ukuran berkas {file_type} melebihi batas maksimum ({max_mb} MB)."
                    }
                )
            chunks.append(chunk)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": f"Gagal membaca berkas {file_type} yang diunggah."}
        )

    if total_size == 0:
        err_code = "INVALID_PDF" if file_type.upper() == "PDF" else "INVALID_IMAGE"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": err_code, "message": f"Berkas {file_type} kosong atau tidak valid."}
        )

    return b"".join(chunks)


@router.post("")
@router.post("/")
def signing_root_reserved(current_user: User = Depends(deps.get_current_user)):
    """
    Route root dicadangkan untuk Phase 2 (mengembalikan 501 Not Implemented).
    SUPER_ADMIN dilarang mengakses fitur penandatanganan.
    """
    if current_user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role SUPER_ADMIN tidak memiliki fitur penandatanganan."}
        )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "RESERVED_ENDPOINT",
            "message": "Endpoint penandatanganan PDF (TTE) dicadangkan untuk Phase 2 (501 Not Implemented)."
        }
    )


async def _execute_signing(
    *,
    pdf: Optional[UploadFile],
    stamp: Optional[UploadFile] = None,
    page: int = 1,
    llx: Optional[float] = None,
    lly: Optional[float] = None,
    urx: Optional[float] = None,
    ury: Optional[float] = None,
    visible: bool = True,
    passphrase_form: Optional[str] = None,
    x_p12_password: Optional[str] = None,
    nik_param: Optional[str] = None,
    x_api_key: Optional[str] = None,
    token: Optional[str] = None,
    db: Session,
    is_legacy: bool = False,
) -> StreamingResponse:
    """
    Core service function penandatanganan dokumen PDF.
    Menangani otentikasi (API Key / JWT), verifikasi sertifikat, pemrosesan berkas bertahap,
    concurrency limiting, isolasi worker threadpool, audit logging, dan streaming response.
    """
    # Batas Phase 1 vs Phase 2: TTE dinonaktifkan pada Phase 1
    if not settings.ENABLE_PDF_SIGNING:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "code": "FEATURE_DISABLED_PHASE_1",
                "message": "Fitur penandatanganan PDF (TTE) belum aktif pada konfigurasi Phase 1 (direncanakan untuk Phase 2)."
            }
        )

    # Validasi input berkas PDF
    if not pdf or not pdf.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": "Berkas PDF wajib diunggah."}
        )

    actor_user: Optional[User] = None
    target_user: Optional[User] = None
    target_nik: str = ""

    # 1. Mode Autentikasi: X-API-Key
    if x_api_key is not None:
        if x_api_key != getattr(settings, "API_KEY", "rahasia-super"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_API_KEY", "message": "X-API-Key tidak valid."}
            )
        if not nik_param or not str(nik_param).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_INPUT", "message": "Parameter NIK wajib diisi saat menggunakan X-API-Key."}
            )
        target_nik = pdf_signer.sanitize_nik(str(nik_param).strip())
        target_user = db.query(User).filter(User.nik == target_nik).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "USER_NOT_FOUND", "message": f"Pengguna dengan NIK {target_nik} tidak terdaftar dalam sistem."}
            )
        if target_user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INACTIVE_USER", "message": "Akun pemilik sertifikat tidak dalam status aktif."}
            )
        if target_user.role == "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Role SUPER_ADMIN tidak memiliki fitur penandatanganan."}
            )
        actor_user = target_user

    # 2. Mode Autentikasi: Bearer JWT Token
    elif token:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
            )
            token_data = TokenPayload(**payload)
        except (JWTError, ValidationError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        current_user = db.query(User).filter(User.id == token_data.sub).first()
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if current_user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # SUPER_ADMIN dilarang mengakses fitur penandatanganan
        if current_user.role == "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Role SUPER_ADMIN tidak memiliki fitur penandatanganan."}
            )

        # Hanya role USER dan ADMIN yang diizinkan
        if current_user.role not in ("USER", "ADMIN"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Akses ditolak."}
            )

        actor_user = current_user
        # NIK penandatangan selalu diambil dari akun USER yang sedang aktif (proteksi IDOR)
        target_nik = current_user.nik
        target_user = current_user

    else:
        # Tidak ada kredensial yang disertakan
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verifikasi sertifikat aktif di database
    latest_cert = (
        db.query(Certificate)
        .filter(Certificate.user_id == target_user.id)
        .order_by(Certificate.created_at.desc())
        .first()
    )
    if latest_cert and latest_cert.status == "REVOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CERTIFICATE_REVOKED", "message": "Sertifikat digital penandatangan telah dicabut (REVOKED) dan tidak dapat digunakan untuk menandatangani dokumen."}
        )

    active_cert: Optional[Certificate] = (
        db.query(Certificate)
        .filter(Certificate.user_id == target_user.id, Certificate.status == "ACTIVE")
        .first()
    )
    if not active_cert:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_ACTIVE_CERTIFICATE", "message": "Pengguna tidak memiliki sertifikat digital yang aktif."}
        )

    # Ambil passphrase (prioritas Header X-P12-Password, fallback form field)
    p12_passphrase = x_p12_password if x_p12_password is not None else passphrase_form
    if not p12_passphrase:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PASSPHRASE", "message": "Passphrase sertifikat (.p12) wajib diisi."}
        )

    # 1. Validasi ekstensi berkas PDF
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Berkas 'pdf' khusus untuk format dokumen PDF (.pdf). Format lain tidak diperbolehkan."}
        )

    # 2. Pembacaan bertahap (chunked) dengan batas ukuran maksimum PDF (25 MB)
    pdf_max_bytes = getattr(settings, "MAX_PDF_SIZE_MB", 25) * 1024 * 1024
    pdf_bytes = await read_upload_file_limited(
        upload_file=pdf,
        max_bytes=pdf_max_bytes,
        file_type="PDF"
    )

    # 3. Validasi parameter spesifik mode
    stamp_bytes: Optional[bytes] = None
    stamp_filename: Optional[str] = None
    target_page = 1

    if visible:
        target_page = page if page and page > 0 else 1
        # Validasi bounding box jika diberikan
        if llx is not None and urx is not None and llx >= urx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COORDINATES", "message": "Dimensi stempel tidak valid: urx harus lebih besar dari llx."}
            )
        if lly is not None and ury is not None and lly >= ury:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COORDINATES", "message": "Dimensi stempel tidak valid: ury harus lebih besar dari lly."}
            )

        # Validasi dan pembacaan bertahap berkas stempel (khusus format gambar, maks 2 MB)
        if stamp is not None and stamp.filename:
            # Validasi ekstensi stempel: wajib format gambar (.png, .jpg, .jpeg, .heic)
            stamp_ext = Path(stamp.filename).suffix.lower()
            if stamp_ext not in (".png", ".jpg", ".jpeg", ".heic"):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail={
                        "code": "UNSUPPORTED_MEDIA_TYPE",
                        "message": f"Berkas 'stamp' khusus untuk format gambar (.png, .jpg, .jpeg, .heic). Format '{stamp_ext or 'tidak dikenal'}' (seperti PDF) tidak diperbolehkan sebagai gambar stempel."
                    }
                )

            # Validasi content_type jika dikirimkan oleh client
            if stamp.content_type and not stamp.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail={
                        "code": "UNSUPPORTED_MEDIA_TYPE",
                        "message": f"Tipe konten berkas 'stamp' ({stamp.content_type}) tidak valid. Berkas 'stamp' harus berupa format gambar (image/png atau image/jpeg)."
                    }
                )

            stamp_max_bytes = getattr(settings, "MAX_STAMP_SIZE_MB", 2) * 1024 * 1024
            stamp_bytes = await read_upload_file_limited(
                upload_file=stamp,
                max_bytes=stamp_max_bytes,
                file_type="stempel gambar"
            )
            stamp_filename = stamp.filename
    else:
        # Mode invisible murni tanpa visual widget
        stamp_bytes = None
        stamp_filename = None
        llx = None
        lly = None
        urx = None
        ury = None
        target_page = 1

    # 4. Pembatasan konkurensi (Concurrency Limiter)
    limiter = get_signing_limiter()
    acquired = await limiter.acquire(timeout=1.0)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RESOURCE_BUSY",
                "message": "Layanan penandatanganan sedang sibuk memproses permintaan lain. Silakan coba kembali beberapa saat lagi."
            }
        )

    # 5. Pemrosesan kriptografi secara asinkron tanpa memblokir event loop
    signing_timeout = float(getattr(settings, "SIGNING_TIMEOUT_SECONDS", 60))
    try:
        signed_pdf_bytes = await asyncio.wait_for(
            run_in_threadpool(
                pdf_signer.sign_pdf,
                pdf_bytes=pdf_bytes,
                nik=target_nik,
                passphrase=p12_passphrase,
                page=target_page,
                llx=llx,
                lly=lly,
                urx=urx,
                ury=ury,
                visible=visible,
                stamp_bytes=stamp_bytes,
                stamp_filename=stamp_filename
            ),
            timeout=signing_timeout
        )
    except asyncio.TimeoutError:
        if actor_user and target_user:
            record_audit(db, actor_user.id, "DOCUMENT_SIGNED", target_user.id, status="FAILED", commit=True)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={
                "code": "SIGNING_TIMEOUT",
                "message": "Batas waktu pemrosesan penandatanganan dokumen terlampaui."
            }
        )
    except pdf_signer.PDFSignerError as e:
        # Catat audit log kegagalan penandatanganan jika aktor terdaftar
        if actor_user and target_user:
            record_audit(db, actor_user.id, "DOCUMENT_SIGNED", target_user.id, status="FAILED", commit=True)

        status_code_map = {
            "INVALID_IDENTIFIER": status.HTTP_400_BAD_REQUEST,
            "INVALID_COORDINATES": status.HTTP_400_BAD_REQUEST,
            "INVALID_PDF": status.HTTP_400_BAD_REQUEST,
            "INVALID_PAGE": status.HTTP_400_BAD_REQUEST,
            "PDF_PAGE_LIMIT_EXCEEDED": status.HTTP_400_BAD_REQUEST,
            "ENCRYPTED_PDF": status.HTTP_400_BAD_REQUEST,
            "INVALID_IMAGE": status.HTTP_400_BAD_REQUEST,
            "UNSUPPORTED_MEDIA_TYPE": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "FILE_TOO_LARGE": HTTP_413_PAYLOAD_TOO_LARGE,
            "INVALID_PASSPHRASE": status.HTTP_401_UNAUTHORIZED,
            "CERTIFICATE_NOT_FOUND": status.HTTP_404_NOT_FOUND,
            "FORBIDDEN": status.HTTP_403_FORBIDDEN,
            "CORRUPT_CERTIFICATE": status.HTTP_400_BAD_REQUEST,
            "SIGNING_FAILED": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }
        status_code = status_code_map.get(e.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        raise HTTPException(
            status_code=status_code,
            detail={"code": e.code, "message": e.message}
        )
    finally:
        limiter.release()

    # Catat audit log keberhasilan penandatanganan operasional jika aktor terdaftar
    if actor_user and target_user:
        record_audit(db, actor_user.id, "DOCUMENT_SIGNED", target_user.id, status="SUCCESS", commit=True)

    # Siapkan nama file keluaran: {nama file}_sign.pdf
    orig_name = Path(pdf.filename).name
    stem = Path(orig_name).stem
    out_name = f"{stem}_sign.pdf"

    headers = {
        "Content-Disposition": f'attachment; filename="{out_name}"',
        "X-Signer-NIK": target_nik,
        "X-Certificate-Serial": active_cert.serial_number if active_cert and active_cert.serial_number else "",
        "X-Certificate-Number": active_cert.certificate_number if active_cert and active_cert.certificate_number else "",
        "X-Signature-Type": "visible" if visible else "invisible",
    }
    if is_legacy:
        headers["Deprecation"] = "true"
        headers["Link"] = f'<{settings.API_V1_STR}/signatures/visible>; rel="alternate", <{settings.API_V1_STR}/signatures/invisible>; rel="alternate"'

    return StreamingResponse(
        io.BytesIO(signed_pdf_bytes),
        media_type="application/pdf",
        headers=headers
    )


@router.post("/visible", response_class=StreamingResponse, summary="Tanda Tangani PDF TTE Terlihat (Visible)")
async def sign_document_visible(
    pdf: Optional[UploadFile] = File(default=None, description="Berkas PDF yang akan ditandatangani (maks 25 MB)"),
    stamp: Optional[UploadFile] = File(default=None, description="Berkas stempel visual PNG/JPG opsional (maks 2 MB)"),
    page: int = Form(default=1, description="Nomor halaman target (1-based, default 1)"),
    llx: Optional[float] = Form(default=None, description="Lower-Left X coordinate (points)"),
    lly: Optional[float] = Form(default=None, description="Lower-Left Y coordinate (points)"),
    urx: Optional[float] = Form(default=None, description="Upper-Right X coordinate (points)"),
    ury: Optional[float] = Form(default=None, description="Upper-Right Y coordinate (points)"),
    passphrase: Optional[str] = Form(default=None, alias="passphrase", description="Passphrase sertifikat .p12"),
    x_p12_password: Optional[str] = Header(default=None, alias="X-P12-Password"),
    nik: Optional[str] = Form(default=None, alias="nik", description="NIK pemilik sertifikat (wajib jika autentikasi X-API-Key)"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    token: Optional[str] = Depends(oauth2_optional),
    db: Session = Depends(deps.get_db),
):
    """
    Endpoint penandatanganan dokumen PDF digital dengan representasi visual (stempel / paraf / QR).
    Mendukung pemanggilan langsung oleh aplikasi eksternal maupun aplikasi Web DigitalSigning.
    """
    return await _execute_signing(
        pdf=pdf,
        stamp=stamp,
        page=page,
        llx=llx,
        lly=lly,
        urx=urx,
        ury=ury,
        visible=True,
        passphrase_form=passphrase,
        x_p12_password=x_p12_password,
        nik_param=nik,
        x_api_key=x_api_key,
        token=token,
        db=db,
        is_legacy=False,
    )


@router.post("/invisible", response_class=StreamingResponse, summary="Tanda Tangani PDF TTE Tak Terlihat (Invisible)")
async def sign_document_invisible(
    pdf: Optional[UploadFile] = File(default=None, description="Berkas PDF yang akan ditandatangani (maks 25 MB)"),
    passphrase: Optional[str] = Form(default=None, alias="passphrase", description="Passphrase sertifikat .p12"),
    x_p12_password: Optional[str] = Header(default=None, alias="X-P12-Password"),
    nik: Optional[str] = Form(default=None, alias="nik", description="NIK pemilik sertifikat (wajib jika autentikasi X-API-Key)"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    token: Optional[str] = Depends(oauth2_optional),
    db: Session = Depends(deps.get_db),
):
    """
    Endpoint penandatanganan dokumen PDF digital secara kriptografis tanpa representasi visual (Invisible).
    Tidak menerima parameter koordinat, halaman, atau stempel visual.
    Mendukung pemanggilan langsung oleh aplikasi eksternal maupun aplikasi Web DigitalSigning.
    """
    return await _execute_signing(
        pdf=pdf,
        stamp=None,
        page=1,
        llx=None,
        lly=None,
        urx=None,
        ury=None,
        visible=False,
        passphrase_form=passphrase,
        x_p12_password=x_p12_password,
        nik_param=nik,
        x_api_key=x_api_key,
        token=token,
        db=db,
        is_legacy=False,
    )


@router.post("/sign", response_class=StreamingResponse, deprecated=True, summary="Endpoint Penandatanganan Legacy (Deprecated)")
async def sign_document(
    pdf: Optional[UploadFile] = File(default=None, description="Dokumen PDF yang akan ditandatangani"),
    stamp: Optional[UploadFile] = File(default=None, description="Berkas stempel visual (PNG/JPG) opsional"),
    page: int = Form(default=1, description="Nomor halaman (1-based)"),
    llx: Optional[float] = Form(default=None, description="Lower-Left X coordinate (points)"),
    lly: Optional[float] = Form(default=None, description="Lower-Left Y coordinate (points)"),
    urx: Optional[float] = Form(default=None, description="Upper-Right X coordinate (points)"),
    ury: Optional[float] = Form(default=None, description="Upper-Right Y coordinate (points)"),
    visible: bool = Form(default=True, description="Mode tanda tangan: True (visible) atau False (invisible)"),
    passphrase_form: Optional[str] = Form(default=None, alias="passphrase"),
    x_p12_password: Optional[str] = Header(default=None, alias="X-P12-Password"),
    nik_param: Optional[str] = Form(default=None, alias="nik"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    token: Optional[str] = Depends(oauth2_optional),
    db: Session = Depends(deps.get_db)
):
    """
    Endpoint penandatanganan dokumen PDF legacy (deprecated).
    Disarankan beralih ke endpoint spesifik:
    - POST /api/v1/signatures/visible
    - POST /api/v1/signatures/invisible
    """
    return await _execute_signing(
        pdf=pdf,
        stamp=stamp,
        page=page,
        llx=llx,
        lly=lly,
        urx=urx,
        ury=ury,
        visible=visible,
        passphrase_form=passphrase_form,
        x_p12_password=x_p12_password,
        nik_param=nik_param,
        x_api_key=x_api_key,
        token=token,
        db=db,
        is_legacy=True,
    )


# Registrasi route langsung untuk kompatibilitas penuh dengan pemanggilan direct
direct_router.add_api_route(
    "/sign",
    sign_document,
    methods=["POST"],
    response_class=StreamingResponse,
    description="Endpoint langsung /sign untuk kompatibilitas dengan standalone Sign API (Deprecated)",
    deprecated=True
)
direct_router.add_api_route(
    "/visible",
    sign_document_visible,
    methods=["POST"],
    response_class=StreamingResponse,
    description="Endpoint langsung /visible untuk penandatanganan visible"
)
direct_router.add_api_route(
    "/invisible",
    sign_document_invisible,
    methods=["POST"],
    response_class=StreamingResponse,
    description="Endpoint langsung /invisible untuk penandatanganan invisible"
)
