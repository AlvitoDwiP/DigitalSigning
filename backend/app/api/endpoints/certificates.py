import os
import math
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api import deps
from app.models.certificate import Certificate
from app.models.user import User
from app.core.security import verify_password
from app.services.audit import record_audit
from app.schemas.certificate import PublicCertificateItem, RevokeCertificateRequest
from app.services.pki import pki_api_client, cleanup_local_pki_materials

router = APIRouter()

VALID_CERT_STATUSES = {"ACTIVE", "EXPIRED", "REPLACED", "REVOKED", "DELETED"}


@router.get("/crl")
def get_crl(format: str = Query("der", description="Format: der atau pem")):
    """
    Endpoint distribusi publik Certificate Revocation List (CRL) untuk validator dan PDF Reader eksternal.
    """
    try:
        content = pki_api_client.get_crl(format=format)
    except Exception:
        from app.core.config import BASE_DIR
        crl_file = (BASE_DIR / "pki" / "intermediate" / "crl" / ("intermediate-ca.crl" if format.lower() == "pem" else "intermediate-ca.crl.der")).resolve()
        if crl_file.is_file():
            content = crl_file.read_bytes()
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "CRL_UNAVAILABLE", "message": "Certificate Revocation List belum tersedia."}
            )

    media_type = "application/x-pem-file" if format.lower() == "pem" else "application/pkix-crl"
    filename = "intermediate-ca.crl" if format.lower() == "pem" else "intermediate-ca.crl.der"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/crl.pem")
def get_crl_pem():
    return get_crl(format="pem")



@router.get("", response_model=dict)
@router.get("/", response_model=dict)
def list_certificates(
    page: int = Query(1, ge=1, description="Nomor halaman (mulai dari 1)"),
    limit: int = Query(20, ge=1, le=100, description="Jumlah item per halaman (1 - 100)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter status sertifikat: ACTIVE, EXPIRED, REPLACED"),
    search: Optional[str] = Query(None, description="Pencarian kata kunci pada serial number, subject, atau fingerprint SHA-256"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Dict[str, Any]:
    """
    API Publik Baca Daftar Sertifikat (Read-Only).
    Menyediakan metadata publik sertifikat untuk integrasi sistem eksternal terotentikasi.
    Tidak mengembalikan private key, file P12, path sistem berkas server, maupun passphrase.
    """
    query = db.query(Certificate)

    # Validasi filter status
    if status_filter:
        clean_status = status_filter.strip().upper()
        if clean_status not in VALID_CERT_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_INPUT",
                    "message": f"Status sertifikat '{status_filter}' tidak valid. Pilihan: {', '.join(sorted(VALID_CERT_STATUSES))}"
                }
            )
        query = query.filter(Certificate.status == clean_status)

    # Pencarian
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Certificate.certificate_number.ilike(s),
                Certificate.serial_number.ilike(s),
                Certificate.subject.ilike(s),
                Certificate.fingerprint_sha256.ilike(s)
            )
        )

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1

    certificates = (
        query.order_by(Certificate.issued_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    formatted_items = [
        PublicCertificateItem.model_validate(c).model_dump()
        for c in certificates
    ]

    return {
        "success": True,
        "data": {
            "items": formatted_items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        }
    }


@router.get("/{identifier}", response_model=dict)
def get_certificate_by_identifier(
    identifier: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Dict[str, Any]:
    """
    API Publik Baca Informasi & Status Spesifik Sertifikat (Read-Only).
    Mendukung pencarian berdasarkan UUID sertifikat, Nomor Seri (serial_number), atau Fingerprint SHA-256.
    Mengembalikan metadata publik serta evaluasi keabsahan aktif masa berlaku (is_valid).
    """
    clean_identifier = identifier.strip()
    if not clean_identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": "Identifier sertifikat tidak boleh kosong"}
        )

    cert = None

    # 1. Coba pencarian berbasis UUID
    try:
        parsed_uuid = uuid.UUID(clean_identifier)
        cert = db.query(Certificate).filter(Certificate.id == parsed_uuid).first()
    except ValueError:
        pass

    # 2. Jika bukan UUID atau tidak ditemukan via UUID, cari via certificate_number, serial_number, atau fingerprint_sha256
    if not cert:
        cert = db.query(Certificate).filter(
            or_(
                Certificate.certificate_number.ilike(clean_identifier),
                Certificate.serial_number == clean_identifier,
                Certificate.fingerprint_sha256.ilike(clean_identifier)
            )
        ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "CERTIFICATE_NOT_FOUND",
                "message": f"Sertifikat dengan identifier '{identifier}' tidak ditemukan"
            }
        )

    # Evaluasi status keabsahan masa berlaku real-time
    now_utc = datetime.now(timezone.utc)
    is_not_expired = cert.expires_at > now_utc
    is_valid = (cert.status == "ACTIVE") and is_not_expired

    cert_data = {
        "id": cert.id,
        "certificate_number": cert.certificate_number,
        "serial_number": cert.serial_number,
        "subject": cert.subject,
        "issuer": cert.issuer,
        "fingerprint_sha256": cert.fingerprint_sha256,
        "issued_at": cert.issued_at,
        "expires_at": cert.expires_at,
        "status": cert.status,
        "revoked_at": cert.revoked_at,
        "revocation_reason": cert.revocation_reason,
        "is_valid": is_valid
    }

    return {
        "success": True,
        "data": cert_data
    }


@router.get("/{identifier}/verify", response_model=dict)
def verify_certificate_status(
    identifier: str,
    db: Session = Depends(deps.get_db),
) -> Dict[str, Any]:
    """
    Verifikasi status keabsahan sertifikat secara mendalam terhadap Database dan Certificate Revocation List (CRL).
    """
    clean_id = identifier.strip()
    cert = None
    try:
        parsed_uuid = uuid.UUID(clean_id)
        cert = db.query(Certificate).filter(Certificate.id == parsed_uuid).first()
    except ValueError:
        pass

    if not cert:
        cert = db.query(Certificate).filter(
            or_(
                Certificate.certificate_number.ilike(clean_id),
                Certificate.serial_number == clean_id,
                Certificate.fingerprint_sha256.ilike(clean_id)
            )
        ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CERTIFICATE_NOT_FOUND", "message": f"Sertifikat '{identifier}' tidak ditemukan"}
        )

    now_utc = datetime.now(timezone.utc)
    is_expired = cert.expires_at <= now_utc
    is_revoked = cert.status == "REVOKED"
    is_deleted = cert.status == "DELETED"

    # Verifikasi langsung pada CRL melalui PKI Engine
    crl_check_result = "PASSED"
    try:
        crl_verify = pki_api_client.verify_certificate(cert.serial_number)
        if crl_verify.get("status") == "REVOKED":
            is_revoked = True
            crl_check_result = "REVOKED"
    except Exception:
        if is_revoked:
            crl_check_result = "REVOKED"

    is_valid = (cert.status == "ACTIVE") and (not is_expired) and (not is_revoked) and (not is_deleted)

    status_desc = "ACTIVE"
    if is_revoked:
        status_desc = "REVOKED"
    elif is_expired:
        status_desc = "EXPIRED"
    elif is_deleted:
        status_desc = "DELETED"
    elif cert.status != "ACTIVE":
        status_desc = cert.status

    return {
        "success": True,
        "data": {
            "is_valid": is_valid,
            "status": status_desc,
            "serial_number": cert.serial_number,
            "certificate_number": cert.certificate_number,
            "subject": cert.subject,
            "issuer": cert.issuer,
            "revoked_at": cert.revoked_at,
            "revocation_reason": cert.revocation_reason,
            "issued_at": cert.issued_at,
            "expires_at": cert.expires_at,
            "crl_check": crl_check_result,
            "message": "Sertifikat valid dan aktif" if is_valid else ("Sertifikat telah dicabut (revoked)" if is_revoked else f"Sertifikat tidak valid ({status_desc})")
        }
    }


@router.post("/{identifier}/revoke", response_model=dict)
def revoke_certificate(
    identifier: str,
    req: RevokeCertificateRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
) -> Dict[str, Any]:
    """
    Operasi pencabutan sertifikat (Certificate Revocation).
    Mendaftarkan nomor seri sertifikat ke CRL Intermediate CA dan memperbarui status sertifikat menjadi REVOKED.
    """
    clean_id = identifier.strip()
    cert = None
    try:
        parsed_uuid = uuid.UUID(clean_id)
        cert = db.query(Certificate).filter(Certificate.id == parsed_uuid).first()
    except ValueError:
        pass

    if not cert:
        cert = db.query(Certificate).filter(
            or_(
                Certificate.certificate_number.ilike(clean_id),
                Certificate.serial_number == clean_id,
                Certificate.fingerprint_sha256.ilike(clean_id)
            )
        ).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CERTIFICATE_NOT_FOUND", "message": f"Sertifikat '{identifier}' tidak ditemukan"}
        )

    if cert.status == "REVOKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_REVOKED", "message": "Sertifikat ini sudah dalam status dicabut (REVOKED)."}
        )

    if cert.status == "DELETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_STATE", "message": "Sertifikat yang telah dihapus tidak dapat dicabut."}
        )

    # Verifikasi kata sandi admin (wajib)
    if not req.admin_password or not req.admin_password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ADMIN_PASSWORD_REQUIRED", "message": "Kata sandi admin wajib diisi untuk mencabut sertifikat."}
        )

    if not verify_password(req.admin_password, current_user.password_hash):
        record_audit(
            db,
            actor_id=current_user.id,
            action="CERTIFICATE_REVOKED",
            target_id=cert.user_id,
            status="FAILED",
            target_type="certificate"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CREDENTIALS", "message": "Kata sandi admin salah. Verifikasi konfirmasi gagal."}
        )

    reason = (req.reason or "unspecified").strip()

    # 1. Panggil PKI Service untuk mengeksekusi openssl ca -revoke dan memperbarui CRL
    try:
        pki_api_client.revoke_certificate(cert.serial_number, reason=reason)
    except Exception as e:
        from app.core.config import BASE_DIR
        script = BASE_DIR / "pki" / "scripts" / "revoke_cert.sh"
        if script.is_file():
            import subprocess
            run_env = os.environ.copy()
            run_env["H"] = str(BASE_DIR)
            run_env["INT_DIR"] = str(BASE_DIR / "pki" / "intermediate")
            res = subprocess.run(["bash", str(script), cert.serial_number, reason], env=run_env, capture_output=True, text=True)
            if res.returncode != 0:
                record_audit(
                    db,
                    actor_id=current_user.id,
                    action="CERTIFICATE_REVOKED",
                    target_id=cert.user_id,
                    status="FAILED",
                    target_type="certificate"
                )
                raise HTTPException(
                    status_code=502,
                    detail={"code": "PKI_REVOCATION_FAILED", "message": f"Gagal mencabut sertifikat pada CA: {res.stderr}"}
                )
        else:
            record_audit(
                db,
                actor_id=current_user.id,
                action="CERTIFICATE_REVOKED",
                target_id=cert.user_id,
                status="FAILED",
                target_type="certificate"
            )
            raise HTTPException(
                status_code=502,
                detail={"code": "PKI_SERVICE_UNAVAILABLE", "message": f"Layanan PKI tidak dapat dihubungi: {str(e)}"}
            )

    # 2. Perbarui status sertifikat di database
    now = datetime.now(timezone.utc)
    cert.status = "REVOKED"
    cert.revoked_at = now
    cert.revocation_reason = reason
    cert.updated_at = now

    record_audit(
        db,
        actor_id=current_user.id,
        action="CERTIFICATE_REVOKED",
        target_id=cert.user_id,
        status="SUCCESS",
        target_type="certificate"
    )
    db.commit()

    return {
        "success": True,
        "message": f"Sertifikat {cert.certificate_number} berhasil dicabut (REVOKED)",
        "data": {
            "id": cert.id,
            "certificate_number": cert.certificate_number,
            "serial_number": cert.serial_number,
            "status": cert.status,
            "revoked_at": cert.revoked_at,
            "revocation_reason": cert.revocation_reason
        }
    }



@router.delete("/{certificate_id}", response_model=dict)
def delete_certificate(
    certificate_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
) -> Dict[str, Any]:
    """
    Operasi hapus sertifikat telah ditiadakan dan digantikan dengan Cabut Sertifikat (Revoke).
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "DEPRECATED_OPERATION",
            "message": "Operasi hapus sertifikat telah ditiadakan dan digantikan dengan Cabut Sertifikat (Revoke). Gunakan POST /api/v1/certificates/{identifier}/revoke."
        }
    )

