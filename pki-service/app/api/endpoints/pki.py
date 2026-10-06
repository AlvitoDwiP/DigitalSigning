from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import verify_internal_token
from app.schemas.pki import GenerateSingleRequest, GenerateSingleResponse, ChangeP12PassphraseRequest
from app.services import pki_engine

router = APIRouter(dependencies=[Depends(verify_internal_token)])

@router.post("/generate", response_model=GenerateSingleResponse)
def generate_single(request: GenerateSingleRequest):
    """
    Generate single user certificate and PKI materials.
    """
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

@router.post("/pfx-password")
def change_pfx_password(request: ChangeP12PassphraseRequest):
    """
    Change P12/PFX passphrase.
    """
    try:
        pki_engine.change_p12_passphrase(
            nik=request.nik,
            new_password=request.new_password
        )
        return {"success": True, "message": "PFX password changed successfully"}
    except pki_engine.PKIEngineError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"] else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": e.code, "message": str(e)}
        )
