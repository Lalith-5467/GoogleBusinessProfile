import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.scraped_business import ScrapedBusiness
from app.utils.helpers import (
    clean_address_text,
    resolve_location,
    extract_place_id,
    extract_pin_code
)
from app.services.web_scraper import WebScraperService

def repair_database():
    db = SessionLocal()
    try:
        records = db.query(ScrapedBusiness).all()
        print(f"Total businesses in database: {len(records)}")

        updated_count = 0
        for b in records:
            changed = False

            # 1. Clean address
            if b.address:
                cleaned_addr = clean_address_text(b.address)
                if cleaned_addr and cleaned_addr != b.address:
                    b.address = cleaned_addr[:400]
                    changed = True

            # 2. Re-parse area if corrupted or empty
            search_loc = b.search_area or b.city or ""
            area, city_cand, state_cand, pin_cand, plus_cand, dist_cand, ctry_cand = WebScraperService._parse_structured_address(
                b.address or "",
                search_location=search_loc
            )

            # Clean area
            cleaned_area = clean_address_text(b.area)
            if area and (not cleaned_area or len(cleaned_area) > 60 or cleaned_area != b.area):
                b.area = area[:250]
                changed = True
            elif cleaned_area and cleaned_area != b.area:
                b.area = cleaned_area[:250]
                changed = True

            # 3. Resolve city
            if search_loc and (not b.city or len(b.city) > 40 or " Rd" in b.city or " St" in b.city or "opp" in b.city.lower() or "near" in b.city.lower()):
                if city_cand:
                    b.city = city_cand[:250]
                    changed = True

            # 4. Resolve district, state, country
            dist_res, st_res, ctry_res = resolve_location(b.city or b.search_area or b.address)
            if dist_res and not b.district:
                b.district = dist_res[:250]
                changed = True
            if st_res and (not b.state or b.state.strip() == ""):
                b.state = st_res[:250]
                changed = True
            if not b.country:
                b.country = ctry_res or ("India" if (b.state or b.city or b.district) else "India")
                changed = True

            # 5. Extract PIN code
            if not b.postal_code and b.address:
                pin = extract_pin_code(b.address)
                if pin:
                    b.postal_code = pin[:50]
                    changed = True

            # 6. Extract Google Place ID
            if not b.google_place_id and b.google_maps_url:
                pid = extract_place_id(b.google_maps_url)
                if pid:
                    b.google_place_id = pid[:255]
                    changed = True

            # 7. Remove fake services string
            if b.services and b.services.strip().lower() == "google maps search result":
                b.services = None
                changed = True

            # 8. Clean description & about_us if they contained address noise
            if b.description and ("RdFried" in b.description or "RdOpen" in b.description or "Modest restaurant" in b.description):
                clean_desc = f"{b.business_name} in {b.city or b.area or b.search_area or 'locality'}."
                b.description = clean_desc[:1000]
                b.about_us = clean_desc[:1000]
                changed = True

            if changed:
                updated_count += 1

        db.commit()
        print(f"Successfully repaired {updated_count} out of {len(records)} businesses in database.")
    except Exception as e:
        db.rollback()
        print(f"Error repairing database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    repair_database()
