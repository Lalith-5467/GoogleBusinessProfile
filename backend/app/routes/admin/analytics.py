import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.admin import AnalyticsResponse
from app.services.auth import require_admin_permission
from app.services.admin_dashboard import AdminDashboardService

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/analytics", tags=["Admin Analytics"])

@router.get("/overview", response_model=AnalyticsResponse)
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_view_analytics"))
):
    """Provides platform growth, usage trends, and category/location distributions."""
    data = AdminDashboardService.get_analytics(db)
    return data
