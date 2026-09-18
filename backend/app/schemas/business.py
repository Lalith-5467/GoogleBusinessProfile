from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class AccountStatusResponse(BaseModel):
    is_connected: bool
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    email: Optional[str] = None
    connection_status: str = "DISCONNECTED"
    total_locations: int = 0
    auth_url_available: bool = False
    message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class LocationResponse(BaseModel):
    id: str
    google_location_id: Optional[str] = None
    business_name: str
    primary_category: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    area: Optional[str] = "N/A"
    city: Optional[str] = "N/A"
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = "Google API"
    status: str = "ACTIVE"
    last_synced_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class LocationCreate(BaseModel):
    business_name: str = Field(..., min_length=1, description="Business Name")
    primary_category: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = "Manual Entry"

class BulkScrapeRequest(BaseModel):
    urls: List[str] = Field(..., description="List of profile URLs or search queries to scrape")

class BulkScrapeResponse(BaseModel):
    success: bool
    message: str
    total_urls_submitted: int
    successfully_scraped: int
    failed: int
    total_businesses_collected: int
    total_count: int
    locations: List[LocationResponse]

class LocationListResponse(BaseModel):
    total: int
    locations: List[LocationResponse]

class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_count: int
    total_count: int
    locations: List[LocationResponse]

class DeleteResponse(BaseModel):
    success: bool
    message: str
    deleted_id: str
    total_count: int

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class LocationBatchSaveItem(BaseModel):
    id: Optional[str] = None
    google_location_id: Optional[str] = None
    google_place_id: Optional[str] = None
    business_name: str = Field(..., min_length=1, description="Business Name")
    area: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = "Business Search"
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    primary_category: Optional[str] = None

class LocationBatchSaveRequest(BaseModel):
    items: List[LocationBatchSaveItem] = Field(..., min_length=1, description="List of business records to save")

class LocationBatchSaveResponse(BaseModel):
    success: bool
    message: str
    saved_count: int
    updated_count: int
    total_count: int
    locations: List[LocationResponse]

