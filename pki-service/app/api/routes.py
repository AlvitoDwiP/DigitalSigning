from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from app.core.security import verify_internal_token
from app.schemas.pki import (
    SingleCertRequest,
    BulkCertRequest,
    RegenerateStageRequest,
    RegenerateCommitRequest,
    RegenerateCleanupRequest,
    ChangePassphraseUserRequest,
    ChangePassphraseAdminRequest,
    RevokeCertRequest,
    VerifyCertRequest
)
from app.services import pki_engine
from app.services.pki_engine import PKIEngineError

public_router = APIRouter(tags=["Public PKI Distribution"])

router = APIRouter(
    prefix="/internal/v1/pki",
    dependencies=[Depends(verify_internal_token)],
    tags=["Internal PKI Engine"]
)

@router.post("/certificates/single")
def generate_single_cert(req: SingleCertRequest):
    try:
        data = pki_engine.generate_single(
            name=req.name,
            nik=req.nik,
            email=req.email,
            organization=req.organization,
            ou=req.ou,
            pfx_password=req.pfx_password
        )
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/bulk")
def generate_bulk_certs(req: BulkCertRequest):
    try:
        raw_requests = [r.model_dump() for r in req.requests]
        data = pki_engine.generate_bulk(raw_requests)
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/regenerate/stage")
def regenerate_stage(req: RegenerateStageRequest):
    try:
        data = pki_engine.generate_staged(
            name=req.name,
            nik=req.nik,
            email=req.email,
            organization=req.organization,
            ou=req.ou,
            pfx_password=req.pfx_password
        )
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/regenerate/commit")
def regenerate_commit(req: RegenerateCommitRequest):
    try:
        success = pki_engine.commit_staged(
            staging_token=req.staging_token,
            target_user_dir=req.target_user_dir,
            target_archive_p12=req.target_archive_p12
        )
        return {"success": True, "data": {"status": "SUCCESS"}}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/regenerate/cleanup")
def regenerate_cleanup(req: RegenerateCleanupRequest):
    try:
        pki_engine.cleanup_staged(staging_token=req.staging_token)
        return {"success": True, "data": {"status": "SUCCESS"}}
    except Exception:
        # Cleanup should never fail with 500 to allow callers to gracefully continue
        return {"success": True, "data": {"status": "CLEANUP_ATTEMPTED"}}

@router.post("/passphrase/user")
def change_passphrase_user(req: ChangePassphraseUserRequest):
    try:
        pki_engine.change_p12_passphrase_user(
            nik=req.nik,
            old_password=req.old_password,
            new_password=req.new_password
        )
        return {"success": True, "data": {"status": "SUCCESS"}}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/passphrase/admin")
def change_passphrase_admin(req: ChangePassphraseAdminRequest):
    try:
        pki_engine.change_p12_passphrase_admin(
            nik=req.nik,
            new_password=req.new_password
        )
        return {"success": True, "data": {"status": "SUCCESS"}}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.delete("/materials/{nik}")
def delete_materials(nik: str):
    try:
        res = pki_engine.delete_user_pki_materials(nik=nik)
        return {"success": True, "data": res}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/revoke")
def revoke_cert(req: RevokeCertRequest):
    try:
        data = pki_engine.revoke_certificate(
            identifier=req.identifier,
            reason=req.reason or "unspecified"
        )
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/certificates/verify")
def verify_cert(req: VerifyCertRequest):
    try:
        data = pki_engine.verify_certificate(identifier=req.identifier)
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.post("/crl/generate")
def generate_crl():
    try:
        data = pki_engine.generate_crl()
        return {"success": True, "data": data}
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@router.get("/crl")
def get_internal_crl(format: str = Query("der", description="Format: der atau pem")):
    try:
        content = pki_engine.get_crl_content(format=format)
        media_type = "application/x-pem-file" if format.lower() == "pem" else "application/pkix-crl"
        filename = "intermediate-ca.crl" if format.lower() == "pem" else "intermediate-ca.crl.der"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

@public_router.get("/crl")
@public_router.get("/crl/intermediate-ca.crl")
def get_public_crl(format: str = Query("der", description="Format: der atau pem")):
    try:
        content = pki_engine.get_crl_content(format=format)
        media_type = "application/x-pem-file" if format.lower() == "pem" else "application/pkix-crl"
        filename = "intermediate-ca.crl" if format.lower() == "pem" else "intermediate-ca.crl.der"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except PKIEngineError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Unexpected error: {str(e)}"}
        )

