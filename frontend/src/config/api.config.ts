/**
 * Centralized API Configuration
 */
export const API_CONFIG = {
  BASE_URL: '',
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
  HEALTH: '/api/health',
} as const;

export default API_CONFIG;
