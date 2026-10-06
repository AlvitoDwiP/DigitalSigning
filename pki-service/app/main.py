from fastapi import FastAPI
from app.core.config import pki_settings
from app.api.health import router as health_router

app = FastAPI(
    title=pki_settings.PROJECT_NAME,
    version=pki_settings.VERSION,
    description="Internal PKI Adapter Service Foundation"
)

app.include_router(health_router, tags=["Health"])

from app.api.endpoints import pki
app.include_router(pki.router, prefix="/internal/pki", tags=["PKI"])

@app.get("/")
def root():
    return {
        "message": "Digital Signature Platform - PKI Adapter Service Foundation",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=pki_settings.PORT, reload=True)
