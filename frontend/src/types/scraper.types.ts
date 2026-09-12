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
