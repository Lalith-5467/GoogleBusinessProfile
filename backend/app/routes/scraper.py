from typing import List
from fastapi import APIRouter, Depends, Response, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.web_scraper import WebScraperService
from app.services.scraper_csv_export import generate_scraped_businesses_csv
from app.models.scraped_business import ScrapedBusiness
from app.schemas.scraper import (
    CompanyScrapeRequest,
    CompanyScrapeResponse,
    KeywordSearchRequest,
    KeywordSearchResponse,
    ScrapedBusinessResponse,
    BulkScrapeRequest,
    BulkScrapeResponse,
    ScrapedBusinessListResponse,
    ScraperCountResponse,
    ScraperDeleteResponse,
    ExportSearchRequest
)

router = APIRouter(prefix="/api/scraper", tags=["Web Business Scraper"])

@router.post("/company", response_model=CompanyScrapeResponse)
async def scrape_single_company(payload: CompanyScrapeRequest, db: Session = Depends(get_db)):
    """
    Scrapes a target URL (Google Maps Search, Google Maps Place, YouTube, or Company Website) using Playwright,
    extracts 1 or multiple business records, upserts records in MySQL (`scraped_businesses`), and returns businesses + total_count.
    """
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="A valid website URL is required.")

    try:
        res = await WebScraperService.scrape_single_website(url=payload.url, db=db)
        biz_models = [ScrapedBusinessResponse.model_validate(b) for b in res["businesses"]]
        primary_biz = ScrapedBusinessResponse.model_validate(res["primary_business"]) if res.get("primary_business") else (biz_models[0] if biz_models else None)
        
        return CompanyScrapeResponse(
            success=True,
            business=primary_biz,
            businesses=biz_models,
            businesses_count=res["businesses_count"],
            total_count=res["total_count"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Website could not be scraped. Reason: {str(e)}")


@router.post("/search", response_model=KeywordSearchResponse)
async def search_businesses_keyword_location(payload: KeywordSearchRequest, db: Session = Depends(get_db)):
    """
    Searches for businesses using keyword + area/location (e.g. KFC + Chennai),
    extracts matching place records via Playwright, saves them in MySQL, and returns records.
    """
    if not payload.keyword or not payload.keyword.strip():
        raise HTTPException(status_code=400, detail="A business keyword or name is required.")

    try:
        res = await WebScraperService.search_keyword_location(
            keyword=payload.keyword,
            location=payload.location,
            db=db,
            max_count=payload.count
        )
        biz_models = [ScrapedBusinessResponse.model_validate(b) for b in res["businesses"]]

        return KeywordSearchResponse(
            success=True,
            keyword=res["keyword"],
            location=res["location"],
            total_returned=res["total_returned"],
            total_count=res["total_count"],
            businesses=biz_models
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Business search failed. Reason: {str(e)}")


@router.post("/bulk", response_model=BulkScrapeResponse)
async def bulk_scrape_companies(payload: BulkScrapeRequest, db: Session = Depends(get_db)):
    """
    Bulk scrapes multiple public company website URLs using Playwright with controlled concurrency,
    stores successful records in MySQL, and returns comprehensive metrics summary.
    """
    if not payload.urls or len(payload.urls) == 0:
        raise HTTPException(status_code=400, detail="Please submit at least one public website URL.")

    result = await WebScraperService.scrape_bulk_websites(urls=payload.urls, db=db)

    results_responses = [ScrapedBusinessResponse.model_validate(b) for b in result["results"]]

    return BulkScrapeResponse(
        success=True,
        total_urls=result["total_urls"],
        successfully_scraped=result["successfully_scraped"],
        failed=result["failed"],
        total_businesses=result["total_businesses"],
        results=results_responses
    )

@router.get("/businesses", response_model=ScrapedBusinessListResponse)
def list_scraped_businesses(db: Session = Depends(get_db)):
    """Lists all stored website scraped business records from MySQL database."""
    records = db.query(ScrapedBusiness).order_by(ScrapedBusiness.scraped_at.desc()).all()
    biz_responses = [ScrapedBusinessResponse.model_validate(b) for b in records]
    return ScrapedBusinessListResponse(
        success=True,
        total_count=len(biz_responses),
        businesses=biz_responses
    )

@router.get("/count", response_model=ScraperCountResponse)
def get_scraped_businesses_count(db: Session = Depends(get_db)):
    """Returns the authoritative total count of scraped businesses stored in MySQL."""
    count = db.query(ScrapedBusiness).count()
    return ScraperCountResponse(success=True, total_count=count)

@router.delete("/businesses/{id}", response_model=ScraperDeleteResponse)
def delete_scraped_business(id: str = Path(..., description="ID of scraped business to delete"), db: Session = Depends(get_db)):
    """Deletes a scraped business record from MySQL table `scraped_businesses` and returns updated count."""
    record = db.query(ScrapedBusiness).filter_by(id=id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Scraped business record with ID '{id}' not found.")

    biz_name = record.business_name
    db.delete(record)
    db.commit()

    total_count = db.query(ScrapedBusiness).count()
    return ScraperDeleteResponse(
        success=True,
        message=f"Scraped business record '{biz_name}' deleted successfully from MySQL.",
        deleted_id=id,
        total_count=total_count
    )

@router.get("/export")
def export_scraped_businesses_csv(db: Session = Depends(get_db)):
    """Generates and downloads `scraped_businesses.csv` containing actual MySQL records."""
    records = db.query(ScrapedBusiness).order_by(ScrapedBusiness.scraped_at.desc()).all()
    csv_data = generate_scraped_businesses_csv(records)

    headers = {
        "Content-Disposition": 'attachment; filename="scraped_businesses.csv"',
        "Content-Type": "text/csv; charset=utf-8"
    }

    return Response(content=csv_data, headers=headers, media_type="text/csv")

@router.post("/export-search")
def export_search_results_csv(payload: ExportSearchRequest, db: Session = Depends(get_db)):
    """Generates and downloads a CSV containing ONLY the requested specific MySQL records."""
    if not payload.ids:
        # Return empty CSV with just headers if no IDs are provided
        csv_data = generate_scraped_businesses_csv([])
    else:
        records = db.query(ScrapedBusiness).filter(ScrapedBusiness.id.in_(payload.ids)).all()
        csv_data = generate_scraped_businesses_csv(records)

    headers = {
        "Content-Disposition": 'attachment; filename="search_results.csv"',
        "Content-Type": "text/csv; charset=utf-8"
    }

    return Response(content=csv_data, headers=headers, media_type="text/csv")
