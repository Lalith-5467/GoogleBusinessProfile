import asyncio
import sys
import json
import logging
import re
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from fastapi import HTTPException

from app.models.scraped_business import ScrapedBusiness

logger = logging.getLogger(__name__)

def _run_with_proactor_loop(coro_fn, *args, **kwargs):
    """Runs an async coroutine on Windows using a dedicated ProactorEventLoop in a worker thread."""
    def _worker():
        loop = asyncio.ProactorEventLoop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro_fn(*args, **kwargs))
        finally:
            loop.close()
    return asyncio.to_thread(_worker)

# SSRF Protection: Block private/internal IP ranges and local hostnames
BLOCKED_HOSTNAMES = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"
]

def normalize_and_validate_url(raw_url: str) -> Tuple[str, str]:
    """
    Validates URL format, applies SSRF protections, normalizes tracking parameters,
    and classifies the URL as GOOGLE_MAPS_SEARCH, GOOGLE_MAPS_PLACE, YOUTUBE, or BUSINESS_WEBSITE.
    """
    url_str = raw_url.strip()
    if not url_str.startswith("http://") and not url_str.startswith("https://"):
        if url_str.startswith("www."):
            url_str = "https://" + url_str
        else:
            raise ValueError("Please enter a valid URL.")

    parsed = urllib.parse.urlparse(url_str)
    hostname = (parsed.hostname or "").lower()
    full_url_lower = url_str.lower()

    if not hostname:
        raise ValueError("Please enter a valid URL.")

    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise ValueError(f"Target hostname '{hostname}' is restricted for security (SSRF protection).")

    if re.match(r'^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)', hostname):
        raise ValueError(f"Target IP address '{hostname}' is restricted (SSRF protection).")

    # Detect Google Maps Search vs Google Maps Place
    if (
        "google.com/maps" in full_url_lower or
        "maps.google.com" in full_url_lower or
        "google.co.in/maps" in full_url_lower or
        "goo.gl/maps" in full_url_lower or
        "maps.app.goo.gl" in full_url_lower
    ):
        if "/place/" in parsed.path:
            return url_str, "GOOGLE_MAPS_PLACE"
        else:
            return url_str, "GOOGLE_MAPS_SEARCH"

    # Detect YouTube URLs & normalize canonical link
    if "youtube.com" in hostname or "youtu.be" in hostname:
        source_type = "YOUTUBE"
        if "youtu.be" in hostname:
            video_id = parsed.path.lstrip("/").split("?")[0].split("&")[0]
            canonical_url = f"https://youtu.be/{video_id}"
        elif "/shorts/" in parsed.path:
            shorts_id = parsed.path.split("/shorts/")[1].split("/")[0].split("?")[0]
            canonical_url = f"https://www.youtube.com/shorts/{shorts_id}"
        elif "/watch" in parsed.path:
            query_params = urllib.parse.parse_qs(parsed.query)
            video_id = query_params.get("v", [""])[0]
            canonical_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else url_str
        else:
            canonical_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        return canonical_url, source_type

    return url_str, "BUSINESS_WEBSITE"


class WebScraperService:
    @staticmethod
    async def scrape_single_website(url: str, db: Session) -> Dict[str, Any]:
        """
        Scrapes a target URL (Google Maps Search, Google Maps Place, YouTube, or Business Website),
        extracts & enriches complete business records, upserts them into MySQL `scraped_businesses`,
        and returns a dictionary with records and total count.
        """
        canonical_url, classification = normalize_and_validate_url(url)
        
        if classification == "GOOGLE_MAPS_SEARCH":
            extracted_list = await WebScraperService._extract_google_maps_search(canonical_url)
        elif classification == "GOOGLE_MAPS_PLACE":
            extracted_list = await WebScraperService._extract_google_maps_place(canonical_url)
        else:
            try:
                extracted_single = await WebScraperService._extract_with_playwright(canonical_url, classification)
                # Perform Google Business Profile Enrichment for company websites
                enriched_single = await WebScraperService._enrich_website_with_google_maps(extracted_single)
                extracted_list = [enriched_single]
            except Exception as e:
                logger.warning(f"Direct scrape failed for '{canonical_url}': {e}. Attempting Google Business Profile brand resolution fallback...")
                brand_fallback = await WebScraperService._fallback_brand_google_maps_search(canonical_url)
                if brand_fallback:
                    extracted_list = brand_fallback
                else:
                    err_str = str(e)
                    if "ERR_HTTP2_PROTOCOL_ERROR" in err_str or "10054" in err_str or "timeout" in err_str.lower() or "connection" in err_str.lower():
                        raise ValueError(f"Unable to scrape '{canonical_url}' directly (website connection blocked by anti-bot firewall). Please try searching by business name in Business Profiles or paste a Google Maps Place URL.")
                    raise ValueError(f"Unable to access this website: {err_str}")

        records: List[ScrapedBusiness] = []
        for item in extracted_list:
            rec = WebScraperService._upsert_scraped_business(item, db)
            records.append(rec)

        total_count = db.query(ScrapedBusiness).count()

        return {
            "success": True,
            "businesses": records,
            "businesses_count": len(records),
            "total_count": total_count,
            "primary_business": records[0] if records else None
        }

    @staticmethod
    async def search_keyword_location(keyword: str, location: Optional[str], db: Session, max_count: Optional[int] = 50) -> Dict[str, Any]:
        """
        Searches Google Maps for business keyword + location (e.g. KFC + Chennai),
        extracts all matching places up to max_count, normalizes fields, saves to MySQL, and returns list.
        """
        clean_kw = keyword.strip()
        clean_loc = (location or "").strip()

        if not clean_kw:
            raise ValueError("Please provide a valid business keyword or name.")

        query_str = f"{clean_kw} in {clean_loc}" if clean_loc else clean_kw
        target_url = f"https://www.google.com/maps/search/{urllib.parse.quote(query_str)}"

        extracted_list = await WebScraperService._extract_google_maps_search(
            target_url=target_url,
            search_keyword=clean_kw,
            search_area=clean_loc
        )

        if max_count and max_count > 0:
            extracted_list = extracted_list[:max_count]

        records: List[ScrapedBusiness] = []
        for item in extracted_list:
            rec = WebScraperService._upsert_scraped_business(item, db)
            records.append(rec)

        total_count = db.query(ScrapedBusiness).count()

        return {
            "success": True,
            "keyword": clean_kw,
            "location": clean_loc,
            "total_returned": len(records),
            "total_count": total_count,
            "businesses": records
        }

    @staticmethod
    async def scrape_bulk_websites(urls: List[str], db: Session) -> Dict[str, Any]:
        """
        Bulk scrapes multiple public URLs with controlled concurrency.
        """
        total_urls = len(urls)
        successfully_scraped = 0
        failed = 0
        all_scraped_results: List[ScrapedBusiness] = []

        semaphore = asyncio.Semaphore(3)

        async def _scrape_worker(raw_url: str):
            nonlocal successfully_scraped, failed
            async with semaphore:
                try:
                    res = await WebScraperService.scrape_single_website(raw_url, db)
                    successfully_scraped += 1
                    all_scraped_results.extend(res["businesses"])
                except Exception as e:
                    logger.error(f"Scrape failed for URL '{raw_url}': {str(e)}")
                    failed += 1

        tasks = [_scrape_worker(u) for u in urls if u and u.strip()]
        if tasks:
            await asyncio.gather(*tasks)

        all_records = db.query(ScrapedBusiness).order_by(ScrapedBusiness.scraped_at.desc()).all()
        total_count = len(all_records)

        return {
            "success": True,
            "total_urls": total_urls,
            "successfully_scraped": successfully_scraped,
            "failed": failed,
            "total_businesses": total_count,
            "results": all_scraped_results,
            "all_businesses": all_records
        }

    @staticmethod
    async def _extract_google_maps_search(
        target_url: str, 
        search_keyword: Optional[str] = None, 
        search_area: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Playwright scraper for Google Maps Search URLs.
        Delegates to ProactorEventLoop on Windows if SelectorEventLoop is active.
        """
        if sys.platform == "win32":
            try:
                loop = asyncio.get_running_loop()
                if isinstance(loop, getattr(asyncio, "SelectorEventLoop", ())):
                    return await _run_with_proactor_loop(
                        WebScraperService._extract_google_maps_search_impl,
                        target_url=target_url,
                        search_keyword=search_keyword,
                        search_area=search_area
                    )
            except Exception as e:
                logger.warning(f"Proactor thread fallback: {e}")

        return await WebScraperService._extract_google_maps_search_impl(
            target_url=target_url,
            search_keyword=search_keyword,
            search_area=search_area
        )

    @staticmethod
    async def _extract_google_maps_search_impl(
        target_url: str, 
        search_keyword: Optional[str] = None, 
        search_area: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Playwright scraper implementation for Google Maps Search URLs.
        Scrolls search results feed, extracts all resolved business cards into complete records.
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900}
            )
            page = await context.new_page()
            extracted_cards: List[Dict[str, Any]] = []

            try:
                response = await page.goto(target_url, timeout=35000, wait_until="domcontentloaded")
                if response and response.status >= 400:
                    raise ValueError("Unable to access the Google Maps results page.")

                await page.wait_for_timeout(3500)

                # Dismiss cookie dialogs if present
                try:
                    consent_btn = page.locator('button[aria-label*="Accept"], button[aria-label*="Agree"]').first
                    if await consent_btn.count() > 0 and await consent_btn.is_visible():
                        await consent_btn.click()
                        await page.wait_for_timeout(1500)
                except Exception:
                    pass

                # Locate feed container and scroll
                feed_selector = 'div[role="feed"], div[aria-label*="Results for"], div.m6QEdf[role="region"]'
                try:
                    await page.wait_for_selector(feed_selector, timeout=8000)
                    feed_loc = page.locator(feed_selector).first
                    if await feed_loc.count() > 0:
                        for _ in range(5):
                            await feed_loc.evaluate('el => el.scrollBy(0, 1000)')
                            await page.wait_for_timeout(800)
                except Exception:
                    pass

                # Query card data in browser context
                raw_cards = await page.evaluate(r'''() => {
                    const cards = Array.from(document.querySelectorAll('div.Nv2pk, div[role="article"]'));
                    return cards.map(el => {
                        const linkEl = el.querySelector('a.hfpxzc');
                        let name = '';
                        if (linkEl && linkEl.getAttribute('aria-label')) {
                            name = linkEl.getAttribute('aria-label').trim();
                        }
                        if (!name) {
                            const heading = el.querySelector('.qBF1Pd, div.fontHeadlineSmall, [role="heading"]');
                            if (heading) name = heading.textContent.trim();
                        }
                        name = name.replace(/[^\x20-\x7E]/g, '').trim();

                        const href = linkEl ? linkEl.href : '';
                        
                        // 1. Rating & Reviews
                        let rating = '';
                        let reviews = '';

                        const ratingEl = el.querySelector('span.MW4etd, span.mwA4fd, span.ceA1da');
                        if (ratingEl) rating = ratingEl.textContent.replace(/[^\x20-\x7E]/g, '').trim();

                        const reviewsEl = el.querySelector('span.UY7F9, span[aria-label*="reviews"], span[aria-label*="Reviews"]');
                        if (reviewsEl) {
                            let rText = reviewsEl.textContent.trim();
                            let mM = rText.match(/\(([\d,]+)\)/);
                            if (mM) {
                                reviews = mM[1].replace(/,/g, '');
                            } else {
                                reviews = rText.replace(/[^0-9]/g, '');
                            }
                        }

                        const ariaStarEl = el.querySelector('span[aria-label*="stars"], span[aria-label*="star"]');
                        if (ariaStarEl) {
                            const ariaText = ariaStarEl.getAttribute('aria-label') || '';
                            const mR = ariaText.match(/(\d\.\d)\s*star/i);
                            if (mR && !rating) rating = mR[1];
                            const mRev = ariaText.match(/([\d,]+)\s*Review/i);
                            if (mRev && !reviews) reviews = mRev[1].replace(/,/g, '');
                        }

                        // 2. Category, PlusCode, OpenStatus & Address text parsing
                        const w4Lines = Array.from(el.querySelectorAll('.W4Efsd')).map(w => w.textContent.trim());
                        let category = '';
                        let plusCode = '';
                        let openStatus = '';
                        let addressParts = [];

                        for (const line of w4Lines) {
                            const parts = line.split(/[·•⋅|\n]/).map(p => p.replace(/[^\x20-\x7E]/g, '').trim());
                            for (const part of parts) {
                                if (!part) continue;

                                // Check rating/review string e.g. "3.7(138)" or "3.7"
                                const rMatch = part.match(/^(\d\.\d)\s*\(([\d,]+)\)$/);
                                if (rMatch) {
                                    if (!rating) rating = rMatch[1];
                                    if (!reviews) reviews = rMatch[2];
                                    continue;
                                }
                                if (/^\d\.\d$/.test(part)) {
                                    if (!rating) rating = part;
                                    continue;
                                }

                                // Check Plus Code e.g. "QHC2+PCV"
                                const plusMatch = part.match(/([A-Z0-9]{4}\+[A-Z0-9]{2,3})/);
                                if (plusMatch) {
                                    if (!plusCode) plusCode = plusMatch[1];
                                    const remaining = part.replace(plusMatch[0], '').replace(/^[,\s\+·•⋅]+/, '').trim();
                                    if (remaining) {
                                        if (/^(Open|Closed|Closes|Opens|24 hours)/i.test(remaining) || remaining.includes('Closes') || remaining.includes('Opens')) {
                                            if (!openStatus) openStatus = remaining;
                                        } else if (remaining.length > 2) {
                                            addressParts.push(remaining);
                                        }
                                    }
                                    continue;
                                }

                                // Check Open/Closed status
                                if (/^(Open|Closed|Closes|Opens|24 hours)/i.test(part) || part.includes('Closes') || part.includes('Opens')) {
                                    if (!openStatus) openStatus = part;
                                    continue;
                                }

                                if (part.includes('★') || part === 'Directions' || part === 'Website' || part === 'Call') {
                                    continue;
                                }

                                const isAddressWord = /\b(st|street|rd|road|lane|ln|drive|drv|highway|hwy|bus stop)\b/i.test(part);
                                if (!category && !/\d/.test(part) && !part.includes(',') && !isAddressWord) {
                                    category = part;
                                } else {
                                    addressParts.push(part);
                                }
                            }
                        }

                        const fullText = addressParts.join(', ');
                        let phoneNum = '';
                        const phoneMatch = fullText.match(/(\+?\d[\d\s\-]{7,15})/);
                        if (phoneMatch) {
                            phoneNum = phoneMatch[1].trim();
                        }

                        return { name, href, rating, reviews, category, plusCode, openStatus, fullText, phoneNum };
                    }).filter(c => c.name && c.name.length > 1);
                }''')

                seen_keys = set()
                for card in raw_cards:
                    b_name = card.get("name", "").strip()
                    if not b_name or b_name.lower() in ["google maps", "results", "search", "directions", "overview"]:
                        continue

                    # Filter out search queries stored as name
                    if b_name.lower().startswith("google.com maps search") or b_name.lower().startswith("https://"):
                        continue

                    full_text = card.get("fullText", "")
                    card_link = card.get("href", "") or target_url

                    # Parse coordinates from place link if available
                    lat, lng = WebScraperService._extract_coordinates_from_url(card_link)
                    area, city, state, pin, plus_c = WebScraperService._parse_structured_address(
                        full_text=full_text,
                        search_location=search_area,
                        category_hint=card.get("category")
                    )

                    plus_code = card.get("plusCode") or plus_c

                    # Deduplicate cards
                    dedup_key = f"{b_name.lower()}|{area.lower()}|{city.lower()}|{lat}|{lng}"
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)

                    phone_candidates = [card.get("phoneNum")] if card.get("phoneNum") else []
                    if full_text:
                        matches = re.findall(r'(\+?\d[\d\s\-]{7,15})', full_text)
                        phone_candidates.extend(matches)

                    prim_phone, mob_phone, land_phone = WebScraperService._classify_phones(phone_candidates)

                    extracted_cards.append({
                        "source_url": card_link,
                        "google_maps_url": card_link,
                        "business_name": b_name[:250],
                        "primary_category": (card.get("category") or search_keyword or "")[:250],
                        "rating": card.get("rating", "")[:50],
                        "review_count": card.get("reviews", "")[:50],
                        "address": full_text[:400] if full_text else f"{b_name}, {city or search_area or ''}",
                        "area": area[:250],
                        "city": city[:250],
                        "state": state[:250],
                        "postal_code": pin[:50],
                        "latitude": lat[:50],
                        "longitude": lng[:50],
                        "plus_code": plus_code[:100],
                        "open_now": card.get("openStatus", "")[:50],
                        "today_open_status": card.get("openStatus", "")[:50],
                        "phone": prim_phone,
                        "phone_landline": land_phone,
                        "phone_mobile": mob_phone,
                        "description": f"{b_name} in {city or area or search_area or 'locality'}.",
                        "about_us": f"{b_name} in {city or area or search_area or 'locality'}.",
                        "services": "Google Maps Search Result",
                        "source_type": "GOOGLE_MAPS_SEARCH",
                        "search_keyword": search_keyword,
                        "search_area": search_area,
                        "data_source": "Google Maps Search"
                    })

                if not extracted_cards:
                    raise ValueError("No business results could be identified from this page.")

            except PlaywrightTimeoutError:
                raise ValueError("This page could not be scraped (timeout).")
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Unable to access Google Maps results page: {str(e)}")
            finally:
                await context.close()
                await browser.close()

        return extracted_cards

    @staticmethod
    async def _extract_google_maps_place(target_url: str) -> List[Dict[str, Any]]:
        """
        Playwright scraper for a single Google Maps Place URL.
        Delegates to ProactorEventLoop on Windows if SelectorEventLoop is active.
        """
        if sys.platform == "win32":
            try:
                loop = asyncio.get_running_loop()
                if isinstance(loop, getattr(asyncio, "SelectorEventLoop", ())):
                    return await _run_with_proactor_loop(
                        WebScraperService._extract_google_maps_place_impl,
                        target_url=target_url
                    )
            except Exception as e:
                logger.warning(f"Proactor thread fallback: {e}")

        return await WebScraperService._extract_google_maps_place_impl(target_url=target_url)

    @staticmethod
    async def _extract_google_maps_place_impl(target_url: str) -> List[Dict[str, Any]]:
        """
        Playwright scraper implementation for a single Google Maps Place URL.
        Extracts complete place fields (Name, Category, Rating, Reviews, Address, Area, City, State, Pin, Lat, Lng, Phone, Landline, Hours, Website, About).
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900}
            )
            page = await context.new_page()

            try:
                response = await page.goto(target_url, timeout=35000, wait_until="domcontentloaded")
                if response and response.status >= 400:
                    raise ValueError("Unable to access the Google Maps place page.")

                await page.wait_for_timeout(3500)

                # Check if search redirected to a feed card list instead of direct place
                first_card = page.locator('a.hfpxzc').first
                if "/search/" in page.url and await first_card.count() > 0:
                    await first_card.click()
                    await page.wait_for_timeout(3500)

                data = await page.evaluate('''() => {
                    const clean = (str) => str ? str.replace(/^[^\\w\\s\\+]+/, '').trim() : '';

                    const h1 = document.querySelector('h1.DUwfe, h1.fontTitleLarge, h1');
                    const catBtn = document.querySelector('button[data-item-id="category"], button.Dkftq, button.fontBodyMedium');
                    const addrBtn = document.querySelector('button[data-item-id="address"], div.Io6YTe');
                    const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
                    const webLink = document.querySelector('a[data-item-id="authority"]');
                    const ratingSpan = document.querySelector('div.F72Y0d span, span.ceA1da, span.mwA4fd');
                    const reviewsBtn = document.querySelector('button.HH2rfc, button[aria-label*="reviews"]');
                    const aboutDiv = document.querySelector('div.PYvAId, div.w8fiHc, div[aria-label*="About"]');
                    const openStatusSpan = document.querySelector('span[style*="color: rgb(24, 128, 56)"], span[style*="color: rgb(217, 48, 37)"], div.m6QEdf span.fontBodyMedium');

                    return {
                        name: h1 ? h1.textContent.trim() : '',
                        category: clean(catBtn ? catBtn.textContent : ''),
                        address: clean(addrBtn ? addrBtn.textContent : ''),
                        phone: clean(phoneBtn ? phoneBtn.textContent : ''),
                        website: webLink ? webLink.href : '',
                        rating: clean(ratingSpan ? ratingSpan.textContent : ''),
                        reviews: reviewsBtn ? reviewsBtn.textContent.trim().replace(/[^0-9,]/g, '') : '',
                        about: clean(aboutDiv ? aboutDiv.textContent : ''),
                        open_status: clean(openStatusSpan ? openStatusSpan.textContent : '')
                    };
                }''')

                final_url = page.url
                b_name = data.get("name")
                if not b_name or b_name.lower() in ["google maps", "maps", "results", ""]:
                    h1_el = page.locator('h1.DUwfe, h1.fontTitleLarge, h1').first
                    if await h1_el.count() > 0:
                        h1_text = await h1_el.text_content()
                        if h1_text and h1_text.strip() and h1_text.strip().lower() not in ["google maps", "results", "search"]:
                            b_name = h1_text.strip()

                if not b_name or b_name.lower() in ["google maps", "maps", "results", ""]:
                    if "/place/" in final_url:
                        place_segment = final_url.split("/place/")[1].split("/")[0]
                        place_clean = re.sub(r'@.*$', '', place_segment)
                        place_clean = urllib.parse.unquote(place_clean).replace('+', ' ').strip()
                        if place_clean and not place_clean.startswith("@"):
                            b_name = place_clean

                if not b_name or b_name.lower() in ["google maps", "maps", "results", ""]:
                    b_name = (await page.title()).replace(" - Google Maps", "").strip()

                if not b_name or b_name.lower() in ["google maps", "maps", "results", ""]:
                    raise ValueError("No reliable business information was found on this Google Maps place page.")

                addr_text = data.get("address", "")
                area, city, state, pin, plus_c = WebScraperService._parse_structured_address(addr_text)
                lat, lng = WebScraperService._extract_coordinates_from_url(final_url)

                phone_raw = data.get("phone", "")
                prim_phone, mob_phone, land_phone = WebScraperService._classify_phones([phone_raw] if phone_raw else [])

                # Fallback to search query if address/phone not rendered
                if not addr_text or not prim_phone:
                    try:
                        search_res = await WebScraperService._extract_google_maps_search(
                            f"https://www.google.com/maps/search/{urllib.parse.quote(b_name)}"
                        )
                        if search_res:
                            fb = search_res[0]
                            addr_text = addr_text or fb.get("address", "")
                            area = area or fb.get("area", "")
                            city = city or fb.get("city", "")
                            state = state or fb.get("state", "")
                            pin = pin or fb.get("postal_code", "")
                            prim_phone = prim_phone or fb.get("phone")
                            land_phone = land_phone or fb.get("phone_landline")
                            mob_phone = mob_phone or fb.get("phone_mobile")
                            data["category"] = data.get("category") or fb.get("primary_category", "")
                            data["rating"] = data.get("rating") or fb.get("rating", "")
                            data["reviews"] = data.get("reviews") or fb.get("review_count", "")
                            lat = lat or fb.get("latitude", "")
                            lng = lng or fb.get("longitude", "")
                    except Exception:
                        pass

                about_val = data.get("about") or f"Google Maps place details for {b_name}."

                return [{
                    "source_url": target_url,
                    "google_maps_url": final_url,
                    "business_name": b_name[:250],
                    "primary_category": data.get("category", "")[:250],
                    "rating": data.get("rating", "")[:50],
                    "review_count": data.get("reviews", "")[:50],
                    "open_now": data.get("open_status", "")[:50],
                    "address": addr_text[:400],
                    "area": area[:250],
                    "city": city[:250],
                    "state": state[:250],
                    "postal_code": pin[:50],
                    "latitude": lat[:50],
                    "longitude": lng[:50],
                    "phone": prim_phone,
                    "phone_landline": land_phone,
                    "phone_mobile": mob_phone,
                    "email": None,
                    "website": data.get("website") or target_url,
                    "description": about_val[:1000],
                    "about_us": about_val[:1000],
                    "services": "Google Maps Place",
                    "source_type": "GOOGLE_MAPS_PLACE",
                    "data_source": "Google Maps Place"
                }]

            except PlaywrightTimeoutError:
                raise ValueError("This Google Maps page could not be scraped (timeout).")
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Unable to access Google Maps place page: {str(e)}")
            finally:
                await context.close()
                await browser.close()

    @staticmethod
    async def _enrich_website_with_google_maps(extracted_website: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enriches a scraped company website record with Google Maps business information (Rating, Reviews, Category, Full Address, Landline, Lat/Lng).
        Performs safe matching verification before merging.
        """
        b_name = extracted_website.get("business_name", "").strip()
        city = extracted_website.get("city", "").strip()
        area = extracted_website.get("area", "").strip()
        location_hint = city or area or ""

        if not b_name:
            extracted_website["enrichment_status"] = "NOT_MATCHED"
            return extracted_website

        search_query = f"{b_name} {location_hint}".strip()
        target_url = f"https://www.google.com/maps/search/{urllib.parse.quote(search_query)}"

        try:
            google_places = await WebScraperService._extract_google_maps_search(target_url)
            if not google_places:
                extracted_website["enrichment_status"] = "NOT_MATCHED"
                return extracted_website

            # Find best matching candidate
            best_match = None
            norm_bname = re.sub(r'[^\w\s]', '', b_name.lower())

            for place in google_places:
                p_name = re.sub(r'[^\w\s]', '', place.get("business_name", "").lower())
                # Check name similarity
                if norm_bname in p_name or p_name in norm_bname or len(set(norm_bname.split()).intersection(set(p_name.split()))) >= 1:
                    best_match = place
                    break

            if not best_match:
                best_match = google_places[0]

            # Verify safe matching
            p_name = best_match.get("business_name", "")
            p_city = best_match.get("city", "")

            # Safe merge
            merged = dict(extracted_website)
            merged["alternate_name"] = p_name if p_name != b_name else None
            merged["primary_category"] = best_match.get("primary_category") or merged.get("primary_category")
            merged["rating"] = best_match.get("rating") or merged.get("rating")
            merged["review_count"] = best_match.get("review_count") or merged.get("review_count")
            merged["google_maps_url"] = best_match.get("google_maps_url")
            merged["address"] = best_match.get("address") or merged.get("address")
            merged["area"] = best_match.get("area") or merged.get("area")
            merged["city"] = best_match.get("city") or merged.get("city")
            merged["state"] = best_match.get("state") or merged.get("state")
            merged["postal_code"] = best_match.get("postal_code") or merged.get("postal_code")
            merged["latitude"] = best_match.get("latitude") or merged.get("latitude")
            merged["longitude"] = best_match.get("longitude") or merged.get("longitude")

            # Combine Phone Numbers safely
            g_landline = best_match.get("phone_landline")
            g_mobile = best_match.get("phone_mobile") or best_match.get("phone")
            web_phone = merged.get("phone")

            if g_landline:
                merged["phone_landline"] = g_landline
            if g_mobile:
                merged["phone_mobile"] = g_mobile
            if web_phone:
                if not merged.get("phone_mobile"):
                    merged["phone_mobile"] = web_phone

            # Primary phone priority: landline or mobile
            merged["phone"] = merged.get("phone_landline") or merged.get("phone_mobile") or web_phone

            merged["about_us"] = best_match.get("about_us") or merged.get("about_us") or merged.get("description")
            merged["enrichment_status"] = "MATCHED"
            merged["data_source"] = "Website + Google Maps Enriched"

            return merged

        except Exception as e:
            logger.warning(f"Enrichment failed for '{b_name}': {e}")
            extracted_website["enrichment_status"] = "NOT_MATCHED"
            return extracted_website

    @staticmethod
    async def _fallback_brand_google_maps_search(raw_url: str) -> List[Dict[str, Any]]:
        """
        When a direct website scrape is blocked by anti-bot firewalls (Akamai, Cloudflare, HTTP2 protocol errors),
        extracts the brand name from the hostname and searches Google Maps to retrieve verified business profiles.
        """
        try:
            parsed = urllib.parse.urlparse(raw_url)
            host = (parsed.hostname or "").lower()
            parts = host.split(".")
            subdomains = {"www", "online", "order", "app", "portal", "shop", "store", "m", "en"}
            tlds = {"com", "co", "in", "org", "net", "io", "ai", "uk", "us", "gov", "edu", "biz", "info"}
            meaningful = [p for p in parts if p not in subdomains and p not in tlds]
            if not meaningful:
                return []

            brand_token = meaningful[0]
            brand_name = brand_token.upper() if len(brand_token) <= 4 else brand_token.title()

            target_url = f"https://www.google.com/maps/search/{urllib.parse.quote(brand_name)}"
            logger.info(f"Anti-bot firewall detected on '{raw_url}'. Auto-resolving brand '{brand_name}' via Google Maps...")
            cards = await WebScraperService._extract_google_maps_search(target_url, search_keyword=brand_name)
            return cards
        except Exception as e:
            logger.warning(f"Brand fallback failed for '{raw_url}': {e}")
            return []

    @staticmethod
    def _extract_coordinates_from_url(url_str: str) -> Tuple[str, str]:
        """Extracts latitude and longitude from Google Maps URL format."""
        if not url_str:
            return "", ""

        # Check !8m2!3d13.0373401!4d80.2297075 pattern
        m = re.search(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', url_str)
        if m:
            return m.group(1), m.group(2)

        # Check @13.0373401,80.2297075 pattern
        m2 = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url_str)
        if m2:
            return m2.group(1), m2.group(2)

        return "", ""

    @staticmethod
    def _parse_structured_address(
        full_text: str, 
        search_location: Optional[str] = None, 
        category_hint: Optional[str] = None
    ) -> Tuple[str, str, str, str, str]:
        """
        Parses structured address components: (Area, City, State, PostalCode, PlusCode) from address string.
        Filters out Plus Codes, coordinates, zoom tokens, category terms, ratings, and open status noise.
        """
        if not full_text:
            return "", (search_location or ""), "", "", ""

        # Clean text and non-printable icon characters
        clean_text = re.sub(r'[^\x20-\x7E]', ' ', full_text)
        clean_text = re.sub(r'@[\d\.-]+,[\d\.-]+.*$', '', clean_text).strip()

        # 1. Extract Plus Code (e.g. QHC2+PCV or PQW5+J42)
        plus_code = ""
        plus_match = re.search(r'\b([A-Z0-9]{4}\+[A-Z0-9]{2,4})\b', clean_text)
        if plus_match:
            plus_code = plus_match.group(1)
            clean_text = clean_text.replace(plus_code, ' ').strip()

        # 2. Extract Postal Code (e.g. 607106 or 600017)
        pin_code = ""
        pin_match = re.search(r'\b(\d{5,6})\b', clean_text)
        if pin_match:
            pin_code = pin_match.group(1)

        # 3. Extract State
        KNOWN_STATES = [
            "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
            "Maharashtra", "Delhi", "Gujarat", "West Bengal", "Rajasthan",
            "Goa", "Puducherry", "Pondicherry"
        ]
        state = ""
        for s_name in KNOWN_STATES:
            if s_name.lower() in clean_text.lower():
                state = s_name
                clean_text = re.sub(re.escape(s_name), ' ', clean_text, flags=re.IGNORECASE).strip()
                break

        # Split into candidate tokens
        tokens = [t.strip() for t in re.split(r'[|·,\n]', clean_text) if t.strip()]

        IGNORE_TERMS = {
            "directions", "website", "save", "share", "menu", "call", "sponsored", 
            "open", "closed", "24 hours", "restaurant", "store", "hospital", "clinic",
            "results", "search", "google maps", "fried chicken restaurant chain", "shopping mall",
            "vegetarian restaurant", "bakery and cake shop", "bakery", "sweet shop", "snack bar"
        }

        valid_tokens = []
        for tok in tokens:
            t_lower = tok.lower()
            if t_lower in IGNORE_TERMS or (category_hint and t_lower == category_hint.lower()):
                continue
            if re.search(r'\b(open|closed|closes|opens|24 hours)\b', t_lower):
                continue
            if re.search(r'^\+?\d[\d\s\-]{7,}$', tok):  # Phone numbers
                continue
            if re.search(r'^@?[\d\.-]+$', tok) or re.search(r'^\d+z$', t_lower):  # Lat/lng/zoom
                continue
            if re.search(r'^\d\.\d$', tok) or "star" in t_lower or "review" in t_lower or re.search(r'^\d\.\d\s*\(', tok) or re.search(r'^\([\d,]+\)$', tok):
                continue
            if re.search(r'^[A-Z0-9]{4}\+[A-Z0-9]{2,4}', tok):  # Plus code fragment
                continue

            cleaned_tok = re.sub(r'^[^\w\s]+', '', tok).strip()
            cleaned_tok = re.sub(r'[\s\+]*open.*$', '', cleaned_tok, flags=re.IGNORECASE).strip()
            if cleaned_tok and len(cleaned_tok) > 1 and cleaned_tok.lower() not in IGNORE_TERMS:
                valid_tokens.append(cleaned_tok)

        area, city = "", ""
        search_loc_clean = (search_location or "").strip()
        if search_loc_clean:
            city = search_loc_clean.title()

        if valid_tokens:
            non_city_tokens = []
            for v in valid_tokens:
                if search_loc_clean and v.lower() == search_loc_clean.lower():
                    city = v.title()
                else:
                    non_city_tokens.append(v)

            if non_city_tokens:
                area = ", ".join(non_city_tokens)
            elif not area and city:
                area = city
        elif not area and city:
            area = city

        if pin_code:
            city = city.replace(pin_code, "").strip()
            if state:
                state = state.replace(pin_code, "").strip()

        return area, city, state, pin_code, plus_code

    @staticmethod
    def _classify_phones(candidates: Any) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        if not candidates:
            return None, None, None

        if isinstance(candidates, str):
            candidates = [candidates]

        mobile_num = None
        landline_num = None
        seen_digits = set()

        for raw in candidates:
            if not raw or not isinstance(raw, str):
                continue
            cleaned = raw.strip()
            if cleaned.lower().startswith("tel:"):
                cleaned = cleaned[4:].strip()
            cleaned = re.sub(r'^[^\w\s\+]+', '', cleaned).strip()
            cleaned = re.sub(r'\s+', ' ', cleaned)
            digits = re.sub(r'\D', '', cleaned)

            if len(digits) < 6 or len(digits) > 15:
                continue

            if digits in seen_digits:
                continue
            seen_digits.add(digits)

            is_mobile = False
            is_landline = False

            # Indian mobile check (10 digits starting 6-9, or 12 starting 916-919, or 11 starting 06-09)
            if len(digits) == 10 and digits[0] in "6789":
                is_mobile = True
            elif len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
                is_mobile = True
            elif len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
                is_mobile = True
            # Indian landline check (044, 080, 022, 040, 011, 033, 0422, 0452, etc.)
            elif len(digits) in (10, 11) and digits.startswith("0") and digits[1] in "12345":
                is_landline = True
            elif len(digits) == 12 and digits.startswith("91") and digits[2] in "12345":
                is_landline = True
            elif re.search(r'^(044|080|022|040|011|033|0422|0452|0431|0416|0427)', digits):
                is_landline = True

            if not is_mobile and not is_landline:
                if re.search(r'\b(044|080|022|040|011|033|0422|0452)\b', cleaned) or cleaned.startswith("044") or cleaned.startswith("080") or cleaned.startswith("022"):
                    is_landline = True
                elif digits and digits[0] in "6789" and len(digits) == 10:
                    is_mobile = True
                elif len(digits) >= 10:
                    if digits[-10] in "6789":
                        is_mobile = True
                    else:
                        is_landline = True

            if is_mobile and not mobile_num:
                mobile_num = cleaned[:100]
            elif is_landline and not landline_num:
                landline_num = cleaned[:100]

            if mobile_num and landline_num:
                break

        primary_phone = mobile_num or landline_num
        return primary_phone, mobile_num, landline_num

    @staticmethod
    def _clean_about_us(raw_text: Optional[str]) -> Optional[str]:
        if not raw_text:
            return None
        cleaned = re.sub(r'<[^>]+>', ' ', raw_text)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        junk = ["cookie policy", "privacy policy", "all rights reserved", "javascript is disabled"]
        if any(j in cleaned.lower() for j in junk) and len(cleaned) < 50:
            return None
        if len(cleaned) < 5:
            return None
        return cleaned[:1000]

    @staticmethod
    async def _extract_with_playwright(target_url: str, source_type: str) -> Dict[str, Any]:
        """
        Uses Playwright Chromium to navigate to public company website and extract DOM metadata.
        Delegates to ProactorEventLoop on Windows if SelectorEventLoop is active.
        """
        if sys.platform == "win32":
            try:
                loop = asyncio.get_running_loop()
                if isinstance(loop, getattr(asyncio, "SelectorEventLoop", ())):
                    return await _run_with_proactor_loop(
                        WebScraperService._extract_with_playwright_impl,
                        target_url=target_url,
                        source_type=source_type
                    )
            except Exception as e:
                logger.warning(f"Proactor thread fallback: {e}")

        return await WebScraperService._extract_with_playwright_impl(target_url=target_url, source_type=source_type)

    @staticmethod
    async def _extract_with_playwright_impl(target_url: str, source_type: str) -> Dict[str, Any]:
        """Uses Playwright Chromium to navigate to public company website and extract DOM metadata."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = await context.new_page()

            try:
                response = await page.goto(target_url, timeout=40000, wait_until="domcontentloaded")
                if response and response.status >= 400:
                    raise ValueError("Unable to access this website.")

                await page.wait_for_timeout(1500)

                json_ld_scripts = await page.eval_on_selector_all(
                    'script[type="application/ld+json"]',
                    'elements => elements.map(e => e.textContent)'
                )

                meta_tags = await page.eval_on_selector_all(
                    'meta',
                    '''elements => elements.map(e => ({
                        name: e.getAttribute('name') || e.getAttribute('property') || e.getAttribute('itemprop'),
                        content: e.getAttribute('content')
                    })).filter(m => m.name && m.content)'''
                )

                page_title = await page.title()
                h1_text = await page.locator('h1').first.text_content() if await page.locator('h1').count() > 0 else ""

                phone_links = await page.eval_on_selector_all('a[href^="tel:"]', 'els => els.map(e => e.textContent)')
                email_links = await page.eval_on_selector_all('a[href^="mailto:"]', 'els => els.map(e => e.textContent)')
                address_text = await page.locator('address').first.text_content() if await page.locator('address').count() > 0 else ""

                about_section_text = await page.evaluate('''() => {
                    const el = document.querySelector('#about, .about, .about-us, [id*="about"], [class*="about"]');
                    return el ? el.textContent.trim().slice(0, 1000) : "";
                }''')

                footer_text = await page.evaluate('''() => {
                    const footer = document.querySelector('footer, .footer, [id*="footer"], .contact, [id*="contact"]');
                    return footer ? footer.textContent.trim().slice(0, 1000) : "";
                }''')

            except PlaywrightTimeoutError:
                raise ValueError("This website could not be scraped (timeout).")
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Unable to access this website: {str(e)}")
            finally:
                await context.close()
                await browser.close()

        return WebScraperService._parse_extracted_data(
            target_url=target_url,
            source_type=source_type,
            json_ld_scripts=json_ld_scripts,
            meta_tags=meta_tags,
            page_title=page_title,
            h1_text=h1_text,
            phone_links=phone_links,
            email_links=email_links,
            address_text=address_text,
            about_section_text=about_section_text,
            footer_text=footer_text
        )

    @staticmethod
    def _parse_extracted_data(
        target_url: str,
        source_type: str,
        json_ld_scripts: List[str],
        meta_tags: List[Dict[str, str]],
        page_title: str,
        h1_text: Optional[str],
        phone_links: List[str],
        email_links: List[str],
        address_text: Optional[str],
        about_section_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Processes raw metadata from single business website."""
        parsed_meta = {m["name"].lower(): m["content"] for m in meta_tags if m.get("name") and m.get("content")}

        business_name = None
        phone = None
        email = None
        website = target_url
        description = parsed_meta.get("description") or parsed_meta.get("og:description") or parsed_meta.get("twitter:description")
        address = None
        city = None
        area = None
        services = None

        if source_type == "YOUTUBE":
            video_title = parsed_meta.get("og:title") or (h1_text.strip() if h1_text else None) or page_title.replace(" - YouTube", "")
            channel_name = parsed_meta.get("og:site_name") or "YouTube"
            business_name = f"{video_title} ({channel_name})" if video_title else "YouTube Video"
            
            return {
                "source_url": target_url,
                "business_name": business_name[:250],
                "area": "",
                "city": "",
                "address": None,
                "phone": None,
                "email": None,
                "website": target_url,
                "description": (description[:500] if description else None),
                "about_us": (description[:500] if description else None),
                "services": f"YouTube Video / Channel: {channel_name}",
                "source_type": "YOUTUBE",
                "data_source": "YouTube"
            }

        # Inspect JSON-LD / Schema.org structured data
        for raw_json in json_ld_scripts:
            try:
                data = json.loads(raw_json)
                items = data if isinstance(data, list) else [data]
                if isinstance(data, dict) and "@graph" in data:
                    items = data["@graph"]

                for item in items:
                    if not isinstance(item, dict):
                        continue
                    schema_type = item.get("@type", "")
                    if isinstance(schema_type, list):
                        schema_type = " ".join(schema_type)

                    relevant_types = [
                        "Organization", "LocalBusiness", "MedicalBusiness", "Hospital",
                        "MedicalClinic", "Dentist", "Store", "Corporation", "BusinessFunction"
                    ]

                    if any(t.lower() in str(schema_type).lower() for t in relevant_types):
                        business_name = business_name or item.get("name") or item.get("legalName")
                        phone = phone or item.get("telephone")
                        email = email or item.get("email")
                        description = description or item.get("description")
                        website = item.get("url") or website
                        
                        addr_obj = item.get("address")
                        if isinstance(addr_obj, dict):
                            street = addr_obj.get("streetAddress", "").strip()
                            locality = addr_obj.get("addressLocality", "").strip()
                            region = addr_obj.get("addressRegion", "").strip()
                            postal = addr_obj.get("postalCode", "").strip()

                            if locality:
                                city = locality
                            elif region:
                                city = region

                            if street:
                                area = street
                            elif locality and region and locality != region:
                                area = locality

                            full_addr_parts = [p for p in [street, locality, region, postal] if p]
                            if full_addr_parts:
                                address = ", ".join(full_addr_parts)
                        elif isinstance(addr_obj, str):
                            address = addr_obj.strip()

            except Exception:
                continue

        # Open Graph & Meta tags fallback
        if not business_name:
            og_site_name = parsed_meta.get("og:site_name")
            og_title = parsed_meta.get("og:title")
            
            if og_site_name and og_site_name.strip():
                business_name = og_site_name.strip()
            elif og_title and og_title.strip():
                business_name = og_title.split("-")[0].split("|")[0].split(":")[0].strip()
            elif h1_text and h1_text.strip():
                business_name = h1_text.strip()
            elif page_title and page_title.strip():
                business_name = page_title.split("-")[0].split("|")[0].split(":")[0].strip()

        if not phone:
            phone = parsed_meta.get("og:phone_number") or (phone_links[0].strip() if phone_links else None)

        if not email:
            email = parsed_meta.get("og:email") or (email_links[0].strip() if email_links else None)

        if not city:
            city = parsed_meta.get("og:locality") or parsed_meta.get("geo.placename") or None

        if not area:
            area = parsed_meta.get("og:street-address") or None

        if not address and address_text and address_text.strip():
            address = address_text.strip().replace("\n", ", ")

        GENERIC_NAMES = {"google maps", "website", "home", "company", "unknown business", "welcome", "index", "default"}
        if business_name:
            name_lower = business_name.strip().lower()
            if name_lower in GENERIC_NAMES or name_lower.startswith("google maps"):
                business_name = None

        if not business_name or len(business_name.strip()) < 2:
            raise ValueError("No reliable business information was found on this website.")

        phone_candidates = []
        if phone:
            phone_candidates.append(phone)
        if parsed_meta.get("og:phone_number"):
            phone_candidates.append(parsed_meta.get("og:phone_number"))
        if phone_links:
            phone_candidates.extend(phone_links)
        if address_text:
            matches = re.findall(r'(\+?\d[\d\s\-]{7,15})', address_text)
            phone_candidates.extend(matches)
        if footer_text:
            matches = re.findall(r'(\+?\d[\d\s\-]{7,15})', footer_text)
            phone_candidates.extend(matches)

        prim_phone, mob_phone, land_phone = WebScraperService._classify_phones(phone_candidates)
        clean_about_val = WebScraperService._clean_about_us(description or about_section_text)

        return {
            "source_url": target_url,
            "business_name": business_name.strip()[:250],
            "area": (area.strip()[:250] if area else ""),
            "city": (city.strip()[:250] if city else ""),
            "address": address,
            "phone": prim_phone,
            "phone_landline": land_phone,
            "phone_mobile": mob_phone,
            "email": email,
            "website": website,
            "description": clean_about_val or description,
            "about_us": clean_about_val,
            "services": services,
            "source_type": source_type,
            "data_source": "Website Scraper"
        }

    @staticmethod
    def _upsert_scraped_business(extracted: Dict[str, Any], db: Session) -> ScrapedBusiness:
        """Upserts a scraped business record in MySQL using source_url or (business_name, area, city) as duplicate key."""
        now = datetime.utcnow()
        source_url = extracted["source_url"]
        b_name = extracted["business_name"]
        area = extracted.get("area", "") or ""
        city = extracted.get("city", "") or ""

        existing = db.query(ScrapedBusiness).filter_by(source_url=source_url).first()
        if not existing and extracted.get("source_type") != "YOUTUBE":
            existing = db.query(ScrapedBusiness).filter_by(
                business_name=b_name,
                area=area,
                city=city
            ).first()

        ext_land = extracted.get("phone_landline")
        ext_mob = extracted.get("phone_mobile")
        ext_prim = extracted.get("phone") or ext_land or ext_mob

        clean_about = WebScraperService._clean_about_us(extracted.get("about_us") or extracted.get("description"))

        if existing:
            existing.business_name = b_name
            existing.alternate_name = extracted.get("alternate_name") or existing.alternate_name

            new_cat = extracted.get("primary_category")
            if new_cat and not re.match(r'^\d+(\.\d+)?$', str(new_cat)):
                existing.primary_category = new_cat
            elif existing.primary_category and re.match(r'^\d+(\.\d+)?$', str(existing.primary_category)):
                existing.primary_category = None

            existing.additional_categories = extracted.get("additional_categories") or existing.additional_categories
            existing.description = extracted.get("description") or existing.description
            existing.about_us = clean_about or existing.about_us
            if extracted.get("rating") is not None:
                existing.rating = extracted.get("rating")
            if extracted.get("review_count") is not None:
                existing.review_count = extracted.get("review_count")
            existing.price_level = extracted.get("price_level") or existing.price_level
            existing.business_status = extracted.get("business_status") or existing.business_status
            existing.open_now = extracted.get("open_now") if extracted.get("open_now") is not None else existing.open_now

            existing.address = extracted.get("address") or existing.address
            existing.address_line_1 = extracted.get("address_line_1") or existing.address_line_1
            existing.address_line_2 = extracted.get("address_line_2") or existing.address_line_2
            if area:
                existing.area = area
            if city:
                existing.city = city
            existing.neighborhood = extracted.get("neighborhood") or existing.neighborhood
            existing.district = extracted.get("district") or existing.district
            existing.state = extracted.get("state") or existing.state
            existing.country = extracted.get("country") or existing.country
            existing.postal_code = extracted.get("postal_code") or existing.postal_code
            if extracted.get("latitude"):
                existing.latitude = extracted.get("latitude")
            if extracted.get("longitude"):
                existing.longitude = extracted.get("longitude")
            if extracted.get("plus_code"):
                existing.plus_code = extracted.get("plus_code")

            existing.phone = ext_prim or existing.phone
            existing.secondary_phone = extracted.get("secondary_phone") or existing.secondary_phone
            existing.phone_landline = ext_land or existing.phone_landline
            existing.phone_mobile = ext_mob or existing.phone_mobile
            existing.email = extracted.get("email") or existing.email
            existing.website = extracted.get("website") or existing.website
            existing.google_maps_url = extracted.get("google_maps_url") or existing.google_maps_url

            existing.monday_hours = extracted.get("monday_hours") or existing.monday_hours
            existing.tuesday_hours = extracted.get("tuesday_hours") or existing.tuesday_hours
            existing.wednesday_hours = extracted.get("wednesday_hours") or existing.wednesday_hours
            existing.thursday_hours = extracted.get("thursday_hours") or existing.thursday_hours
            existing.friday_hours = extracted.get("friday_hours") or existing.friday_hours
            existing.saturday_hours = extracted.get("saturday_hours") or existing.saturday_hours
            existing.sunday_hours = extracted.get("sunday_hours") or existing.sunday_hours
            existing.opening_hours = extracted.get("opening_hours") or existing.opening_hours
            existing.today_open_status = extracted.get("today_open_status") or existing.today_open_status

            existing.services = extracted.get("services") or existing.services
            existing.amenities = extracted.get("amenities") or existing.amenities
            existing.accessibility = extracted.get("accessibility") or existing.accessibility
            existing.payment_options = extracted.get("payment_options") or existing.payment_options
            existing.delivery = extracted.get("delivery") or existing.delivery
            existing.dine_in = extracted.get("dine_in") or existing.dine_in
            existing.pickup = extracted.get("pickup") or existing.pickup
            existing.reservation_url = extracted.get("reservation_url") or existing.reservation_url
            existing.menu_url = extracted.get("menu_url") or existing.menu_url

            existing.source_type = extracted.get("source_type", "WEBSITE_SCRAPE")
            existing.search_keyword = extracted.get("search_keyword") or existing.search_keyword
            existing.search_area = extracted.get("search_area") or existing.search_area
            existing.google_place_id = extracted.get("google_place_id") or existing.google_place_id
            existing.google_cid = extracted.get("google_cid") or existing.google_cid
            existing.data_source = extracted.get("data_source") or existing.data_source
            existing.enrichment_status = extracted.get("enrichment_status") or existing.enrichment_status
            existing.status = "ACTIVE"
            existing.scraped_at = now
            existing.updated_at = now
            record = existing
        else:
            record = ScrapedBusiness(
                source_url=source_url,
                business_name=b_name,
                alternate_name=extracted.get("alternate_name"),
                primary_category=extracted.get("primary_category"),
                additional_categories=extracted.get("additional_categories"),
                description=extracted.get("description"),
                about_us=clean_about,
                rating=extracted.get("rating"),
                review_count=extracted.get("review_count"),
                price_level=extracted.get("price_level"),
                business_status=extracted.get("business_status"),
                open_now=extracted.get("open_now"),

                address=extracted.get("address"),
                address_line_1=extracted.get("address_line_1"),
                address_line_2=extracted.get("address_line_2"),
                area=area,
                neighborhood=extracted.get("neighborhood"),
                city=city,
                district=extracted.get("district"),
                state=extracted.get("state"),
                country=extracted.get("country"),
                postal_code=extracted.get("postal_code"),
                latitude=extracted.get("latitude"),
                longitude=extracted.get("longitude"),
                plus_code=extracted.get("plus_code"),

                phone=ext_prim,
                secondary_phone=extracted.get("secondary_phone"),
                phone_landline=ext_land,
                phone_mobile=ext_mob,
                email=extracted.get("email"),
                website=extracted.get("website"),
                google_maps_url=extracted.get("google_maps_url"),

                monday_hours=extracted.get("monday_hours"),
                tuesday_hours=extracted.get("tuesday_hours"),
                wednesday_hours=extracted.get("wednesday_hours"),
                thursday_hours=extracted.get("thursday_hours"),
                friday_hours=extracted.get("friday_hours"),
                saturday_hours=extracted.get("saturday_hours"),
                sunday_hours=extracted.get("sunday_hours"),
                opening_hours=extracted.get("opening_hours"),
                today_open_status=extracted.get("today_open_status"),

                services=extracted.get("services"),
                amenities=extracted.get("amenities"),
                accessibility=extracted.get("accessibility"),
                payment_options=extracted.get("payment_options"),
                delivery=extracted.get("delivery"),
                dine_in=extracted.get("dine_in"),
                pickup=extracted.get("pickup"),
                reservation_url=extracted.get("reservation_url"),
                menu_url=extracted.get("menu_url"),

                source_type=extracted.get("source_type", "WEBSITE_SCRAPE"),
                search_keyword=extracted.get("search_keyword"),
                search_area=extracted.get("search_area"),
                google_place_id=extracted.get("google_place_id"),
                google_cid=extracted.get("google_cid"),
                data_source=extracted.get("data_source"),
                enrichment_status=extracted.get("enrichment_status"),
                status="ACTIVE",
                scraped_at=now
            )
            db.add(record)

        db.commit()
        db.refresh(record)
        return record
