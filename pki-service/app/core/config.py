import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import model_validator

# Base dir of pki-service
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
ENV_FILE = ROOT_DIR / ".env"

INSECURE_DEV_TOKENS = {
    "dev-internal-pki-secret-token-2026",
    "secret",
    "changeme",
    "default",
}

KNOWN_DEFAULT_INTER_CA_PASS = {
    "InterPass!ChangeMe123",
    "changeme",
    "secret",
    "password",
}

class Settings(BaseSettings):
    PROJECT_NAME: str = "PKI Certificate Issuer Service"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PKI_PORT", os.getenv("PORT", "8001")))
    
    # Internal Authentication Token
    PKI_SERVICE_TOKEN: str = os.getenv("PKI_SERVICE_TOKEN", "dev-internal-pki-secret-token-2026")
    
    # PKI Engine & Storage integration
    PKI_ENGINE_DIR: str = os.getenv("PKI_ENGINE_DIR", "/app/pki/scripts")
    P12_ARCHIVE_DIR: str = os.getenv("P12_ARCHIVE_DIR", "/app/sign-api/p12")
    PKI_TIMEOUT: int = int(os.getenv("PKI_TIMEOUT", "60"))
    
    # PKI Secrets & Passphrases
    INTER_CA_PASS: str = os.getenv("INTER_CA_PASS", "InterPass!ChangeMe123")
    DEFAULT_PFX_PASS: str = os.getenv("DEFAULT_PFX_PASS", "Mkri006!")
    DEFAULT_USER_PASS: str = os.getenv("DEFAULT_USER_PASS", "Konstitusi100%")

    INT_DIR: Optional[str] = os.getenv("INT_DIR", None)
    ISSUED_DIR: Optional[str] = os.getenv("ISSUED_DIR", None)
    CHAIN_PATH: Optional[str] = os.getenv("CHAIN_PATH", None)

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() == "production":
            if not self.PKI_SERVICE_TOKEN or self.PKI_SERVICE_TOKEN in INSECURE_DEV_TOKENS or len(self.PKI_SERVICE_TOKEN) < 32:
                raise ValueError(
                    "Production environment requires a strong and non-default PKI_SERVICE_TOKEN (at least 32 characters)."
                )
            if not self.INTER_CA_PASS or self.INTER_CA_PASS in KNOWN_DEFAULT_INTER_CA_PASS or len(self.INTER_CA_PASS.strip()) < 8:
                raise ValueError(
                    "Production environment requires a strong and non-default INTER_CA_PASS."
                )
            if self.INT_DIR and "test" in self.INT_DIR.lower():
                raise ValueError(
                    "Production environment cannot use a test CA directory."
                )
        return self

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        extra = "ignore"

settings = Settings()
