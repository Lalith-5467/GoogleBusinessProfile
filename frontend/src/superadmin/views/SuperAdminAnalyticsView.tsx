import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  Users,
  Globe,
  FileSpreadsheet,
  MapPin,
  Tag,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { AnalyticsOverview } from '../types';
import { superAdminApi } from '../services/superAdminApi';

export function SuperAdminAnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-3 border-[#6B8F71] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#68736B]">Calculating platform analytics from database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#6B8F71]" />
              Platform Analytics & Usage Trends
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Live data aggregation across 7-day registration growth, scrape velocity, and market distributions
            </p>
          </div>

          <button
            onClick={fetchAnalytics}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-[10px] bg-[#F6F8F5] border border-[#DDE5DE] text-[#1D1E18]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analytics
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 2-Column Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registration Velocity (Last 7 Days) */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#6B8F71]" />
            <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
              User Registrations (Last 7 Days)
            </h2>
          </div>

          <div className="space-y-3">
            {analytics?.user_growth.map((item, idx) => {
              const maxVal = Math.max(...analytics.user_growth.map((i) => i.count), 5);
              const pct = (item.count / maxVal) * 100;
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono text-[#68736B] shrink-0">{item.date}</span>
                  <div className="flex-1 bg-[#F6F8F5] h-5 rounded-md overflow-hidden p-0.5">
                    <div
                      className="bg-[#6B8F71] h-full rounded-sm transition-all flex items-center justify-end px-1 text-[10px] text-white font-bold"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    >
                      {item.count > 0 ? item.count : ''}
                    </div>
                  </div>
                  <span className="w-8 font-mono font-semibold text-right text-[#1D1E18]">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scraping Job Activity (Last 7 Days) */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-[#6B8F71]" />
            <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
              Scraping Jobs Volume (Last 7 Days)
            </h2>
          </div>

          <div className="space-y-3">
            {analytics?.scraping_trends.map((item, idx) => {
              const maxVal = Math.max(...analytics.scraping_trends.map((i) => i.total), 5);
              const completedPct = (item.completed / maxVal) * 100;
              const failedPct = (item.failed / maxVal) * 100;
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono text-[#68736B] shrink-0">{item.date}</span>
                  <div className="flex-1 bg-[#F6F8F5] h-5 rounded-md overflow-hidden p-0.5 flex gap-1">
                    {item.completed > 0 && (
                      <div
                        className="bg-[#2F7D4A] h-full rounded-sm text-[10px] text-white font-bold flex items-center justify-center px-1"
                        style={{ width: `${completedPct}%` }}
                        title={`${item.completed} completed`}
                      >
                        {item.completed}
                      </div>
                    )}
                    {item.failed > 0 && (
                      <div
                        className="bg-[#C94A4A] h-full rounded-sm text-[10px] text-white font-bold flex items-center justify-center px-1"
                        style={{ width: `${failedPct}%` }}
                        title={`${item.failed} failed`}
                      >
                        {item.failed}
                      </div>
                    )}
                  </div>
                  <span className="w-8 font-mono font-semibold text-right text-[#1D1E18]">
                    {item.total}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[#68736B] pt-3 border-t border-[#F6F8F5]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2F7D4A]" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#C94A4A]" /> Failed
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Categories & Cities Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Business Categories */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-[#6B8F71]" />
            <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
              Top Extracted Categories
            </h2>
          </div>

          {(!analytics?.categories_breakdown || analytics.categories_breakdown.length === 0) ? (
            <div className="py-8 text-center text-xs text-[#68736B]">No category data yet.</div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {analytics.categories_breakdown.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#F6F8F5]">
                  <span className="font-semibold text-[#1D1E18] truncate max-w-[220px]">{c.category}</span>
                  <span className="font-mono font-bold text-[#6B8F71] bg-white px-2 py-0.5 rounded border border-[#DDE5DE]">
                    {c.count} records
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Harvested Cities */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-[#6B8F71]" />
            <h2 className="text-sm font-bold font-heading text-[#1D1E18]">
              Top Harvested Locations & Cities
            </h2>
          </div>

          {(!analytics?.cities_breakdown || analytics.cities_breakdown.length === 0) ? (
            <div className="py-8 text-center text-xs text-[#68736B]">No city data yet.</div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {analytics.cities_breakdown.map((city, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#F6F8F5]">
                  <span className="font-semibold text-[#1D1E18] truncate max-w-[220px]">{city.city}</span>
                  <span className="font-mono font-bold text-[#6B8F71] bg-white px-2 py-0.5 rounded border border-[#DDE5DE]">
                    {city.count} locations
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
