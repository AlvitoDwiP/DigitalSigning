from fastapi import FastAPI
from app.core.config import settings
from app.api.routes import router as pki_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="PKI Service / Certificate Issuer internal daemon",
    docs_url=None, # Disable Swagger in production/internal
    redoc_url=None
)

app.include_router(pki_router)

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "pki-service",
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=False)
