import {
  UserProfile,
  AdminPermission,
  UserListItem,
  SubscriptionPlan,
  DashboardStats,
  AnalyticsOverview,
  AuditLogItem,
  ExportLogItem,
  ScrapingJobItem,
  UnifiedBusinessItem
} from '../types';
import { API_CONFIG } from '../../config/api.config';

const TOKEN_KEY = 'gbp_superadmin_access_token';

export const superAdminTokenStorage = {
  get: (): string | null => {
    try {
      return (
        sessionStorage.getItem(TOKEN_KEY) ||
        localStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem('gbp_admin_access_token') ||
        localStorage.getItem('gbp_admin_access_token')
      );
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  remove: (): void => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('gbp_admin_access_token');
      localStorage.removeItem('gbp_admin_access_token');
    } catch {}
  },
};

const getBaseUrl = (): string => {
  return API_CONFIG.BASE_URL || '';
};

const authFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const token = superAdminTokenStorage.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${getBaseUrl()}${endpoint}`;
  return fetch(url, { ...options, headers });
};

export const superAdminApi = {
  // Auth
  login: async (credentials: { email: string; password: string }): Promise<{ access_token: string; user: UserProfile }> => {
    const res = await authFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials or server error' }));
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    superAdminTokenStorage.set(data.access_token);
    return data;
  },

  getProfile: async (): Promise<UserProfile> => {
    const res = await authFetch('/api/admin/auth/me');
    if (!res.ok) {
      throw new Error('Failed to load profile');
    }
    return res.json();
  },

  changePassword: async (payload: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> => {
    const res = await authFetch('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to change password' }));
      throw new Error(err.detail || 'Failed to change password');
    }
    return res.json();
  },

  bootstrap: async (payload: { email: string; password: string; full_name?: string; bootstrap_secret?: string }): Promise<{ access_token: string; user: UserProfile }> => {
    const res = await authFetch('/api/admin/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Bootstrap failed' }));
      throw new Error(err.detail || 'Bootstrap failed');
    }
    const data = await res.json();
    superAdminTokenStorage.set(data.access_token);
    return data;
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await authFetch('/api/admin/dashboard/stats');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch dashboard stats' }));
      throw new Error(err.detail || 'Failed to fetch dashboard stats');
    }
    return res.json();
  },

  // Users Management
  listUsers: async (params?: { search?: string; role?: string; status?: string; skip?: number; limit?: number }): Promise<{ success: boolean; total: number; users: UserListItem[] }> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const res = await authFetch(`/api/admin/users?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load users');
    return res.json();
  },

  createUser: async (payload: {
    email: string;
    password: string;
    full_name?: string;
    role?: string;
    status?: string;
    plan_id?: string;
    permissions?: Partial<AdminPermission>;
  }): Promise<UserProfile> => {
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create user' }));
      throw new Error(err.detail || 'Failed to create user');
    }
    return res.json();
  },

  updateUser: async (userId: string, payload: {
    email?: string;
    full_name?: string;
    role?: string;
    status?: string;
    plan_id?: string;
    password?: string;
    current_password?: string;
    confirm_password?: string;
  }): Promise<UserProfile> => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update user' }));
      throw new Error(err.detail || 'Failed to update user');
    }
    return res.json();
  },

  updateUserStatus: async (userId: string, status: string): Promise<UserProfile> => {
    const res = await authFetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update status' }));
      throw new Error(err.detail || 'Failed to update status');
    }
    return res.json();
  },

  updateAdminPermissions: async (userId: string, permissions: AdminPermission): Promise<AdminPermission> => {
    const res = await authFetch(`/api/admin/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(permissions),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update permissions' }));
      throw new Error(err.detail || 'Failed to update permissions');
    }
    return res.json();
  },

  deleteUser: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete user' }));
      throw new Error(err.detail || 'Failed to delete user');
    }
    return res.json();
  },

  // Unified Business Management
  listUnifiedBusinesses: async (params?: { search?: string; source?: string; city?: string; category?: string; skip?: number; limit?: number }): Promise<{
    success: boolean;
    total: number;
    google_count: number;
    scraped_count: number;
    businesses: UnifiedBusinessItem[];
  }> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.source) query.set('source', params.source);
    if (params?.city) query.set('city', params.city);
    if (params?.category) query.set('category', params.category);
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const res = await authFetch(`/api/admin/businesses?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load businesses');
    return res.json();
  },

  deleteGoogleLocation: async (locationId: string): Promise<{ success: boolean; message: string }> => {
    const res = await authFetch(`/api/admin/businesses/google/${locationId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete Google location');
    return res.json();
  },

  deleteScrapedBusiness: async (scrapedId: string): Promise<{ success: boolean; message: string }> => {
    const res = await authFetch(`/api/admin/businesses/scraped/${scrapedId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete scraped business');
    return res.json();
  },

  // Scraper Monitoring
  listScrapingJobs: async (params?: { status?: string; job_type?: string; skip?: number; limit?: number }): Promise<{ success: boolean; total: number; jobs: ScrapingJobItem[] }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.job_type) query.set('job_type', params.job_type);
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const res = await authFetch(`/api/admin/scrapers/jobs?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load scraping jobs');
    return res.json();
  },

  enrichBusiness: async (businessId: string): Promise<{ success: boolean; message: string }> => {
    const res = await authFetch(`/api/admin/scrapers/enrich/${businessId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to enrich business');
    return res.json();
  },

  // Exports Monitor
  listExportLogs: async (params?: { export_type?: string; skip?: number; limit?: number }): Promise<{ success: boolean; total: number; logs: ExportLogItem[] }> => {
    const query = new URLSearchParams();
    if (params?.export_type) query.set('export_type', params.export_type);
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const res = await authFetch(`/api/admin/exports?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load export history');
    return res.json();
  },

  // Plans Management
  listPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await authFetch('/api/admin/plans');
    if (!res.ok) throw new Error('Failed to load plans');
    return res.json();
  },

  updatePlan: async (planId: string, payload: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> => {
    const res = await authFetch(`/api/admin/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update plan');
    return res.json();
  },

  // Analytics
  getAnalytics: async (): Promise<AnalyticsOverview> => {
    const res = await authFetch('/api/admin/analytics/overview');
    if (!res.ok) throw new Error('Failed to load analytics overview');
    return res.json();
  },

  // Audit Logs
  listAuditLogs: async (params?: { actor?: string; action?: string; skip?: number; limit?: number }): Promise<{ success: boolean; total: number; logs: AuditLogItem[] }> => {
    const query = new URLSearchParams();
    if (params?.actor) query.set('actor', params.actor);
    if (params?.action) query.set('action', params.action);
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const res = await authFetch(`/api/admin/audit-logs?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  },
};
