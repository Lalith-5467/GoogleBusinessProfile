import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User, AdminPermission, SubscriptionPlan
from app.services.auth import (
    hash_password,
    generate_salt,
    verify_password,
    create_access_token,
    decode_access_token,
    bootstrap_super_admin
)

# In-memory SQLite for isolated admin system unit testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestAdminSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.db = TestingSessionLocal()

    def tearDown(self):
        self.db.close()

    def test_password_hashing_and_verification(self):
        salt = generate_salt()
        pw = "SuperSecurePass123!"
        hashed = hash_password(pw, salt)

        self.assertTrue(verify_password(pw, hashed, salt))
        self.assertFalse(verify_password("WrongPassword", hashed, salt))

    def test_jwt_token_generation_and_decoding(self):
        token = create_access_token(user_id="user-123", email="admin@test.com", role="SUPER_ADMIN")
        self.assertIsNotNone(token)
        
        payload = decode_access_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "user-123")
        self.assertEqual(payload["email"], "admin@test.com")
        self.assertEqual(payload["role"], "SUPER_ADMIN")

    def test_bootstrap_and_login_flow(self):
        # 1. Bootstrap Super Admin
        resp = self.client.post("/api/admin/auth/bootstrap", json={
            "email": "superadmin@example.com",
            "password": "Password123!",
            "full_name": "Chief Super Admin"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["role"], "SUPER_ADMIN")
        token = data["access_token"]

        # 2. Access /me endpoint with token
        me_resp = self.client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["email"], "superadmin@example.com")

        # 3. Regular login with valid credentials
        login_resp = self.client.post("/api/admin/auth/login", json={
            "email": "superadmin@example.com",
            "password": "Password123!"
        })
        self.assertEqual(login_resp.status_code, 200)

        # 4. Login with invalid password
        bad_login = self.client.post("/api/admin/auth/login", json={
            "email": "superadmin@example.com",
            "password": "WrongPassword!"
        })
        self.assertEqual(bad_login.status_code, 401)

    def test_role_based_access_control(self):
        # Create Super Admin
        super_admin = bootstrap_super_admin(self.db, "master@test.com", "MasterPass123!")
        super_token = create_access_token(super_admin.id, super_admin.email, super_admin.role)

        # Super Admin creates a regular Admin with limited permissions
        create_admin_resp = self.client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {super_token}"},
            json={
                "email": "subadmin@test.com",
                "password": "SubAdminPass123!",
                "full_name": "Sub Admin",
                "role": "ADMIN",
                "permissions": {
                    "can_manage_users": True,
                    "can_manage_businesses": True,
                    "can_manage_scrapers": False,
                    "can_manage_exports": False,
                    "can_manage_plans": False,
                    "can_view_analytics": True,
                    "can_view_audit_logs": False
                }
            }
        )
        self.assertEqual(create_admin_resp.status_code, 201)
        sub_admin_id = create_admin_resp.json()["id"]

        # Sub Admin logs in
        login_resp = self.client.post("/api/admin/auth/login", json={
            "email": "subadmin@test.com",
            "password": "SubAdminPass123!"
        })
        self.assertEqual(login_resp.status_code, 200)
        sub_token = login_resp.json()["access_token"]

        # Sub admin CAN access users list (permission granted)
        users_resp = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {sub_token}"})
        self.assertEqual(users_resp.status_code, 200)

        # Sub admin CANNOT access audit logs (permission denied)
        audit_resp = self.client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {sub_token}"})
        self.assertEqual(audit_resp.status_code, 403)

        # Sub admin CANNOT delete users (only super admin can delete users)
        del_resp = self.client.delete(f"/api/admin/users/{super_admin.id}", headers={"Authorization": f"Bearer {sub_token}"})
        self.assertEqual(del_resp.status_code, 403)

    def test_customer_cannot_access_admin_api(self):
        # Create Customer user
        salt = generate_salt()
        cust = User(
            email="customer@example.com",
            password_hash=hash_password("CustomerPass123!", salt),
            salt=salt,
            role="CUSTOMER",
            status="ACTIVE"
        )
        self.db.add(cust)
        self.db.commit()

        cust_token = create_access_token(cust.id, cust.email, cust.role)

        # Customer tries to access admin stats
        stats_resp = self.client.get("/api/admin/dashboard/stats", headers={"Authorization": f"Bearer {cust_token}"})
        self.assertEqual(stats_resp.status_code, 403)

        # Customer tries to access users list
        users_resp = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {cust_token}"})
        self.assertEqual(users_resp.status_code, 403)

if __name__ == "__main__":
    unittest.main()
