import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, ExportLog
from app.schemas.admin import ExportLogsResponse, ExportLogItem
from app.services.auth import require_admin_permission

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/exports", tags=["Admin Export Management"])

from pydantic import BaseModel

class LogExportRequest(BaseModel):
    export_type: str = "SCRAPER"
    record_count: int = 0
    file_name: str = "export.csv"
    file_format: str = "CSV"
    user_email: Optional[str] = None

@router.post("/log")
def record_export_log(
    payload: LogExportRequest,
    db: Session = Depends(get_db)
):
    """Records an export event from client downloads or server actions into MySQL export_logs."""
    try:
        from app.services.audit import log_export_event
        export_log = log_export_event(
            db=db,
            export_type=payload.export_type,
            record_count=payload.record_count,
            file_name=payload.file_name,
            file_format=payload.file_format,
            user_email=payload.user_email
        )
        return {"success": True, "log_id": export_log.id if export_log else None}
    except Exception as e:
        logger.warning(f"Failed to record export log: {e}")
        return {"success": False, "error": str(e)}

@router.get("", response_model=ExportLogsResponse)
def list_export_logs(
    export_type: Optional[str] = Query(None, description="Filter by export type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_exports"))
):
    """Lists history of all data exports across the application."""
    query = db.query(ExportLog)

    if export_type and export_type.strip():
        query = query.filter(ExportLog.export_type == export_type.strip().upper())

    total = query.count()
    logs = query.order_by(desc(ExportLog.created_at)).offset(skip).limit(limit).all()

    items = [ExportLogItem.model_validate(l) for l in logs]
    return ExportLogsResponse(success=True, total=total, logs=items)

