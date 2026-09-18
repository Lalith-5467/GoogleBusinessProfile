/**
 * Centralized API Configuration
 */
const envApiUrl = ((import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '') as string).replace(/\/+$/, '');

export const API_CONFIG = {
  BASE_URL: envApiUrl,
  GOOGLE_BUSINESS: {
    STATUS: '/api/google-business/status',
    AUTH_URL: '/api/google-business/auth/url',
    SYNC: '/api/google-business/sync',
    LOCATIONS: '/api/google-business/locations',
    COUNT: '/api/google-business/count',
    EXPORT: '/api/google-business/export',
  },
  SCRAPER: {
    COMPANY: '/api/scraper/company',
    BULK: '/api/scraper/bulk',
    BUSINESSES: '/api/scraper/businesses',
    COUNT: '/api/scraper/count',
    EXPORT: '/api/scraper/export',
  },
  ADMIN: {
    LOGIN: '/api/admin/auth/login',
    ME: '/api/admin/auth/me',
    BOOTSTRAP: '/api/admin/auth/bootstrap',
    CHANGE_PASSWORD: '/api/admin/auth/change-password',
    DASHBOARD_STATS: '/api/admin/dashboard/stats',
    USERS: '/api/admin/users',
    BUSINESSES: '/api/admin/businesses',
    SCRAPERS: '/api/admin/scrapers/jobs',
    EXPORTS: '/api/admin/exports',
    PLANS: '/api/admin/plans',
    ANALYTICS: '/api/admin/analytics/overview',
    AUDIT_LOGS: '/api/admin/audit-logs',
  },
  HEALTH: '/api/health',
} as const;

export default API_CONFIG;
