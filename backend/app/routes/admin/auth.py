import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User, AdminPermission
from app.schemas.admin import (
    AdminLoginRequest,
    BootstrapSuperAdminRequest,
    ChangePasswordRequest,
    TokenResponse,
    UserProfileResponse,
    PermissionSchema
)
from app.services.auth import (
    verify_password,
    hash_password,
    generate_salt,
    create_access_token,
    get_current_user,
    is_super_admin_exists,
    bootstrap_super_admin
)
from app.services.audit import log_audit_event

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/auth", tags=["Admin Authentication"])

@router.post("/login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates a Super Admin or Admin user, returns a signed JWT access token,
    and records the login event in audit logs.
    """
    email_clean = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        logger.warning(f"Failed login attempt for non-existent email: {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password credentials."
        )

    if not verify_password(payload.password, user.password_hash, user.salt):
        logger.warning(f"Invalid password for user: {email_clean}")
        log_audit_event(
            db=db,
            actor_email=email_clean,
            action="LOGIN_FAILED",
            user_id=user.id,
            ip_address=client_ip,
            details={"reason": "Invalid password"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password credentials."
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.lower()}. Please contact the Super Admin."
        )

    if user.role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to administrative accounts."
        )

    # Update last login timestamp
    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)

    log_audit_event(
        db=db,
        actor_email=user.email,
        action="ADMIN_LOGIN_SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        details={"role": user.role}
    )

    perms_schema = PermissionSchema.model_validate(user.permissions) if user.permissions else (
        PermissionSchema(
            can_manage_users=True,
            can_manage_businesses=True,
            can_manage_scrapers=True,
            can_manage_exports=True,
            can_manage_plans=True,
            can_view_analytics=True,
            can_view_audit_logs=True
        ) if user.role == "SUPER_ADMIN" else PermissionSchema()
    )

    profile_resp = UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        plan_id=user.plan_id,
        is_original_super_admin=getattr(user, "is_original_super_admin", False),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        permissions=perms_schema
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=profile_resp
    )

@router.get("/me", response_model=UserProfileResponse)
def get_current_admin_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated admin's profile and active permissions."""
    perms_schema = PermissionSchema.model_validate(current_user.permissions) if current_user.permissions else (
        PermissionSchema(
            can_manage_users=True,
            can_manage_businesses=True,
            can_manage_scrapers=True,
            can_manage_exports=True,
            can_manage_plans=True,
            can_view_analytics=True,
            can_view_audit_logs=True
        ) if current_user.role == "SUPER_ADMIN" else PermissionSchema()
    )

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        status=current_user.status,
        plan_id=current_user.plan_id,
        is_original_super_admin=getattr(current_user, "is_original_super_admin", False),
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
        permissions=perms_schema
    )

@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Allows authenticated Original Super Admin to update security credentials."""
    if current_user.role != "SUPER_ADMIN" or not getattr(current_user, "is_original_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security and settings modifications are restricted to the Original Super Admin."
        )

    if not verify_password(payload.current_password, current_user.password_hash, current_user.salt):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed."
        )

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long."
        )

    new_salt = generate_salt()
    current_user.salt = new_salt
    current_user.password_hash = hash_password(payload.new_password, new_salt)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_user.email,
        action="PASSWORD_CHANGED",
        user_id=current_user.id,
        ip_address=client_ip
    )

    return {"success": True, "message": "Password changed successfully."}

@router.post("/bootstrap", response_model=TokenResponse)
def bootstrap_initial_super_admin(payload: BootstrapSuperAdminRequest, request: Request, db: Session = Depends(get_db)):
    """
    Initializes the first Super Admin. If a Super Admin already exists,
    this endpoint requires matching settings.BOOTSTRAP_SECRET or rejects request to prevent unauthorized takeover.
    """
    has_super = is_super_admin_exists(db)
    if has_super:
        # Require valid bootstrap secret
        if not settings.BOOTSTRAP_SECRET or payload.bootstrap_secret != settings.BOOTSTRAP_SECRET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Admin already exists. Bootstrap is locked. Use existing credentials or CLI."
            )

    admin = bootstrap_super_admin(
        db=db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name or "System Super Admin"
    )

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=admin.email,
        action="SUPER_ADMIN_BOOTSTRAP",
        user_id=admin.id,
        ip_address=client_ip
    )

    token = create_access_token(user_id=admin.id, email=admin.email, role=admin.role)
    perms_schema = PermissionSchema(
        can_manage_users=True,
        can_manage_businesses=True,
        can_manage_scrapers=True,
        can_manage_exports=True,
        can_manage_plans=True,
        can_view_analytics=True,
        can_view_audit_logs=True
    )

    profile_resp = UserProfileResponse(
        id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role,
        status=admin.status,
        plan_id=admin.plan_id,
        is_original_super_admin=getattr(admin, "is_original_super_admin", True),
        last_login_at=admin.last_login_at,
        created_at=admin.created_at,
        permissions=perms_schema
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=profile_resp
    )
