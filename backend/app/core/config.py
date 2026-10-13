import os
from pathlib import Path
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

INSECURE_DEV_KEYS = {
    "dev-secret-key-digital-signature-platform-2026",
    "secret",
    "changeme",
}

INSECURE_DEV_TOKENS = {
    "dev-pki-service-token-2026",
    "secret",
    "changeme",
}

class Settings(BaseSettings):
    PROJECT_NAME: str = "Digital Signature Platform API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment & Server
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-digital-signature-platform-2026")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]
    
    # JWT Auth
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/digital_signature_db"
    )
    
    # PKI Service integration
    PKI_SERVICE_URL: str = os.getenv("PKI_SERVICE_URL", "http://localhost:8001")
    PKI_SERVICE_TOKEN: str = os.getenv("PKI_SERVICE_TOKEN", "dev-pki-service-token-2026")
    PKI_TIMEOUT: int = int(os.getenv("PKI_TIMEOUT", "30"))

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() == "production":
            if self.SECRET_KEY in INSECURE_DEV_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Production environment requires a strong and non-default SECRET_KEY (at least 32 characters)."
                )
            if self.PKI_SERVICE_TOKEN in INSECURE_DEV_TOKENS or len(self.PKI_SERVICE_TOKEN) < 16:
                raise ValueError(
                    "Production environment requires a strong and non-default PKI_SERVICE_TOKEN (at least 16 characters)."
                )
        return self

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        extra = "ignore"

settings = Settings()

