from fastapi import APIRouter

from app.routes.admin.auth import router as admin_auth_router
from app.routes.admin.dashboard import router as admin_dashboard_router
from app.routes.admin.users import router as admin_users_router
from app.routes.admin.businesses import router as admin_businesses_router
from app.routes.admin.scrapers import router as admin_scrapers_router
from app.routes.admin.exports import router as admin_exports_router
from app.routes.admin.plans import router as admin_plans_router
from app.routes.admin.analytics import router as admin_analytics_router
from app.routes.admin.audit_logs import router as admin_audit_logs_router

admin_router = APIRouter(prefix="/api/admin")

admin_router.include_router(admin_auth_router)
admin_router.include_router(admin_dashboard_router)
admin_router.include_router(admin_users_router)
admin_router.include_router(admin_businesses_router)
admin_router.include_router(admin_scrapers_router)
admin_router.include_router(admin_exports_router)
admin_router.include_router(admin_plans_router)
admin_router.include_router(admin_analytics_router)
admin_router.include_router(admin_audit_logs_router)

__all__ = ["admin_router"]
