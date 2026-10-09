from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, asc, desc
from sqlalchemy.exc import IntegrityError
import uuid
from typing import List, Any, Dict, Optional
import datetime
import dateutil.parser
import csv
import io
import re
from pydantic import BaseModel

from app.api import deps
from app.models.user import User
from app.models.certificate import Certificate
from app.models.audit_log import AuditLog
from app.schemas.user import User as UserSchema, GenerateUserRequest, GenerateUserResponse, GenerateUserResponseData
from app.schemas.certificate import CertificateResponse, RegenerateCertificateRequest, RegenerateCertificateResponse
from app.services.pki_client import pki_client
from app.core.security import get_password_hash

router = APIRouter()

CSV_EXPECTED_HEADERS = ["name", "nik", "email", "organization", "ou", "password", "pfx_pass"]

class ChangeUserPfxPasswordRequest(BaseModel):
    new_password: str
    confirm_password: str
    old_password: Optional[str] = None

def validate_password_policy(pwd: str) -> List[str]:
    errors = []
    if len(pwd) < 8:
        errors.append("Password must be at least 8 characters")
    if not re.search(r'[A-Z]', pwd):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r'[^a-zA-Z0-9]', pwd):
        errors.append("Password must contain at least one non-alphanumeric character")
    return errors

def parse_and_validate_bulk_csv(content: str, db: Session) -> Dict[str, Any]:
    # Strip potential UTF-8 BOM
    if content.startswith('\ufeff'):
        content = content[1:]
        
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CSV", "message": "CSV file is empty"}
        )
        
    # Validate Header
    header = [h.strip() for h in rows[0]]
    if header != CSV_EXPECTED_HEADERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CSV_HEADER", "message": f"CSV header must be: {','.join(CSV_EXPECTED_HEADERS)}"}
        )
        
    data_rows = rows[1:]
    if not data_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_CSV_DATA", "message": "CSV contains no data rows"}
        )
        
    parsed_rows = []
    seen_niks = set()
    seen_emails = set()
    
    row_idx = 0
    for r in data_rows:
        # Skip completely blank lines
        if not r or (len(r) == 1 and not r[0].strip()):
            continue
            
        row_idx += 1
        errors = []
        
        if len(r) != 7:
            errors.append(f"Expected 7 columns, got {len(r)}")
            parsed_rows.append({
                "row": row_idx,
                "nik": r[1].strip() if len(r) > 1 else "",
                "valid": False,
                "errors": errors,
                "data": None
            })
            continue
            
        name, nik, email, org, ou, password, pfx_pass = [col.strip() for col in r]
        
        # Check forbidden characters (\t, \r, \n)
        for field_name, field_val in [
            ("name", name), ("nik", nik), ("email", email), 
            ("organization", org), ("ou", ou), ("password", password), 
            ("pfx_pass", pfx_pass)
        ]:
            if "\t" in field_val or "\r" in field_val or "\n" in field_val:
                errors.append(f"Field '{field_name}' contains forbidden tab or newline characters")
                
        # Required fields
        if not name:
            errors.append("Field 'name' is required")
        if not nik:
            errors.append("Field 'nik' is required")
        if not email:
            errors.append("Field 'email' is required")
        if not org:
            errors.append("Field 'organization' is required")
        if not ou:
            errors.append("Field 'ou' is required")
        if not password:
            errors.append("Field 'password' is required")
        if not pfx_pass:
            errors.append("Field 'pfx_pass' is required")
            
        # NIK format
        if nik and not re.match(r"^[0-9]{16}$", nik):
            errors.append("NIK must be exactly 16 digits")
            
        # Email format
        if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            errors.append("Invalid email format")
            
        # Password policy
        if password:
            pwd_errs = validate_password_policy(password)
            errors.extend(pwd_errs)
            
        # Duplicate check in CSV
        if nik:
            if nik in seen_niks:
                errors.append("Duplicate NIK in CSV")
            else:
                seen_niks.add(nik)
                
        if email:
            email_lower = email.lower()
            if email_lower in seen_emails:
                errors.append("Duplicate email in CSV")
            else:
                seen_emails.add(email_lower)
                
        # Duplicate check in DB
        if nik and not any("NIK" in e for e in errors):
            existing_user_nik = db.query(User).filter(User.nik == nik).first()
            if existing_user_nik:
                errors.append("NIK already exists in database")
                
        if email and not any("email" in e for e in errors):
            existing_user_email = db.query(User).filter(User.email == email).first()
            if existing_user_email:
                errors.append("Email already exists in database")
                
        is_valid = len(errors) == 0
        parsed_rows.append({
            "row": row_idx,
            "nik": nik,
            "valid": is_valid,
            "errors": errors if not is_valid else [],
            "data": {
                "name": name,
                "nik": nik,
                "email": email,
                "organization": org,
                "ou": ou,
                "password": password,
                "pfx_pass": pfx_pass
            } if is_valid else None
        })
        
    return {
        "total": len(parsed_rows),
        "valid": sum(1 for r in parsed_rows if r["valid"]),
        "invalid": sum(1 for r in parsed_rows if not r["valid"]),
        "rows": parsed_rows
    }

@router.get("/", response_model=dict)
def get_users(
    search: Optional[str] = Query(None, description="Search across name, nik, or email"),
    role: Optional[str] = Query(None, description="Filter by role: SUPER_ADMIN, ADMIN, USER"),
    status: Optional[str] = Query(None, description="Filter by user status: ACTIVE, INACTIVE"),
    certificate_status: Optional[str] = Query(None, description="Filter by certificate status: ACTIVE, EXPIRED, REPLACED, REVOKED"),
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
        query = query.join(Certificate, Certificate.user_id == User.id).filter(
            Certificate.status == certificate_status
        ).distinct()

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

    users = query.offset(offset).limit(limit).all()

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
    cert_history = db.query(Certificate).filter(Certificate.user_id == user_id).all()
    
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
        
    # Pre-validation Database checking
    existing_nik = db.query(User).filter(User.nik == req.nik).first()
    if existing_nik:
        raise HTTPException(status_code=409, detail={"code": "INVALID_NIK", "message": "NIK already exists"})
        
    existing_email = db.query(User).filter(User.email == req.email).first()
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
    
    pki_res = pki_client.generate_single(pki_req)
    cert_metadata = pki_res
    
    # 2. Database Transaction
    try:
        user_id = uuid.uuid4()
        cert_id = uuid.uuid4()
        
        new_user = User(
            id=user_id,
            name=req.name,
            nik=req.nik,
            email=req.email,
            organization=req.organization,
            ou=req.ou,
            password_hash=get_password_hash(req.password),
            role="USER",
            status="ACTIVE"
        )
        db.add(new_user)
        
        issued_at = dateutil.parser.parse(cert_metadata["issued_at"])
        expires_at = dateutil.parser.parse(cert_metadata["expires_at"])
        
        new_cert = Certificate(
            id=cert_id,
            user_id=user_id,
            serial_number=cert_metadata["serial_number"],
            subject=cert_metadata["subject"],
            issuer=cert_metadata["issuer"],
            fingerprint_sha256=cert_metadata["fingerprint_sha256"].replace(":", ""),
            certificate_path=cert_metadata["certificate_path"],
            p12_reference=cert_metadata["p12_reference"],
            issued_at=issued_at,
            expires_at=expires_at,
            status="ACTIVE"
        )
        db.add(new_cert)
        
        # Audit
        audit_user = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="USER_CREATED",
            target_type="user",
            target_id=user_id,
            status="SUCCESS"
        )
        db.add(audit_user)

        audit_cert = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="CERTIFICATE_GENERATED",
            target_type="certificate",
            target_id=cert_id,
            status="SUCCESS"
        )
        db.add(audit_cert)
        
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
            pki_client.delete_user_materials(req.nik)
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
            pki_res = pki_client.generate_bulk(valid_pki_requests)
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
            
            issued_at = dateutil.parser.parse(cert_metadata["issued_at"])
            expires_at = dateutil.parser.parse(cert_metadata["expires_at"])
            
            new_cert = Certificate(
                id=cert_id,
                user_id=user_id,
                serial_number=cert_metadata.get("serial_number", ""),
                subject=cert_metadata.get("subject", ""),
                issuer=cert_metadata.get("issuer", "Intermediate CA"),
                fingerprint_sha256=cert_metadata.get("fingerprint_sha256", "").replace(":", ""),
                certificate_path=cert_metadata.get("certificate_path", ""),
                p12_reference=cert_metadata.get("p12_reference", ""),
                issued_at=issued_at,
                expires_at=expires_at,
                status="ACTIVE"
            )
            db.add(new_cert)
            
            audit_user = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="USER_CREATED",
                target_type="user",
                target_id=user_id,
                status="SUCCESS"
            )
            db.add(audit_user)

            audit_cert = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="CERTIFICATE_GENERATED",
                target_type="certificate",
                target_id=cert_id,
                status="SUCCESS"
            )
            db.add(audit_cert)
            
            db.commit()
            
            results.append({
                "row": orig_row["row"],
                "nik": nik,
                "status": "SUCCESS"
            })
        except Exception:
            db.rollback()
            try:
                pki_client.delete_user_materials(nik)
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
            pki_client.change_p12_passphrase_user(
                nik=target_user.nik,
                old_password=req.old_password,
                new_password=req.new_password
            )
        except Exception:
            audit = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="PFX_PASSWORD_CHANGED",
                target_type="user",
                target_id=target_user.id,
                status="FAILED"
            )
            db.add(audit)
            db.commit()
            raise
    else:
        # ADMIN / SUPER_ADMIN
        try:
            pki_client.change_p12_passphrase_admin(
                nik=target_user.nik,
                new_password=req.new_password
            )
        except Exception:
            audit = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="PFX_PASSWORD_CHANGED",
                target_type="user",
                target_id=target_user.id,
                status="FAILED"
            )
            db.add(audit)
            db.commit()
            raise
            
    audit = AuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        action="PFX_PASSWORD_CHANGED",
        target_type="user",
        target_id=target_user.id,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()
    
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
        
    try:
        pki_client.delete_user_materials(user.nik)
    except Exception as e:
        audit_fail = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="USER_DELETED",
            target_type="user",
            target_id=user_id,
            status="FAILED"
        )
        db.add(audit_fail)
        db.commit()
        raise HTTPException(
            status_code=500, 
            detail={"code": "PKI_CLEANUP_FAILED", "message": "Failed to cleanup PKI materials, user not deleted"}
        )

    try:
        db.query(Certificate).filter(Certificate.user_id == user_id).delete()
        db.delete(user)
        
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="USER_DELETED",
            target_type="user",
            target_id=user_id,
            status="SUCCESS"
        )
        db.add(audit)
        db.commit()
        return {"success": True, "message": "User berhasil dihapus"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Failed to delete user metadata from DB"})

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
    current_user: User = Depends(deps.require_roles(["SUPER_ADMIN", "ADMIN"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found"}
        )

    active_cert = db.query(Certificate).filter(
        Certificate.user_id == user_id,
        Certificate.status == "ACTIVE"
    ).first()
    if not active_cert:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_ACTIVE_CERTIFICATE", "message": "User tidak memiliki sertifikat aktif untuk di-regenerate"}
        )

    pfx_pass = "Mkri006!"
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
        stage_res = pki_client.regenerate_stage(pki_payload)
        staging_token = stage_res.get("staging_token")
        target_user_dir = stage_res.get("target_user_dir")
        target_archive_p12 = stage_res.get("target_archive_p12")
        cert_metadata = stage_res.get("metadata", {})
    except Exception as e:
        audit_fail = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="CERTIFICATE_REGENERATED",
            target_type="certificate",
            target_id=active_cert.id,
            status="FAILED"
        )
        db.add(audit_fail)
        db.commit()
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
                    pki_client.regenerate_cleanup(staging_token)
                except Exception:
                    pass
            audit_fail = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="CERTIFICATE_REGENERATED",
                target_type="certificate",
                target_id=active_cert.id,
                status="FAILED"
            )
            db.add(audit_fail)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "INVALID_CERTIFICATE_METADATA", "message": f"Missing required certificate metadata: {k}"}
            )

    try:
        issued_at = dateutil.parser.parse(cert_metadata["issued_at"])
        expires_at = dateutil.parser.parse(cert_metadata["expires_at"])
    except Exception:
        issued_at = datetime.datetime.now(datetime.timezone.utc)
        expires_at = issued_at + datetime.timedelta(days=730)

    new_cert_id = uuid.uuid4()
    old_cert_id = active_cert.id
    try:
        active_cert.status = "REPLACED"
        active_cert.updated_at = datetime.datetime.now(datetime.timezone.utc)

        new_cert = Certificate(
            id=new_cert_id,
            user_id=user.id,
            serial_number=cert_metadata["serial_number"],
            subject=cert_metadata["subject"],
            issuer=cert_metadata["issuer"],
            fingerprint_sha256=cert_metadata["fingerprint_sha256"].replace(":", ""),
            certificate_path=cert_metadata["certificate_path"],
            p12_reference=cert_metadata["p12_reference"],
            issued_at=issued_at,
            expires_at=expires_at,
            status="ACTIVE"
        )
        db.add(new_cert)
        db.flush()

        active_cert.replaced_by = new_cert_id

        audit_success = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            action="CERTIFICATE_REGENERATED",
            target_type="certificate",
            target_id=new_cert_id,
            status="SUCCESS"
        )
        db.add(audit_success)

        db.commit()
        db.refresh(new_cert)

        # Commit staged artifacts to active directory
        if staging_token and target_user_dir and target_archive_p12:
            try:
                pki_client.regenerate_commit(staging_token, target_user_dir, target_archive_p12)
            except Exception:
                pass

        return {
            "success": True,
            "data": {
                "old_certificate_id": old_cert_id,
                "new_certificate": {
                    "id": new_cert.id,
                    "serial_number": new_cert.serial_number,
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
                pki_client.regenerate_cleanup(staging_token)
            except Exception:
                pass
        try:
            audit_fail = AuditLog(
                id=uuid.uuid4(),
                user_id=current_user.id,
                action="CERTIFICATE_REGENERATED",
                target_type="certificate",
                target_id=active_cert.id,
                status="FAILED"
            )
            db.add(audit_fail)
            db.commit()
        except Exception:
            db.rollback()
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DATABASE_TRANSACTION_FAILED", "message": f"Failed to persist regenerated certificate: {str(e)}"}
        )


