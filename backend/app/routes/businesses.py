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
    custom_loc_id = f"manual-{abs(hash(b_name + (area_val or '')))}"
    
    new_loc = GoogleBusinessLocation(
        google_location_id=custom_loc_id,
        business_name=b_name,
        area=area_val,
        city=city_val,
        address=payload.address.strip() if payload.address else None,
        source=payload.source or "Manual Entry",
        status="ACTIVE",
        last_synced_at=now
    )
    
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    
    return LocationResponse.model_validate(new_loc)

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
        
    result = GoogleBusinessService.bulk_scrape_urls(urls=payload.urls, db=db)
    
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
    try:
        locations = GoogleBusinessService.sync_locations(db=db)
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
        raise HTTPException(
            status_code=502,
            detail="Failed to synchronize business locations from Google API. Please ensure Google My Business APIs are enabled in your Google Cloud project."
        )

@router.get("/export")
def export_businesses_csv(db: Session = Depends(get_db)):
    """Generates and downloads a CSV file containing all stored business locations from MySQL."""
    locations = db.query(GoogleBusinessLocation).order_by(GoogleBusinessLocation.created_at.desc()).all()
    
    csv_data = generate_locations_csv(locations)
    
    headers = {
        "Content-Disposition": 'attachment; filename="google_businesses.csv"',
        "Content-Type": "text/csv; charset=utf-8"
    }
    
    return Response(content=csv_data, headers=headers, media_type="text/csv")
