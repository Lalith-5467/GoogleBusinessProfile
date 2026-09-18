import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.admin import DashboardStatsResponse
from app.services.auth import require_admin
from app.services.admin_dashboard import AdminDashboardService

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/dashboard", tags=["Admin Dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Returns authoritative, real-time database-driven statistics across the platform."""
    stats = AdminDashboardService.get_dashboard_stats(db)
    return stats
