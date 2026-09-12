from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.services.google_business import GoogleBusinessService
from app.models.business import GoogleBusinessAccount

router = APIRouter(prefix="/api/google-business/auth", tags=["Google Auth"])

@router.get("/url")
def get_google_auth_url():
    """Generates and returns the Google OAuth authorization URL."""
    try:
        url = GoogleBusinessService.get_auth_url()
        return {"url": url, "configured": True}
    except HTTPException as e:
        return {"url": None, "configured": False, "message": e.detail}

@router.get("/callback")
def google_auth_callback(code: str = Query(...), db: Session = Depends(get_db)):
    """Receives authorization code from Google OAuth redirect, exchanges tokens, and saves account."""
    try:
        account = GoogleBusinessService.process_oauth_callback(code=code, db=db)
        # Redirect back to frontend page
        redirect_target = f"{settings.FRONTEND_URL}?auth=success"
        return RedirectResponse(url=redirect_target)
    except Exception as e:
        redirect_target = f"{settings.FRONTEND_URL}?auth=error&error={str(e)}"
        return RedirectResponse(url=redirect_target)

@router.post("/disconnect")
def disconnect_google_account(db: Session = Depends(get_db)):
    """Disconnects the connected Google Business account."""
    account = db.query(GoogleBusinessAccount).filter_by(connection_status="CONNECTED").first()
    if account:
        account.connection_status = "DISCONNECTED"
        account.access_token = None
        account.refresh_token = None
        db.commit()
        return {"success": True, "message": "Google Business Profile account disconnected."}
    return {"success": False, "message": "No connected account found."}
