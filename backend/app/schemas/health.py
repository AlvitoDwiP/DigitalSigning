from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class DatabaseHealthSchema(BaseModel):
    status: str
    database_url_masked: Optional[str] = None
    error: Optional[str] = None

class HealthResponseSchema(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    database: DatabaseHealthSchema

class ErrorDetailSchema(BaseModel):
    code: str
    message: str

class ErrorResponseSchema(BaseModel):
    success: bool = False
    error: ErrorDetailSchema
