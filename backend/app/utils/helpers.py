import re
from typing import Optional, Tuple

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

# Comprehensive city -> (district, state) mapping for Indian cities and towns
CITY_STATE_MAP = {
    # Tamil Nadu
    "chennai": ("Chennai", "Tamil Nadu"),
    "salem": ("Salem", "Tamil Nadu"),
    "coimbatore": ("Coimbatore", "Tamil Nadu"),
    "madurai": ("Madurai", "Tamil Nadu"),
    "tiruchirappalli": ("Tiruchirappalli", "Tamil Nadu"),
    "trichy": ("Tiruchirappalli", "Tamil Nadu"),
    "tirunelveli": ("Tirunelveli", "Tamil Nadu"),
    "vellore": ("Vellore", "Tamil Nadu"),
    "erode": ("Erode", "Tamil Nadu"),
    "tiruppur": ("Tiruppur", "Tamil Nadu"),
    "tirupur": ("Tiruppur", "Tamil Nadu"),
    "dindigul": ("Dindigul", "Tamil Nadu"),
    "thanjavur": ("Thanjavur", "Tamil Nadu"),
    "tanjore": ("Thanjavur", "Tamil Nadu"),
    "kanniyakumari": ("Kanniyakumari", "Tamil Nadu"),
    "kanyakumari": ("Kanniyakumari", "Tamil Nadu"),
    "cuddalore": ("Cuddalore", "Tamil Nadu"),
    "panruti": ("Cuddalore", "Tamil Nadu"),
    "neyveli": ("Cuddalore", "Tamil Nadu"),
    "kurinjipadi": ("Cuddalore", "Tamil Nadu"),
    "kadampuliyur": ("Cuddalore", "Tamil Nadu"),
    "ulundurpet": ("Kallakurichi", "Tamil Nadu"),
    "kallakurichi": ("Kallakurichi", "Tamil Nadu"),
    "tambaram": ("Chengalpattu", "Tamil Nadu"),
    "chengalpattu": ("Chengalpattu", "Tamil Nadu"),
    "pallavaram": ("Chengalpattu", "Tamil Nadu"),
    "pammal": ("Chengalpattu", "Tamil Nadu"),
    "avadi": ("Thiruvallur", "Tamil Nadu"),
    "thiruvallur": ("Thiruvallur", "Tamil Nadu"),
    "tiruvallur": ("Thiruvallur", "Tamil Nadu"),
    "villupuram": ("Villupuram", "Tamil Nadu"),
    "dharmapuri": ("Dharmapuri", "Tamil Nadu"),
    "krishnagiri": ("Krishnagiri", "Tamil Nadu"),
    "namakkal": ("Namakkal", "Tamil Nadu"),
    "karur": ("Karur", "Tamil Nadu"),
    "nagapattinam": ("Nagapattinam", "Tamil Nadu"),
    "thiruvarur": ("Thiruvarur", "Tamil Nadu"),
    "perambalur": ("Perambalur", "Tamil Nadu"),
    "ariyalur": ("Ariyalur", "Tamil Nadu"),
    "pudukkottai": ("Pudukkottai", "Tamil Nadu"),
    "sivagangai": ("Sivagangai", "Tamil Nadu"),
    "ramanathapuram": ("Ramanathapuram", "Tamil Nadu"),
    "virudhunagar": ("Virudhunagar", "Tamil Nadu"),
    "theni": ("Theni", "Tamil Nadu"),
    "thoothukudi": ("Thoothukudi", "Tamil Nadu"),
    "tuticorin": ("Thoothukudi", "Tamil Nadu"),
    "tenkasi": ("Tenkasi", "Tamil Nadu"),
    "tirupattur": ("Tirupattur", "Tamil Nadu"),
    "ranipet": ("Ranipet", "Tamil Nadu"),
    "mayiladuthurai": ("Mayiladuthurai", "Tamil Nadu"),
    "ooty": ("Nilgiris", "Tamil Nadu"),
    "nilgiris": ("Nilgiris", "Tamil Nadu"),
    "hosur": ("Krishnagiri", "Tamil Nadu"),
    "pollachi": ("Coimbatore", "Tamil Nadu"),
    "kanchipuram": ("Kanchipuram", "Tamil Nadu"),
    "kumbakonam": ("Thanjavur", "Tamil Nadu"),
    # Puducherry
    "pondicherry": ("Puducherry", "Puducherry"),
    "puducherry": ("Puducherry", "Puducherry"),
    "karaikal": ("Karaikal", "Puducherry"),
    # Karnataka
    "bengaluru": ("Bengaluru", "Karnataka"),
    "bangalore": ("Bengaluru", "Karnataka"),
    "mysuru": ("Mysuru", "Karnataka"),
    "mysore": ("Mysuru", "Karnataka"),
    "mangaluru": ("Dakshina Kannada", "Karnataka"),
    "mangalore": ("Dakshina Kannada", "Karnataka"),
    "hubli": ("Dharwad", "Karnataka"),
    "dharwad": ("Dharwad", "Karnataka"),
    "belagavi": ("Belagavi", "Karnataka"),
    "belgaum": ("Belagavi", "Karnataka"),
    # Telangana & Andhra Pradesh
    "hyderabad": ("Hyderabad", "Telangana"),
    "secunderabad": ("Hyderabad", "Telangana"),
    "warangal": ("Warangal", "Telangana"),
    "visakhapatnam": ("Visakhapatnam", "Andhra Pradesh"),
    "vizag": ("Visakhapatnam", "Andhra Pradesh"),
    "vijayawada": ("Krishna", "Andhra Pradesh"),
    "guntur": ("Guntur", "Andhra Pradesh"),
    "nellore": ("Nellore", "Andhra Pradesh"),
    "kurnool": ("Kurnool", "Andhra Pradesh"),
    "tirupati": ("Tirupati", "Andhra Pradesh"),
    # Maharashtra
    "mumbai": ("Mumbai", "Maharashtra"),
    "pune": ("Pune", "Maharashtra"),
    "nagpur": ("Nagpur", "Maharashtra"),
    "nashik": ("Nashik", "Maharashtra"),
    "thane": ("Thane", "Maharashtra"),
    # Delhi & NCR
    "delhi": ("New Delhi", "Delhi"),
    "new delhi": ("New Delhi", "Delhi"),
    "noida": ("Gautam Buddha Nagar", "Uttar Pradesh"),
    "gurgaon": ("Gurugram", "Haryana"),
    "gurugram": ("Gurugram", "Haryana"),
    # West Bengal
    "kolkata": ("Kolkata", "West Bengal"),
    # Kerala
    "kochi": ("Ernakulam", "Kerala"),
    "cochin": ("Ernakulam", "Kerala"),
    "thiruvananthapuram": ("Thiruvananthapuram", "Kerala"),
    "trivandrum": ("Thiruvananthapuram", "Kerala"),
    "kozhikode": ("Kozhikode", "Kerala"),
    "calicut": ("Kozhikode", "Kerala"),
    "thrissur": ("Thrissur", "Kerala"),
    # Gujarat
    "ahmedabad": ("Ahmedabad", "Gujarat"),
    "surat": ("Surat", "Gujarat"),
    "vadodara": ("Vadodara", "Gujarat"),
    "rajkot": ("Rajkot", "Gujarat"),
    # Rajasthan
    "jaipur": ("Jaipur", "Rajasthan"),
    "jodhpur": ("Jodhpur", "Rajasthan"),
    "udaipur": ("Udaipur", "Rajasthan"),
    # Others
    "chandigarh": ("Chandigarh", "Chandigarh"),
    "lucknow": ("Lucknow", "Uttar Pradesh"),
    "kanpur": ("Kanpur", "Uttar Pradesh"),
    "varanasi": ("Varanasi", "Uttar Pradesh"),
    "patna": ("Patna", "Bihar"),
    "bhopal": ("Bhopal", "Madhya Pradesh"),
    "indore": ("Indore", "Madhya Pradesh"),
    "bhubaneswar": ("Khordha", "Odisha"),
    "ranchi": ("Ranchi", "Jharkhand"),
    "raipur": ("Raipur", "Chhattisgarh"),
    "guwahati": ("Kamrup Metropolitan", "Assam"),
}

CATEGORY_NOISE_WORDS = {
    'restaurant', 'cafe', 'college', 'hospital', 'clinic', 'hotel', 'store', 'shop',
    're', 'fusion restaurant', 'dessert restaurant', 'north indian restaurant',
    'south indian restaurant', 'ice cream shop', 'fast food restaurant',
    'fried chicken restaurant chain', 'vegetarian restaurant', 'bakery', 'sweet shop',
    'shopping mall', 'dine-in', 'takeaway', 'takeout', 'delivery', 'no-contact delivery',
    'ice cream', 'casual', 'eatery', 'india'
}

def resolve_location(loc_or_text: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Given a city name, search location, or address text, resolves (district, state, country).
    Returns (district, state, country) or (None, None, None).
    """
    if not loc_or_text:
        return None, None, None

    lower_text = loc_or_text.lower()
    for key, (dist, st) in CITY_STATE_MAP.items():
        if re.search(r'\b' + re.escape(key) + r'\b', lower_text):
            return dist, st, "India"

    # Also check if text literally contains known state names
    for key, (dist, st) in CITY_STATE_MAP.items():
        if st.lower() in lower_text:
            return None, st, "India"

    return None, None, None

def extract_place_id(url_or_text: Optional[str]) -> Optional[str]:
    """Extracts Google Place ID (ChIJ...) from URL or text."""
    if not url_or_text:
        return None
    m = re.search(r'(?:!19s|place_id:)?(ChIJ[A-Za-z0-9_-]{20,})', url_or_text)
    if m:
        return m.group(1)
    return None

def extract_pin_code(text: Optional[str]) -> Optional[str]:
    """Extracts 6-digit Indian PIN code."""
    if not text:
        return None
    m = re.search(r'\b([1-9]\d{5})\b', text)
    if m:
        return m.group(1)
    return None

def clean_address_text(raw: Optional[str]) -> Optional[str]:
    """
    Comprehensive address cleaner:
    1. Removes coordinate strings (@13.xx,80.xx).
    2. Splits joined words like 'RdOpen', 'RdModest'.
    3. Removes open/closed status fragments.
    4. Removes category/noise blurbs (e.g. 'Modest restaurant for Pan-Asian fare', 'Fusion restaurant').
    5. Strips phone numbers.
    6. Deduplicates comma-separated tokens (case-insensitive, substring-aware).
    7. Formats into a clean address string.
    """
    if not raw:
        return None

    text = re.sub(r'[^\x20-\x7E]', ' ', raw)
    text = re.sub(r'@[\d\.\-]+,[\d\.\-]+[^\s,]*', ' ', text)

    # Split joined road/street tokens and trailing noise/status (e.g. 'RdOpen', 'RdModest', 'RdClosed')
    text = re.sub(
        r'([a-zA-Z0-9])(Open|Closed|Opens|Closes|Modest|Fried|Vegetarian|Restaurant|Fast|Ice|Sweet|Bakery|Shopping|North|South)',
        r'\1 \2',
        text,
        flags=re.IGNORECASE
    )

    # Remove open/closed status fragments
    text = re.sub(
        r'(Opens?\s+\S+|Closes?\s+\S+|Open\s+now|Open|Closed|24\s+hours)',
        ' ',
        text,
        flags=re.IGNORECASE
    )

    # Remove known category & service noise strings
    multi_word_noise = [
        r'Modest\s+restaurant\s+for\s+Pan-Asian\s+fare',
        r'Pan-Asian\s+fare',
        r'Fried\s+chicken\s+restaurant\s+chain',
        r'Restaurant\s+chain',
        r'Vegetarian\s+restaurant',
        r'Bakery\s+and\s+cake\s+shop',
        r'Shopping\s+mall',
        r'Snack\s+bar',
        r'Sweet\s+shop',
        r'Fusion\s+restaurant',
        r'Dessert\s+restaurant',
        r'North\s+Indian\s+restaurant',
        r'South\s+Indian\s+restaurant',
        r'Ice\s+cream\s+shop',
        r'Fast\s+food\s+restaurant',
        r'Family\s+restaurant',
        r'No-contact\s+delivery',
    ]
    for noise in multi_word_noise:
        text = re.sub(noise, ' ', text, flags=re.IGNORECASE)

    # Remove phone numbers
    text = re.sub(r'\+?\d[\d\s\-]{7,15}', ' ', text)

    parts = [p.strip() for p in re.split(r'[,|]', text) if p.strip()]
    seen = set()
    deduped = []
    for p in parts:
        p_clean = re.sub(r'\s+', ' ', p).strip().strip(',').strip()
        if not p_clean or len(p_clean) <= 1:
            continue
        if p_clean.lower() in CATEGORY_NOISE_WORDS:
            continue
        key = p_clean.lower()
        if key in seen or any(key in s for s in seen):
            continue
        seen.add(key)
        deduped.append(p_clean)

    res = ", ".join(deduped)
    res = re.sub(r',\s*,+', ',', res)
    res = re.sub(r'\s{2,}', ' ', res).strip().strip(',').strip()
    return res or None
