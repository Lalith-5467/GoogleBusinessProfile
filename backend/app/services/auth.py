import hmac
import hashlib
import json
import base64
import secrets
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User, AdminPermission, SubscriptionPlan

logger = logging.getLogger("google-business-backend")

security = HTTPBearer(auto_error=False)

# =============================================================================
# 1. Cryptographic Password Hashing (PBKDF2-HMAC-SHA256)
# =============================================================================
def generate_salt() -> str:
    """Generates a secure random 32-byte hexadecimal salt."""
    return secrets.token_hex(32)

def hash_password(password: str, salt: str) -> str:
    """Hashes password using PBKDF2 with HMAC-SHA256 and 200,000 iterations."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        200000
    )
    return key.hex()

def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    """Constant-time verification of password against stored hash."""
    computed = hash_password(plain_password, salt)
    return hmac.compare_digest(computed, password_hash)

# =============================================================================
# 2. Cryptographic JWT Token Generation & Verification (HMAC-SHA256)
# =============================================================================
def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(s: str) -> bytes:
    padding = '=' * (4 - (len(s) % 4)) if (len(s) % 4) != 0 else ''
    return base64.urlsafe_b64decode((s + padding).encode('utf-8'))

def create_access_token(user_id: str, email: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token for authentication."""
    header = {"alg": settings.JWT_ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    exp = now + (int(expires_delta.total_seconds()) if expires_delta else settings.JWT_EXPIRY_HOURS * 3600)
    
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": exp
    }
    
    header_bytes = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    
    header_encoded = _base64url_encode(header_bytes)
    payload_encoded = _base64url_encode(payload_bytes)
    
    signing_input = f"{header_encoded}.{payload_encoded}".encode('utf-8')
    signature = hmac.new(settings.JWT_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_encoded = _base64url_encode(signature)
    
    return f"{header_encoded}.{payload_encoded}.{signature_encoded}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and cryptographically verifies signature and expiry of a JWT access token."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        header_encoded, payload_encoded, signature_encoded = parts
        signing_input = f"{header_encoded}.{payload_encoded}".encode('utf-8')
        expected_sig = hmac.new(settings.JWT_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        actual_sig = _base64url_decode(signature_encoded)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            logger.warning("Invalid token signature")
            return None
        
        payload_bytes = _base64url_decode(payload_encoded)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Check expiry
        now = int(time.time())
        if payload.get("exp") and payload["exp"] < now:
            logger.warning("Token expired")
            return None
            
        return payload
    except Exception as e:
        logger.warning(f"Failed to decode token: {e}")
        return None

# =============================================================================
# 3. FastAPI Authentication & Authorization Dependencies
# =============================================================================
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Extracts and validates current logged in user from Authorization Bearer token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token was not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {user.status.lower()}. Access denied.",
        )
        
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user has either SUPER_ADMIN or ADMIN role."""
    if current_user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource."
        )
    return current_user

def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user has SUPER_ADMIN role (both original and created)."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required to perform this action."
        )
    return current_user

def require_original_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user is the Original Super Admin with full unrestricted CRUD control."""
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required to perform this action."
        )
    if not getattr(current_user, "is_original_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="View-only Super Admin account cannot perform administrative modifications."
        )
    return current_user

def verify_super_admin_not_view_only(user: User):
    """Raises 403 Forbidden if a created Super Admin attempts to execute a mutating action."""
    if user.role == "SUPER_ADMIN" and not getattr(user, "is_original_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="View-only Super Admin account cannot create, modify, or delete resources."
        )

def require_admin_permission(permission_key: str):
    """Factory dependency ensuring an Admin user has a specific configured permission."""
    def permission_checker(current_user: User = Depends(require_admin)) -> User:
        if current_user.role == "SUPER_ADMIN":
            return current_user  # Super admin has access to view/access
        
        perms = current_user.permissions
        if not perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No administrative permissions configured for this account."
            )
            
        has_perm = getattr(perms, permission_key, False)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You lack the required administrative permission '{permission_key}'."
            )
        return current_user
    return permission_checker

# =============================================================================
# 4. Super Admin Bootstrap & Seed Utilities
# =============================================================================
def is_super_admin_exists(db: Session) -> bool:
    """Returns True if at least one SUPER_ADMIN user exists in MySQL."""
    return db.query(User).filter(User.role == "SUPER_ADMIN").count() > 0

def bootstrap_super_admin(
    db: Session,
    email: str,
    password: str,
    full_name: str = "System Super Admin"
) -> User:
    """Safely creates initial Super Admin account with Original Super Admin status."""
    clean_email = email.strip().lower()
    existing = db.query(User).filter(User.email == clean_email).first()
    
    salt = generate_salt()
    pw_hash = hash_password(password, salt)
    
    if existing:
        existing.role = "SUPER_ADMIN"
        existing.status = "ACTIVE"
        existing.is_original_super_admin = True
        existing.password_hash = pw_hash
        existing.salt = salt
        existing.full_name = full_name
        db.commit()
        db.refresh(existing)
        logger.info(f"Existing user '{clean_email}' promoted to Original SUPER_ADMIN.")
        return existing
    
    super_admin = User(
        email=clean_email,
        password_hash=pw_hash,
        salt=salt,
        full_name=full_name,
        role="SUPER_ADMIN",
        status="ACTIVE",
        is_original_super_admin=True
    )
    db.add(super_admin)
    db.commit()
    db.refresh(super_admin)
    
    # Add all permissions
    perms = AdminPermission(
        user_id=super_admin.id,
        can_manage_users=True,
        can_manage_businesses=True,
        can_manage_scrapers=True,
        can_manage_exports=True,
        can_manage_plans=True,
        can_view_analytics=True,
        can_view_audit_logs=True
    )
    db.add(perms)
    db.commit()
    logger.info(f"Super Admin account initialized successfully: {clean_email}")
    return super_admin

def seed_default_plans_if_empty(db: Session):
    """Ensures standard Free, Basic, and Pro subscription plans exist in MySQL."""
    if db.query(SubscriptionPlan).count() == 0:
        plans = [
            SubscriptionPlan(
                name="FREE",
                display_name="Free Starter",
                price_monthly=0.0,
                search_limit=50,
                scrape_limit=20,
                bulk_scrape_limit=5,
                export_limit=10,
                features_json=json.dumps(["Standard Business Search", "Basic Website Scrape", "CSV Exports"]),
                is_active=True
            ),
            SubscriptionPlan(
                name="BASIC",
                display_name="Basic Professional",
                price_monthly=29.0,
                search_limit=500,
                scrape_limit=200,
                bulk_scrape_limit=50,
                export_limit=100,
                features_json=json.dumps(["Extended Business Search", "Place Details Enrichment", "Bulk Website Scrape", "Excel & CSV Exports"]),
                is_active=True
            ),
            SubscriptionPlan(
                name="PRO",
                display_name="Enterprise Pro",
                price_monthly=99.0,
                search_limit=5000,
                scrape_limit=2000,
                bulk_scrape_limit=500,
                export_limit=1000,
                features_json=json.dumps(["Unlimited Business Search", "Full Place Details Enrichment", "Priority Bulk Scraping", "Unlimited Exports", "API Access"]),
                is_active=True
            ),
        ]
        for p in plans:
            db.add(p)
        db.commit()
        logger.info("Default subscription plans seeded into MySQL.")
