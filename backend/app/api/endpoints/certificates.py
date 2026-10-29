import math
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api import deps
from app.models.certificate import Certificate
from app.models.user import User
from app.services.audit import record_audit
from app.schemas.certificate import PublicCertificateItem
from app.services import pki_api_client
from app.services.pki_cleanup import cleanup_local_pki_materials

router = APIRouter()

VALID_CERT_STATUSES = {"ACTIVE", "EXPIRED", "REPLACED"}


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
        "is_valid": is_valid
    }

    return {
        "success": True,
        "data": cert_data
    }


@router.delete("/{certificate_id}", response_model=dict)
def delete_certificate(
    certificate_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
) -> Dict[str, Any]:
    """
    Menghapus sertifikat dari database dan membersihkan seluruh berkas fisik terkait di backend / storage.
    """
    cert = db.query(Certificate).filter(Certificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CERTIFICATE_NOT_FOUND", "message": "Sertifikat tidak ditemukan"}
        )

    user = db.query(User).filter(User.id == cert.user_id).first()
    user_nik = user.nik if user else None

    cert_paths = []
    if cert.certificate_path:
        cert_paths.append(cert.certificate_path)
    if cert.p12_reference:
        cert_paths.append(cert.p12_reference)

    # 1. Bersihkan file fisik di sign-api/p12 dan pki/issued
    if user_nik:
        try:
            pki_api_client.delete_user_materials(user_nik)
        except Exception:
            pass
        cleanup_local_pki_materials(user_nik, cert_paths=cert_paths)
    elif cert_paths:
        cleanup_local_pki_materials("", cert_paths=cert_paths)

    # 2. Perbarui status menjadi DELETED agar tercatat di riwayat sertifikat dan audit log
    try:
        db.query(Certificate).filter(Certificate.replaced_by == certificate_id).update({"replaced_by": None}, synchronize_session=False)
        cert.status = "DELETED"
        cert.updated_at = datetime.now(timezone.utc)
        
        if user:
            record_audit(
                db,
                actor_id=current_user.id,
                action="CERTIFICATE_DELETED",
                target_id=user.id,
                status="SUCCESS",
                target_type="user"
            )
        else:
            record_audit(
                db,
                actor_id=current_user.id,
                action="CERTIFICATE_DELETED",
                target_id=certificate_id,
                status="SUCCESS",
                target_type="certificate"
            )
        db.commit()

        return {"success": True, "message": "Sertifikat berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": f"Gagal menghapus sertifikat dari database: {str(e)}"}
        )

