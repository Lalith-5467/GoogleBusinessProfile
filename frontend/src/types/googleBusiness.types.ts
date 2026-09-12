export interface BusinessLocation {
  id: string;
  google_location_id?: string;
  business_name: string;
  area: string;
  city: string;
  address?: string;
  source: string;
  status: string;
  last_synced_at?: string;
}

export interface LocationCreatePayload {
  business_name: string;
  area?: string;
  city?: string;
  address?: string;
  source?: string;
}

export interface AccountStatus {
  is_connected: boolean;
  account_id?: string;
  account_name?: string;
  email?: string;
  connection_status: string;
  total_locations: number;
  auth_url_available: boolean;
  message?: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  synced_count: number;
  total_count: number;
  locations: BusinessLocation[];
}

export interface BulkScrapeResponse {
  success: boolean;
  message: string;
  total_urls_submitted: number;
  successfully_scraped: number;
  failed: number;
  total_businesses_collected: number;
  total_count: number;
  locations: BusinessLocation[];
}

export interface DeleteResponse {
  success: boolean;
  message: string;
  deleted_id: string;
  total_count: number;
}
