import re
from typing import Optional

def normalize_url(url: Optional[str]) -> Optional[str]:
    """Ensure URL has http/https protocol prefix."""
    if not url:
        return None
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        return f"https://{url}"
    return url

def clean_phone_number(phone: Optional[str]) -> Optional[str]:
    """Clean phone number keeping standard digits and symbols."""
    if not phone:
        return None
    return re.sub(r"[^\d+\-\s().]", "", phone).strip()
