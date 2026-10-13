import os
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

INSECURE_DEV_TOKENS = {
    "dev-pki-service-token-2026",
    "secret",
    "changeme",
}

class PKISettings(BaseSettings):
    PROJECT_NAME: str = "Digital Signature Platform - PKI Service Adapter"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PKI_SERVICE_PORT", "8001"))
    
    PKI_SERVICE_TOKEN: str = os.getenv("PKI_SERVICE_TOKEN", "dev-pki-service-token-2026")
    PKI_ENGINE_DIR: str = os.getenv("PKI_ENGINE_DIR", str(BASE_DIR / "pki" / "scripts"))

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() == "production":
            if self.PKI_SERVICE_TOKEN in INSECURE_DEV_TOKENS or len(self.PKI_SERVICE_TOKEN) < 16:
                raise ValueError(
                    "Production environment requires a strong and non-default PKI_SERVICE_TOKEN (at least 16 characters)."
                )
        return self

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        extra = "ignore"

pki_settings = PKISettings()

