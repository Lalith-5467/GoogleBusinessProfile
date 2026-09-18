export interface BusinessLocation {
  id: string;
  google_location_id?: string;
  business_name: string;
  primary_category?: string;
  rating?: string;
  review_count?: string;
  phone?: string;
  website?: string;
  area: string;
  city: string;
  state?: string;
  postal_code?: string;
  latitude?: string;
  longitude?: string;
  address?: string;
  source: string;
  status: string;
  last_synced_at?: string;
}

export interface LocationCreatePayload {
  business_name: string;
  primary_category?: string;
  rating?: string;
  review_count?: string;
  phone?: string;
  website?: string;
  area?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  address?: string;
  source?: string;
}

export interface LocationBatchSaveItem {
  id?: string;
  google_location_id?: string;
  google_place_id?: string;
  business_name: string;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  address?: string | null;
  source?: string;
  phone?: string | null;
  website?: string | null;
  rating?: string | null;
  review_count?: string | null;
  primary_category?: string | null;
}

export interface LocationBatchSaveResponse {
  success: boolean;
  message: string;
  saved_count: number;
  updated_count: number;
  total_count: number;
  locations: BusinessLocation[];
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

const API_BASE = ((import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '') as string).replace(/\/+$/, '');

export const googleBusinessApi = {
  async getStatus(): Promise<AccountStatus> {
    const res = await fetch(`${API_BASE}/api/google-business/status`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch status' }));
      throw new Error(err.detail || 'Failed to fetch status');
    }
    return res.json();
  },

  async getLocations(): Promise<{ total: number; locations: BusinessLocation[] }> {
    const res = await fetch(`${API_BASE}/api/google-business/locations`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch business locations' }));
      throw new Error(err.detail || 'Failed to fetch business locations');
    }
    return res.json();
  },

  async getCount(): Promise<{ total_businesses: number }> {
    const res = await fetch(`${API_BASE}/api/google-business/count`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch business count' }));
      throw new Error(err.detail || 'Failed to fetch business count');
    }
    return res.json();
  },

  async addLocation(payload: LocationCreatePayload): Promise<BusinessLocation> {
    const res = await fetch(`${API_BASE}/api/google-business/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to add business record' }));
      throw new Error(err.detail || 'Failed to add business record');
    }
    return res.json();
  },

  async saveBatchLocations(items: LocationBatchSaveItem[]): Promise<LocationBatchSaveResponse> {
    const res = await fetch(`${API_BASE}/api/google-business/locations/save-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to save business records' }));
      throw new Error(err.detail || 'Failed to save business records');
    }
    return res.json();
  },

  async deleteLocation(locationId: string): Promise<DeleteResponse> {
    const res = await fetch(`${API_BASE}/api/google-business/locations/${encodeURIComponent(locationId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete business record' }));
      throw new Error(err.detail || 'Failed to delete business record');
    }
    return res.json();
  },

  async bulkScrape(urls: string[]): Promise<BulkScrapeResponse> {
    const res = await fetch(`${API_BASE}/api/google-business/bulk-scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Bulk scrape operation failed' }));
      throw new Error(err.detail || 'Failed to scrape URLs');
    }
    return res.json();
  },

  async syncBusinesses(): Promise<SyncResponse> {
    const res = await fetch(`${API_BASE}/api/google-business/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Sync operation failed' }));
      throw new Error(err.detail || 'Failed to sync businesses');
    }
    return res.json();
  },

  async getAuthUrl(): Promise<{ url: string | null; configured: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/api/google-business/auth/url`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch auth URL' }));
      throw new Error(err.detail || 'Failed to fetch auth URL');
    }
    return res.json();
  },

  async disconnectAccount(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/google-business/auth/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to disconnect account' }));
      throw new Error(err.detail || 'Failed to disconnect account');
    }
    return res.json();
  },

  async triggerCsvDownload(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/google-business/export`);
    if (!response.ok) {
      throw new Error('Failed to generate CSV export');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google_businesses.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

