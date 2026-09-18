import unittest
from app.services.google_places import _parse_address_components, _normalize_place_data

class TestGooglePlacesEnrichment(unittest.TestCase):
    def test_structured_address_components_parsing(self):
        components = [
            {"long_name": "123", "types": ["street_number"]},
            {"long_name": "Anna Salai", "types": ["route"]},
            {"long_name": "T Nagar", "types": ["sublocality_level_1", "sublocality"]},
            {"long_name": "Chennai", "types": ["locality"]},
            {"long_name": "Chennai District", "types": ["administrative_area_level_2"]},
            {"long_name": "Tamil Nadu", "types": ["administrative_area_level_1"]},
            {"long_name": "India", "types": ["country"]},
            {"long_name": "600017", "types": ["postal_code"]},
        ]
        parsed = _parse_address_components(components)
        self.assertEqual(parsed["address_line_1"], "123 Anna Salai")
        self.assertEqual(parsed["area"], "T Nagar")
        self.assertEqual(parsed["city"], "Chennai")
        self.assertEqual(parsed["district"], "Chennai District")
        self.assertEqual(parsed["state"], "Tamil Nadu")
        self.assertEqual(parsed["country"], "India")
        self.assertEqual(parsed["postal_code"], "600017")

    def test_new_places_api_address_components(self):
        components = [
            {"longText": "45", "types": ["street_number"]},
            {"longText": "MG Road", "types": ["route"]},
            {"longText": "Bengaluru", "types": ["locality"]},
            {"longText": "Karnataka", "types": ["administrative_area_level_1"]},
            {"longText": "560001", "types": ["postal_code"]},
        ]
        parsed = _parse_address_components(components)
        self.assertEqual(parsed["address_line_1"], "45 MG Road")
        self.assertEqual(parsed["city"], "Bengaluru")
        self.assertEqual(parsed["state"], "Karnataka")
        self.assertEqual(parsed["postal_code"], "560001")

    def test_normalize_place_data_new_api_format(self):
        raw_new_api = {
            "id": "places/ChIJN1t_tDeuEmsRUsoyG83frY4",
            "displayName": {"text": "KFC", "languageCode": "en"},
            "formattedAddress": "123 Anna Salai, T Nagar, Chennai, Tamil Nadu 600017, India",
            "nationalPhoneNumber": "(044) 2834 1234",
            "internationalPhoneNumber": "+91 44 2834 1234",
            "websiteUri": "https://online.kfc.co.in",
            "googleMapsUri": "https://maps.google.com/?cid=102",
            "rating": 4.3,
            "userRatingCount": 1250,
            "priceLevel": "PRICE_LEVEL_MODERATE",
            "businessStatus": "OPERATIONAL",
            "regularOpeningHours": {
                "openNow": True,
                "weekdayDescriptions": [
                    "Monday: 10:00 AM – 11:00 PM",
                    "Tuesday: 10:00 AM – 11:00 PM",
                    "Wednesday: 10:00 AM – 11:00 PM",
                    "Thursday: 10:00 AM – 11:00 PM",
                    "Friday: 10:00 AM – 11:00 PM",
                    "Saturday: 10:00 AM – 11:00 PM",
                    "Sunday: 10:00 AM – 11:00 PM",
                ]
            },
            "editorialSummary": {"text": "Fast-food chain known for fried chicken."},
            "primaryTypeDisplayName": {"text": "Fast Food Restaurant"},
            "types": ["fast_food_restaurant", "restaurant", "food", "point_of_interest", "establishment"],
            "paymentOptions": {
                "acceptsCreditCards": True,
                "acceptsDebitCards": True,
                "acceptsNfc": True
            },
            "accessibilityOptions": {
                "wheelchairAccessibleEntrance": True,
                "wheelchairAccessibleRestroom": True
            },
            "parkingOptions": {
                "freeParkingLot": True
            },
            "delivery": True,
            "dineIn": True,
            "takeout": True,
            "reservable": False,
            "outdoorSeating": True,
            "goodForChildren": True,
            "goodForGroups": True,
            "location": {"latitude": 13.0418, "longitude": 80.2341},
            "plusCode": {"globalCode": "7M5236RH+Q4"},
            "addressComponents": [
                {"longText": "123", "types": ["street_number"]},
                {"longText": "Anna Salai", "types": ["route"]},
                {"longText": "T Nagar", "types": ["sublocality_level_1"]},
                {"longText": "Chennai", "types": ["locality"]},
                {"longText": "Tamil Nadu", "types": ["administrative_area_level_1"]},
                {"longText": "India", "types": ["country"]},
                {"longText": "600017", "types": ["postal_code"]},
            ]
        }

        normalized = _normalize_place_data(raw_new_api)

        self.assertEqual(normalized["google_place_id"], "ChIJN1t_tDeuEmsRUsoyG83frY4")
        self.assertEqual(normalized["business_name"], "KFC")
        self.assertEqual(normalized["primary_category"], "Fast Food Restaurant")
        self.assertEqual(normalized["phone"], "+91 44 2834 1234")
        self.assertEqual(normalized["secondary_phone"], "(044) 2834 1234")
        self.assertEqual(normalized["website"], "https://online.kfc.co.in")
        self.assertEqual(normalized["google_maps_url"], "https://maps.google.com/?cid=102")
        self.assertEqual(normalized["rating"], "4.3")
        self.assertEqual(normalized["review_count"], "1250")
        self.assertEqual(normalized["price_level"], "Moderate ($$)")
        self.assertEqual(normalized["business_status"], "Operational")
        self.assertEqual(normalized["open_now"], "Open")
        self.assertEqual(normalized["monday_hours"], "10:00 AM – 11:00 PM")
        self.assertEqual(normalized["sunday_hours"], "10:00 AM – 11:00 PM")
        self.assertEqual(normalized["description"], "Fast-food chain known for fried chicken.")
        self.assertEqual(normalized["about_us"], "Fast-food chain known for fried chicken.")
        self.assertEqual(normalized["address"], "123 Anna Salai, T Nagar, Chennai, Tamil Nadu 600017, India")
        self.assertEqual(normalized["address_line_1"], "123 Anna Salai")
        self.assertEqual(normalized["area"], "T Nagar")
        self.assertEqual(normalized["city"], "Chennai")
        self.assertEqual(normalized["state"], "Tamil Nadu")
        self.assertEqual(normalized["country"], "India")
        self.assertEqual(normalized["postal_code"], "600017")
        self.assertEqual(normalized["latitude"], "13.0418")
        self.assertEqual(normalized["longitude"], "80.2341")
        self.assertEqual(normalized["plus_code"], "7M5236RH+Q4")
        self.assertEqual(normalized["delivery"], "Yes")
        self.assertEqual(normalized["dine_in"], "Yes")
        self.assertEqual(normalized["pickup"], "Yes")
        self.assertIn("Credit Cards", normalized["payment_options"])
        self.assertIn("NFC", normalized["payment_options"])
        self.assertIn("Wheelchair Accessible Entrance", normalized["accessibility"])
        self.assertIn("Free Parking Lot", normalized["amenities"])
        self.assertIn("Outdoor Seating", normalized["amenities"])
        self.assertIn("Good for Kids", normalized["amenities"])
        self.assertIn("Good for Groups", normalized["amenities"])
        self.assertEqual(normalized["enrichment_status"], "ENRICHED")

    def test_normalize_place_data_legacy_format(self):
        raw_legacy = {
            "place_id": "ChIJLegacy123",
            "name": "Pizza Hut",
            "formatted_address": "456 OMR Road, Chennai, Tamil Nadu 600096, India",
            "formatted_phone_number": "044 1234 5678",
            "website": "https://www.pizzahut.co.in",
            "url": "https://maps.google.com/?cid=200",
            "rating": 4.0,
            "user_ratings_total": 850,
            "price_level": 1,
            "business_status": "CLOSED_TEMPORARILY",
            "opening_hours": {
                "open_now": False,
                "weekday_text": ["Monday: 11:00 AM – 10:00 PM"]
            },
            "types": ["restaurant", "food", "establishment"],
            "geometry": {
                "location": {"lat": 12.9876, "lng": 80.2456}
            },
            "dine_in": True,
            "delivery": True,
            "takeout": False,
            "wheelchair_accessible_entrance": True,
        }

        normalized = _normalize_place_data(raw_legacy)

        self.assertEqual(normalized["google_place_id"], "ChIJLegacy123")
        self.assertEqual(normalized["business_name"], "Pizza Hut")
        self.assertEqual(normalized["phone"], "044 1234 5678")
        self.assertEqual(normalized["website"], "https://www.pizzahut.co.in")
        self.assertEqual(normalized["rating"], "4.0")
        self.assertEqual(normalized["review_count"], "850")
        self.assertEqual(normalized["price_level"], "Inexpensive ($)")
        self.assertEqual(normalized["business_status"], "Temporarily Closed")
        self.assertEqual(normalized["open_now"], "Closed")
        self.assertEqual(normalized["monday_hours"], "11:00 AM – 10:00 PM")
        self.assertEqual(normalized["latitude"], "12.9876")
        self.assertEqual(normalized["longitude"], "80.2456")
        self.assertEqual(normalized["dine_in"], "Yes")
        self.assertEqual(normalized["delivery"], "Yes")
        self.assertEqual(normalized["pickup"], "No")
        self.assertEqual(normalized["accessibility"], "Wheelchair Accessible Entrance")

if __name__ == "__main__":
    unittest.main()

