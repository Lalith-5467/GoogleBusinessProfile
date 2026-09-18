import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Globe,
  FileSpreadsheet,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { DashboardStats } from '../types';
import { adminApi } from '../services/adminApi';

interface AdminDashboardViewProps {
  onNavigateTab: (tab: string) => void;
}

export function AdminDashboardView({ onNavigateTab }: AdminDashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-3 border-[#6B8F71] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#68736B]">Loading real-time platform statistics from MySQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-[#C94A4A]/20 rounded-2xl text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="w-8 h-8 text-[#C94A4A] mx-auto mb-2" />
        <h3 className="text-base font-bold text-[#1D1E18]">Could not load dashboard statistics</h3>
        <p className="text-xs text-[#68736B] mt-1 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-[#6B8F71] text-white text-xs font-semibold rounded-lg hover:bg-[#597A5F]"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#6B8F71]" />
            Platform Overview & Live Metrics
          </h1>
          <p className="text-xs text-[#68736B] mt-0.5">
            Real database metrics calculated dynamically from MySQL tables
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-[10px] bg-[#F6F8F5] hover:bg-[#EEF4F0] border border-[#DDE5DE] text-[#1D1E18] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#68736B] ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* 4 Major Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users Card */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm hover:border-[#AAD2BA] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#68736B] uppercase tracking-wider font-heading">
              Registered Users
            </span>
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4F0] text-[#6B8F71] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-[#1D1E18] mt-2">
            {stats?.total_users ?? 0}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#68736B] pt-3 border-t border-[#F6F8F5]">
            <span className="inline-flex items-center gap-1.5 text-[#2F7D4A] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#2F7D4A]" />
              {stats?.active_users ?? 0} Active
            </span>
            <span>{stats?.total_admins ?? 0} Admins</span>
          </div>
        </div>

        {/* Total Stored Businesses */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm hover:border-[#AAD2BA] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#68736B] uppercase tracking-wider font-heading">
              Stored Businesses
            </span>
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4F0] text-[#6B8F71] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-[#1D1E18] mt-2">
            {stats?.total_businesses ?? 0}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#68736B] pt-3 border-t border-[#F6F8F5]">
            <span>{stats?.google_locations_count ?? 0} Google API</span>
            <span>{stats?.scraped_businesses_count ?? 0} Scraped</span>
          </div>
        </div>

        {/* Total Scraping Jobs */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm hover:border-[#AAD2BA] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#68736B] uppercase tracking-wider font-heading">
              Scraping Activity
            </span>
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4F0] text-[#6B8F71] flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-[#1D1E18] mt-2">
            {stats?.total_scraping_jobs ?? 0}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#68736B] pt-3 border-t border-[#F6F8F5]">
            <span className="text-[#2F7D4A] font-medium">{stats?.successful_jobs ?? 0} Success</span>
            <span className="text-[#C94A4A] font-medium">{stats?.failed_jobs ?? 0} Failed</span>
          </div>
        </div>

        {/* Total Exports */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm hover:border-[#AAD2BA] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#68736B] uppercase tracking-wider font-heading">
              Data Exports
            </span>
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4F0] text-[#6B8F71] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-[#1D1E18] mt-2">
            {stats?.total_exports ?? 0}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#68736B] pt-3 border-t border-[#F6F8F5]">
            <span>Format: CSV / Excel</span>
            <span className="text-[#2F7D4A] font-medium">Logged</span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Recent Registrations & Recent Scraping Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent User Registrations */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#6B8F71]" />
              <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
                Recent User Registrations
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('users')}
              className="text-xs font-semibold text-[#6B8F71] hover:text-[#597A5F] inline-flex items-center gap-1"
            >
              Manage All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(!stats?.recent_registrations || stats.recent_registrations.length === 0) ? (
            <div className="py-8 text-center text-xs text-[#68736B]">
              No user accounts registered yet.
            </div>
          ) : (
            <div className="divide-y divide-[#F6F8F5] flex-1">
              {stats.recent_registrations.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1D1E18] truncate">
                      {u.full_name || u.email}
                    </div>
                    <div className="text-[11px] text-[#68736B] truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                          : u.role === 'ADMIN'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        u.status === 'ACTIVE'
                          ? 'bg-[#2F7D4A]'
                          : u.status === 'SUSPENDED'
                          ? 'bg-[#C94A4A]'
                          : 'bg-gray-400'
                      }`}
                      title={u.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Scraping Activity */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#6B8F71]" />
              <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
                Recent Scraping Activity
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('scrapers')}
              className="text-xs font-semibold text-[#6B8F71] hover:text-[#597A5F] inline-flex items-center gap-1"
            >
              View Scraper Monitor <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(!stats?.recent_scraping_activity || stats.recent_scraping_activity.length === 0) ? (
            <div className="py-8 text-center text-xs text-[#68736B]">
              No scraping jobs logged yet. Real scrapes will appear here.
            </div>
          ) : (
            <div className="divide-y divide-[#F6F8F5] flex-1">
              {stats.recent_scraping_activity.map((j) => (
                <div key={j.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1D1E18] truncate font-mono text-[11px]">
                      {j.query_or_url}
                    </div>
                    <div className="text-[11px] text-[#68736B] flex items-center gap-2 mt-0.5">
                      <span>Type: {j.job_type}</span>
                      <span>&bull;</span>
                      <span>{j.results_count} records</span>
                      {j.duration_ms > 0 && (
                        <>
                          <span>&bull;</span>
                          <span>{(j.duration_ms / 1000).toFixed(1)}s</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {j.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF4EE] text-[#2F7D4A]">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    ) : j.status === 'FAILED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-[#C94A4A]">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                        <Clock className="w-3 h-3 animate-spin" /> Running
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
