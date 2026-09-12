import { ScrapedBusiness } from '../services/scraperApi';

/**
 * Standard 58-column CSV header specification matching backend scraper_csv_export.py
 */
const CSV_HEADERS = [
  "Business Name",
  "Alternate Name",
  "Primary Category",
  "Additional Categories",
  "About Us / Description",
  "Rating",
  "Review Count",
  "Price Level",
  "Business Status",
  "Open Now",
  "Full Address",
  "Address Line 1",
  "Address Line 2",
  "Area / Locality",
  "Neighborhood",
  "City",
  "District",
  "State",
  "Country",
  "Postal Code",
  "Latitude",
  "Longitude",
  "Plus Code",
  "Primary Phone",
  "Secondary Phone",
  "Landline Phone",
  "Mobile Phone",
  "Email",
  "Website",
  "Google Maps URL",
  "Monday Hours",
  "Tuesday Hours",
  "Wednesday Hours",
  "Thursday Hours",
  "Friday Hours",
  "Saturday Hours",
  "Sunday Hours",
  "Opening Hours",
  "Today Open Status",
  "Services",
  "Amenities",
  "Accessibility",
  "Payment Options",
  "Delivery",
  "Dine In",
  "Pickup",
  "Reservation URL",
  "Menu URL",
  "Original Input URL",
  "Source Type",
  "Search Keyword",
  "Search Area",
  "Google Place ID",
  "Google CID",
  "Data Source",
  "Enrichment Status",
  "Scrape Status",
  "Scraped At"
];

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string directly from ScrapedBusiness records.
 * Guaranteed to only contain the specific records passed in.
 */
export function generateScrapedBusinessesCsvString(businesses: ScrapedBusiness[]): string {
  const rows: string[] = [];
  rows.push(CSV_HEADERS.map(h => escapeCsv(h)).join(','));

  for (const biz of businesses) {
    const row = [
      biz.business_name || '',
      biz.alternate_name || '',
      biz.primary_category || '',
      biz.additional_categories || '',
      biz.about_us || biz.description || '',
      biz.rating || '',
      biz.review_count || '',
      biz.price_level || '',
      biz.business_status || '',
      biz.open_now || '',
      biz.address || '',
      biz.address_line_1 || '',
      biz.address_line_2 || '',
      biz.area || '',
      biz.neighborhood || '',
      biz.city || '',
      biz.district || '',
      biz.state || '',
      biz.country || '',
      biz.postal_code || '',
      biz.latitude || '',
      biz.longitude || '',
      biz.plus_code || '',
      biz.phone || '',
      biz.secondary_phone || '',
      biz.phone_landline || '',
      biz.phone_mobile || '',
      biz.email || '',
      biz.website || '',
      biz.google_maps_url || '',
      biz.monday_hours || '',
      biz.tuesday_hours || '',
      biz.wednesday_hours || '',
      biz.thursday_hours || '',
      biz.friday_hours || '',
      biz.saturday_hours || '',
      biz.sunday_hours || '',
      biz.opening_hours || '',
      biz.today_open_status || '',
      biz.services || '',
      biz.amenities || '',
      biz.accessibility || '',
      biz.payment_options || '',
      biz.delivery || '',
      biz.dine_in || '',
      biz.pickup || '',
      biz.reservation_url || '',
      biz.menu_url || '',
      biz.source_url || '',
      biz.source_type || '',
      biz.search_keyword || '',
      biz.search_area || '',
      biz.google_place_id || '',
      biz.google_cid || '',
      biz.data_source || '',
      biz.enrichment_status || '',
      biz.status || 'ACTIVE',
      biz.scraped_at || ''
    ];
    rows.push(row.map(v => escapeCsv(v)).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Directly downloads the provided businesses as a CSV file in the browser.
 * Includes UTF-8 BOM so Excel opens it with proper character encoding.
 */
export function exportScrapedBusinessesCsv(businesses: ScrapedBusiness[], filename: string): void {
  const csvContent = generateScrapedBusinessesCsvString(businesses);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
