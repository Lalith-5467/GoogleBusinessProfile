import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  RefreshCw,
  AlertCircle,
  FileText
} from 'lucide-react';
import { ExportLogItem } from '../types';
import { adminApi } from '../services/adminApi';

export function AdminExportsView() {
  const [logs, setLogs] = useState<ExportLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportTypeFilter, setExportTypeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listExportLogs({
        export_type: exportTypeFilter || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load export history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [exportTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Toolbar */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#6B8F71]" />
              Data Export History & Audit
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Authoritative record of all CSV and Excel exports requested across Google Business Profiles and Website Scraper
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white border border-[#DDE5DE] text-xs font-bold text-[#1D1E18]">
              Total Exports: {total}
            </span>
            <button
              onClick={fetchLogs}
              className="p-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] hover:bg-white text-[#68736B]"
              title="Refresh export logs"
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
            value={exportTypeFilter}
            onChange={(e) => setExportTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
          >
            <option value="">All Export Types</option>
            <option value="GOOGLE_BUSINESS">Google Business Profiles</option>
            <option value="SCRAPER">Scraped Businesses</option>
            <option value="SEARCH_FILTERED">Search Filtered Results</option>
          </select>
        </div>
      </div>

      {/* Export Logs Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[#68736B] font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Export File</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Records Exported</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading export logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    No export requests logged yet. New CSV downloads will automatically appear here.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#F6F8F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#6B8F71] shrink-0" />
                        <span className="font-semibold text-[#1D1E18] font-mono text-xs">{l.file_name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-[#F6F8F5] text-[#1D1E18] border border-[#DDE5DE]">
                        {l.export_type.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-[#1D1E18]">
                      {l.record_count} records
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF4EE] text-[#2F7D4A]">
                        {l.file_format}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[#68736B]">
                      {l.user_email || 'Public User'}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#68736B]">
                      {l.ip_address || '—'}
                    </td>

                    <td className="py-3 px-4 text-right text-[#68736B] text-[11px]">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
