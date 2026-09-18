import json
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, SubscriptionPlan
from app.schemas.admin import SubscriptionPlanSchema, UpdatePlanRequest
from app.services.auth import require_admin, require_super_admin, require_admin_permission
from app.services.audit import log_audit_event

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/plans", tags=["Admin Subscription Plans"])

@router.get("", response_model=List[SubscriptionPlanSchema])
def list_plans(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Lists all subscription plans and their limits."""
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly.asc()).all()
    return [SubscriptionPlanSchema.model_validate(p) for p in plans]

@router.put("/{plan_id}", response_model=SubscriptionPlanSchema)
def update_plan(
    plan_id: str,
    payload: UpdatePlanRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_super_admin)
):
    """Super Admin updates plan pricing, limits, and active status."""
    plan = db.query(SubscriptionPlan).filter_by(id=plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found.")

    if payload.display_name is not None:
        plan.display_name = payload.display_name
    if payload.price_monthly is not None:
        plan.price_monthly = payload.price_monthly
    if payload.search_limit is not None:
        plan.search_limit = payload.search_limit
    if payload.scrape_limit is not None:
        plan.scrape_limit = payload.scrape_limit
    if payload.bulk_scrape_limit is not None:
        plan.bulk_scrape_limit = payload.bulk_scrape_limit
    if payload.export_limit is not None:
        plan.export_limit = payload.export_limit
    if payload.features_json is not None:
        plan.features_json = payload.features_json
    if payload.is_active is not None:
        plan.is_active = payload.is_active

    db.commit()
    db.refresh(plan)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="PLAN_UPDATED",
        user_id=current_admin.id,
        target_type="PLAN",
        target_id=plan.id,
        ip_address=client_ip,
        details={"plan_name": plan.name, "price": plan.price_monthly}
    )

    return SubscriptionPlanSchema.model_validate(plan)
