import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class ScrapedBusiness(Base):
    __tablename__ = "scraped_businesses"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    source_url = Column(Text, nullable=False)
    business_name = Column(String(255), nullable=False)
    alternate_name = Column(String(255), nullable=True)
    primary_category = Column(String(255), nullable=True)
    additional_categories = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    about_us = Column(Text, nullable=True)
    rating = Column(String(50), nullable=True)
    review_count = Column(String(50), nullable=True)
    price_level = Column(String(50), nullable=True)
    business_status = Column(String(50), nullable=True)
    open_now = Column(String(50), nullable=True)

    # Location fields
    address = Column(Text, nullable=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    area = Column(String(255), nullable=True)
    neighborhood = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    state = Column(String(255), nullable=True)
    country = Column(String(255), nullable=True)
    postal_code = Column(String(100), nullable=True)
    latitude = Column(String(100), nullable=True)
    longitude = Column(String(100), nullable=True)
    plus_code = Column(String(100), nullable=True)

    # Contact fields
    phone = Column(String(100), nullable=True)
    secondary_phone = Column(String(100), nullable=True)
    phone_landline = Column(String(100), nullable=True)
    phone_mobile = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(Text, nullable=True)
    google_maps_url = Column(Text, nullable=True)

    # Opening Hours fields
    monday_hours = Column(String(255), nullable=True)
    tuesday_hours = Column(String(255), nullable=True)
    wednesday_hours = Column(String(255), nullable=True)
    thursday_hours = Column(String(255), nullable=True)
    friday_hours = Column(String(255), nullable=True)
    saturday_hours = Column(String(255), nullable=True)
    sunday_hours = Column(String(255), nullable=True)
    opening_hours = Column(Text, nullable=True)
    today_open_status = Column(String(100), nullable=True)

    # Other Google Business Info
    services = Column(Text, nullable=True)
    amenities = Column(Text, nullable=True)
    accessibility = Column(Text, nullable=True)
    payment_options = Column(Text, nullable=True)
    delivery = Column(String(50), nullable=True)
    dine_in = Column(String(50), nullable=True)
    pickup = Column(String(50), nullable=True)
    reservation_url = Column(Text, nullable=True)
    menu_url = Column(Text, nullable=True)

    # Source & Tracking
    source_type = Column(String(50), default="WEBSITE_SCRAPE")
    search_keyword = Column(String(255), nullable=True)
    search_area = Column(String(255), nullable=True)
    google_place_id = Column(String(255), nullable=True)
    google_cid = Column(String(255), nullable=True)
    data_source = Column(String(100), nullable=True)
    enrichment_status = Column(String(100), nullable=True)
    status = Column(String(50), default="ACTIVE")
    scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

