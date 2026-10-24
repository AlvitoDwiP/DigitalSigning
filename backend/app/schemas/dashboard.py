from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class DashboardStatistics(BaseModel):
    total_user: int
    active: int
    expired: int


class ExpiringCertificateUser(BaseModel):
    user_id: str
    name: str
    expires_at: str


class ExpiryBuckets(BaseModel):
    within_30_days: int
    d31_to_60_days: int = Field(alias="31_to_60_days")
    d61_to_90_days: int = Field(alias="61_to_90_days")

    model_config = ConfigDict(populate_by_name=True)


class RecentActivity(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    status: str
    created_at: str


class DashboardAdminData(BaseModel):
    statistics: DashboardStatistics
    expiring_certificates: List[ExpiringCertificateUser]
    expiry_buckets: ExpiryBuckets
    recent_activities: List[RecentActivity]


class DashboardUserCertificate(BaseModel):
    id: str
    serial_number: str
    issued_at: str
    expires_at: str
    status: str
    days_remaining: int


class DashboardUserAccount(BaseModel):
    id: str
    name: str
    email: str
    nik: str
    organization: Optional[str] = None
    ou: Optional[str] = None


class DashboardUserData(BaseModel):
    user: DashboardUserAccount
    active_certificate: Optional[DashboardUserCertificate] = None
    has_active_certificate: bool
