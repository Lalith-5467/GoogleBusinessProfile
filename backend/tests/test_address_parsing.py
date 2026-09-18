import unittest
from app.services.web_scraper import WebScraperService
from app.utils.helpers import (
    clean_address_text,
    resolve_location,
    extract_place_id,
    extract_pin_code
)
from app.schemas.scraper import ScrapedBusinessResponse

class TestAddressParsingAndFieldExtraction(unittest.TestCase):
    def test_user_bug_example_duplication(self):
        """Test the user's exact reported bug with duplicate address components and phone."""
        raw = "Yagnavalkiya Bhavanam RdOpen, 0422 265 6422, College, Yagnavalkiya Bhavanam Rd, 0422 265 6422"
        cleaned = clean_address_text(raw)
        self.assertEqual(cleaned, "Yagnavalkiya Bhavanam Rd")
        self.assertNotIn("0422", cleaned)
        self.assertNotIn("Open", cleaned)
        self.assertNotIn("College", cleaned)

        area, city, state, pin, plus, dist, country = WebScraperService._parse_structured_address(cleaned, "Coimbatore")
        self.assertEqual(city, "Coimbatore")
        self.assertEqual(dist, "Coimbatore")
        self.assertEqual(state, "Tamil Nadu")
        self.assertEqual(country, "India")
        self.assertEqual(area, "Yagnavalkiya Bhavanam Rd")

    def test_salem_businesses(self):
        """Test Salem businesses that had concatenated noise and missing state/district/country."""
        test_cases = [
            ("24, Greenways RdModest restaurant for Pan-Asian fare, Fusion restaurant", "Salem", "Greenways Rd"),
            ("No. 4 brindhavan road, 4th Cross St, North Indian restaurant", "Salem", "No. 4 brindhavan road, 4th Cross St"),
            ("3/1 M.G.Road, Sarada College Rd, next to A.p medical center, Re, Dessert restaurant", "Salem", "3/1 M.G.Road, Sarada College Rd"),
            ("Central Avenue, Omalur Main Rd, Restaurant", "Salem", "Central Avenue, Omalur Main Rd"),
            ("1-50, Brindavan Rd, Restaurant", "Salem", "Brindavan Rd")
        ]
        for raw, search_loc, expected_area in test_cases:
            cleaned = clean_address_text(raw)
            self.assertNotIn("restaurant", cleaned.lower())
            area, city, state, pin, plus, dist, country = WebScraperService._parse_structured_address(cleaned, search_loc)
            self.assertEqual(city, "Salem")
            self.assertEqual(dist, "Salem")
            self.assertEqual(state, "Tamil Nadu")
            self.assertEqual(country, "India")
            self.assertEqual(area, expected_area)

    def test_place_id_extraction(self):
        """Test Google Place ID extraction from Maps URLs."""
        url1 = "https://www.google.com/maps/place/KFC/data=!4m7!3m6!1s0x3a5263004c780d15:0xf471dabe479ca36c!8m2!3d13.0983632!4d80.1378211!16s%2Fg%2F11w4kt22_y!19sChIJFQ14TABjUjoRbKOcR77acfQ?authuser=0"
        self.assertEqual(extract_place_id(url1), "ChIJFQ14TABjUjoRbKOcR77acfQ")

        url2 = "https://www.google.com/maps/place/data=!4m2!3m1!1s0x0:0x0?q=place_id:ChIJyZGn6YjxqzsRol0eMiJbq-s"
        self.assertEqual(extract_place_id(url2), "ChIJyZGn6YjxqzsRol0eMiJbq-s")

    def test_pin_code_extraction(self):
        """Test 6-digit Indian postal code extraction."""
        addr = "Sri Gokulam Hospital, 3/636, Meyyanur Rd, Meyyanur, Salem, Tamil Nadu 636004"
        self.assertEqual(extract_pin_code(addr), "636004")

    def test_schema_validator(self):
        """Test ScrapedBusinessResponse schema auto-cleaning and location resolution."""
        data = {
            "id": "test-123",
            "source_url": "https://example.com",
            "business_name": "Salem Test Cafe",
            "address": "12, Crosscut Rd, Salem",
            "area": "12, Crosscut Rd, Salem",
            "city": "Salem",
            "state": None,
            "district": None,
            "country": None,
            "google_maps_url": "https://www.google.com/maps/place/data=!19sChIJFQ14TABjUjoRbKOcR77acfQ",
            "services": "Google Maps Search Result",
            "status": "ACTIVE"
        }
        resp = ScrapedBusinessResponse.model_validate(data)
        self.assertEqual(resp.city, "Salem")
        self.assertEqual(resp.district, "Salem")
        self.assertEqual(resp.state, "Tamil Nadu")
        self.assertEqual(resp.country, "India")
        self.assertEqual(resp.google_place_id, "ChIJFQ14TABjUjoRbKOcR77acfQ")
        self.assertIsNone(resp.services)

if __name__ == "__main__":
    unittest.main()
