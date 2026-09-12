from app.routes.google_auth import router as auth_router
from app.routes.businesses import router as business_router
from app.routes.scraper import router as scraper_router

__all__ = ["auth_router", "business_router", "scraper_router"]
