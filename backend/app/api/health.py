from fastapi import APIRouter
from app.core.database import check_database_connection
from app.core.config import settings

router = APIRouter()

@router.get("/health", summary="Basic & Database Health Check")
def health_check():
    db_health = check_database_connection()
    is_healthy = db_health.get("status") == "connected"
    
    return {
        "status": "ok" if is_healthy else "degraded",
        "service": "Digital Signature Platform Backend API",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_health
    }
