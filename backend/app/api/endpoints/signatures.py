import io
import uuid
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, Form, Header, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.models.certificate import Certificate
from app.services.audit import record_audit
from app.services import pdf_signer

router = APIRouter()


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


@router.post("/sign", response_class=StreamingResponse)
async def sign_document(
    pdf: Optional[UploadFile] = File(default=None, description="Dokumen PDF yang akan ditandatangani"),
    stamp: Optional[UploadFile] = File(default=None, description="Berkas stempel visual (PNG/JPG) opsional"),
    page: int = Form(default=1, description="Nomor halaman (1-based)"),
    llx: Optional[float] = Form(default=None, description="Lower-Left X coordinate (points)"),
    lly: Optional[float] = Form(default=None, description="Lower-Left Y coordinate (points)"),
    urx: Optional[float] = Form(default=None, description="Upper-Right X coordinate (points)"),
    ury: Optional[float] = Form(default=None, description="Upper-Right Y coordinate (points)"),
    passphrase_form: Optional[str] = Form(default=None, alias="passphrase"),
    x_p12_password: Optional[str] = Header(default=None),
    nik_param: Optional[str] = Form(default=None, alias="nik"),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """
    Endpoint penandatanganan dokumen PDF digital terpadu untuk platform web.
    - USER menandatangani secara mandiri menggunakan sertifikat aktif miliknya (NIK dipaksa dari sesi).
    - ADMIN dapat menandatangani atas nama dokumen pengguna lain sesuai kewenangannya.
    - SUPER_ADMIN dibatasi dan tidak memiliki akses ke fitur penandatanganan.
    - Pada Phase 1: Fitur dinonaktifkan secara aman dan mengembalikan 501 Not Implemented.
    """
    # SUPER_ADMIN dilarang mengakses fitur penandatanganan
    if current_user.role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role SUPER_ADMIN tidak memiliki fitur penandatanganan."}
        )

    # Batas Phase 1 vs Phase 2: TTE dinonaktifkan pada Phase 1
    if not settings.ENABLE_PDF_SIGNING:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "code": "FEATURE_DISABLED_PHASE_1",
                "message": "Fitur penandatanganan PDF (TTE) belum aktif pada konfigurasi Phase 1 (direncanakan untuk Phase 2)."
            }
        )

    # Validasi input untuk Phase 2
    if not pdf or not pdf.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": "Berkas PDF wajib diunggah."}
        )

    # Hanya role USER dan ADMIN yang diizinkan
    if current_user.role not in ("USER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Akses ditolak."}
        )

    # Tentukan NIK target:
    # Untuk USER: NIK WAJIB berasal dari akunnya sendiri (proteksi IDOR).
    # Untuk ADMIN: dapat menentukan NIK target atau menggunakan NIK akunnya sendiri.
    if current_user.role == "USER":
        target_nik = current_user.nik
        target_user = current_user
    else:
        # ADMIN
        if nik_param and nik_param.strip():
            safe_nik = nik_param.strip()
            target_user = db.query(User).filter(User.nik == safe_nik).first()
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "NOT_FOUND", "message": f"Pengguna dengan NIK {safe_nik} tidak ditemukan."}
                )
            target_nik = target_user.nik
        else:
            target_nik = current_user.nik
            target_user = current_user

    # Verifikasi status akun pengguna target
    if target_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INACTIVE_USER", "message": "Akun pemilik sertifikat tidak dalam status aktif."}
        )

    # Verifikasi sertifikat aktif pengguna target di database
    active_cert = (
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

    # Validasi dan baca konten PDF
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "INVALID_PDF", "message": "Berkas yang diunggah harus berupa file PDF."}
        )

    try:
        pdf_bytes = await pdf.read()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": "Gagal membaca berkas PDF yang diunggah."}
        )

    if not pdf_bytes or len(pdf_bytes) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PDF", "message": "Berkas PDF kosong atau tidak valid."}
        )

    # Validasi dan baca konten stempel (jika ada)
    stamp_bytes: Optional[bytes] = None
    stamp_filename: Optional[str] = None
    if stamp is not None and stamp.filename:
        try:
            stamp_bytes = await stamp.read()
            stamp_filename = stamp.filename
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_IMAGE", "message": "Gagal membaca berkas stempel."}
            )

    # Proses penandatanganan in-process
    try:
        signed_pdf_bytes = pdf_signer.sign_pdf(
            pdf_bytes=pdf_bytes,
            nik=target_nik,
            passphrase=p12_passphrase,
            page=page,
            llx=llx,
            lly=lly,
            urx=urx,
            ury=ury,
            stamp_bytes=stamp_bytes,
            stamp_filename=stamp_filename
        )
    except pdf_signer.PDFSignerError as e:
        # Catat audit log kegagalan penandatanganan
        record_audit(db, current_user.id, "DOCUMENT_SIGNED", target_user.id, status="FAILED", commit=True)

        status_code_map = {
            "INVALID_IDENTIFIER": status.HTTP_400_BAD_REQUEST,
            "INVALID_COORDINATES": status.HTTP_400_BAD_REQUEST,
            "INVALID_PDF": status.HTTP_400_BAD_REQUEST,
            "INVALID_PAGE": status.HTTP_400_BAD_REQUEST,
            "INVALID_IMAGE": status.HTTP_400_BAD_REQUEST,
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

    # Catat audit log keberhasilan penandatanganan operasional
    record_audit(db, current_user.id, "DOCUMENT_SIGNED", target_user.id, status="SUCCESS", commit=True)

    # Siapkan nama file keluaran
    orig_name = Path(pdf.filename).name
    stem = Path(orig_name).stem
    out_name = f"{stem}_signed.pdf"

    headers = {
        "Content-Disposition": f'attachment; filename="{out_name}"',
        "X-Signer-NIK": target_nik,
        "X-Certificate-Serial": active_cert.serial_number or "",
        "X-Certificate-Number": active_cert.certificate_number or "",
    }

    return StreamingResponse(
        io.BytesIO(signed_pdf_bytes),
        media_type="application/pdf",
        headers=headers
    )
