import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func

from app.database import get_db
from app.models.user import User, AuditLog
from app.schemas.admin import AuditLogsResponse, AuditLogItem
from app.services.auth import require_admin_permission

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/audit-logs", tags=["Admin Audit Trail"])

@router.get("", response_model=AuditLogsResponse)
def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor email"),
    action: Optional[str] = Query(None, description="Filter by action code"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_view_audit_logs"))
):
    """Chronological audit log showing administrative actions, actor, IP, timestamp, and details."""
    query = db.query(AuditLog)

    if actor and actor.strip():
        query = query.filter(func.lower(AuditLog.actor_email).like(f"%{actor.strip().lower()}%"))

    if action and action.strip():
        query = query.filter(AuditLog.action == action.strip().upper())

    total = query.count()
    logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

    items = [AuditLogItem.model_validate(l) for l in logs]
    return AuditLogsResponse(success=True, total=total, logs=items)
