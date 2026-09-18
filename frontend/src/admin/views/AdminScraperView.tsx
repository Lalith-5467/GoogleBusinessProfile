import React, { useState, useEffect } from 'react';
import {
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Layers
} from 'lucide-react';
import { ScrapingJobItem } from '../types';
import { adminApi } from '../services/adminApi';

export function AdminScraperView() {
  const [jobs, setJobs] = useState<ScrapingJobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Selected error modal
  const [selectedErrorJob, setSelectedErrorJob] = useState<ScrapingJobItem | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listScrapingJobs({
        status: statusFilter || undefined,
        job_type: jobTypeFilter || undefined,
      });
      setJobs(data.jobs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load scraper monitoring jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, jobTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Toolbar */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#6B8F71]" />
              Website Scraper Job Monitor
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Live audit of Playwright Chromium harvesting operations, success rates, duration, and error diagnostics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white border border-[#DDE5DE] text-xs font-bold text-[#1D1E18]">
              Total Jobs: {total}
            </span>
            <button
              onClick={fetchJobs}
              className="p-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] hover:bg-white text-[#68736B]"
              title="Refresh jobs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-[#F6F8F5]">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
          </select>

          <select
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
          >
            <option value="">All Job Types</option>
            <option value="SINGLE">Single Website Scrape</option>
            <option value="BULK">Bulk Website Scrape</option>
            <option value="KEYWORD_SEARCH">Keyword Location Search</option>
          </select>
        </div>
      </div>

      {/* Scraping Jobs Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[#68736B] font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Target Query / URL</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Results Harvested</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading scraper monitoring jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    No scraping jobs recorded yet.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-[#F6F8F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-[#1D1E18] truncate max-w-[320px]">
                        {j.query_or_url}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F8F5] border border-[#DDE5DE] text-[#1D1E18]">
                        {j.job_type}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {j.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF4EE] text-[#2F7D4A]">
                          <CheckCircle2 className="w-3 h-3" /> Completed
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
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold">
                      {j.results_count} records
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#68736B]">
                      {j.duration_ms > 0 ? `${(j.duration_ms / 1000).toFixed(2)}s` : '—'}
                    </td>

                    <td className="py-3 px-4 text-[#68736B] text-[11px]">
                      {new Date(j.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {j.error_message ? (
                        <button
                          onClick={() => setSelectedErrorJob(j)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-[#C94A4A] rounded text-[11px] font-semibold"
                        >
                          View Error
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#2F7D4A]">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modal: Error Diagnostic Details --- */}
      {selectedErrorJob && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-lg p-6 modal-safe animate-toast-in">
            <div className="flex items-center gap-2 text-[#C94A4A] font-bold font-heading mb-2">
              <AlertCircle className="w-5 h-5" />
              <span>Scraper Execution Error Diagnostic</span>
            </div>
            <p className="text-xs text-[#68736B] mb-3">
              Target query: <span className="font-mono font-semibold text-[#1D1E18]">{selectedErrorJob.query_or_url}</span>
            </p>

            <div className="p-3 bg-[#F6F8F5] border border-[#DDE5DE] rounded-[10px] text-xs font-mono text-[#C94A4A] whitespace-pre-wrap max-h-60 overflow-y-auto">
              {selectedErrorJob.error_message}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-[#DDE5DE]">
              <button
                onClick={() => setSelectedErrorJob(null)}
                className="px-4 py-2 rounded-[10px] bg-[#6B8F71] text-white text-xs font-semibold hover:bg-[#597A5F]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
