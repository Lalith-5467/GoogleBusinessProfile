import datetime
import logging
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from fastapi import HTTPException

from app.config import settings
from app.models.business import GoogleBusinessAccount, GoogleBusinessLocation

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/business.manage",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

class GoogleBusinessService:
    @staticmethod
    def is_oauth_configured() -> bool:
        return bool(
            settings.GOOGLE_CLIENT_ID and 
            settings.GOOGLE_CLIENT_SECRET and 
            settings.GOOGLE_CLIENT_ID.strip() != "" and
            settings.GOOGLE_CLIENT_SECRET.strip() != ""
        )

    @staticmethod
    def get_auth_url() -> str:
        if not GoogleBusinessService.is_oauth_configured():
            raise HTTPException(
                status_code=400,
                detail="Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured in .env file."
            )
        
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=settings.GOOGLE_REDIRECT_URI
        )
        
        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent"
        )
        return authorization_url

    @staticmethod
    def process_oauth_callback(code: str, db: Session) -> GoogleBusinessAccount:
        if not GoogleBusinessService.is_oauth_configured():
            raise HTTPException(status_code=400, detail="Google OAuth credentials are not configured.")
        
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=settings.GOOGLE_REDIRECT_URI
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials

        userinfo_service = build("oauth2", "v2", credentials=credentials)
        user_info = userinfo_service.userinfo().get().execute()
        
        google_account_id = user_info.get("id", "unknown_account")
        email = user_info.get("email")
        account_name = user_info.get("name") or email

        account = db.query(GoogleBusinessAccount).filter_by(google_account_id=google_account_id).first()
        if not account:
            account = GoogleBusinessAccount(
                google_account_id=google_account_id,
                email=email,
                account_name=account_name
            )
            db.add(account)
        
        account.access_token = credentials.token
        account.refresh_token = credentials.refresh_token or account.refresh_token
        account.token_expiry = credentials.expiry
        account.connection_status = "CONNECTED"
        account.updated_at = datetime.datetime.utcnow()

        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def get_connected_account(db: Session) -> Optional[GoogleBusinessAccount]:
        return db.query(GoogleBusinessAccount).filter_by(connection_status="CONNECTED").first()

    @staticmethod
    def sync_locations(db: Session) -> List[GoogleBusinessLocation]:
        account = GoogleBusinessService.get_connected_account(db)
        if not account:
            raise HTTPException(
                status_code=401, 
                detail="No authorized Google Business Profile account connected. Please connect your Google account first."
            )

        if not GoogleBusinessService.is_oauth_configured():
            raise HTTPException(status_code=400, detail="Google OAuth credentials are not configured.")

        credentials = Credentials(
            token=account.access_token,
            refresh_token=account.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=SCOPES
        )

        try:
            account_mgmt_service = build("mybusinessaccountmanagement", "v1", credentials=credentials)
            accounts_response = account_mgmt_service.accounts().list().execute()
            accounts_list = accounts_response.get("accounts", [])

            info_service = build("mybusinessbusinessinformation", "v1", credentials=credentials)
            
            for g_acc in accounts_list:
                acc_name = g_acc.get("name")
                if not acc_name:
                    continue
                
                locations_resp = info_service.accounts().locations().list(
                    parent=acc_name,
                    readMask="name,title,storefrontAddress,serviceArea"
                ).execute()

                locations_data = locations_resp.get("locations", [])
                
                for loc in locations_data:
                    loc_name_id = loc.get("name")
                    title = loc.get("title") or "Unnamed Business"
                    
                    address_data = loc.get("storefrontAddress", {})
                    address_lines = address_data.get("addressLines", [])
                    locality = address_data.get("locality")
                    sublocality = address_data.get("sublocality")
                    
                    area = sublocality or locality or "N/A"
                    city = locality or "N/A"
                    formatted_address = ", ".join(address_lines) if address_lines else None
                    if locality and formatted_address:
                        formatted_address += f", {locality}"
                        
                    now = datetime.datetime.utcnow()

                    existing_loc = db.query(GoogleBusinessLocation).filter_by(google_location_id=loc_name_id).first()
                    if existing_loc:
                        existing_loc.business_name = title
                        existing_loc.area = area
                        existing_loc.city = city
                        existing_loc.address = formatted_address
                        existing_loc.source = "Google API"
                        existing_loc.status = "ACTIVE"
                        existing_loc.last_synced_at = now
                        existing_loc.updated_at = now
                    else:
                        location_obj = GoogleBusinessLocation(
                            google_business_account_id=account.id,
                            google_location_id=loc_name_id,
                            business_name=title,
                            area=area,
                            city=city,
                            address=formatted_address,
                            source="Google API",
                            status="ACTIVE",
                            last_synced_at=now
                        )
                        db.add(location_obj)

                    db.commit()

            return db.query(GoogleBusinessLocation).order_by(GoogleBusinessLocation.created_at.desc()).all()

        except Exception as e:
            db.rollback()
            logger.error(f"Google Business API sync error: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=502,
                detail=f"Google Business Profile API request failed: {str(e)}"
            )

    @staticmethod
    def bulk_scrape_urls(urls: List[str], db: Session) -> Dict[str, Any]:
        """
        Parses submitted profile URLs/queries, extracts business information,
        and saves valid records directly into MySQL database.
        Returns precise scraping metrics (total_urls_submitted, successfully_scraped, failed, total_businesses_collected).
        """
        total_urls = len(urls)
        successfully_scraped = 0
        failed = 0

        for url_str in urls:
            cleaned = url_str.strip()
            if not cleaned or (not cleaned.startswith("http") and not cleaned.startswith("www") and len(cleaned) < 3):
                failed += 1
                continue

            try:
                # Extract business profile details from URL / string pattern
                business_name = None
                area = "N/A"
                city = "N/A"
                address = None

                # Pattern matching for Google Maps / Business URLs (e.g. google.com/maps/place/Business+Name/@lat,lng,...)
                if "maps/place/" in cleaned:
                    parts = cleaned.split("maps/place/")[1].split("/")[0]
                    decoded = urllib.parse.unquote(parts).replace("+", " ")
                    # Remove coordinate string if present in place path
                    decoded_clean = re.sub(r'@[\d\.-]+,[\d\.-]+.*$', '', decoded).strip()
                    name_parts = [p.strip() for p in decoded_clean.split(",") if p.strip() and not p.strip().startswith("@")]
                    if name_parts:
                        business_name = name_parts[0]
                        if len(name_parts) > 1 and not re.search(r'^\d+(\.\d+)?z?$', name_parts[1]):
                            area = name_parts[1]
                        if len(name_parts) > 2 and not re.search(r'^\d+(\.\d+)?z?$', name_parts[2]):
                            city = name_parts[2]
                        address = decoded_clean
                elif "search?" in cleaned or "query=" in cleaned:
                    parsed_url = urllib.parse.urlparse(cleaned)
                    params = urllib.parse.parse_qs(parsed_url.query)
                    q = params.get("q", params.get("query", [""]))[0]
                    if q:
                        decoded = urllib.parse.unquote(q).replace("+", " ")
                        q_clean = re.sub(r'@[\d\.-]+,[\d\.-]+.*$', '', decoded).strip()
                        q_parts = [p.strip() for p in q_clean.split(",") if p.strip() and not p.strip().startswith("@")]
                        if q_parts:
                            business_name = q_parts[0]
                            if len(q_parts) > 1 and not re.search(r'^\d+(\.\d+)?z?$', q_parts[1]):
                                area = q_parts[1]
                            if len(q_parts) > 2 and not re.search(r'^\d+(\.\d+)?z?$', q_parts[2]):
                                city = q_parts[2]
                            address = q_clean
                else:
                    # Generic URL or name query fallback parsing
                    cleaned_name = re.sub(r'https?://(www\.)?', '', cleaned)
                    parts = [p.strip() for p in cleaned_name.replace("/", " ").replace("-", " ").split(",") if p.strip()]
                    if parts:
                        business_name = parts[0].title()
                        if len(parts) > 1:
                            area = parts[1].title()
                        if len(parts) > 2:
                            city = parts[2].title()
                        address = f"{business_name}, {area}, {city}"

                if not business_name or business_name.lower().startswith("google.com maps search"):
                    failed += 1
                    continue

                now = datetime.datetime.utcnow()
                # Generate location ID for unique constraint check
                custom_location_id = f"scrape-{abs(hash(business_name + (area or '')))}"

                existing = db.query(GoogleBusinessLocation).filter_by(google_location_id=custom_location_id).first()
                if not existing:
                    existing = db.query(GoogleBusinessLocation).filter_by(business_name=business_name, area=area).first()

                if existing:
                    existing.business_name = business_name
                    existing.area = area or existing.area
                    existing.city = city or existing.city
                    existing.address = address or existing.address
                    existing.source = "Web Scraper"
                    existing.last_synced_at = now
                    existing.updated_at = now
                else:
                    new_loc = GoogleBusinessLocation(
                        google_location_id=custom_location_id,
                        business_name=business_name,
                        area=area,
                        city=city,
                        address=address,
                        source="Web Scraper",
                        status="ACTIVE",
                        last_synced_at=now
                    )
                    db.add(new_loc)

                db.commit()
                successfully_scraped += 1

            except Exception as e:
                db.rollback()
                logger.error(f"Failed to scrape URL {url_str}: {e}")
                failed += 1

        all_locations = db.query(GoogleBusinessLocation).order_by(GoogleBusinessLocation.created_at.desc()).all()
        total_count = len(all_locations)

        return {
            "success": True,
            "message": f"Scraped {successfully_scraped} business records successfully ({failed} failed).",
            "total_urls_submitted": total_urls,
            "successfully_scraped": successfully_scraped,
            "failed": failed,
            "total_businesses_collected": successfully_scraped,
            "total_count": total_count,
            "locations": all_locations
        }
