from typing import Dict, Any, List
from fastapi import HTTPException, status
from app.services import pki_engine

class PKIServiceClient:
    """
    Direct in-process PKI Service Adapter (Monolithic implementation).
    Delegates calls directly to pki_engine using subprocess/OpenSSL scripts,
    removing microservice network overhead.
    """

    def generate_single(self, data: dict) -> Dict[str, Any]:
        try:
            return pki_engine.generate_single(
                name=data["name"],
                nik=data["nik"],
                email=data["email"],
                organization=data["organization"],
                ou=data["ou"],
                pfx_password=data["pfx_password"]
            )
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_502_BAD_GATEWAY
                if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"]
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def generate_bulk(self, requests: List[dict]) -> Dict[str, Any]:
        try:
            results = pki_engine.generate_bulk(requests)
            return {"results": results}
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if e.code == "INVALID_INPUT"
                else (
                    status.HTTP_502_BAD_GATEWAY
                    if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"]
                    else status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def change_p12_passphrase_user(self, nik: str, old_password: str, new_password: str) -> Dict[str, Any]:
        try:
            pki_engine.change_p12_passphrase_user(nik, old_password, new_password)
            return {"success": True, "message": "P12 passphrase updated successfully"}
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if e.code in ["INVALID_IDENTIFIER", "INVALID_INPUT"]
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def change_p12_passphrase_admin(self, nik: str, new_password: str) -> Dict[str, Any]:
        try:
            pki_engine.change_p12_passphrase_admin(nik, new_password)
            return {"success": True, "message": "P12 passphrase updated successfully by admin"}
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if e.code in ["INVALID_IDENTIFIER", "INVALID_INPUT"]
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def delete_user_materials(self, nik: str) -> Dict[str, Any]:
        try:
            return pki_engine.delete_user_pki_materials(nik)
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if e.code == "INVALID_IDENTIFIER"
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def regenerate_stage(self, data: dict) -> Dict[str, Any]:
        try:
            return pki_engine.generate_staged(
                name=data["name"],
                nik=data["nik"],
                email=data["email"],
                organization=data["organization"],
                ou=data["ou"],
                pfx_password=data["pfx_password"]
            )
        except pki_engine.PKIEngineError as e:
            status_code = (
                status.HTTP_502_BAD_GATEWAY
                if e.code in ["PKI_GENERATION_FAILED", "PKI_ENGINE_ERROR"]
                else status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            raise HTTPException(status_code=status_code, detail={"code": e.code, "message": str(e)})

    def regenerate_commit(self, staging_token: str, target_user_dir: str, target_archive_p12: str) -> Dict[str, Any]:
        try:
            pki_engine.commit_staged(
                staging_token=staging_token,
                target_user_dir=target_user_dir,
                target_archive_p12=target_archive_p12
            )
            return {"success": True, "message": "Staged certificate committed"}
        except pki_engine.PKIEngineError as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"code": e.code, "message": str(e)})

    def regenerate_cleanup(self, staging_token: str) -> Dict[str, Any]:
        try:
            pki_engine.cleanup_staged(staging_token=staging_token)
            return {"success": True, "message": "Staged certificate cleaned up"}
        except pki_engine.PKIEngineError as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"code": e.code, "message": str(e)})

pki_client = PKIServiceClient()
