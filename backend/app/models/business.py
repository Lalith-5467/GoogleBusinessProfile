import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class GoogleBusinessAccount(Base):
    __tablename__ = "google_business_accounts"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    application_user_id = Column(String(191), nullable=True)
    google_account_id = Column(String(255), nullable=False, unique=True)
    account_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    connection_status = Column(String(50), default="CONNECTED")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    locations = relationship("GoogleBusinessLocation", back_populates="account", cascade="all, delete-orphan")

class GoogleBusinessLocation(Base):
    __tablename__ = "google_business_locations"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    google_business_account_id = Column(String(191), ForeignKey("google_business_accounts.id", ondelete="CASCADE"), nullable=True)
    google_location_id = Column(String(255), nullable=True, unique=True)
    business_name = Column(String(255), nullable=False)
    area = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    source = Column(String(191), default="Google API")
    status = Column(String(50), default="ACTIVE")
    last_synced_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("GoogleBusinessAccount", back_populates="locations")
