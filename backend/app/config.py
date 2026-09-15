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
        if not v:
            return "https://googlebusinessprofile.mccmrfip.in/api/google-business/auth/callback"
        return v.strip()

    def get_cors_origins(self) -> List[str]:
        """Returns a list of unique, valid CORS origin URLs."""
        origins = {
            self.FRONTEND_URL,
            "https://googlebusinessprofile.mccmrfip.in",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        }
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

