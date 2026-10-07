from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import verify_internal_token
from app.schemas.pki import (
    GenerateSingleRequest, 
    GenerateSingleResponse, 
    ChangeP12PassphraseRequest,
    ChangeP12PassphraseUserRequest,
    ChangeP12PassphraseAdminRequest,
    GenerateBulkRequest,
    GenerateBulkResponse,
    RegenerateStageResponse,
    RegenerateCommitRequest,
    RegenerateCleanupRequest
)
from app.services import pki_engine

router = APIRouter(dependencies=[Depends(verify_internal_token)])

@router.post("/generate", response_model=GenerateSingleResponse)
def generate_single(request: GenerateSingleRequest):
    try:
        result = pki_engine.generate_single(
            name=request.name,
            nik=request.nik,
            email=request.email,
            organization=request.organization,
            ou=request.ou,
            pfx_password=request.pfx_password
        )
        return result
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/regenerate-stage", response_model=RegenerateStageResponse)
def regenerate_stage(request: GenerateSingleRequest):
    try:
        result = pki_engine.generate_staged(
            name=request.name,
            nik=request.nik,
            email=request.email,
            organization=request.organization,
            ou=request.ou,
            pfx_password=request.pfx_password
        )
        return result
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/regenerate-commit")
def regenerate_commit(request: RegenerateCommitRequest):
    try:
        pki_engine.commit_staged(
            staging_token=request.staging_token,
            target_user_dir=request.target_user_dir,
            target_archive_p12=request.target_archive_p12
        )
        return {"success": True, "message": "Staged certificate committed"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/regenerate-cleanup")
def regenerate_cleanup(request: RegenerateCleanupRequest):
    try:
        pki_engine.cleanup_staged(staging_token=request.staging_token)
        return {"success": True, "message": "Staged certificate cleaned up"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )


@router.post("/generate-bulk", response_model=GenerateBulkResponse)
def generate_bulk(request: GenerateBulkRequest):
    try:
        results = pki_engine.generate_bulk(request.requests)
        return {"results": results}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if e.code == "INVALID_INPUT" else (
                status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/change-p12-passphrase/user")
def change_p12_passphrase_user(request: ChangeP12PassphraseUserRequest):
    try:
        pki_engine.change_p12_passphrase_user(
            nik=request.nik,
            old_password=request.old_password,
            new_password=request.new_password
        )
        return {"success": True, "message": "Passphrase P12 berhasil diubah"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if e.code in ["INVALID_INPUT", "INVALID_IDENTIFIER"] else (
                status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/change-p12-passphrase/admin")
def change_p12_passphrase_admin(request: ChangeP12PassphraseAdminRequest):
    try:
        pki_engine.change_p12_passphrase_admin(
            nik=request.nik,
            new_password=request.new_password
        )
        return {"success": True, "message": "Passphrase P12 berhasil diubah"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if e.code in ["INVALID_INPUT", "INVALID_IDENTIFIER"] else (
                status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail={"code": e.code, "message": str(e)}
        )

@router.post("/pfx-password")
def change_pfx_password(request: ChangeP12PassphraseRequest):
    try:
        pki_engine.change_p12_passphrase_admin(
            nik=request.nik,
            new_password=request.new_password
        )
        return {"success": True, "message": "Passphrase P12 berhasil diubah"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if e.code in ["INVALID_INPUT", "INVALID_IDENTIFIER"] else (
                status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail={"code": e.code, "message": str(e)}
        )

@router.delete("/user/{nik}")
def delete_user_materials(nik: str):
    try:
        return pki_engine.delete_user_pki_materials(nik)
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )
