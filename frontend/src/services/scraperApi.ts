export interface ScrapedBusiness {
  id: string;
  source_url: string;
  business_name: string;
  alternate_name?: string | null;
  primary_category?: string | null;
  additional_categories?: string | null;
  description?: string | null;
  about_us?: string | null;
  rating?: string | null;
  review_count?: string | null;
  price_level?: string | null;
  business_status?: string | null;
  open_now?: string | null;

  // Location
  address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  area?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  plus_code?: string | null;

  // Contact
  phone?: string | null;
  secondary_phone?: string | null;
  phone_landline?: string | null;
  phone_mobile?: string | null;
  email?: string | null;
  website?: string | null;
  google_maps_url?: string | null;

  // Hours
  monday_hours?: string | null;
  tuesday_hours?: string | null;
  wednesday_hours?: string | null;
  thursday_hours?: string | null;
  friday_hours?: string | null;
  saturday_hours?: string | null;
  sunday_hours?: string | null;
  opening_hours?: string | null;
  today_open_status?: string | null;

  // Google attributes
  services?: string | null;
  amenities?: string | null;
  accessibility?: string | null;
  payment_options?: string | null;
  delivery?: string | null;
  dine_in?: string | null;
  pickup?: string | null;
  reservation_url?: string | null;
  menu_url?: string | null;

  // Source / Tracking
  source_type: string;
  search_keyword?: string | null;
  search_area?: string | null;
  google_place_id?: string | null;
  google_cid?: string | null;
  data_source?: string | null;
  enrichment_status?: string | null;
  status: string;
  scraped_at?: string | null;
}

export interface CompanyScrapeResponse {
  success: boolean;
  business?: ScrapedBusiness;
  businesses?: ScrapedBusiness[];
  businesses_count?: number;
  total_count: number;
}

export interface KeywordSearchResponse {
  success: boolean;
  keyword: string;
  location?: string | null;
  total_returned: number;
  total_count: number;
  businesses: ScrapedBusiness[];
}

export interface BulkScrapeResponse {
  success: boolean;
  total_urls: number;
  successfully_scraped: number;
  failed: number;
  total_businesses: number;
  results: ScrapedBusiness[];
}

export interface ScrapedBusinessListResponse {
  success: boolean;
  total_count: number;
  businesses: ScrapedBusiness[];
}

export interface ScraperCountResponse {
  success: boolean;
  total_count: number;
}

export interface ScraperDeleteResponse {
  success: boolean;
  message: string;
  deleted_id: string;
  total_count: number;
}

const API_BASE = ((import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '') as string).replace(/\/+$/, '');

export const scraperApi = {
  async scrapeCompany(url: string): Promise<CompanyScrapeResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to scrape website' }));
      throw new Error(err.detail || 'Website could not be scraped.');
    }
    return res.json();
  },

  async searchBusinesses(keyword: string, location?: string, count?: number): Promise<KeywordSearchResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, location, count }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Business search failed' }));
      throw new Error(err.detail || 'Business search operation failed.');
    }
    return res.json();
  },

  async scrapeBulk(urls: string[]): Promise<BulkScrapeResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Bulk scraping failed' }));
      throw new Error(err.detail || 'Bulk scraping operation failed.');
    }
    return res.json();
  },

  async getBusinesses(): Promise<ScrapedBusinessListResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/businesses`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch scraped businesses' }));
      throw new Error(err.detail || 'Failed to fetch scraped businesses');
    }
    return res.json();
  },

  async getCount(): Promise<ScraperCountResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/count`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch count' }));
      throw new Error(err.detail || 'Failed to fetch count');
    }
    return res.json();
  },

  async deleteBusiness(id: string): Promise<ScraperDeleteResponse> {
    const res = await fetch(`${API_BASE}/api/scraper/businesses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete business record' }));
      throw new Error(err.detail || 'Failed to delete record');
    }
    return res.json();
  },

  async triggerCsvDownload(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/scraper/export`);
    if (!response.ok) {
      throw new Error('Failed to generate CSV export');
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'scraped_businesses.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  async triggerSearchCsvDownload(ids: string[], filename: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/scraper/export-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate search results CSV export');
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  async getBusinessById(id: string): Promise<ScrapedBusiness> {
    const response = await fetch(`${API_BASE}/api/scraper/businesses/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch business record: ${response.statusText}`);
    }
    return response.json();
  },

  async enrichBusiness(id: string): Promise<ScrapedBusiness> {
    const response = await fetch(`${API_BASE}/api/scraper/businesses/${id}/enrich`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Failed to enrich business details: ${response.statusText}`);
    }
    return response.json();
  }
};
