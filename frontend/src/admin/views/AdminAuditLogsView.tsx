import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  FileCode,
  User,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AuditLogItem } from '../types';
import { adminApi } from '../services/adminApi';

export function AdminAuditLogsView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listAuditLogs({
        actor: actorFilter || undefined,
        action: actionFilter || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#6B8F71]" />
              Immutable Administrative Audit Trail
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Secure, chronological event logging of all administrative operations, logins, privilege modifications, and data deletions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white border border-[#DDE5DE] text-xs font-bold text-[#1D1E18]">
              Total Events: {total}
            </span>
            <button
              onClick={fetchLogs}
              className="p-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] hover:bg-white text-[#68736B]"
              title="Refresh audit logs"
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

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#F6F8F5]">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#68736B]" />
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="Filter by actor email..."
              className="w-full pl-9 pr-20 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#DDE5DE] rounded-md hover:bg-[#EEF4F0] text-[#1D1E18]"
            >
              Filter
            </button>
          </form>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
          >
            <option value="">All Action Types</option>
            <option value="ADMIN_LOGIN_SUCCESS">ADMIN_LOGIN_SUCCESS</option>
            <option value="SUPER_ADMIN_BOOTSTRAP">SUPER_ADMIN_BOOTSTRAP</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="USER_UPDATED">USER_UPDATED</option>
            <option value="USER_STATUS_CHANGED">USER_STATUS_CHANGED</option>
            <option value="ADMIN_PERMISSIONS_UPDATED">ADMIN_PERMISSIONS_UPDATED</option>
            <option value="BUSINESS_DELETED">BUSINESS_DELETED</option>
            <option value="PLAN_UPDATED">PLAN_UPDATED</option>
            <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[#68736B] font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Actor Email</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#68736B]">
                    No audit records matching the search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  let parsedDetails: any = null;
                  try {
                    if (log.details_json) {
                      parsedDetails = JSON.parse(log.details_json);
                    }
                  } catch {}

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-[#F6F8F5]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#1D1E18]">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${
                              log.action.includes('DELETE')
                                ? 'bg-red-50 text-[#C94A4A]'
                                : log.action.includes('LOGIN')
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-[#EAF4EE] text-[#2F7D4A]'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1D1E18]">{log.actor_email}</span>
                        </td>

                        <td className="py-3 px-4 text-[#68736B]">
                          {log.target_type ? (
                            <span className="px-2 py-0.5 rounded bg-gray-100 font-mono text-[10px] text-gray-700">
                              {log.target_type}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-[#68736B]">
                          {log.ip_address || '—'}
                        </td>

                        <td className="py-3 px-4 text-[#68736B] text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {parsedDetails ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B8F71] hover:underline"
                            >
                              <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#68736B]">—</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && parsedDetails && (
                        <tr className="bg-[#F6F8F5]/80">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="p-3 bg-white border border-[#DDE5DE] rounded-[10px] text-xs font-mono text-[#1D1E18] overflow-x-auto">
                              <pre>{JSON.stringify(parsedDetails, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
