from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

# --- Auth Schemas ---
class AdminLoginRequest(BaseModel):
    email: str
    password: str

class BootstrapSuperAdminRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = "System Super Admin"
    bootstrap_secret: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class PermissionSchema(BaseModel):
    can_manage_users: bool = True
    can_manage_businesses: bool = True
    can_manage_scrapers: bool = True
    can_manage_exports: bool = True
    can_manage_plans: bool = False
    can_view_analytics: bool = True
    can_view_audit_logs: bool = False

    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    status: str
    plan_id: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    permissions: Optional[PermissionSchema] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

# --- User Management Schemas ---
class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = "CUSTOMER"  # SUPER_ADMIN, ADMIN, CUSTOMER
    status: str = "ACTIVE"
    plan_id: Optional[str] = None
    permissions: Optional[PermissionSchema] = None

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    plan_id: Optional[str] = None
    password: Optional[str] = None

class UpdateUserStatusRequest(BaseModel):
    status: str  # ACTIVE, INACTIVE, SUSPENDED

class UpdatePermissionsRequest(BaseModel):
    can_manage_users: bool
    can_manage_businesses: bool
    can_manage_scrapers: bool
    can_manage_exports: bool
    can_manage_plans: bool
    can_view_analytics: bool
    can_view_audit_logs: bool

class UserListItem(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    status: str
    plan_id: Optional[str] = None
    plan_name: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    scraping_jobs_count: int = 0
    exports_count: int = 0
    permissions: Optional[PermissionSchema] = None

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    success: bool = True
    total: int
    users: List[UserListItem]

# --- Subscription Plan Schemas ---
class SubscriptionPlanSchema(BaseModel):
    id: str
    name: str
    display_name: str
    price_monthly: float
    search_limit: int
    scrape_limit: int
    bulk_scrape_limit: int
    export_limit: int
    features_json: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UpdatePlanRequest(BaseModel):
    display_name: Optional[str] = None
    price_monthly: Optional[float] = None
    search_limit: Optional[int] = None
    scrape_limit: Optional[int] = None
    bulk_scrape_limit: Optional[int] = None
    export_limit: Optional[int] = None
    features_json: Optional[str] = None
    is_active: Optional[bool] = None

# --- Dashboard & Analytics Schemas ---
class DashboardStatsResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    suspended_users: int
    total_admins: int
    total_businesses: int
    google_locations_count: int
    scraped_businesses_count: int
    total_scraping_jobs: int
    successful_jobs: int
    failed_jobs: int
    running_jobs: int
    total_exports: int
    recent_registrations: List[Dict[str, Any]]
    recent_scraping_activity: List[Dict[str, Any]]

class AnalyticsResponse(BaseModel):
    user_growth: List[Dict[str, Any]]
    scraping_trends: List[Dict[str, Any]]
    export_trends: List[Dict[str, Any]]
    categories_breakdown: List[Dict[str, Any]]
    cities_breakdown: List[Dict[str, Any]]

# --- Audit & Monitoring Schemas ---
class AuditLogItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    actor_email: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    ip_address: Optional[str] = None
    details_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogsResponse(BaseModel):
    success: bool = True
    total: int
    logs: List[AuditLogItem]

class ExportLogItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    export_type: str
    record_count: int
    file_name: str
    file_format: str
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExportLogsResponse(BaseModel):
    success: bool = True
    total: int
    logs: List[ExportLogItem]

class ScrapingJobItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    job_type: str
    query_or_url: str
    status: str
    results_count: int
    error_message: Optional[str] = None
    duration_ms: int
    created_at: datetime

    class Config:
        from_attributes = True

class ScrapingJobsResponse(BaseModel):
    success: bool = True
    total: int
    jobs: List[ScrapingJobItem]

class UnifiedBusinessItem(BaseModel):
    id: str
    source_type: str  # GOOGLE_API, MANUAL_ENTRY, WEBSITE_SCRAPE
    business_name: str
    primary_category: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    status: str = "ACTIVE"
    created_at: datetime

class UnifiedBusinessListResponse(BaseModel):
    success: bool = True
    total: int
    google_count: int
    scraped_count: int
    businesses: List[UnifiedBusinessItem]
