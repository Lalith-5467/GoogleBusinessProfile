import os
import logging
from typing import Optional, List
from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger("google-business-backend")

class Settings(BaseSettings):
    PORT: int = 8000
    DATABASE_URL: str = "mysql+pymysql://root:@127.0.0.1:3306/googlebusinessprofile"
    FRONTEND_URL: str = "https://googlebusinessprofile.mccmrfip.in"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = ""
    
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://googlebusinessprofile.mccmrfip.in/api/google-business/auth/callback"
    GOOGLE_PLACES_API_KEY: str = ""

    # Security & Super Admin Bootstrap
    JWT_SECRET_KEY: str = "gbp-super-admin-secure-jwt-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    SUPER_ADMIN_EMAIL: str = ""
    SUPER_ADMIN_PASSWORD: str = ""
    BOOTSTRAP_SECRET: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v:
            return "mysql+pymysql://root:@127.0.0.1:3306/googlebusinessprofile"
        v = v.strip()
        # SQLAlchemy 2.0 requires dialect driver specification for MySQL
        if v.startswith("mysql://"):
            v = "mysql+pymysql://" + v[len("mysql://"):]
        return v

    @field_validator("FRONTEND_URL", mode="before")
    @classmethod
    def normalize_frontend_url(cls, v: str) -> str:
        if not v:
            return "https://googlebusinessprofile.mccmrfip.in"
        return v.strip().rstrip("/")

    @field_validator("GOOGLE_REDIRECT_URI", mode="before")
    @classmethod
    def normalize_redirect_uri(cls, v: str) -> str:
        if not v or not v.strip():
            return ""
        return v.strip()

    def get_google_redirect_uri(self) -> str:
        """Returns configured redirect URI or dynamically derives from FRONTEND_URL."""
        if self.GOOGLE_REDIRECT_URI and self.GOOGLE_REDIRECT_URI.strip():
            return self.GOOGLE_REDIRECT_URI.strip()
        frontend = self.FRONTEND_URL.rstrip("/")
        return f"{frontend}/api/google-business/auth/callback"

    def get_cors_origins(self) -> List[str]:
        """Returns a list of unique, valid CORS origin URLs."""
        if self.CORS_ORIGINS and self.CORS_ORIGINS.strip() == "*":
            return ["*"]

        origins = {
            self.FRONTEND_URL.rstrip("/"),
            "https://googlebusinessprofile.mccmrfip.in",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost",
            "https://localhost"
        }
        
        # Add root domain and variations if configured
        if self.FRONTEND_URL:
            clean_front = self.FRONTEND_URL.rstrip("/")
            origins.add(clean_front)
            if clean_front.startswith("https://"):
                origins.add("http://" + clean_front[8:])
            elif clean_front.startswith("http://"):
                origins.add("https://" + clean_front[7:])

        if self.CORS_ORIGINS:
            for item in self.CORS_ORIGINS.split(","):
                clean = item.strip().rstrip("/")
                if clean:
                    origins.add(clean)
        return list(origins)

    
    class Config:
        env_file = (".env", "../.env", "backend/.env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Production warnings for database configuration
if settings.ENVIRONMENT.lower() == "production":
    if "127.0.0.1" in settings.DATABASE_URL or "localhost" in settings.DATABASE_URL:
        logger.warning(
            "[PRODUCTION WARNING] DATABASE_URL is pointing to a local MySQL instance (localhost/127.0.0.1). "
            "Ensure a managed production MySQL database is configured via DATABASE_URL."
        )

