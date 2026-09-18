#!/usr/bin/env python3
"""
Secure Super Admin Bootstrap & Password Reset CLI Utility.
Usage:
  python scripts/create_super_admin.py --email admin@example.com --password YourStrongPassword123 --name "Master Admin"
Or run interactively:
  python scripts/create_super_admin.py
"""

import sys
import os
import argparse
import getpass

# Add backend directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(script_dir, "..", "backend")
sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine, Base
from app.models.user import User, AdminPermission
from app.services.auth import (
    hash_password,
    generate_salt,
    bootstrap_super_admin,
    seed_default_plans_if_empty
)

def main():
    parser = argparse.ArgumentParser(description="Bootstrap or Reset Super Admin Account")
    parser.add_argument("--email", help="Super Admin Email address")
    parser.add_argument("--password", help="Super Admin Password (min 8 chars)")
    parser.add_argument("--name", default="System Super Admin", help="Full name for the Super Admin")
    args = parser.parse_args()

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        seed_default_plans_if_empty(db)

        email = args.email
        if not email:
            email = input("Enter Super Admin Email: ").strip()

        if not email or "@" not in email:
            print("[ERROR] Invalid email address provided.")
            sys.exit(1)

        password = args.password
        if not password:
            password = getpass.getpass("Enter Super Admin Password (min 8 chars): ").strip()
            confirm = getpass.getpass("Confirm Super Admin Password: ").strip()
            if password != confirm:
                print("[ERROR] Passwords do not match.")
                sys.exit(1)

        if len(password) < 8:
            print("[ERROR] Password must be at least 8 characters long.")
            sys.exit(1)

        name = args.name or "System Super Admin"

        admin = bootstrap_super_admin(
            db=db,
            email=email,
            password=password,
            full_name=name
        )

        print("=================================================================")
        print("  [SUCCESS] Super Admin account configured successfully!")
        print(f"  Email: {admin.email}")
        print(f"  Role:  {admin.role}")
        print(f"  Status: {admin.status}")
        print("=================================================================")

    except Exception as e:
        print(f"[ERROR] Failed to configure Super Admin: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
