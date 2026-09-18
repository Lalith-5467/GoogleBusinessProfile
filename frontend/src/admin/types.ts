export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AdminPermission {
  can_manage_users: boolean;
  can_manage_businesses: boolean;
  can_manage_scrapers: boolean;
  can_manage_exports: boolean;
  can_manage_plans: boolean;
  can_view_analytics: boolean;
  can_view_audit_logs: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  status: UserStatus;
  plan_id?: string | null;
  last_login_at?: string | null;
  created_at: string;
  permissions?: AdminPermission | null;
}

export interface UserListItem {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  status: UserStatus;
  plan_id?: string | null;
  plan_name?: string | null;
  last_login_at?: string | null;
  created_at: string;
  scraping_jobs_count: number;
  exports_count: number;
  permissions?: AdminPermission | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  search_limit: number;
  scrape_limit: number;
  bulk_scrape_limit: number;
  export_limit: number;
  features_json?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  suspended_users: number;
  total_admins: number;
  total_businesses: number;
  google_locations_count: number;
  scraped_businesses_count: number;
  total_scraping_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  total_exports: number;
  recent_registrations: Array<{
    id: string;
    email: string;
    full_name?: string | null;
    role: string;
    status: string;
    created_at: string;
  }>;
  recent_scraping_activity: Array<{
    id: string;
    job_type: string;
    query_or_url: string;
    status: string;
    results_count: number;
    duration_ms: number;
    created_at: string;
  }>;
}

export interface AnalyticsOverview {
  user_growth: Array<{ date: string; count: number }>;
  scraping_trends: Array<{ date: string; completed: number; failed: number; total: number }>;
  export_trends: Array<{ date: string; count: number }>;
  categories_breakdown: Array<{ category: string; count: number }>;
  cities_breakdown: Array<{ city: string; count: number }>;
}

export interface AuditLogItem {
  id: string;
  user_id?: string | null;
  actor_email: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  ip_address?: string | null;
  details_json?: string | null;
  created_at: string;
}

export interface ExportLogItem {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  export_type: string;
  record_count: number;
  file_name: string;
  file_format: string;
  ip_address?: string | null;
  created_at: string;
}

export interface ScrapingJobItem {
  id: string;
  user_id?: string | null;
  job_type: string;
  query_or_url: string;
  status: string;
  results_count: number;
  error_message?: string | null;
  duration_ms: number;
  created_at: string;
}

export interface UnifiedBusinessItem {
  id: string;
  source_type: 'GOOGLE_LOCATION' | 'WEBSITE_SCRAPE';
  business_name: string;
  primary_category?: string | null;
  rating?: string | null;
  review_count?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  status: string;
  created_at: string;
}
