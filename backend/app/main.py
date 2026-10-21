from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.health import router as health_router
from app.api.errors import setup_exception_handlers

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Digital Signature Platform - Backend API Foundation"
)

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
from app.api.endpoints import auth, users, admins, account, dashboard, audit_logs, signatures, certificates
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(admins.router, prefix=f"{settings.API_V1_STR}/admins", tags=["Management Admin"])
app.include_router(account.router, prefix=f"{settings.API_V1_STR}/account", tags=["Account"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])
app.include_router(audit_logs.router, prefix=f"{settings.API_V1_STR}/audit-logs", tags=["Audit Log"])
app.include_router(signatures.router, prefix=f"{settings.API_V1_STR}/signatures", tags=["Signatures"])
app.include_router(certificates.router, prefix=f"{settings.API_V1_STR}/certificates", tags=["Certificates"])
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(health_router, tags=["Health"]) # Root /health convenience

from pathlib import Path
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import BASE_DIR

# Determine frontend static directory if built
dist_dir = None
for candidate in [BASE_DIR / "frontend" / "dist", Path("/app/frontend/dist")]:
    if candidate.exists() and (candidate / "index.html").is_file():
        dist_dir = candidate
        break

if dist_dir:
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/", tags=["Dashboard UI"])
    def serve_frontend_root():
        return FileResponse(dist_dir / "index.html")

    @app.middleware("http")
    async def spa_fallback_middleware(request: Request, call_next):
        response = await call_next(request)
        if response.status_code == 404 and request.method == "GET":
            path = request.url.path
            # Do NOT hijack API, health, docs, openapi routes
            if not (path.startswith("/api/") or path.startswith("/health") or path.startswith("/docs") or path.startswith("/openapi.json")):
                static_file = dist_dir / path.lstrip("/")
                if static_file.is_file():
                    return FileResponse(static_file)
                index_file = dist_dir / "index.html"
                if index_file.is_file():
                    return FileResponse(index_file)
        return response
else:
    @app.get("/", tags=["Root"])
    def root():
        return {
            "message": "Digital Signature Platform Backend API",
            "docs": "/docs",
            "health": "/health"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
