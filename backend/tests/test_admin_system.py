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

    def test_original_vs_created_super_admin_permissions(self):
        # 1. Bootstrap Original Super Admin
        original_admin = bootstrap_super_admin(
            db=self.db,
            email="original_super@test.com",
            password="OriginalPassword123!",
            full_name="Original Super Admin"
        )
        self.assertTrue(original_admin.is_original_super_admin)
        orig_token = create_access_token(original_admin.id, original_admin.email, original_admin.role)

        # Verify Original Super Admin gets is_original_super_admin=True in /me
        orig_me = self.client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {orig_token}"})
        self.assertEqual(orig_me.status_code, 200)
        self.assertTrue(orig_me.json()["is_original_super_admin"])

        # 2. Original Super Admin creates a new Super Admin account
        create_resp = self.client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {orig_token}"},
            json={
                "email": "created_super@test.com",
                "password": "CreatedPassword123!",
                "full_name": "Created Super Admin",
                "role": "SUPER_ADMIN"
            }
        )
        self.assertEqual(create_resp.status_code, 201)
        created_data = create_resp.json()
        self.assertEqual(created_data["role"], "SUPER_ADMIN")
        self.assertFalse(created_data["is_original_super_admin"])
        created_user_id = created_data["id"]

        # 3. Created Super Admin logs in
        login_resp = self.client.post("/api/admin/auth/login", json={
            "email": "created_super@test.com",
            "password": "CreatedPassword123!"
        })
        self.assertEqual(login_resp.status_code, 200)
        created_token = login_resp.json()["access_token"]
        self.assertFalse(login_resp.json()["user"]["is_original_super_admin"])

        # 4. Verify Created Super Admin (Sub Super Admin) can VIEW dashboard and administrative data (GET requests -> 200 OK)
        stats_resp = self.client.get("/api/admin/dashboard/stats", headers={"Authorization": f"Bearer {created_token}"})
        self.assertEqual(stats_resp.status_code, 200)

        users_resp = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {created_token}"})
        self.assertEqual(users_resp.status_code, 200)

        biz_resp = self.client.get("/api/admin/businesses", headers={"Authorization": f"Bearer {created_token}"})
        self.assertEqual(biz_resp.status_code, 200)

        plans_resp = self.client.get("/api/admin/plans", headers={"Authorization": f"Bearer {created_token}"})
        self.assertEqual(plans_resp.status_code, 200)

        audit_resp = self.client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {created_token}"})
        self.assertEqual(audit_resp.status_code, 200)

        # 5. Security & Settings Restriction: Sub Super Admin CANNOT modify security settings/passwords (403 Forbidden)
        bad_change_pw = self.client.post(
            "/api/admin/auth/change-password",
            headers={"Authorization": f"Bearer {created_token}"},
            json={
                "current_password": "CreatedPassword123!",
                "new_password": "NewCreatedPassword123!"
            }
        )
        self.assertEqual(bad_change_pw.status_code, 403)
        self.assertIn("Security and settings modifications are restricted to the Original Super Admin", bad_change_pw.json().get("detail", ""))

        # 6. Original Super Admin CAN modify Security & Settings (200 OK)
        good_change_pw = self.client.post(
            "/api/admin/auth/change-password",
            headers={"Authorization": f"Bearer {orig_token}"},
            json={
                "current_password": "OriginalPassword123!",
                "new_password": "NewOriginalPassword123!"
            }
        )
        self.assertEqual(good_change_pw.status_code, 200)
        self.assertTrue(good_change_pw.json().get("success"))

        # 7. Verify Sub Super Admin retains regular administrative capabilities (NOT entire dashboard view only)
        sub_edit_user = self.client.put(
            f"/api/admin/users/{created_user_id}",
            headers={"Authorization": f"Bearer {created_token}"},
            json={"full_name": "Updated by Sub Super Admin"}
        )
        self.assertEqual(sub_edit_user.status_code, 200)
        self.assertEqual(sub_edit_user.json()["full_name"], "Updated by Sub Super Admin")

        # Sub Super Admin cannot alter user roles or grant permissions (restricted to Original Super Admin)
        bad_role_change = self.client.put(
            f"/api/admin/users/{created_user_id}",
            headers={"Authorization": f"Bearer {created_token}"},
            json={"role": "ADMIN"}
        )
        self.assertEqual(bad_role_change.status_code, 403)

    def test_sub_super_admin_secure_password_reset(self):
        # 1. Bootstrap Original Super Admin
        original_admin = bootstrap_super_admin(
            db=self.db,
            email="master_super@test.com",
            password="MasterPassword123!",
            full_name="Master Super Admin"
        )
        orig_token = create_access_token(original_admin.id, original_admin.email, original_admin.role)

        # 2. Original Super Admin creates Sub Super Admin
        create_sub_resp = self.client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {orig_token}"},
            json={
                "email": "sub_super@test.com",
                "password": "InitialSubPass123!",
                "full_name": "Sub Super Admin User",
                "role": "SUPER_ADMIN"
            }
        )
        self.assertEqual(create_sub_resp.status_code, 201)
        sub_user_id = create_sub_resp.json()["id"]

        # 3. Sub Super Admin logs in
        login_sub = self.client.post("/api/admin/auth/login", json={
            "email": "sub_super@test.com",
            "password": "InitialSubPass123!"
        })
        self.assertEqual(login_sub.status_code, 200)
        sub_token = login_sub.json()["access_token"]

        # --- Test 1: Sub Super Admin enters wrong current password + new password ---
        # Expected: 401 Unauthorized, "Current password is incorrect.", password is NOT changed.
        test1_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "WrongCurrentPassword123!",
                "password": "NewSecretPassword123!",
                "confirm_password": "NewSecretPassword123!"
            }
        )
        self.assertEqual(test1_resp.status_code, 401)
        self.assertEqual(test1_resp.json().get("detail"), "Current password is incorrect.")

        # Verify old password still works, new password does not work
        self.assertEqual(
            self.client.post("/api/admin/auth/login", json={"email": "sub_super@test.com", "password": "InitialSubPass123!"}).status_code,
            200
        )
        self.assertEqual(
            self.client.post("/api/admin/auth/login", json={"email": "sub_super@test.com", "password": "NewSecretPassword123!"}).status_code,
            401
        )

        # --- Test 3: Sub Super Admin enters correct current password but mismatched confirmation ---
        # Expected: 400 Bad Request, "New password and confirm password do not match.", password NOT changed.
        test3_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "InitialSubPass123!",
                "password": "NewSecretPassword123!",
                "confirm_password": "MismatchedPassword123!"
            }
        )
        self.assertEqual(test3_resp.status_code, 400)
        self.assertEqual(test3_resp.json().get("detail"), "New password and confirm password do not match.")

        # --- Test 4: Sub Super Admin enters a new password but leaves current password empty ---
        # Expected: 400 Bad Request, "Please enter your current password.", password NOT changed.
        test4_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "",
                "password": "NewSecretPassword123!",
                "confirm_password": "NewSecretPassword123!"
            }
        )
        self.assertEqual(test4_resp.status_code, 400)
        self.assertEqual(test4_resp.json().get("detail"), "Please enter your current password.")

        # Test Same Password: New password must be different from current password
        same_pw_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "InitialSubPass123!",
                "password": "InitialSubPass123!",
                "confirm_password": "InitialSubPass123!"
            }
        )
        self.assertEqual(same_pw_resp.status_code, 400)
        self.assertEqual(same_pw_resp.json().get("detail"), "New password must be different from your current password.")

        # --- Test 5: Sub Super Admin changes Full Name only without changing password ---
        # Expected: 200 OK, name updated, no current password required.
        test5_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "full_name": "Updated Sub Super Admin Name"
            }
        )
        self.assertEqual(test5_resp.status_code, 200)
        self.assertEqual(test5_resp.json().get("full_name"), "Updated Sub Super Admin Name")

        # Test: Sub Super Admin cannot change another user's password
        other_pw_resp = self.client.put(
            f"/api/admin/users/{original_admin.id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "InitialSubPass123!",
                "password": "HackedPassword123!",
                "confirm_password": "HackedPassword123!"
            }
        )
        self.assertEqual(other_pw_resp.status_code, 403)
        self.assertEqual(other_pw_resp.json().get("detail"), "Sub Super Admins cannot reset passwords for other accounts.")

        # --- Test 2: Sub Super Admin enters correct current password + matching new password ---
        # Expected: 200 OK, password changed successfully.
        test2_resp = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={
                "current_password": "InitialSubPass123!",
                "password": "BrandNewPassword123!",
                "confirm_password": "BrandNewPassword123!"
            }
        )
        self.assertEqual(test2_resp.status_code, 200)

        # --- Test 6: After changing password, login using the new password ---
        # Expected: Login succeeds.
        test6_resp = self.client.post("/api/admin/auth/login", json={
            "email": "sub_super@test.com",
            "password": "BrandNewPassword123!"
        })
        self.assertEqual(test6_resp.status_code, 200)
        self.assertIn("access_token", test6_resp.json())

        # --- Test 7: Try logging in using the old password ---
        # Expected: Login fails (401 Unauthorized).
        test7_resp = self.client.post("/api/admin/auth/login", json={
            "email": "sub_super@test.com",
            "password": "InitialSubPass123!"
        })
        self.assertEqual(test7_resp.status_code, 401)

        # --- Scenario B: Super Admin managing another user's password without needing their current password ---
        orig_reset_other = self.client.put(
            f"/api/admin/users/{sub_user_id}",
            headers={"Authorization": f"Bearer {orig_token}"},
            json={
                "password": "ResetBySuperAdmin123!",
                "confirm_password": "ResetBySuperAdmin123!"
            }
        )
        self.assertEqual(orig_reset_other.status_code, 200)
        # Login with reset password works
        self.assertEqual(
            self.client.post("/api/admin/auth/login", json={"email": "sub_super@test.com", "password": "ResetBySuperAdmin123!"}).status_code,
            200
        )

if __name__ == "__main__":
    unittest.main()
