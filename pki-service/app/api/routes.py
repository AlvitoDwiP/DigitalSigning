from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import verify_internal_token
from app.schemas.pki import (
    SingleCertRequest,
    BulkCertRequest,
    RegenerateStageRequest,
    RegenerateCommitRequest,
    RegenerateCleanupRequest,
    ChangePassphraseUserRequest,
    ChangePassphraseAdminRequest
)
from app.services import pki_engine
from app.services.pki_engine import PKIEngineError

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
