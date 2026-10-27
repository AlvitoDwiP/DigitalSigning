from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, and_, func
import uuid
from typing import Any, Dict, Optional
import datetime
from dateutil import parser

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.schemas.user import (
    User as UserSchema,
    GenerateUserRequest,
    GenerateUserResponse,
    GenerateUserResponseData,
    ChangeUserPfxPasswordRequest,
)
from app.schemas.certificate import CertificateResponse, RegenerateCertificateRequest, RegenerateCertificateResponse
from app.services import pki_api_client
from app.services.pki_cleanup import cleanup_local_pki_materials
from app.services.bulk_user_importer import parse_and_validate_bulk_csv
from app.services.certificate_counter import allocate_certificate_number
from app.core.security import get_password_hash, verify_password
from app.core.config import settings

router = APIRouter()


from app.services.audit import record_audit as _record_audit


def _build_certificate_model(
    db: Session,
    user_id: uuid.UUID,
    cert_metadata: Dict[str, Any],
    cert_id: Optional[uuid.UUID] = None,
    status: str = "ACTIVE",
    certificate_number: Optional[str] = None,
    sequence_number: Optional[int] = None,
    issued_year: Optional[int] = None,
) -> Certificate:
    """Helper untuk memetakan metadata sertifikat PKI Engine ke model SQLAlchemy Certificate."""
    try:
        issued_at = parser.parse(cert_metadata["issued_at"])
        expires_at = parser.parse(cert_metadata["expires_at"])
    except Exception:
        issued_at = datetime.datetime.now(datetime.timezone.utc)
        expires_at = issued_at + datetime.timedelta(days=730)

    serial = cert_metadata.get("serial_number", "").strip()

    if not certificate_number or not sequence_number or not issued_year:
        certificate_number, sequence_number, issued_year = allocate_certificate_number(
            db=db,
            issued_at=issued_at,
            serial_hex=serial
        )

    return Certificate(
        id=cert_id or uuid.uuid4(),
        user_id=user_id,
        serial_number=serial,
        certificate_number=certificate_number,
        sequence_number=sequence_number,
        issued_year=issued_year,
        subject=cert_metadata.get("subject", ""),
        issuer=cert_metadata.get("issuer", "Intermediate CA"),
        fingerprint_sha256=cert_metadata.get("fingerprint_sha256", "").replace(":", ""),
        certificate_path=cert_metadata.get("certificate_path", ""),
        p12_reference=cert_metadata.get("p12_reference", ""),
        issued_at=issued_at,
        expires_at=expires_at,
        status=status
    )


@router.get("/", response_model=dict)
def get_users(
    search: Optional[str] = Query(None, description="Search across name, nik, or email"),
    role: Optional[str] = Query(None, description="Filter by role: SUPER_ADMIN, ADMIN, USER"),
    status: Optional[str] = Query(None, description="Filter by user status: ACTIVE, INACTIVE"),
    certificate_status: Optional[str] = Query(None, description="Filter by certificate status: ACTIVE, EXPIRED, REPLACED"),
    sort: Optional[str] = Query("created_at", description="Sort field: name, created_at, nearest_expiry, expires_at"),
    order: Optional[str] = Query("desc", description="Sort order: asc, desc"),
    page: Optional[int] = Query(None, ge=1, description="Page number (1-based)"),
    skip: Optional[int] = Query(0, ge=0, description="Offset (used if page is not provided)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    query = db.query(User)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(search_pattern),
                User.nik.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )

    if role:
        query = query.filter(User.role == role)

    if status:
        query = query.filter(User.status == status)

    if certificate_status:
        query = query.filter(User.certificates.any(Certificate.status == certificate_status))

    # Sorting
    is_asc = (order.lower() == "asc") if order else False
    if sort in ["nearest_expiry", "expires_at"]:
        query = query.outerjoin(
            Certificate,
            and_(Certificate.user_id == User.id, Certificate.status == "ACTIVE")
        )
        if is_asc:
            query = query.order_by(Certificate.expires_at.asc().nullslast(), User.created_at.desc())
        else:
            query = query.order_by(Certificate.expires_at.desc().nullslast(), User.created_at.desc())
    elif sort == "name":
        query = query.order_by(User.name.asc() if is_asc else User.name.desc())
    else:  # default created_at
        query = query.order_by(User.created_at.asc() if is_asc else User.created_at.desc())

    total = query.count()

    # Pagination calculation
    if page is not None:
        offset = (page - 1) * limit
        current_page = page
    else:
        offset = skip if skip is not None else 0
        current_page = (offset // limit) + 1 if limit > 0 else 1

    users = query.options(selectinload(User.certificates)).offset(offset).limit(limit).all()

    items = []
    for u in users:
        u_dict = UserSchema.model_validate(u).model_dump()
        active_cert = next((c for c in u.certificates if c.status == "ACTIVE"), None)
        u_dict["active_certificate"] = CertificateResponse.model_validate(active_cert).model_dump() if active_cert else None
        items.append(u_dict)

    return {
        "success": True,
        "data": {
            "items": items,
            "pagination": {
                "page": current_page,
                "limit": limit,
                "total": total
            }
        }
    }

@router.get("/{user_id}", response_model=dict)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    active_cert = db.query(Certificate).filter(Certificate.user_id == user_id, Certificate.status == "ACTIVE").first()
    cert_history = db.query(Certificate).filter(Certificate.user_id == user_id).order_by(Certificate.created_at.desc()).all()
    
    user_data = UserSchema.model_validate(user).model_dump()
    user_data["active_certificate"] = CertificateResponse.model_validate(active_cert).model_dump() if active_cert else None
    user_data["certificate_history"] = [CertificateResponse.model_validate(c).model_dump() for c in cert_history]
    
    return {"success": True, "data": user_data}

@router.post("/generate", response_model=GenerateUserResponse)
def generate_user(
    req: GenerateUserRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    if req.pfx_password != req.confirm_pfx_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Konfirmasi passphrase tidak cocok"})
        
    # Check Nama dan Email sama
    if req.name.strip().lower() == req.email.strip().lower():
        raise HTTPException(
            status_code=400,
            detail={"code": "NAME_EMAIL_MATCH", "message": "Nama pengguna dan email tidak boleh sama"}
        )

    # Pre-validation Database checking
    existing_name = db.query(User).filter(func.lower(User.name) == func.lower(req.name.strip())).first()
    if existing_name:
        raise HTTPException(status_code=409, detail={"code": "INVALID_NAME", "message": "Nama pengguna sudah terdaftar"})

    existing_nik = db.query(User).filter(User.nik == req.nik.strip()).first()
    if existing_nik:
        raise HTTPException(status_code=409, detail={"code": "INVALID_NIK", "message": "NIK already exists"})
        
    existing_email = db.query(User).filter(func.lower(User.email) == func.lower(req.email.strip())).first()
    if existing_email:
        raise HTTPException(status_code=409, detail={"code": "INVALID_EMAIL", "message": "Email already exists"})
        
    # 1. Call PKI Service
    pki_req = {
        "name": req.name,
        "nik": req.nik,
        "email": req.email,
        "organization": req.organization,
        "ou": req.ou,
        "pfx_password": req.pfx_password
    }
    
    pki_res = pki_api_client.generate_single(pki_req)
    cert_metadata = pki_res
    
    # 2. Database Transaction
    try:
        user_id = uuid.uuid4()
        cert_id = uuid.uuid4()
        
        raw_password = req.password or getattr(settings, "DEFAULT_USER_PASS", "Konstitusi100%")
        new_user = User(
            id=user_id,
            name=req.name,
            nik=req.nik,
            email=req.email,
            organization=req.organization,
            ou=req.ou,
            password_hash=get_password_hash(raw_password),
            role="USER",
            status="ACTIVE"
        )
        db.add(new_user)
        
        new_cert = _build_certificate_model(db=db, user_id=user_id, cert_metadata=cert_metadata, cert_id=cert_id)
        db.add(new_cert)
        
        _record_audit(db, current_user.id, "USER_CREATED", user_id, "SUCCESS")
        _record_audit(db, current_user.id, "CERTIFICATE_GENERATED", user_id, "SUCCESS")
        
        db.commit()
        db.refresh(new_user)
        db.refresh(new_cert)
        
        return GenerateUserResponse(
            success=True,
            data=GenerateUserResponseData(
                user=UserSchema.model_validate(new_user),
                certificate=CertificateResponse.model_validate(new_cert).model_dump()
            )
        )
    except Exception as e:
        db.rollback()
        # Cleanup PKI materials if DB fails
        try:
            pki_api_client.delete_user_materials(req.nik)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Database transaction failed"})

@router.post("/generate-bulk/validate", response_model=dict)
async def validate_bulk_csv(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_ENCODING", "message": "File must be valid UTF-8 text"})
        
    validation_res = parse_and_validate_bulk_csv(content_str, db)
    
    # Format rows for safe preview (exclude passwords/secrets)
    preview_rows = []
    for r in validation_res["rows"]:
        if r["valid"]:
            d = r["data"]
            preview_rows.append({
                "row": r["row"],
                "nik": r["nik"],
                "name": d["name"],
                "email": d["email"],
                "organization": d["organization"],
                "ou": d["ou"],
                "valid": True
            })
        else:
            preview_rows.append({
                "row": r["row"],
                "nik": r["nik"],
                "valid": False,
                "errors": r["errors"]
            })
            
    return {
        "success": True,
        "data": {
            "total": validation_res["total"],
            "valid": validation_res["valid"],
            "invalid": validation_res["invalid"],
            "rows": preview_rows
        }
    }

@router.post("/generate-bulk", response_model=dict)
async def generate_bulk_users(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_ENCODING", "message": "File must be valid UTF-8 text"})
        
    validation_res = parse_and_validate_bulk_csv(content_str, db)
    
    results = []
    valid_pki_requests = []
    password_hashes = {}  # nik -> password_hash
    row_mapping = {}      # nik -> row_dict
    
    for r in validation_res["rows"]:
        if not r["valid"]:
            results.append({
                "row": r["row"],
                "nik": r["nik"] if r["nik"] else "unknown",
                "status": "FAILED",
                "error": "; ".join(r["errors"])
            })
        else:
            d = r["data"]
            nik = d["nik"]
            row_mapping[nik] = r
            password_hashes[nik] = get_password_hash(d["password"])
            valid_pki_requests.append({
                "name": d["name"],
                "nik": nik,
                "email": d["email"],
                "organization": d["organization"],
                "ou": d["ou"],
                "pfx_password": d["pfx_pass"]
            })
            
    pki_results_by_nik = {}
    if valid_pki_requests:
        try:
            pki_res = pki_api_client.generate_bulk(valid_pki_requests)
            for res_item in pki_res.get("results", []):
                pki_results_by_nik[res_item["nik"]] = res_item
        except Exception as exc:
            for req in valid_pki_requests:
                nik = req["nik"]
                orig_row = row_mapping[nik]
                results.append({
                    "row": orig_row["row"],
                    "nik": nik,
                    "status": "FAILED",
                    "error": "PKI service invocation failed"
                })
            results.sort(key=lambda x: x["row"])
            return {
                "success": True,
                "data": {
                    "total": validation_res["total"],
                    "success": 0,
                    "failed": len(results),
                    "results": results
                }
            }
            
    for req in valid_pki_requests:
        nik = req["nik"]
        orig_row = row_mapping[nik]
        pki_item = pki_results_by_nik.get(nik)
        
        if not pki_item or pki_item.get("status") != "SUCCESS":
            err_msg = pki_item.get("error", "PKI generation failed") if pki_item else "PKI generation failed"
            results.append({
                "row": orig_row["row"],
                "nik": nik,
                "status": "FAILED",
                "error": err_msg
            })
            continue
            
        cert_metadata = pki_item.get("metadata", {})
        d = orig_row["data"]
        
        try:
            user_id = uuid.uuid4()
            cert_id = uuid.uuid4()
            
            new_user = User(
                id=user_id,
                name=d["name"],
                nik=nik,
                email=d["email"],
                organization=d["organization"],
                ou=d["ou"],
                password_hash=password_hashes[nik],
                role="USER",
                status="ACTIVE"
            )
            db.add(new_user)
            
            new_cert = _build_certificate_model(db=db, user_id=user_id, cert_metadata=cert_metadata, cert_id=cert_id)
            db.add(new_cert)
            
            _record_audit(db, current_user.id, "USER_CREATED", user_id, "SUCCESS")
            _record_audit(db, current_user.id, "CERTIFICATE_GENERATED", user_id, "SUCCESS")
            
            db.commit()
            
            results.append({
                "row": orig_row["row"],
                "nik": nik,
                "status": "SUCCESS"
            })
        except Exception:
            db.rollback()
            try:
                pki_api_client.delete_user_materials(nik)
            except Exception:
                pass
            results.append({
                "row": orig_row["row"],
                "nik": nik,
                "status": "FAILED",
                "error": "Database persistence failed"
            })
            
    results.sort(key=lambda x: x["row"])
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    
    return {
        "success": True,
        "data": {
            "total": validation_res["total"],
            "success": success_count,
            "failed": failed_count,
            "results": results
        }
    }

@router.post("/{user_id}/pfx-password", response_model=dict)
def change_user_pfx_password(
    user_id: uuid.UUID,
    req: ChangeUserPfxPasswordRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role == "USER" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Tidak memiliki akses untuk mengubah password user lain"})
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "User not found"})
        
    active_cert = db.query(Certificate).filter(Certificate.user_id == user_id, Certificate.status == "ACTIVE").first()
    if not active_cert:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "User does not have an active certificate"})
        
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Konfirmasi password tidak cocok"})
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password baru minimal 8 karakter"})
        
    if current_user.role == "USER":
        if not req.old_password:
            raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password lama wajib diisi"})
        if req.old_password == req.new_password:
            raise HTTPException(status_code=400, detail={"code": "INVALID_INPUT", "message": "Password baru tidak boleh sama dengan password lama"})
            
        try:
            pki_api_client.change_p12_passphrase_user(
                nik=target_user.nik,
                old_password=req.old_password,
                new_password=req.new_password
            )
        except Exception:
            _record_audit(db, current_user.id, "PFX_PASSWORD_CHANGED", target_user.id, "FAILED", commit=True)
            raise
    else:
        # ADMIN / SUPER_ADMIN
        try:
            pki_api_client.change_p12_passphrase_admin(
                nik=target_user.nik,
                new_password=req.new_password
            )
        except Exception:
            _record_audit(db, current_user.id, "PFX_PASSWORD_CHANGED", target_user.id, "FAILED", commit=True)
            raise
            
    _record_audit(db, current_user.id, "PFX_PASSWORD_CHANGED", target_user.id, "SUCCESS", commit=True)
    
    return {"success": True, "message": "Passphrase berhasil diubah"}

@router.delete("/{user_id}", response_model=dict)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Kumpulkan seluruh path sertifikat sebelum data dihapus dari database
    user_certs = db.query(Certificate).filter(Certificate.user_id == user_id).all()
    cert_paths = [c.certificate_path for c in user_certs if c.certificate_path] + [c.p12_reference for c in user_certs if c.p12_reference]

    # 1. Panggil PKI service internal jika tersedia
    try:
        pki_api_client.delete_user_materials(user.nik)
    except Exception:
        # Jika pki_service tidak berjalan (misal pada host local dev), cleanup lokal akan menangani
        pass

    # 2. Pembersihan file fisik lokal (fail-safe cleanup untuk pki/issued dan sign-api/p12)
    cleanup_local_pki_materials(user.nik, cert_paths=cert_paths)

    try:
        # Putus dependensi hierarki referensi sebelum delete
        cert_ids = [c.id for c in user_certs]
        if cert_ids:
            db.query(Certificate).filter(Certificate.replaced_by.in_(cert_ids)).update({"replaced_by": None}, synchronize_session=False)
        db.query(Certificate).filter(Certificate.user_id == user_id).delete(synchronize_session=False)
        db.delete(user)
        _record_audit(db, current_user.id, "USER_DELETED", user_id, "SUCCESS", commit=True)
        return {"success": True, "message": "User berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": f"Failed to delete user metadata from DB: {str(e)}"})

@router.delete("/{user_id}/certificates/{certificate_id}", response_model=dict)
def delete_user_certificate(
    user_id: uuid.UUID,
    certificate_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cert = db.query(Certificate).filter(Certificate.id == certificate_id, Certificate.user_id == user_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found for this user")

    cert_paths = []
    if cert.certificate_path:
        cert_paths.append(cert.certificate_path)
    if cert.p12_reference:
        cert_paths.append(cert.p12_reference)

    # 1. Bersihkan file fisik di sign-api/p12 dan pki/issued
    try:
        pki_api_client.delete_user_materials(user.nik)
    except Exception:
        pass
    cleanup_local_pki_materials(user.nik, cert_paths=cert_paths)

    # 2. Hapus data sertifikat dari database
    try:
        db.query(Certificate).filter(Certificate.replaced_by == certificate_id).update({"replaced_by": None}, synchronize_session=False)
        db.delete(cert)
        db.commit()
        _record_audit(db, current_user.id, "CERTIFICATE_DELETED", certificate_id, "SUCCESS", target_type="certificate", commit=True)
        return {"success": True, "message": "Sertifikat berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": f"Failed to delete certificate: {str(e)}"})

@router.get("/{user_id}/certificates", response_model=dict)
def get_user_certificates(
    user_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    certs = db.query(Certificate).filter(Certificate.user_id == user_id).all()
    return {"success": True, "data": [CertificateResponse.model_validate(c).model_dump() for c in certs]}

@router.post("/{user_id}/certificates/regenerate", response_model=RegenerateCertificateResponse)
def regenerate_user_certificate(
    user_id: uuid.UUID,
    req: Optional[RegenerateCertificateRequest] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["SUPER_ADMIN", "ADMIN", "USER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted"
        )

    # Validasi hak akses: Pengguna biasa (USER) hanya dapat me-regenerate sertifikat miliknya sendiri
    if current_user.role == "USER" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Pengguna hanya dapat meregenerasi sertifikat miliknya sendiri"}
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found"}
        )

    active_cert = db.query(Certificate).filter(
        Certificate.user_id == user_id,
        Certificate.status.in_(["ACTIVE", "EXPIRED"])
    ).order_by(Certificate.created_at.desc()).first()
    if not active_cert:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_ACTIVE_CERTIFICATE", "message": "User tidak memiliki sertifikat aktif atau kedaluwarsa untuk di-regenerate"}
        )

    # Verifikasi Password:
    # Jika ADMIN / SUPER_ADMIN: verifikasi password admin yang login
    # Jika USER: verifikasi password akun pengguna yang login
    input_pwd = None
    if req:
        input_pwd = req.password or req.admin_password

    if not input_pwd or not input_pwd.strip():
        pwd_msg = "Password akun Anda wajib diisi untuk verifikasi konfirmasi" if current_user.role == "USER" else "Password akun Admin wajib diisi untuk verifikasi"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": pwd_msg}
        )

    if not verify_password(input_pwd, current_user.password_hash):
        _record_audit(db, current_user.id, "CERTIFICATE_REGENERATED", user.id, "FAILED", commit=True)
        err_msg = "Password akun salah. Verifikasi gagal." if current_user.role == "USER" else "Password admin salah. Verifikasi gagal."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CREDENTIALS", "message": err_msg}
        )

    pfx_pass = settings.DEFAULT_PFX_PASS
    if req:
        if req.pfx_password:
            if req.confirm_pfx_password is not None and req.pfx_password != req.confirm_pfx_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_INPUT", "message": "Konfirmasi passphrase tidak cocok"}
                )
            pfx_pass = req.pfx_password

    pki_payload = {
        "name": user.name,
        "nik": user.nik,
        "email": user.email,
        "organization": user.organization,
        "ou": user.ou,
        "pfx_password": pfx_pass
    }

    staging_token = None
    target_user_dir = None
    target_archive_p12 = None

    try:
        stage_res = pki_api_client.regenerate_stage(pki_payload)
        staging_token = stage_res.get("staging_token")
        target_user_dir = stage_res.get("target_user_dir")
        target_archive_p12 = stage_res.get("target_archive_p12")
        cert_metadata = stage_res.get("metadata", {})
    except Exception as e:
        _record_audit(db, current_user.id, "CERTIFICATE_REGENERATED", user.id, "FAILED", commit=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "PKI_GENERATION_FAILED", "message": f"PKI Certificate generation failed: {str(e)}"}
        )

    required_keys = ["serial_number", "subject", "issuer", "fingerprint_sha256", "certificate_path", "p12_reference", "issued_at", "expires_at"]
    for k in required_keys:
        if not cert_metadata.get(k):
            if staging_token:
                try:
                    pki_api_client.regenerate_cleanup(staging_token)
                except Exception:
                    pass
            _record_audit(db, current_user.id, "CERTIFICATE_REGENERATED", user.id, "FAILED", commit=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "INVALID_CERTIFICATE_METADATA", "message": f"Missing required certificate metadata: {k}"}
            )

    new_cert_id = uuid.uuid4()
    old_cert_id = active_cert.id
    try:
        active_cert.status = "REPLACED"
        active_cert.updated_at = datetime.datetime.now(datetime.timezone.utc)

        new_cert = _build_certificate_model(
            db=db,
            user_id=user.id,
            cert_metadata=cert_metadata,
            cert_id=new_cert_id
        )
        db.add(new_cert)
        db.flush()

        active_cert.replaced_by = new_cert_id

        _record_audit(db, current_user.id, "CERTIFICATE_REGENERATED", user.id, "SUCCESS")
        db.commit()
        db.refresh(new_cert)

        # Commit staged artifacts to active directory
        if staging_token and target_user_dir and target_archive_p12:
            try:
                pki_api_client.regenerate_commit(staging_token, target_user_dir, target_archive_p12)
            except Exception:
                pass

        return {
            "success": True,
            "data": {
                "old_certificate_id": old_cert_id,
                "new_certificate": {
                    "id": new_cert.id,
                    "serial_number": new_cert.serial_number,
                    "certificate_number": new_cert.certificate_number,
                    "issued_at": new_cert.issued_at,
                    "expires_at": new_cert.expires_at,
                    "status": new_cert.status
                }
            }
        }
    except Exception as e:
        db.rollback()
        if staging_token:
            try:
                pki_api_client.regenerate_cleanup(staging_token)
            except Exception:
                pass
        try:
            _record_audit(db, current_user.id, "CERTIFICATE_REGENERATED", user.id, "FAILED", commit=True)
        except Exception:
            db.rollback()
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DATABASE_TRANSACTION_FAILED", "message": f"Failed to persist regenerated certificate: {str(e)}"}
        )


