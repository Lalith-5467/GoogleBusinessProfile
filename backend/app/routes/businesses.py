import datetime
import logging
from typing import List
from fastapi import APIRouter, Depends, Response, HTTPException, Path
from sqlalchemy.orm import Session

logger = logging.getLogger("google-business-backend")

from app.database import get_db
from app.services.google_business import GoogleBusinessService
from app.services.csv_export import generate_locations_csv
from app.models.business import GoogleBusinessAccount, GoogleBusinessLocation
from app.schemas.business import (
    AccountStatusResponse,
    LocationResponse,
    LocationCreate,
    LocationBatchSaveRequest,
    LocationBatchSaveResponse,
    BulkScrapeRequest,
    BulkScrapeResponse,
    LocationListResponse,
    SyncResponse,
    DeleteResponse
)

router = APIRouter(prefix="/api/google-business", tags=["Google Business Profiles"])

@router.get("/status", response_model=AccountStatusResponse)
def get_account_status(db: Session = Depends(get_db)):
    """Returns the current connection status, total business location count, and OAuth configuration state."""
    is_configured = GoogleBusinessService.is_oauth_configured()
    account = db.query(GoogleBusinessAccount).filter_by(connection_status="CONNECTED").first()
    
    total_locations = db.query(GoogleBusinessLocation).count()
    
    if not account:
        return AccountStatusResponse(
            is_connected=False,
            connection_status="DISCONNECTED",
            total_locations=total_locations,
            auth_url_available=is_configured,
            message="No Google Business Profile account connected." if is_configured else "Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured on the server."
        )
        
    return AccountStatusResponse(
        is_connected=True,
        account_id=account.google_account_id,
        account_name=account.account_name,
        email=account.email,
        connection_status=account.connection_status,
        total_locations=total_locations,
        auth_url_available=is_configured
    )

def sanitize_loc_record(name: str, area: str, city: str):
    import re, urllib.parse
    b_name = name or ""
    if b_name.lower().startswith("google.com maps search") or "maps/search" in b_name.lower():
        clean = re.sub(r'^(https?://)?(www\.)?google\.com/maps/search/', '', b_name, flags=re.IGNORECASE)
        clean = re.sub(r'@[\d\.-]+,[\d\.-]+.*$', '', clean).strip()
        clean = urllib.parse.unquote(clean).replace('+', ' ').strip()
        if clean and not clean.lower().startswith("google.com"):
            b_name = clean.title()

    def is_coord_or_zoom(val: str) -> bool:
        if not val: return True
        v = val.strip().lower()
        if re.search(r'^@?[\d\.-]+$', v) or re.search(r'^\d+z$', v) or v in ["13z", "14z", "15z", "12z", "16z", "n/a"]:
            return True
        return False

    a_val = "" if is_coord_or_zoom(area) else area.strip()
    c_val = "" if is_coord_or_zoom(city) else city.strip()
    return b_name, a_val, c_val


@router.get("/locations", response_model=LocationListResponse)
def list_locations(db: Session = Depends(get_db)):
    """Lists all stored business locations from the MySQL database with strict location sanitization."""
    locations = db.query(GoogleBusinessLocation).order_by(GoogleBusinessLocation.created_at.desc()).all()
    dirty = False
    for loc in locations:
        b, a, c = sanitize_loc_record(loc.business_name, loc.area, loc.city)
        if loc.business_name != b or loc.area != a or loc.city != c:
            loc.business_name = b
            loc.area = a
            loc.city = c
            dirty = True
    if dirty:
        db.commit()

    return LocationListResponse(
        total=len(locations),
        locations=[LocationResponse.model_validate(loc) for loc in locations]
    )

from sqlalchemy import func
import hashlib

@router.get("/count")
def get_locations_count(db: Session = Depends(get_db)):
    """Returns the total number of business locations stored in MySQL."""
    count = db.query(GoogleBusinessLocation).count()
    return {"total_businesses": count}

@router.post("/locations", response_model=LocationResponse, status_code=201)
def add_location(payload: LocationCreate, db: Session = Depends(get_db)):
    """Adds a new valid business profile record to MySQL database, increasing total count."""
    now = datetime.datetime.utcnow()
    b_name, area_val, city_val = sanitize_loc_record(payload.business_name, payload.area or "", payload.city or "")
    norm_key = f"{b_name.strip().lower()}|{area_val.strip().lower()}|{city_val.strip().lower()}"
    custom_loc_id = f"manual-{hashlib.md5(norm_key.encode('utf-8')).hexdigest()[:16]}"
    
    # Check for existing to prevent duplicate
    existing = db.query(GoogleBusinessLocation).filter(
        (GoogleBusinessLocation.google_location_id == custom_loc_id) |
        (
            (func.lower(GoogleBusinessLocation.business_name) == b_name.lower()) &
            (func.lower(GoogleBusinessLocation.city) == city_val.lower()) &
            (func.lower(GoogleBusinessLocation.area) == area_val.lower())
        )
    ).first()

    if existing:
        if payload.address and payload.address.strip():
            existing.address = payload.address.strip()
        if payload.primary_category:
            existing.primary_category = payload.primary_category
        if payload.rating:
            existing.rating = payload.rating
        if payload.review_count:
            existing.review_count = payload.review_count
        if payload.phone:
            existing.phone = payload.phone
        if payload.website:
            existing.website = payload.website
        if payload.state:
            existing.state = payload.state
        if payload.postal_code:
            existing.postal_code = payload.postal_code
        existing.last_synced_at = now
        existing.status = "ACTIVE"
        db.commit()
        db.refresh(existing)
        return LocationResponse.model_validate(existing)

    new_loc = GoogleBusinessLocation(
        google_location_id=custom_loc_id,
        business_name=b_name,
        primary_category=payload.primary_category,
        rating=payload.rating,
        review_count=payload.review_count,
        phone=payload.phone,
        website=payload.website,
        area=area_val,
        city=city_val,
        state=payload.state,
        postal_code=payload.postal_code,
        address=payload.address.strip() if payload.address else None,
        source=payload.source or "Manual Entry",
        status="ACTIVE",
        last_synced_at=now
    )
    
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    
    return LocationResponse.model_validate(new_loc)


@router.post("/locations/save-batch", response_model=LocationBatchSaveResponse)
def save_batch_locations(payload: LocationBatchSaveRequest, db: Session = Depends(get_db)):
    """
    Saves or imports selected search results into the official `google_business_locations` database table.
    Performs deterministic deduplication using stable provider identifiers (`google_place_id`, `google_location_id`, or normalized name+city+area).
    Updates existing records when present and inserts new unique records, returning updated total count.
    """
    now = datetime.datetime.utcnow()
    saved_count = 0
    updated_count = 0
    saved_models: List[GoogleBusinessLocation] = []

    for item in payload.items:
        b_name, area_val, city_val = sanitize_loc_record(item.business_name, item.area or "", item.city or "")
        if not b_name:
            continue

        # Stable provider ID
        if item.google_place_id and item.google_place_id.strip():
            stable_loc_id = f"google-{item.google_place_id.strip()}"
        elif item.google_location_id and item.google_location_id.strip() and item.google_location_id != "google-undefined":
            stable_loc_id = item.google_location_id.strip()
        else:
            norm_key = f"{b_name.strip().lower()}|{area_val.strip().lower()}|{city_val.strip().lower()}"
            stable_loc_id = f"search-{hashlib.md5(norm_key.encode('utf-8')).hexdigest()[:16]}"

        # Deduplication check
        existing = db.query(GoogleBusinessLocation).filter(
            (GoogleBusinessLocation.google_location_id == stable_loc_id) |
            (
                (func.lower(GoogleBusinessLocation.business_name) == b_name.lower()) &
                (func.lower(GoogleBusinessLocation.city) == city_val.lower()) &
                (func.lower(GoogleBusinessLocation.area) == area_val.lower())
            )
        ).first()

        if existing:
            # Update existing record with latest details
            if item.address and item.address.strip():
                existing.address = item.address.strip()
            if area_val:
                existing.area = area_val
            if city_val:
                existing.city = city_val
            if item.state:
                existing.state = item.state
            if item.postal_code:
                existing.postal_code = item.postal_code
            if item.latitude:
                existing.latitude = item.latitude
            if item.longitude:
                existing.longitude = item.longitude
            if item.primary_category:
                existing.primary_category = item.primary_category
            if item.rating:
                existing.rating = item.rating
            if item.review_count:
                existing.review_count = item.review_count
            if item.phone:
                existing.phone = item.phone
            if item.website:
                existing.website = item.website
            if item.source:
                existing.source = item.source
            existing.last_synced_at = now
            existing.status = "ACTIVE"
            updated_count += 1
            saved_models.append(existing)
        else:
            # Insert new unique record
            new_loc = GoogleBusinessLocation(
                google_location_id=stable_loc_id,
                business_name=b_name,
                primary_category=item.primary_category,
                rating=item.rating,
                review_count=item.review_count,
                phone=item.phone,
                website=item.website,
                area=area_val,
                city=city_val,
                state=item.state,
                postal_code=item.postal_code,
                latitude=item.latitude,
                longitude=item.longitude,
                address=item.address.strip() if item.address else None,
                source=item.source or "Business Search",
                status="ACTIVE",
                last_synced_at=now
            )
            db.add(new_loc)
            saved_count += 1
            saved_models.append(new_loc)

    db.commit()
    for m in saved_models:
        db.refresh(m)

    total_count = db.query(GoogleBusinessLocation).count()
    msg_parts = []
    if saved_count > 0:
        msg_parts.append(f"{saved_count} new unique business{'es' if saved_count > 1 else ''} saved")
    if updated_count > 0:
        msg_parts.append(f"{updated_count} existing record{'s' if updated_count > 1 else ''} updated")
    if not msg_parts:
        msg_parts.append("0 records processed")

    msg = f"Save complete: {', '.join(msg_parts)}."

    return LocationBatchSaveResponse(
        success=True,
        message=msg,
        saved_count=saved_count,
        updated_count=updated_count,
        total_count=total_count,
        locations=[LocationResponse.model_validate(loc) for loc in saved_models]
    )



@router.delete("/locations/{location_id}", response_model=DeleteResponse)
def delete_location(location_id: str = Path(..., description="Location ID to delete"), db: Session = Depends(get_db)):
    """Deletes a business location record from MySQL database, automatically decreasing total count."""
    loc = db.query(GoogleBusinessLocation).filter_by(id=location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Business location with ID '{location_id}' not found.")
        
    db.delete(loc)
    db.commit()
    
    total_count = db.query(GoogleBusinessLocation).count()
    return DeleteResponse(
        success=True,
        message=f"Business record '{loc.business_name}' deleted successfully.",
        deleted_id=location_id,
        total_count=total_count
    )

@router.post("/bulk-scrape", response_model=BulkScrapeResponse)
def bulk_scrape_businesses(payload: BulkScrapeRequest, db: Session = Depends(get_db)):
    """
    Executes bulk web scraping on submitted URLs, extracts valid business profiles,
    saves them to MySQL database, and returns accurate scraping metrics and updated total count.
    """
    if not payload.urls or len(payload.urls) == 0:
        raise HTTPException(status_code=400, detail="Please submit at least one URL or profile query.")
        
    start_time = datetime.datetime.utcnow()
    result = GoogleBusinessService.bulk_scrape_urls(urls=payload.urls, db=db)
    duration_ms = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
    
    try:
        from app.services.audit import log_scraping_job
        log_scraping_job(
            db=db,
            job_type="BULK_GOOGLE",
            query_or_url=f"Bulk {len(payload.urls)} Google URLs",
            status="COMPLETED" if result.get("successfully_scraped", 0) > 0 else "FAILED",
            results_count=result.get("total_businesses_collected", 0),
            duration_ms=duration_ms
        )
    except Exception:
        pass

    loc_responses = [LocationResponse.model_validate(loc) for loc in result["locations"]]
    
    return BulkScrapeResponse(
        success=True,
        message=result["message"],
        total_urls_submitted=result["total_urls_submitted"],
        successfully_scraped=result["successfully_scraped"],
        failed=result["failed"],
        total_businesses_collected=result["total_businesses_collected"],
        total_count=result["total_count"],
        locations=loc_responses
    )

@router.post("/sync", response_model=SyncResponse)
def sync_businesses(db: Session = Depends(get_db)):
    """Triggers location synchronization with official Google Business Profile API and upserts into MySQL."""
    start_time = datetime.datetime.utcnow()
    try:
        locations = GoogleBusinessService.sync_locations(db=db)
        duration_ms = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
        
        try:
            from app.services.audit import log_scraping_job
            log_scraping_job(
                db=db,
                job_type="GOOGLE_API_SYNC",
                query_or_url="Google Business Profile Sync",
                status="COMPLETED",
                results_count=len(locations),
                duration_ms=duration_ms
            )
        except Exception:
            pass

        loc_responses = [LocationResponse.model_validate(loc) for loc in locations]
        total_count = db.query(GoogleBusinessLocation).count()
        
        return SyncResponse(
            success=True,
            message="Business locations synchronized successfully with Google Business Profile API.",
            synced_count=len(loc_responses),
            total_count=total_count,
            locations=loc_responses
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google Business Profile sync error: {e}", exc_info=True)
        duration_ms = int((datetime.datetime.utcnow() - start_time).total_seconds() * 1000)
        try:
            from app.services.audit import log_scraping_job
            log_scraping_job(
                db=db,
                job_type="GOOGLE_API_SYNC",
                query_or_url="Google Business Profile Sync",
                status="FAILED",
                results_count=0,
                error_message=str(e),
                duration_ms=duration_ms
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=502,
            detail="Failed to synchronize business locations from Google API. Please ensure Google My Business APIs are enabled in your Google Cloud project."
        )


@router.get("/export")
def export_businesses_csv(db: Session = Depends(get_db)):
    """Generates and downloads a CSV file containing all stored business locations from MySQL."""
    locations = db.query(GoogleBusinessLocation).order_by(GoogleBusinessLocation.created_at.desc()).all()
    
    csv_data = generate_locations_csv(locations)
    
    try:
        from app.services.audit import log_export_event
        log_export_event(
            db=db,
            export_type="GOOGLE_BUSINESS",
            record_count=len(locations),
            file_name="google_businesses.csv",
            file_format="CSV"
        )
    except Exception:
        pass

    headers = {
        "Content-Disposition": 'attachment; filename="google_businesses.csv"',
        "Content-Type": "text/csv; charset=utf-8"
    }
    
    return Response(content=csv_data, headers=headers, media_type="text/csv")
