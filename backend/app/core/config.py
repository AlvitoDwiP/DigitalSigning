import os
from pathlib import Path
from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

INSECURE_DEV_KEYS = {
    "dev-secret-key-digital-signature-platform-2026",
    "secret",
    "changeme",
    "default",
}

INSECURE_DEV_TOKENS = {
    "dev-internal-pki-secret-token-2026",
    "secret",
    "changeme",
    "default",
}

INSECURE_DEV_DB_URLS = {
    "postgresql://postgres:postgres@localhost:5432/digital_signature_db",
    "postgresql://postgres:postgrespassword@postgres:5432/digital_signature_db",
    "postgresql://postgres:postgres@db:5432/digital_signature_db",
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
    
    # PKI Service Internal API Integration (2-Container Architecture)
    PKI_SERVICE_URL: str = os.getenv("PKI_SERVICE_URL", "http://pki_service:8001")
    PKI_SERVICE_TOKEN: str = os.getenv("PKI_SERVICE_TOKEN", "dev-internal-pki-secret-token-2026")

    # PKI Engine & Storage integration (for local fallback / canonical issued)
    PKI_ENGINE_DIR: str = os.getenv("PKI_ENGINE_DIR", "/app/pki/scripts")
    ISSUED_DIR: str = os.getenv("ISSUED_DIR", "/app/pki/issued")
    P12_ARCHIVE_DIR: str = os.getenv("P12_ARCHIVE_DIR", "/app/sign-api/p12")
    PKI_TIMEOUT: int = int(os.getenv("PKI_TIMEOUT", "30"))
    MAX_AUDIT_LOGS: int = int(os.getenv("MAX_AUDIT_LOGS", "5000"))

    # Passphrases & Defaults
    INTER_CA_PASS: Optional[str] = os.getenv("INTER_CA_PASS", None)
    DEFAULT_PFX_PASS: str = os.getenv("DEFAULT_PFX_PASS", "Mkri006!")
    DEFAULT_USER_PASS: str = os.getenv("DEFAULT_USER_PASS", "Konstitusi100%")
    API_KEY: str = os.getenv("API_KEY", "rahasia-super")

    # Security Hardening & PDF Signing Limits
    MAX_PDF_SIZE_MB: int = int(os.getenv("MAX_PDF_SIZE_MB", "25"))
    MAX_STAMP_SIZE_MB: int = int(os.getenv("MAX_STAMP_SIZE_MB", "2"))
    MAX_STAMP_WIDTH: int = int(os.getenv("MAX_STAMP_WIDTH", "4096"))
    MAX_STAMP_HEIGHT: int = int(os.getenv("MAX_STAMP_HEIGHT", "4096"))
    MAX_STAMP_PIXELS: int = int(os.getenv("MAX_STAMP_PIXELS", "16777216"))
    MAX_PDF_PAGES: int = int(os.getenv("MAX_PDF_PAGES", "1000"))
    MAX_CONCURRENT_SIGNING: int = int(os.getenv("MAX_CONCURRENT_SIGNING", "10"))
    SIGNING_TIMEOUT_SECONDS: int = int(os.getenv("SIGNING_TIMEOUT_SECONDS", "60"))

    # Feature Flags (Phase 2 Roadmap)
    # TTE PDF is active in Phase 2 and enabled by default (can be toggled via ENABLE_PDF_SIGNING env var)
    ENABLE_PDF_SIGNING: bool = os.getenv("ENABLE_PDF_SIGNING", "true").lower() in ("true", "1")

    @field_validator("MAX_PDF_SIZE_MB")
    @classmethod
    def validate_max_pdf_size(cls, v: int) -> int:
        if v < 1 or v > 200:
            raise ValueError("MAX_PDF_SIZE_MB harus bernilai antara 1 dan 200 MB.")
        return v

    @field_validator("MAX_STAMP_SIZE_MB")
    @classmethod
    def validate_max_stamp_size(cls, v: int) -> int:
        if v < 1 or v > 50:
            raise ValueError("MAX_STAMP_SIZE_MB harus bernilai antara 1 dan 50 MB.")
        return v

    @field_validator("MAX_PDF_PAGES")
    @classmethod
    def validate_max_pdf_pages(cls, v: int) -> int:
        if v < 1 or v > 10000:
            raise ValueError("MAX_PDF_PAGES harus bernilai antara 1 dan 10000 halaman.")
        return v

    @field_validator("MAX_CONCURRENT_SIGNING")
    @classmethod
    def validate_max_concurrent_signing(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError("MAX_CONCURRENT_SIGNING harus bernilai antara 1 dan 100.")
        return v

    @field_validator("SIGNING_TIMEOUT_SECONDS")
    @classmethod
    def validate_signing_timeout(cls, v: int) -> int:
        if v < 5 or v > 300:
            raise ValueError("SIGNING_TIMEOUT_SECONDS harus bernilai antara 5 dan 300 detik.")
        return v

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.ENVIRONMENT.lower() == "production":
            if not self.SECRET_KEY or self.SECRET_KEY in INSECURE_DEV_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "Production environment requires a strong and non-default SECRET_KEY (at least 32 characters)."
                )
            if (
                not self.PKI_SERVICE_TOKEN
                or self.PKI_SERVICE_TOKEN in INSECURE_DEV_TOKENS
                or len(self.PKI_SERVICE_TOKEN) < 32
            ):
                raise ValueError(
                    "Production environment requires a strong and non-default PKI_SERVICE_TOKEN (at least 32 characters)."
                )
            if (
                not self.DATABASE_URL
                or self.DATABASE_URL in INSECURE_DEV_DB_URLS
                or "postgres:postgres@" in self.DATABASE_URL
            ):
                raise ValueError(
                    "Production environment requires a secure and non-default DATABASE_URL / POSTGRES_PASSWORD."
                )
            if self.INTER_CA_PASS is not None and (
                self.INTER_CA_PASS in {"InterPass!ChangeMe123", "changeme", "secret", "password"}
                or len(self.INTER_CA_PASS.strip()) < 8
            ):
                raise ValueError(
                    "Production environment requires a strong and non-default INTER_CA_PASS."
                )
            if not self.API_KEY or self.API_KEY in {"rahasia-super", "secret", "changeme", "default"} or len(self.API_KEY) < 16:
                raise ValueError(
                    "Production environment requires a strong and non-default API_KEY (at least 16 characters)."
                )
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "Production environment must not use wildcard '*' in CORS_ORIGINS when credentials are enabled."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        extra="ignore"
    )

settings = Settings()

