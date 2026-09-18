import logging
import asyncio
import urllib.parse
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("google-business-backend")

def _parse_address_components(components: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    """
    Parses structured address components returned by Google Places API into normalized address fields.
    Does not guess or fabricate values if they are not provided by Google.
    Supports both legacy (long_name/short_name) and new (longText/shortText) Places API naming conventions.
    """
    street_number = ""
    route = ""
    subpremise = ""
    premise = ""
    sublocality_1 = ""
    sublocality_2 = ""
    sublocality_3 = ""
    neighborhood = ""
    locality = ""
    postal_town = ""
    admin_area_3 = ""
    admin_area_2 = ""
    admin_area_1 = ""
    country = ""
    postal_code = ""

    for c in components:
        types = c.get("types", [])
        long_name = (c.get("long_name") or c.get("longText") or "").strip()
        if not long_name:
            continue

        if "street_number" in types:
            street_number = long_name
        elif "route" in types:
            route = long_name
        elif "subpremise" in types:
            subpremise = long_name
        elif "premise" in types:
            premise = long_name
        elif "sublocality_level_1" in types:
            sublocality_1 = long_name
        elif "sublocality_level_2" in types:
            sublocality_2 = long_name
        elif "sublocality_level_3" in types:
            sublocality_3 = long_name
        elif "sublocality" in types and not sublocality_1:
            sublocality_1 = long_name
        elif "neighborhood" in types:
            neighborhood = long_name
        elif "locality" in types:
            locality = long_name
        elif "postal_town" in types:
            postal_town = long_name
        elif "administrative_area_level_3" in types:
            admin_area_3 = long_name
        elif "administrative_area_level_2" in types:
            admin_area_2 = long_name
        elif "administrative_area_level_1" in types:
            admin_area_1 = long_name
        elif "country" in types:
            country = long_name
        elif "postal_code" in types:
            postal_code = long_name

    addr_line_1_parts = [p for p in [street_number, route] if p]
    address_line_1 = " ".join(addr_line_1_parts) if addr_line_1_parts else (route or street_number or premise or None)
    
    sub_parts = [p for p in [subpremise, sublocality_2 or sublocality_3] if p]
    address_line_2 = ", ".join(sub_parts) if sub_parts else (subpremise or sublocality_2 or sublocality_3 or None)
    
    area = sublocality_1 or neighborhood or (locality if not sublocality_1 else None)
    city = locality or postal_town or admin_area_2 or None
    district = admin_area_2 or admin_area_3 or None

    return {
        "address_line_1": address_line_1,
        "address_line_2": address_line_2,
        "neighborhood": neighborhood or None,
        "area": area or None,
        "city": city or None,
        "district": district,
        "state": admin_area_1 or None,
        "country": country or None,
        "postal_code": postal_code or None,
    }


def _normalize_place_data(raw: Dict[str, Any], base_item: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Normalizes a place record from Google Places API (supports both New v1 camelCase and Legacy snake_case).
    Maps all available fields cleanly into the 58-column standard business model.
    Does NOT fabricate missing information.
    """
    enriched = dict(base_item) if base_item else {}

    # 1. Place ID
    raw_id = raw.get("id") or raw.get("place_id") or raw.get("placeId") or enriched.get("google_place_id")
    if raw_id:
        clean_id = raw_id.replace("places/", "") if isinstance(raw_id, str) else str(raw_id)
        enriched["google_place_id"] = clean_id

    # 2. Business Name
    display_name = raw.get("displayName")
    if isinstance(display_name, dict):
        b_name = display_name.get("text", "")
    elif isinstance(display_name, str):
        b_name = display_name
    else:
        b_name = raw.get("name", "")
    if b_name:
        enriched["business_name"] = str(b_name).strip()

    # 3. Categories / Types
    primary_type_obj = raw.get("primaryTypeDisplayName")
    primary_type = None
    if isinstance(primary_type_obj, dict):
        primary_type = primary_type_obj.get("text")
    elif raw.get("primaryType"):
        primary_type = str(raw.get("primaryType")).replace("_", " ").title()
    elif raw.get("primary_category"):
        primary_type = raw.get("primary_category")

    types = raw.get("types", [])
    if isinstance(types, list):
        specific_types = [t for t in types if t not in ("point_of_interest", "establishment")]
        if not primary_type:
            if specific_types:
                primary_type = specific_types[0].replace("_", " ").title()
            elif types:
                primary_type = types[0].replace("_", " ").title()

        remaining_types = [t.replace("_", " ").title() for t in specific_types if t.replace("_", " ").title() != primary_type]
        if remaining_types:
            enriched["additional_categories"] = ", ".join(remaining_types[:6])

    if primary_type:
        enriched["primary_category"] = primary_type

    # 4. Contact & Phone Numbers (prefer international, otherwise national)
    intl_phone = (raw.get("internationalPhoneNumber") or raw.get("international_phone_number") or "").strip()
    nat_phone = (raw.get("nationalPhoneNumber") or raw.get("formatted_phone_number") or raw.get("formattedPhoneNumber") or "").strip()
    
    primary_phone = intl_phone or nat_phone
    if primary_phone:
        enriched["phone"] = primary_phone
    if nat_phone and intl_phone and nat_phone != intl_phone:
        enriched["secondary_phone"] = nat_phone

    # 5. Website & Maps URL
    website = raw.get("websiteUri") or raw.get("website")
    if website:
        enriched["website"] = str(website).strip()

    maps_url = raw.get("googleMapsUri") or raw.get("url") or raw.get("google_maps_url") or enriched.get("google_maps_url")
    if not maps_url and enriched.get("google_place_id"):
        place_id_val = enriched.get("google_place_id")
        b_name_val = enriched.get("business_name") or ""
        maps_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(b_name_val)}&query_place_id={place_id_val}"

    if maps_url:
        enriched["google_maps_url"] = str(maps_url).strip()
        enriched["source_url"] = str(maps_url).strip()

    # 6. Rating & Reviews
    rating = raw.get("rating")
    if rating is not None:
        enriched["rating"] = str(rating)

    user_ratings = raw.get("userRatingCount") if raw.get("userRatingCount") is not None else raw.get("user_ratings_total")
    if user_ratings is not None:
        enriched["review_count"] = str(user_ratings)

    # 7. Editorial Summary / About
    editorial = raw.get("editorialSummary") or raw.get("editorial_summary") or {}
    if isinstance(editorial, dict):
        overview = editorial.get("text") or editorial.get("overview")
        if overview:
            enriched["description"] = overview.strip()
            enriched["about_us"] = overview.strip()
    elif isinstance(editorial, str) and editorial.strip():
        enriched["description"] = editorial.strip()
        enriched["about_us"] = editorial.strip()

    # 8. Address & Structured Address Components
    formatted_addr = raw.get("formattedAddress") or raw.get("formatted_address") or raw.get("shortFormattedAddress")
    if formatted_addr:
        enriched["address"] = str(formatted_addr).strip()

    components = raw.get("addressComponents") or raw.get("address_components") or []
    if components:
        parsed_addr = _parse_address_components(components)
        for key, val in parsed_addr.items():
            if val:
                enriched[key] = val

    postal_addr = raw.get("postalAddress")
    if isinstance(postal_addr, dict):
        if postal_addr.get("postalCode") and not enriched.get("postal_code"):
            enriched["postal_code"] = str(postal_addr.get("postalCode")).strip()
        if postal_addr.get("administrativeArea") and not enriched.get("state"):
            enriched["state"] = str(postal_addr.get("administrativeArea")).strip()
        if postal_addr.get("locality") and not enriched.get("city"):
            enriched["city"] = str(postal_addr.get("locality")).strip()
        if postal_addr.get("addressLines") and not enriched.get("address_line_1"):
            lines = postal_addr.get("addressLines")
            if isinstance(lines, list) and lines:
                enriched["address_line_1"] = " ".join(lines)

    # 9. Location Coordinates & Plus Code
    loc = raw.get("location") or raw.get("geometry", {}).get("location") or {}
    if isinstance(loc, dict):
        lat = loc.get("latitude") if loc.get("latitude") is not None else loc.get("lat")
        lng = loc.get("longitude") if loc.get("longitude") is not None else loc.get("lng")
        if lat is not None:
            enriched["latitude"] = str(lat)
        if lng is not None:
            enriched["longitude"] = str(lng)

    plus_code = raw.get("plusCode") or raw.get("plus_code") or {}
    if isinstance(plus_code, dict):
        pcode = plus_code.get("globalCode") or plus_code.get("global_code") or plus_code.get("compoundCode") or plus_code.get("compound_code")
        if pcode:
            enriched["plus_code"] = pcode

    # 10. Business Status
    b_status = raw.get("businessStatus") or raw.get("business_status")
    if b_status:
        if b_status == "OPERATIONAL":
            enriched["business_status"] = "Operational"
        elif b_status == "CLOSED_TEMPORARILY":
            enriched["business_status"] = "Temporarily Closed"
        elif b_status == "CLOSED_PERMANENTLY":
            enriched["business_status"] = "Permanently Closed"
        else:
            enriched["business_status"] = str(b_status).replace("_", " ").title()

    # 11. Price Level
    price = raw.get("priceLevel") if raw.get("priceLevel") is not None else raw.get("price_level")
    if price is not None:
        price_str = str(price)
        if price_str in ("PRICE_LEVEL_FREE", "0"):
            enriched["price_level"] = "Free"
        elif price_str in ("PRICE_LEVEL_INEXPENSIVE", "1"):
            enriched["price_level"] = "Inexpensive ($)"
        elif price_str in ("PRICE_LEVEL_MODERATE", "2"):
            enriched["price_level"] = "Moderate ($$)"
        elif price_str in ("PRICE_LEVEL_EXPENSIVE", "3"):
            enriched["price_level"] = "Expensive ($$$)"
        elif price_str in ("PRICE_LEVEL_VERY_EXPENSIVE", "4"):
            enriched["price_level"] = "Very Expensive ($$$$)"
        else:
            enriched["price_level"] = price_str

    # 12. Opening Hours
    op_hours = raw.get("currentOpeningHours") or raw.get("regularOpeningHours") or raw.get("current_opening_hours") or raw.get("opening_hours") or {}
    if isinstance(op_hours, dict):
        is_open = op_hours.get("openNow") if "openNow" in op_hours else op_hours.get("open_now")
        if is_open is not None:
            enriched["open_now"] = "Open" if is_open else "Closed"

        weekday_text = op_hours.get("weekdayDescriptions") or op_hours.get("weekday_text") or []
        if isinstance(weekday_text, list) and weekday_text:
            enriched["opening_hours"] = "\n".join(weekday_text)
            for line in weekday_text:
                line_lower = line.lower()
                if "monday:" in line_lower:
                    enriched["monday_hours"] = line.split(":", 1)[1].strip()
                elif "tuesday:" in line_lower:
                    enriched["tuesday_hours"] = line.split(":", 1)[1].strip()
                elif "wednesday:" in line_lower:
                    enriched["wednesday_hours"] = line.split(":", 1)[1].strip()
                elif "thursday:" in line_lower:
                    enriched["thursday_hours"] = line.split(":", 1)[1].strip()
                elif "friday:" in line_lower:
                    enriched["friday_hours"] = line.split(":", 1)[1].strip()
                elif "saturday:" in line_lower:
                    enriched["saturday_hours"] = line.split(":", 1)[1].strip()
                elif "sunday:" in line_lower:
                    enriched["sunday_hours"] = line.split(":", 1)[1].strip()

            if not enriched.get("today_open_status"):
                enriched["today_open_status"] = enriched.get("open_now") or "Available"

    # 13. Attributes, Amenities & Options
    delivery = raw.get("delivery")
    if delivery is not None:
        enriched["delivery"] = "Yes" if delivery else "No"

    dine_in = raw.get("dineIn") if raw.get("dineIn") is not None else raw.get("dine_in")
    if dine_in is not None:
        enriched["dine_in"] = "Yes" if dine_in else "No"

    takeout = raw.get("takeout") if raw.get("takeout") is not None else raw.get("curbsidePickup")
    if takeout is not None:
        enriched["pickup"] = "Yes" if takeout else "No"

    reservations_uri = raw.get("reservationsUri") or raw.get("reservation_url")
    reservable = raw.get("reservable")
    if reservations_uri:
        enriched["reservation_url"] = str(reservations_uri).strip()
    elif reservable is not None:
        enriched["reservation_url"] = "Reservable via Google" if reservable else None

    menu_uri = raw.get("menuUri") or raw.get("menu_url")
    if menu_uri:
        enriched["menu_url"] = str(menu_uri).strip()

    # Payment Options
    payment_opts = raw.get("paymentOptions") or {}
    p_list = []
    if isinstance(payment_opts, dict):
        if payment_opts.get("acceptsCashOnly"):
            p_list.append("Cash Only")
        else:
            if payment_opts.get("acceptsCreditCards"):
                p_list.append("Credit Cards")
            if payment_opts.get("acceptsDebitCards"):
                p_list.append("Debit Cards")
            if payment_opts.get("acceptsNfc"):
                p_list.append("NFC / Contactless")
    if raw.get("accepts_credit_cards") and "Credit Cards" not in p_list:
        p_list.append("Credit Cards")
    if p_list:
        enriched["payment_options"] = ", ".join(p_list)

    # Accessibility Options
    access_opts = raw.get("accessibilityOptions") or {}
    a_list = []
    if isinstance(access_opts, dict):
        if access_opts.get("wheelchairAccessibleEntrance"):
            a_list.append("Wheelchair Accessible Entrance")
        if access_opts.get("wheelchairAccessibleParking"):
            a_list.append("Wheelchair Accessible Parking")
        if access_opts.get("wheelchairAccessibleRestroom"):
            a_list.append("Wheelchair Accessible Restroom")
        if access_opts.get("wheelchairAccessibleSeating"):
            a_list.append("Wheelchair Accessible Seating")
    if raw.get("wheelchair_accessible_entrance") and "Wheelchair Accessible Entrance" not in a_list:
        a_list.append("Wheelchair Accessible Entrance")

    if a_list:
        enriched["accessibility"] = ", ".join(a_list)

    # Amenities
    amenities = []
    parking_opts = raw.get("parkingOptions") or {}
    if isinstance(parking_opts, dict):
        if parking_opts.get("freeParkingLot"):
            amenities.append("Free Parking Lot")
        if parking_opts.get("paidParkingLot"):
            amenities.append("Paid Parking Lot")
        if parking_opts.get("valetParking"):
            amenities.append("Valet Parking")
        if parking_opts.get("freeStreetParking"):
            amenities.append("Free Street Parking")

    if raw.get("outdoorSeating"):
        amenities.append("Outdoor Seating")
    if raw.get("goodForChildren"):
        amenities.append("Good for Kids")
    if raw.get("goodForGroups"):
        amenities.append("Good for Groups")
    if raw.get("serves_vegetarian_food") or raw.get("servesVegetarianFood"):
        amenities.append("Vegetarian Options")
    if raw.get("serves_breakfast") or raw.get("servesBreakfast"):
        amenities.append("Breakfast")
    if raw.get("serves_lunch") or raw.get("servesLunch"):
        amenities.append("Lunch")
    if raw.get("serves_dinner") or raw.get("servesDinner"):
        amenities.append("Dinner")
    if raw.get("serves_beer") or raw.get("serves_wine") or raw.get("servesBeer") or raw.get("servesWine"):
        amenities.append("Alcohol Served")

    if amenities:
        enriched["amenities"] = ", ".join(amenities)

    # Services
    srv_list = []
    if enriched.get("dine_in") == "Yes":
        srv_list.append("Dine-in")
    if enriched.get("pickup") == "Yes":
        srv_list.append("Takeaway")
    if enriched.get("delivery") == "Yes":
        srv_list.append("Delivery")
    if enriched.get("reservation_url"):
        srv_list.append("Reservations")
    if srv_list:
        enriched["services"] = ", ".join(srv_list)

    enriched["enrichment_status"] = "ENRICHED"
    enriched["data_source"] = "Google Places API (Enriched)"

    return enriched


class GooglePlacesService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.GOOGLE_PLACES_API_KEY and settings.GOOGLE_PLACES_API_KEY.strip())

    @staticmethod
    async def fetch_place_details(
        client: httpx.AsyncClient,
        place_id: str,
        base_item: Dict[str, Any],
        semaphore: asyncio.Semaphore
    ) -> Dict[str, Any]:
        """
        Requests Place Details for an individual place_id using Google Places API (New or Legacy).
        Requests all supported fields via explicit field mask.
        Merges returned data into base_item, preserving all existing values if detail fields are unavailable.
        """
        if not place_id or not GooglePlacesService.is_configured():
            return base_item

        api_key = settings.GOOGLE_PLACES_API_KEY.strip()
        clean_place_id = place_id.replace("places/", "")

        # 1. Try Google Places API (New) Details endpoint first
        new_url = f"https://places.googleapis.com/v1/places/{clean_place_id}"
        new_field_mask = (
            "id,displayName,formattedAddress,shortFormattedAddress,location,rating,"
            "userRatingCount,primaryType,primaryTypeDisplayName,types,nationalPhoneNumber,"
            "internationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours,"
            "currentOpeningHours,businessStatus,priceLevel,editorialSummary,paymentOptions,"
            "parkingOptions,accessibilityOptions,outdoorSeating,delivery,dineIn,takeout,"
            "reservable,goodForChildren,goodForGroups,addressComponents,plusCode"
        )
        new_headers = {
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": new_field_mask
        }

        async with semaphore:
            try:
                resp = await client.get(new_url, headers=new_headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        return _normalize_place_data(data, base_item)
            except Exception as e:
                logger.debug(f"Places API (New) details attempt notice for {clean_place_id}: {e}")

            # 2. Fallback to Google Places API (Legacy) Details endpoint
            legacy_url = "https://maps.googleapis.com/maps/api/place/details/json"
            legacy_fields = (
                "place_id,name,formatted_address,address_components,geometry,types,"
                "formatted_phone_number,international_phone_number,website,url,"
                "rating,user_ratings_total,price_level,opening_hours,current_opening_hours,"
                "business_status,editorial_summary,plus_code,dine_in,delivery,takeout,"
                "reservable,serves_beer,serves_breakfast,serves_brunch,serves_dinner,"
                "serves_lunch,serves_vegetarian_food,serves_wine,wheelchair_accessible_entrance"
            )
            legacy_params = {
                "place_id": clean_place_id,
                "fields": legacy_fields,
                "key": api_key,
            }

            try:
                resp = await client.get(legacy_url, params=legacy_params)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") in ("OK",) and data.get("result"):
                        return _normalize_place_data(data.get("result"), base_item)
                    else:
                        logger.warning(f"Place details legacy status '{data.get('status')}' for place_id {clean_place_id}")
                        return base_item
                else:
                    logger.warning(f"Place details HTTP {resp.status_code} for place_id {clean_place_id}")
                    return base_item
            except Exception as e:
                logger.warning(f"Error enriching place_id {clean_place_id}: {e}")
                return base_item

    @staticmethod
    async def search_places(keyword: str, location: Optional[str] = None, max_count: int = 50) -> List[Dict[str, Any]]:
        """
        Searches for places using Google Places API (supports New v1 Text Search with fallback to Legacy Text Search).
        Returns fully normalized business records with structured address components, phone, hours, ratings, and attributes.
        """
        if not GooglePlacesService.is_configured():
            raise ValueError("Google Places API key is not configured.")

        api_key = settings.GOOGLE_PLACES_API_KEY.strip()
        clean_kw = keyword.strip()
        clean_loc = (location or "").strip()
        query = f"{clean_kw} in {clean_loc}" if clean_loc else clean_kw
        limit = min(max(1, max_count), 50)

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. Try Google Places API (New) Text Search
            new_search_url = "https://places.googleapis.com/v1/places:searchText"
            new_field_mask = (
                "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,"
                "places.location,places.rating,places.userRatingCount,places.primaryType,"
                "places.primaryTypeDisplayName,places.types,places.nationalPhoneNumber,"
                "places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,"
                "places.regularOpeningHours,places.currentOpeningHours,places.businessStatus,"
                "places.priceLevel,places.editorialSummary,places.paymentOptions,places.parkingOptions,"
                "places.accessibilityOptions,places.outdoorSeating,places.delivery,places.dineIn,"
                "places.takeout,places.reservable,places.goodForChildren,places.goodForGroups,"
                "places.addressComponents,places.plusCode"
            )
            new_headers = {
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": new_field_mask,
                "Content-Type": "application/json"
            }
            new_payload = {
                "textQuery": query,
                "maxResultCount": min(limit, 20)
            }

            try:
                resp = await client.post(new_search_url, headers=new_headers, json=new_payload)
                if resp.status_code == 200:
                    data = resp.json()
                    places = data.get("places", [])
                    if places:
                        normalized_list: List[Dict[str, Any]] = []
                        for p in places[:limit]:
                            default_meta = {
                                "source_type": "GOOGLE_PLACES_API",
                                "data_source": "Google Places API (Official)",
                                "search_keyword": clean_kw,
                                "search_area": clean_loc or None,
                                "status": "ACTIVE",
                                "city": clean_loc.title() if clean_loc else None,
                            }
                            norm = _normalize_place_data(p, default_meta)
                            normalized_list.append(norm)
                        return normalized_list
            except Exception as e:
                logger.debug(f"Places API (New) search attempt notice: {e}")

            # 2. Fallback to Legacy Google Places Text Search
            legacy_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            legacy_params = {
                "query": query,
                "key": api_key,
            }

            resp = await client.get(legacy_url, params=legacy_params)
            if resp.status_code != 200:
                logger.error(f"Google Places API HTTP error: {resp.status_code} - {resp.text}")
                raise ValueError(f"Google Places API request failed with status {resp.status_code}.")

            data = resp.json()
            status = data.get("status")
            if status not in ("OK", "ZERO_RESULTS"):
                err_msg = data.get("error_message", status)
                logger.error(f"Google Places API returned status '{status}': {err_msg}")
                raise ValueError(f"Google Places API error: {err_msg}")

            raw_places = data.get("results", [])
            base_places: List[Dict[str, Any]] = []
            for p in raw_places[:limit]:
                place_id = p.get("place_id") or ""
                b_name = p.get("name", "").strip()
                formatted_addr = p.get("formatted_address", "").strip()

                types = p.get("types", [])
                specific_types = [t for t in types if t not in ("point_of_interest", "establishment")]
                primary_cat = specific_types[0].replace("_", " ").title() if specific_types else (types[0].replace("_", " ").title() if types else None)

                geo = p.get("geometry", {}).get("location", {})
                lat = str(geo.get("lat")) if geo.get("lat") is not None else None
                lng = str(geo.get("lng")) if geo.get("lng") is not None else None

                maps_url = (
                    f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(b_name)}&query_place_id={place_id}"
                    if place_id
                    else f"https://www.google.com/maps/search/{urllib.parse.quote(b_name + ' ' + formatted_addr)}"
                )

                base_places.append({
                    "source_url": maps_url,
                    "google_maps_url": maps_url,
                    "business_name": b_name,
                    "primary_category": primary_cat,
                    "additional_categories": ", ".join(t.replace("_", " ").title() for t in specific_types[1:5]) if len(specific_types) > 1 else None,
                    "rating": str(p.get("rating")) if p.get("rating") is not None else None,
                    "review_count": str(p.get("user_ratings_total")) if p.get("user_ratings_total") is not None else None,
                    "price_level": str(p.get("price_level")) if p.get("price_level") is not None else None,
                    "business_status": p.get("business_status"),
                    "address": formatted_addr or None,
                    "area": None,
                    "city": clean_loc.title() if clean_loc else None,
                    "latitude": lat,
                    "longitude": lng,
                    "google_place_id": place_id or None,
                    "source_type": "GOOGLE_PLACES_API",
                    "data_source": "Google Places API (Official)",
                    "search_keyword": clean_kw,
                    "search_area": clean_loc or None,
                    "status": "ACTIVE",
                })

            if not base_places:
                return []

            semaphore = asyncio.Semaphore(10)
            tasks = [
                GooglePlacesService.fetch_place_details(
                    client=client,
                    place_id=item.get("google_place_id") or "",
                    base_item=item,
                    semaphore=semaphore
                )
                for item in base_places
            ]

            enriched_results = await asyncio.gather(*tasks, return_exceptions=True)

            final_results: List[Dict[str, Any]] = []
            for idx, res in enumerate(enriched_results):
                if isinstance(res, Exception):
                    logger.warning(f"Place enrichment task exception: {res}")
                    final_results.append(base_places[idx])
                elif isinstance(res, dict):
                    final_results.append(res)
                else:
                    final_results.append(base_places[idx])

            return final_results
