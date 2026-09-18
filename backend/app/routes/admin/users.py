import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func

from app.database import get_db
from app.models.user import User, AdminPermission, SubscriptionPlan, ScrapingJob, ExportLog
from app.schemas.admin import (
    CreateUserRequest,
    UpdateUserRequest,
    UpdateUserStatusRequest,
    UpdatePermissionsRequest,
    UserListResponse,
    UserListItem,
    UserProfileResponse,
    PermissionSchema
)
from app.services.auth import (
    require_admin,
    require_super_admin,
    require_admin_permission,
    hash_password,
    generate_salt
)
from app.services.audit import log_audit_event

logger = logging.getLogger("google-business-backend")

router = APIRouter(prefix="/users", tags=["Admin User Management"])

@router.get("", response_model=UserListResponse)
def list_users(
    search: Optional[str] = Query(None, description="Search by email or name"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_users"))
):
    """Lists registered users with search, role/status filtering, and usage metrics."""
    query = db.query(User)

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.filter(or_(func.lower(User.email).like(s), func.lower(User.full_name).like(s)))

    if role and role.strip():
        query = query.filter(User.role == role.strip().upper())

    if status_filter and status_filter.strip():
        query = query.filter(User.status == status_filter.strip().upper())

    total = query.count()
    users_list = query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()

    plan_ids = [u.plan_id for u in users_list if u.plan_id]
    plans = {p.id: p.name for p in db.query(SubscriptionPlan).filter(SubscriptionPlan.id.in_(plan_ids)).all()} if plan_ids else {}

    results: List[UserListItem] = []
    for u in users_list:
        scraping_count = db.query(ScrapingJob).filter(ScrapingJob.user_id == u.id).count()
        exports_count = db.query(ExportLog).filter(ExportLog.user_id == u.id).count()
        
        perms_schema = PermissionSchema.model_validate(u.permissions) if u.permissions else None

        results.append(
            UserListItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                status=u.status,
                plan_id=u.plan_id,
                plan_name=plans.get(u.plan_id, "Free"),
                last_login_at=u.last_login_at,
                created_at=u.created_at,
                scraping_jobs_count=scraping_count,
                exports_count=exports_count,
                permissions=perms_schema
            )
        )

    return UserListResponse(success=True, total=total, users=results)

@router.post("", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_users"))
):
    """
    Creates a new user account.
    - Super Admin can create SUPER_ADMIN, ADMIN, or CUSTOMER accounts.
    - Regular Admin can only create CUSTOMER accounts.
    """
    clean_email = payload.email.strip().lower()
    target_role = payload.role.strip().upper()

    if target_role in ["SUPER_ADMIN", "ADMIN"] and current_admin.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can create administrative accounts."
        )

    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{clean_email}' already exists."
        )

    salt = generate_salt()
    pw_hash = hash_password(payload.password, salt)

    new_user = User(
        email=clean_email,
        password_hash=pw_hash,
        salt=salt,
        full_name=payload.full_name,
        role=target_role,
        status=payload.status.strip().upper(),
        plan_id=payload.plan_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If role is ADMIN or SUPER_ADMIN, setup permissions
    perms_schema = None
    if target_role in ["ADMIN", "SUPER_ADMIN"]:
        req_perms = payload.permissions or PermissionSchema()
        is_super = (target_role == "SUPER_ADMIN")
        perms = AdminPermission(
            user_id=new_user.id,
            can_manage_users=True if is_super else req_perms.can_manage_users,
            can_manage_businesses=True if is_super else req_perms.can_manage_businesses,
            can_manage_scrapers=True if is_super else req_perms.can_manage_scrapers,
            can_manage_exports=True if is_super else req_perms.can_manage_exports,
            can_manage_plans=True if is_super else req_perms.can_manage_plans,
            can_view_analytics=True if is_super else req_perms.can_view_analytics,
            can_view_audit_logs=True if is_super else req_perms.can_view_audit_logs
        )
        db.add(perms)
        db.commit()
        db.refresh(perms)
        perms_schema = PermissionSchema.model_validate(perms)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="USER_CREATED",
        user_id=current_admin.id,
        target_type="USER",
        target_id=new_user.id,
        ip_address=client_ip,
        details={"created_email": clean_email, "role": target_role}
    )

    return UserProfileResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        status=new_user.status,
        plan_id=new_user.plan_id,
        last_login_at=new_user.last_login_at,
        created_at=new_user.created_at,
        permissions=perms_schema
    )

@router.get("/{user_id}", response_model=UserProfileResponse)
def get_user_detail(
    user_id: str = Path(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_users"))
):
    """Fetches full profile and permissions for a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    perms_schema = PermissionSchema.model_validate(user.permissions) if user.permissions else None
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        plan_id=user.plan_id,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        permissions=perms_schema
    )

@router.put("/{user_id}", response_model=UserProfileResponse)
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_users"))
):
    """Updates user fields (name, email, plan, role, password). Super Admin privilege required for role modifications."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Role escalation check
    if payload.role and payload.role != user.role:
        if current_admin.role != "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admins can alter user roles."
            )
        user.role = payload.role.strip().upper()

    if payload.email:
        clean_email = payload.email.strip().lower()
        if clean_email != user.email:
            dup = db.query(User).filter(User.email == clean_email, User.id != user.id).first()
            if dup:
                raise HTTPException(status_code=400, detail="Email is already in use by another user.")
            user.email = clean_email

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.status:
        user.status = payload.status.strip().upper()

    if payload.plan_id is not None:
        user.plan_id = payload.plan_id

    if payload.password and payload.password.strip():
        salt = generate_salt()
        user.salt = salt
        user.password_hash = hash_password(payload.password.strip(), salt)

    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="USER_UPDATED",
        user_id=current_admin.id,
        target_type="USER",
        target_id=user.id,
        ip_address=client_ip,
        details={"updated_email": user.email, "role": user.role, "status": user.status}
    )

    perms_schema = PermissionSchema.model_validate(user.permissions) if user.permissions else None
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        plan_id=user.plan_id,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        permissions=perms_schema
    )

@router.put("/{user_id}/status", response_model=UserProfileResponse)
def update_user_status(
    user_id: str,
    payload: UpdateUserStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin_permission("can_manage_users"))
):
    """Changes user status (ACTIVE, INACTIVE, SUSPENDED) with confirmation logging."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.role == "SUPER_ADMIN" and current_admin.id != user.id:
        if current_admin.role != "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Cannot alter status of a Super Admin account.")

    new_status = payload.status.strip().upper()
    if new_status not in ["ACTIVE", "INACTIVE", "SUSPENDED"]:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE, INACTIVE, or SUSPENDED.")

    old_status = user.status
    user.status = new_status
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="USER_STATUS_CHANGED",
        user_id=current_admin.id,
        target_type="USER",
        target_id=user.id,
        ip_address=client_ip,
        details={"target_email": user.email, "old_status": old_status, "new_status": new_status}
    )

    perms_schema = PermissionSchema.model_validate(user.permissions) if user.permissions else None
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        plan_id=user.plan_id,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        permissions=perms_schema
    )

@router.put("/{user_id}/permissions", response_model=PermissionSchema)
def update_admin_permissions(
    user_id: str,
    payload: UpdatePermissionsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_super_admin)
):
    """Allows Super Admin to configure granular permissions for an Admin account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=400, detail="Permissions can only be assigned to Admin accounts.")

    perms = user.permissions
    if not perms:
        perms = AdminPermission(user_id=user.id)
        db.add(perms)

    perms.can_manage_users = payload.can_manage_users
    perms.can_manage_businesses = payload.can_manage_businesses
    perms.can_manage_scrapers = payload.can_manage_scrapers
    perms.can_manage_exports = payload.can_manage_exports
    perms.can_manage_plans = payload.can_manage_plans
    perms.can_view_analytics = payload.can_view_analytics
    perms.can_view_audit_logs = payload.can_view_audit_logs

    db.commit()
    db.refresh(perms)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="ADMIN_PERMISSIONS_UPDATED",
        user_id=current_admin.id,
        target_type="ADMIN_PERMISSION",
        target_id=user.id,
        ip_address=client_ip,
        details={"target_email": user.email, "permissions": payload.model_dump()}
    )

    return PermissionSchema.model_validate(perms)

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_super_admin)
):
    """Super Admin safely deletes a user account (cannot delete own account)."""
    if current_admin.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own Super Admin account.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    email_deleted = user.email
    db.delete(user)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor_email=current_admin.email,
        action="USER_DELETED",
        user_id=current_admin.id,
        target_type="USER",
        target_id=user_id,
        ip_address=client_ip,
        details={"deleted_email": email_deleted}
    )

    return {"success": True, "message": f"User '{email_deleted}' deleted successfully."}
