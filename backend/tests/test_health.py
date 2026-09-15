"""
FastAPI Health Check Endpoint Test
"""
import unittest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestHealthEndpoint(unittest.TestCase):
    def test_health_check_endpoint(self):
        """Verify that the health check endpoint returns 200 and healthy status."""
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "google-business-backend")
        self.assertIn("database", data)
        self.assertIn("environment", data)

if __name__ == "__main__":
    unittest.main()
