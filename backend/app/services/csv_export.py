import csv
import io
from typing import List
from app.models.business import GoogleBusinessLocation

def generate_locations_csv(locations: List[GoogleBusinessLocation]) -> str:
    """
    Generates RFC-4180 compliant CSV string from GoogleBusinessLocation records.
    Columns: Business Name, Category, Rating, Review Count, Phone, Website, Area, City, State, Postal Code, Address, Source, Saved At
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # Write CSV Header
    writer.writerow([
        "Business Name",
        "Category",
        "Rating",
        "Review Count",
        "Phone",
        "Website",
        "Area",
        "City",
        "State",
        "Postal Code",
        "Address",
        "Source",
        "Saved At"
    ])
    
    for loc in locations:
        saved_at_str = loc.last_synced_at.strftime("%Y-%m-%d %H:%M:%S") if loc.last_synced_at else "N/A"
        writer.writerow([
            loc.business_name or "N/A",
            loc.primary_category or "N/A",
            loc.rating or "N/A",
            loc.review_count or "N/A",
            loc.phone or "N/A",
            loc.website or "N/A",
            loc.area or "N/A",
            loc.city or "N/A",
            loc.state or "N/A",
            loc.postal_code or "N/A",
            loc.address or "N/A",
            loc.source or "Business Search",
            saved_at_str
        ])
        
    return output.getvalue()

