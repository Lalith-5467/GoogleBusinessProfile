import sys
import asyncio
import logging

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routes import auth_router, business_router, scraper_router, admin_router
from app.services.auth import seed_default_plans_if_empty, bootstrap_super_admin, is_super_admin_exists

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("google-business-backend")

# Ensure database tables exist in MySQL
try:
    Base.metadata.create_all(bind=engine)
    
    # Non-destructive column migrations for scraped_businesses
    from sqlalchemy import text
    new_cols = [
        "alternate_name VARCHAR(255) NULL",
        "primary_category VARCHAR(255) NULL",
        "additional_categories TEXT NULL",
        "rating VARCHAR(50) NULL",
        "review_count VARCHAR(50) NULL",
        "price_level VARCHAR(50) NULL",
        "business_status VARCHAR(50) NULL",
        "open_now VARCHAR(50) NULL",
        "address_line_1 VARCHAR(255) NULL",
        "address_line_2 VARCHAR(255) NULL",
        "neighborhood VARCHAR(255) NULL",
        "district VARCHAR(255) NULL",
        "state VARCHAR(255) NULL",
        "country VARCHAR(255) NULL",
        "postal_code VARCHAR(100) NULL",
        "latitude VARCHAR(100) NULL",
        "longitude VARCHAR(100) NULL",
        "plus_code VARCHAR(100) NULL",
        "secondary_phone VARCHAR(100) NULL",
        "phone_mobile VARCHAR(100) NULL",
        "google_maps_url TEXT NULL",
        "monday_hours VARCHAR(255) NULL",
        "tuesday_hours VARCHAR(255) NULL",
        "wednesday_hours VARCHAR(255) NULL",
        "thursday_hours VARCHAR(255) NULL",
        "friday_hours VARCHAR(255) NULL",
        "saturday_hours VARCHAR(255) NULL",
        "sunday_hours VARCHAR(255) NULL",
        "opening_hours TEXT NULL",
        "today_open_status VARCHAR(100) NULL",
        "amenities TEXT NULL",
        "accessibility TEXT NULL",
        "payment_options TEXT NULL",
        "delivery VARCHAR(50) NULL",
        "dine_in VARCHAR(50) NULL",
        "pickup VARCHAR(50) NULL",
        "reservation_url TEXT NULL",
        "menu_url TEXT NULL",
        "search_keyword VARCHAR(255) NULL",
        "search_area VARCHAR(255) NULL",
        "google_place_id VARCHAR(255) NULL",
        "google_cid VARCHAR(255) NULL",
        "data_source VARCHAR(100) NULL",
        "enrichment_status VARCHAR(100) NULL"
    ]
    with engine.connect() as conn:
        for col_def in new_cols:
            col_name = col_def.split()[0]
            try:
                conn.execute(text(f"ALTER TABLE scraped_businesses ADD COLUMN {col_def}"))
                conn.commit()
                logger.info(f"Added column '{col_name}' to scraped_businesses table.")
            except Exception:
                pass

        # Non-destructive column migrations for google_business_locations
        location_cols = [
            "primary_category VARCHAR(255) NULL",
            "rating VARCHAR(50) NULL",
            "review_count VARCHAR(50) NULL",
            "phone VARCHAR(100) NULL",
            "website TEXT NULL",
            "state VARCHAR(255) NULL",
            "postal_code VARCHAR(100) NULL",
            "latitude VARCHAR(100) NULL",
            "longitude VARCHAR(100) NULL"
        ]
        for col_def in location_cols:
            col_name = col_def.split()[0]
            try:
                conn.execute(text(f"ALTER TABLE google_business_locations ADD COLUMN {col_def}"))
                conn.commit()
                logger.info(f"Added column '{col_name}' to google_business_locations table.")
            except Exception:
                pass

    logger.info("Database tables initialized successfully.")
    
    # Initialize default subscription plans & optional env super admin
    try:
        init_db = SessionLocal()
        seed_default_plans_if_empty(init_db)
        if settings.SUPER_ADMIN_EMAIL and settings.SUPER_ADMIN_PASSWORD and not is_super_admin_exists(init_db):
            bootstrap_super_admin(
                db=init_db,
                email=settings.SUPER_ADMIN_EMAIL,
                password=settings.SUPER_ADMIN_PASSWORD,
                full_name="System Super Admin"
            )
        init_db.close()
    except Exception as se:
        logger.warning(f"Note on startup seeding: {se}")

except Exception as e:
    logger.error(f"Failed to initialize database tables: {e}")

app = FastAPI(
    title="Google Business Profile Backend API",
    description="Python FastAPI backend service for managing Google Business Profiles, OAuth authentication, sync, CSV exports, and Super Admin panel.",
    version="1.0.0"
)

# CORS Configuration
origins = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router)
app.include_router(business_router)
app.include_router(scraper_router)
app.include_router(admin_router)

@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint to verify backend service status."""
    db_target = "not-configured"
    if settings.DATABASE_URL:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(settings.DATABASE_URL)
            db_target = f"{parsed.hostname}:{parsed.port or 3306}{parsed.path}"
        except Exception:
            db_target = settings.DATABASE_URL.split("@")[-1]

    return {
        "status": "healthy",
        "service": "google-business-backend",
        "database": db_target,
        "port": settings.PORT,
        "environment": settings.ENVIRONMENT
    }

# =============================================================================
# Production Static Files & SPA Fallback Routing
# =============================================================================
frontend_dist_candidates = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")),
    os.path.abspath("frontend/dist"),
    os.path.abspath("/app/frontend/dist"),
]

frontend_dist = next((p for p in frontend_dist_candidates if os.path.isdir(p) and os.path.isfile(os.path.join(p, "index.html"))), None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_app(full_path: str):
        # Do not hijack API or docs routes
        if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
            raise HTTPException(status_code=404, detail="Resource not found")
        
        target_file = os.path.join(frontend_dist, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)
        
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    loop_setting = "asyncio:ProactorEventLoop" if sys.platform == "win32" else "asyncio"
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True, loop=loop_setting)
