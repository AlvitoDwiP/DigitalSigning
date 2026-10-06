import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLAlchemy Engine Initialization
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> dict:
    """
    Checks database connection and returns status dictionary.
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1;"))
            result.fetchone()
        return {"status": "connected", "database_url_masked": settings.DATABASE_URL.split("@")[-1]}
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return {"status": "disconnected", "error": str(e)}
