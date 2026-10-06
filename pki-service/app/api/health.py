from fastapi import APIRouter
from app.core.config import pki_settings

router = APIRouter()

@router.get("/health", summary="PKI Service Health Check")
def pki_health():
    return {
        "status": "ok",
        "service": pki_settings.PROJECT_NAME,
        "version": pki_settings.VERSION,
        "pki_engine_dir": pki_settings.PKI_ENGINE_DIR
    }
