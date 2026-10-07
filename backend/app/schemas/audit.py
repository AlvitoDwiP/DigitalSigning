from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class AuditLogBase(BaseModel):
    user_id: Optional[uuid.UUID] = None
    action: str
    target_type: str
    target_id: Optional[uuid.UUID] = None
    status: str

class AuditLogResponse(AuditLogBase):
    id: uuid.UUID
    created_at: datetime
    
    class Config:
        from_attributes = True
