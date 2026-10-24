import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditLogBase(BaseModel):
    user_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[uuid.UUID] = None
    target_name: Optional[str] = None
    status: str


class AuditLogResponse(AuditLogBase):
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


