from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class CompanyScrapeRequest(BaseModel):
    url: str = Field(..., description="Public company/business website URL to scrape")

class KeywordSearchRequest(BaseModel):
    keyword: str = Field(..., description="Business name or category keyword (e.g. KFC, restaurants)")
    location: Optional[str] = Field(None, description="City or area location (e.g. Chennai, T Nagar)")
    count: Optional[int] = Field(50, description="Requested maximum count of matching businesses")

class ScrapedBusinessResponse(BaseModel):
    id: str
    source_url: str
    business_name: str
    alternate_name: Optional[str] = None
    primary_category: Optional[str] = None
    additional_categories: Optional[str] = None
    description: Optional[str] = None
    about_us: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    price_level: Optional[str] = None
    business_status: Optional[str] = None
    open_now: Optional[str] = None

    # Location
    address: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    area: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    plus_code: Optional[str] = None

    # Contact
    phone: Optional[str] = None
    secondary_phone: Optional[str] = None
    phone_landline: Optional[str] = None
    phone_mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    google_maps_url: Optional[str] = None

    # Hours
    monday_hours: Optional[str] = None
    tuesday_hours: Optional[str] = None
    wednesday_hours: Optional[str] = None
    thursday_hours: Optional[str] = None
    friday_hours: Optional[str] = None
    saturday_hours: Optional[str] = None
    sunday_hours: Optional[str] = None
    opening_hours: Optional[str] = None
    today_open_status: Optional[str] = None

    # Google info
    services: Optional[str] = None
    amenities: Optional[str] = None
    accessibility: Optional[str] = None
    payment_options: Optional[str] = None
    delivery: Optional[str] = None
    dine_in: Optional[str] = None
    pickup: Optional[str] = None
    reservation_url: Optional[str] = None
    menu_url: Optional[str] = None

    # Source / Tracking
    source_type: str = "WEBSITE_SCRAPE"
    search_keyword: Optional[str] = None
    search_area: Optional[str] = None
    google_place_id: Optional[str] = None
    google_cid: Optional[str] = None
    data_source: Optional[str] = None
    enrichment_status: Optional[str] = None
    status: str = "ACTIVE"
    scraped_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CompanyScrapeResponse(BaseModel):
    success: bool
    business: Optional[ScrapedBusinessResponse] = None
    businesses: List[ScrapedBusinessResponse] = []
    businesses_count: int = 1
    total_count: int

class KeywordSearchResponse(BaseModel):
    success: bool
    keyword: str
    location: Optional[str] = None
    total_returned: int
    total_count: int
    businesses: List[ScrapedBusinessResponse] = []

class BulkScrapeRequest(BaseModel):
    urls: List[str] = Field(..., description="List of public company website URLs to scrape")

class BulkScrapeResponse(BaseModel):
    success: bool
    total_urls: int
    successfully_scraped: int
    failed: int
    total_businesses: int
    results: List[ScrapedBusinessResponse]

class ScrapedBusinessListResponse(BaseModel):
    success: bool
    total_count: int
    businesses: List[ScrapedBusinessResponse]

class ScraperCountResponse(BaseModel):
    success: bool
    total_count: int

class ScraperDeleteResponse(BaseModel):
    success: bool
    message: str
    deleted_id: str
    total_count: int

class ExportSearchRequest(BaseModel):
    ids: List[str]
