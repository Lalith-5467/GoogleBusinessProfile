import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.business import GoogleBusinessLocation

class TestBusinessSaveAndCount(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        # Clean test records if any
        self.db.query(GoogleBusinessLocation).filter(
            GoogleBusinessLocation.business_name.like("Unit Test %")
        ).delete(synchronize_session=False)
        self.db.commit()

    def tearDown(self):
        self.db.query(GoogleBusinessLocation).filter(
            GoogleBusinessLocation.business_name.like("Unit Test %")
        ).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def test_count_and_batch_save_with_deduplication(self):
        # 1. Initial count
        r_init = self.client.get("/api/google-business/count")
        self.assertEqual(r_init.status_code, 200)
        init_count = r_init.json()["total_businesses"]

        # 2. Batch save 2 new businesses
        payload = {
            "items": [
                {
                    "google_place_id": "ChIJ_test_place_001",
                    "business_name": "Unit Test Bakery Chennai",
                    "area": "T Nagar",
                    "city": "Chennai",
                    "address": "10 Usman Road, T Nagar, Chennai",
                    "source": "Business Search"
                },
                {
                    "google_place_id": "ChIJ_test_place_002",
                    "business_name": "Unit Test Cafe Chennai",
                    "area": "Nungambakkam",
                    "city": "Chennai",
                    "address": "25 Khader Nawaz Khan Road, Nungambakkam, Chennai",
                    "source": "Business Search"
                }
            ]
        }
        r_save = self.client.post("/api/google-business/locations/save-batch", json=payload)
        self.assertEqual(r_save.status_code, 200)
        data = r_save.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["saved_count"], 2)
        self.assertEqual(data["updated_count"], 0)
        self.assertEqual(data["total_count"], init_count + 2)

        # 3. Verify status endpoint matches
        r_status = self.client.get("/api/google-business/status")
        self.assertEqual(r_status.status_code, 200)
        self.assertEqual(r_status.json()["total_locations"], init_count + 2)

        # 4. Save the exact same businesses again (deduplication test)
        r_save_dupe = self.client.post("/api/google-business/locations/save-batch", json=payload)
        self.assertEqual(r_save_dupe.status_code, 200)
        dupe_data = r_save_dupe.json()
        self.assertTrue(dupe_data["success"])
        self.assertEqual(dupe_data["saved_count"], 0)
        self.assertEqual(dupe_data["updated_count"], 2)
        self.assertEqual(dupe_data["total_count"], init_count + 2)

        # 5. Delete one record and verify count drops by 1
        saved_id = data["locations"][0]["id"]
        r_del = self.client.delete(f"/api/google-business/locations/{saved_id}")
        self.assertEqual(r_del.status_code, 200)
        del_data = r_del.json()
        self.assertTrue(del_data["success"])
        self.assertEqual(del_data["total_count"], init_count + 1)

if __name__ == "__main__":
    unittest.main()
