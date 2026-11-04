from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import (
    account,
    admins,
    audit_logs,
    auth,
    certificates,
    dashboard,
    signatures,
    users,
)
from app.api.errors import setup_exception_handlers
from app.api.health import router as health_router
from app.core.config import BASE_DIR, settings

def ensure_schema_migrations():
    """Memastikan skema database mutakhir (kolom revocation dan constraint)."""
    try:
        from sqlalchemy import text
        from app.core.database import engine
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;"))
            conn.execute(text("ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'REPLACED', 'DELETED', 'REVOKED'));"))
            conn.execute(text("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(255);"))
            conn.execute(text("UPDATE alembic_version SET version_num = '0004_revoked_cert_status' WHERE version_num = '0003_deleted_cert_status';"))
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not auto-apply schema migrations: {e}")

# Apply schema migrations on reload and startup
ensure_schema_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Digital Signature Platform - Backend API Foundation"
)

@app.on_event("startup")
def on_startup():
    ensure_schema_migrations()

# Setup Global Exception Handlers
setup_exception_handlers(app)

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(admins.router, prefix=f"{settings.API_V1_STR}/admins", tags=["Management Admin"])
app.include_router(account.router, prefix=f"{settings.API_V1_STR}/account", tags=["Account"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])
app.include_router(audit_logs.router, prefix=f"{settings.API_V1_STR}/audit-logs", tags=["Audit Log"])
app.include_router(signatures.router, prefix=f"{settings.API_V1_STR}/signatures", tags=["Signatures"])
app.include_router(signatures.direct_router)
app.include_router(certificates.router, prefix=f"{settings.API_V1_STR}/certificates", tags=["Certificates"])
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(health_router, tags=["Health"])  # Root /health convenience


@app.get("/", tags=["API Info"])
def root():
    """
    Root endpoint mengembalikan informasi layanan API DigitalSigning.
    Frontend web diakses secara terpisah melalui http://localhost:3000.
    """
    return {
        "service": getattr(settings, "PROJECT_NAME", "Digital Signature Platform Backend API"),
        "version": getattr(settings, "PROJECT_VERSION", "1.0.0"),
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "docs": {
            "swagger": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json"
        },
        "health": "/health",
        "api_v1_prefix": settings.API_V1_STR
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
