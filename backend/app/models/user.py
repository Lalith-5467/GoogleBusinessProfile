import uuid
import json
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="CUSTOMER", nullable=False)  # SUPER_ADMIN, ADMIN, CUSTOMER
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, INACTIVE, SUSPENDED
    plan_id = Column(String(191), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    permissions = relationship("AdminPermission", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    export_logs = relationship("ExportLog", back_populates="user", cascade="all, delete-orphan")
    scraping_jobs = relationship("ScrapingJob", back_populates="user", cascade="all, delete-orphan")


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    user_id = Column(String(191), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    can_manage_users = Column(Boolean, default=True)
    can_manage_businesses = Column(Boolean, default=True)
    can_manage_scrapers = Column(Boolean, default=True)
    can_manage_exports = Column(Boolean, default=True)
    can_manage_plans = Column(Boolean, default=False)
    can_view_analytics = Column(Boolean, default=True)
    can_view_audit_logs = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="permissions")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    name = Column(String(50), nullable=False, unique=True)  # FREE, BASIC, PRO
    display_name = Column(String(100), nullable=False)
    price_monthly = Column(Float, default=0.0)
    search_limit = Column(Integer, default=50)
    scrape_limit = Column(Integer, default=20)
    bulk_scrape_limit = Column(Integer, default=5)
    export_limit = Column(Integer, default=10)
    features_json = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    user_id = Column(String(191), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_email = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(191), nullable=True)
    ip_address = Column(String(100), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")


class ExportLog(Base):
    __tablename__ = "export_logs"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    user_id = Column(String(191), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String(255), nullable=True)
    export_type = Column(String(50), nullable=False)  # GOOGLE_BUSINESS, SCRAPER, SEARCH_FILTERED
    record_count = Column(Integer, default=0)
    file_name = Column(String(255), nullable=False)
    file_format = Column(String(50), default="CSV")
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="export_logs")


class ScrapingJob(Base):
    __tablename__ = "scraping_jobs"

    id = Column(String(191), primary_key=True, default=generate_uuid)
    user_id = Column(String(191), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    job_type = Column(String(50), nullable=False)  # SINGLE, BULK, KEYWORD_SEARCH
    query_or_url = Column(Text, nullable=False)
    status = Column(String(50), default="COMPLETED")  # COMPLETED, FAILED, RUNNING
    results_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="scraping_jobs")
