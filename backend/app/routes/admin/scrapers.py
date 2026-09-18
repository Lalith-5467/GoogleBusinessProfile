import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, ScrapingJob
from app.models.scraped_business import ScrapedBusiness
from app.schemas.admin import ScrapingJobsResponse, ScrapingJobItem
from app.services.auth import require_admin_permission
from app.services.web_scraper import WebScraperService
from app.services.audit import log_audit_event

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/scrapers", tags=["Admin Scraper Monitoring"])

@router.get("/jobs", response_model=ScrapingJobsResponse)
def list_scraping_jobs(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_scrapers"))
):
    """Lists scraping jobs execution history with result counts, execution duration, and errors."""
    query = db.query(ScrapingJob)

    if status_filter and status_filter.strip():
        query = query.filter(ScrapingJob.status == status_filter.strip().upper())

    if job_type and job_type.strip():
        query = query.filter(ScrapingJob.job_type == job_type.strip().upper())

    total = query.count()
    jobs = query.order_by(desc(ScrapingJob.created_at)).offset(skip).limit(limit).all()

    items = [ScrapingJobItem.model_validate(j) for j in jobs]
    return ScrapingJobsResponse(success=True, total=total, jobs=items)

@router.post("/enrich/{business_id}")
async def enrich_business_admin(
    business_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_scrapers"))
):
    """Admin endpoint to trigger place details enrichment on a specific scraped business."""
    record = db.query(ScrapedBusiness).filter_by(id=business_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scraped business record not found.")

    try:
        updated = await WebScraperService.enrich_business_place_details(business_id=business_id, db=db)
        
        client_ip = request.client.host if request.client else "unknown"
        log_audit_event(
            db=db,
            actor_email=current_admin.email,
            action="SCRAPER_ENRICH_TRIGGERED",
            user_id=current_admin.id,
            target_type="SCRAPED_BUSINESS",
            target_id=business_id,
            ip_address=client_ip,
            details={"business_name": record.business_name}
        )

        return {
            "success": True,
            "message": f"Business '{record.business_name}' enriched successfully.",
            "business": {
                "id": updated.id,
                "business_name": updated.business_name,
                "enrichment_status": updated.enrichment_status
            }
        }
    except Exception as e:
        logger.error(f"Admin enrichment error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to enrich business: {str(e)}")
