import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class PKISettings(BaseSettings):
    PROJECT_NAME: str = "Digital Signature Platform - PKI Service Adapter"
    VERSION: str = "1.0.0"
    PORT: int = int(os.getenv("PKI_SERVICE_PORT", "8001"))
    
    PKI_SERVICE_TOKEN: str = os.getenv("PKI_SERVICE_TOKEN", "dev-pki-service-token-2026")
    PKI_ENGINE_DIR: str = os.getenv("PKI_ENGINE_DIR", str(BASE_DIR / "pki" / "scripts"))
    
    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        extra = "ignore"

pki_settings = PKISettings()
