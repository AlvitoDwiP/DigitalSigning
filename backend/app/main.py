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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.api.endpoints import auth
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(health_router, tags=["Health"]) # Root /health convenience

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
