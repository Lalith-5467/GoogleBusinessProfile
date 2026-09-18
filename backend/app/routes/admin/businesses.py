import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func

from app.database import get_db
from app.models.user import User
from app.models.business import GoogleBusinessLocation
from app.models.scraped_business import ScrapedBusiness
from app.schemas.admin import UnifiedBusinessListResponse, UnifiedBusinessItem
from app.services.auth import require_admin_permission
from app.services.audit import log_audit_event

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/businesses", tags=["Admin Business Management"])

@router.get("", response_model=UnifiedBusinessListResponse)
def list_unified_businesses(
    search: Optional[str] = Query(None, description="Search by business name or address"),
    source: Optional[str] = Query(None, description="Filter by source: all, google, scraped"),
    city: Optional[str] = Query(None, description="Filter by city"),
    category: Optional[str] = Query(None, description="Filter by primary category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_businesses"))
):
    """
    Returns a unified view of all stored business records from both
    `google_business_locations` and `scraped_businesses`.
    """
    unified_items: List[UnifiedBusinessItem] = []

    # 1. Fetch Google Locations
    if source in [None, "", "all", "google"]:
        g_query = db.query(GoogleBusinessLocation)
        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            g_query = g_query.filter(or_(
                func.lower(GoogleBusinessLocation.business_name).like(s),
                func.lower(GoogleBusinessLocation.address).like(s),
                func.lower(GoogleBusinessLocation.city).like(s)
            ))
        if city and city.strip():
            g_query = g_query.filter(func.lower(GoogleBusinessLocation.city) == city.strip().lower())
        if category and category.strip():
            g_query = g_query.filter(func.lower(GoogleBusinessLocation.primary_category).like(f"%{category.strip().lower()}%"))

        g_locations = g_query.all()
        for loc in g_locations:
            unified_items.append(
                UnifiedBusinessItem(
                    id=loc.id,
                    source_type="GOOGLE_LOCATION",
                    business_name=loc.business_name,
                    primary_category=loc.primary_category,
                    rating=loc.rating,
                    review_count=loc.review_count,
                    city=loc.city,
                    state=loc.state,
                    phone=loc.phone,
                    website=loc.website,
                    address=loc.address or (f"{loc.area}, {loc.city}" if loc.area and loc.city else loc.city),
                    status=loc.status or "ACTIVE",
                    created_at=loc.created_at
                )
            )

    # 2. Fetch Scraped Businesses
    if source in [None, "", "all", "scraped"]:
        s_query = db.query(ScrapedBusiness)
        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            s_query = s_query.filter(or_(
                func.lower(ScrapedBusiness.business_name).like(s),
                func.lower(ScrapedBusiness.address).like(s),
                func.lower(ScrapedBusiness.city).like(s)
            ))
        if city and city.strip():
            s_query = s_query.filter(func.lower(ScrapedBusiness.city) == city.strip().lower())
        if category and category.strip():
            s_query = s_query.filter(func.lower(ScrapedBusiness.primary_category).like(f"%{category.strip().lower()}%"))

        s_businesses = s_query.all()
        for b in s_businesses:
            unified_items.append(
                UnifiedBusinessItem(
                    id=b.id,
                    source_type="WEBSITE_SCRAPE",
                    business_name=b.business_name,
                    primary_category=b.primary_category,
                    rating=b.rating,
                    review_count=b.review_count,
                    city=b.city,
                    state=b.state,
                    phone=b.phone,
                    website=b.website,
                    address=b.address or b.city,
                    status=b.status or "ACTIVE",
                    created_at=b.created_at
                )
            )

    # Sort descending by created_at
    unified_items.sort(key=lambda x: x.created_at if x.created_at else datetime.min, reverse=True)

    google_count = db.query(GoogleBusinessLocation).count()
    scraped_count = db.query(ScrapedBusiness).count()
    total = len(unified_items)

    paginated = unified_items[skip : skip + limit]

    return UnifiedBusinessListResponse(
        success=True,
        total=total,
        google_count=google_count,
        scraped_count=scraped_count,
        businesses=paginated
    )

@router.delete("/google/{location_id}")
def delete_google_location_admin(
    location_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_businesses"))
):
    """Admin endpoint to delete a Google Business Location record with audit trail."""
    loc = db.query(GoogleBusinessLocation).filter_by(id=location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Business location not found.")

    b_name = loc.business_name
    db.delete(loc)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="BUSINESS_DELETED",
        user_id=current_admin.id,
        target_type="GOOGLE_LOCATION",
        target_id=location_id,
        ip_address=client_ip,
        details={"business_name": b_name}
    )

    return {"success": True, "message": f"Business location '{b_name}' deleted successfully."}

@router.delete("/scraped/{scraped_id}")
def delete_scraped_business_admin(
    scraped_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_businesses"))
):
    """Admin endpoint to delete a Scraped Business record with audit trail."""
    record = db.query(ScrapedBusiness).filter_by(id=scraped_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scraped business not found.")

    b_name = record.business_name
    db.delete(record)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="BUSINESS_DELETED",
        user_id=current_admin.id,
        target_type="SCRAPED_BUSINESS",
        target_id=scraped_id,
        ip_address=client_ip,
        details={"business_name": b_name}
    )

    return {"success": True, "message": f"Scraped business '{b_name}' deleted successfully."}
