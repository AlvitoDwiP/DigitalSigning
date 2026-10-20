import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

INSECURE_DEV_KEYS = {
    "dev-secret-key-digital-signature-platform-2026",
    "secret",
    "changeme",
}

KNOWN_DEFAULT_INTER_CA_PASS = {
    "InterPass!ChangeMe123",
    "changeme",
    "secret",
    "password",
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
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return []
            if v_str.startswith("[") and v_str.endswith("]"):
                import json
                try:
                    return json.loads(v_str)
                except Exception:
                    pass
            return [i.strip() for i in v_str.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(i) for i in v]
        return []
    
    # JWT Auth
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/digital_signature_db"
    )
    
    # PKI Engine & Storage integration (Monolith)
    PKI_ENGINE_DIR: str = os.getenv("PKI_ENGINE_DIR", "/app/pki/scripts")
    P12_ARCHIVE_DIR: str = os.getenv("P12_ARCHIVE_DIR", "/app/sign-api/p12")
    PKI_TIMEOUT: int = int(os.getenv("PKI_TIMEOUT", "30"))
    MAX_AUDIT_LOGS: int = int(os.getenv("MAX_AUDIT_LOGS", "5000"))

    # PKI Secrets & Default Passphrases
    INTER_CA_PASS: str = os.getenv("INTER_CA_PASS", "InterPass!ChangeMe123")
    DEFAULT_PFX_PASS: str = os.getenv("DEFAULT_PFX_PASS", "Mkri006!")
    DEFAULT_USER_PASS: str = os.getenv("DEFAULT_USER_PASS", "Konstitusi100%")

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() == "production":
            if self.SECRET_KEY in INSECURE_DEV_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Production environment requires a strong and non-default SECRET_KEY (at least 32 characters)."
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "Production environment must not use wildcard '*' in CORS_ORIGINS when credentials are enabled."
                )
            if not self.INTER_CA_PASS or not self.INTER_CA_PASS.strip():
                raise ValueError(
                    "Production environment requires INTER_CA_PASS to be configured."
                )
            if self.INTER_CA_PASS in KNOWN_DEFAULT_INTER_CA_PASS:
                raise ValueError(
                    "Production environment cannot use default or insecure INTER_CA_PASS."
                )
            if len(self.INTER_CA_PASS.strip()) < 8:
                raise ValueError(
                    "Production environment requires INTER_CA_PASS to be at least 8 characters."
                )
        return self

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else None
        extra = "ignore"

settings = Settings()

