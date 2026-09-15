import unittest
from unittest.mock import patch, MagicMock
from app.config import Settings
from app.database import Base
from app.schemas.business import AccountStatusResponse
from app.services.google_business import GoogleBusinessService
from app.services.web_scraper import WebScraperService
from app.services.csv_export import generate_locations_csv
from app.services.scraper_csv_export import generate_scraped_businesses_csv
from app.models.business import GoogleBusinessLocation
from app.models.scraped_business import ScrapedBusiness

class TestProductionReadiness(unittest.TestCase):
    def test_database_url_normalization(self):
        """Verify that mysql:// is automatically converted to mysql+pymysql:// for SQLAlchemy."""
        s = Settings(
            DATABASE_URL="mysql://user:secret@db.host.internal:3306/production_db",
            _env_file=None
        )
        self.assertTrue(s.DATABASE_URL.startswith("mysql+pymysql://"))
        self.assertEqual(
            s.DATABASE_URL,
            "mysql+pymysql://user:secret@db.host.internal:3306/production_db"
        )

    def test_frontend_url_normalization(self):
        """Verify that trailing slashes are stripped from FRONTEND_URL to avoid CORS mismatches."""
        s = Settings(
            FRONTEND_URL="https://mybusinessapp.com///",
            _env_file=None
        )
        self.assertEqual(s.FRONTEND_URL, "https://mybusinessapp.com")

    def test_cors_origins_resolution(self):
        """Verify that get_cors_origins includes FRONTEND_URL and any CORS_ORIGINS."""
        s = Settings(
            FRONTEND_URL="https://app.example.com",
            CORS_ORIGINS="https://extra1.example.com, https://extra2.example.com/",
            _env_file=None
        )
        origins = s.get_cors_origins()
        self.assertIn("https://app.example.com", origins)
        self.assertIn("https://extra1.example.com", origins)
        self.assertIn("https://extra2.example.com", origins)
        self.assertIn("http://localhost:3000", origins)

    def test_oauth_unconfigured_status(self):
        """Verify is_oauth_configured returns False when credentials are empty."""
        with patch("app.services.google_business.settings.GOOGLE_CLIENT_ID", ""), \
             patch("app.services.google_business.settings.GOOGLE_CLIENT_SECRET", ""):
            self.assertFalse(GoogleBusinessService.is_oauth_configured())

    def test_locations_csv_export(self):
        """Verify that CSV export generates valid RFC-4180 CSV without exceptions."""
        mock_loc = GoogleBusinessLocation(
            id="test-uuid-1",
            business_name="Acme Bakery",
            area="Downtown",
            city="Metropolis",
            address="123 Main St",
            source="Manual Entry",
            status="ACTIVE"
        )
        csv_text = generate_locations_csv([mock_loc])
        self.assertIsInstance(csv_text, str)
        self.assertIn("Acme Bakery", csv_text)
        self.assertIn("Metropolis", csv_text)

    def test_scraped_businesses_csv_export(self):
        """Verify that Scraped Business CSV export functions correctly."""
        mock_scraped = ScrapedBusiness(
            id="scraped-1",
            source_url="https://apex.example.com",
            business_name="Apex Solutions",
            website="https://apex.example.com",
            phone="+1234567890",
            email="info@apex.example.com",
            data_source="WEBSITE_DIRECT"
        )
        csv_text = generate_scraped_businesses_csv([mock_scraped])
        self.assertIsInstance(csv_text, str)
        self.assertIn("Apex Solutions", csv_text)
        self.assertIn("https://apex.example.com", csv_text)

    def test_missing_playwright_browser_handling(self):
        """Verify that when the browser is missing, endpoints return clean 503 error instead of raw server paths."""
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)

        with patch("app.services.web_scraper.WebScraperService.scrape_single_website") as mock_scrape:
            mock_scrape.side_effect = ValueError(
                "Website scraping is temporarily unavailable because the scraping browser is not installed."
            )
            response = client.post("/api/scraper/company", json={"url": "https://example.com"})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(
                response.json()["detail"],
                "Website scraping is temporarily unavailable because the scraping browser is not installed."
            )

        with patch("app.services.web_scraper.WebScraperService.search_keyword_location") as mock_search:
            mock_search.side_effect = ValueError(
                "Website scraping is temporarily unavailable because the scraping browser is not installed."
            )
            response = client.post("/api/scraper/search", json={"keyword": "cafe", "location": "paris"})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(
                response.json()["detail"],
                "Website scraping is temporarily unavailable because the scraping browser is not installed."
            )

if __name__ == "__main__":
    unittest.main()
