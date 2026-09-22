import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Filter,
  UserCheck,
  UserX
} from 'lucide-react';
import { UserListItem, UserStatus } from '../types';
import { adminApi } from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminCustomerUsersView() {
  const { hasPermission } = useAdminAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const canManageUsers = hasPermission('can_manage_users');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const limit = 15;
      const skip = (page - 1) * limit;
      // Specifically query customer role users for staff admin operations
      const data = await adminApi.listUsers({
        role: 'CUSTOMER',
        status: statusFilter !== 'ALL' ? (statusFilter as UserStatus) : undefined,
        search: search.trim() || undefined,
        skip,
        limit,
      });

      setUsers(data.users);
      setTotalPages(Math.ceil((data.total || 0) / limit) || 1);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    if (!canManageUsers) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await adminApi.updateUserStatus(userId, newStatus);
      setSuccessMsg(`Customer account status updated to ${newStatus}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, status: newStatus });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update customer status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#6B8F71]" />
            Customer User Directory
          </h1>
          <p className="text-xs text-[#68736B] mt-0.5">
            View registered customer accounts, monitor scraping/export activity, and manage access
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold text-[#1D1E18] bg-[#F6F8F5] hover:bg-[#EEF4F0] border border-[#DDE5DE] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-[10px] bg-[#EAF4EE] border border-[#AAD2BA] text-[#2F7D4A] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#2F7D4A] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-[10px] bg-red-50 border border-[#C94A4A]/30 text-[#C94A4A] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#C94A4A] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full md:w-96 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68736B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by email or name..."
            className="w-full pl-10 pr-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-xs text-[#1D1E18] placeholder-[#68736B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-[#68736B]" />
          <span className="text-xs text-[#68736B] font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-[8px] border border-[#DDE5DE] bg-[#F6F8F5] text-xs text-[#1D1E18] focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Customer Users Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1D1E18]">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[11px] font-semibold text-[#68736B] uppercase tracking-wider font-heading">
              <tr>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Scrapes</th>
                <th className="py-3 px-4">Exports</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading customer accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#68736B]">
                    No customer accounts match the current filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F6F8F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1D1E18]">{u.full_name || 'Customer User'}</div>
                      <div className="text-[11px] text-[#68736B] font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                          u.status === 'ACTIVE'
                            ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                            : u.status === 'SUSPENDED'
                            ? 'bg-red-50 text-[#C94A4A] border border-[#C94A4A]/30'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {u.status === 'ACTIVE' && <CheckCircle2 className="w-2.5 h-2.5 text-[#2F7D4A]" />}
                        {u.status === 'SUSPENDED' && <XCircle className="w-2.5 h-2.5 text-[#C94A4A]" />}
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#1D1E18]">{u.scraping_jobs_count || 0}</td>
                    <td className="py-3 px-4 font-mono text-[#1D1E18]">{u.exports_count || 0}</td>
                    <td className="py-3 px-4 text-[#68736B] text-[11px]">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-semibold text-[#6B8F71] hover:bg-[#EAF4EE] border border-[#AAD2BA] transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-[#F6F8F5] border-t border-[#DDE5DE] px-4 py-3 flex items-center justify-between text-xs text-[#68736B]">
          <div>
            Total: <span className="font-semibold text-[#1D1E18]">{totalCount}</span> customers
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-2.5 py-1 rounded border border-[#DDE5DE] bg-white text-[#1D1E18] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-mono">
              Page {page} of {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-2.5 py-1 rounded border border-[#DDE5DE] bg-white text-[#1D1E18] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE5DE]">
              <h3 className="font-bold font-heading text-[#1D1E18] text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#6B8F71]" />
                Customer Profile Details
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-[#68736B] hover:text-[#1D1E18] text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Full Name:</span>
                <span className="font-semibold text-[#1D1E18]">{selectedUser.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Email Address:</span>
                <span className="font-mono font-medium text-[#1D1E18]">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Account Status:</span>
                <span className="font-semibold font-mono uppercase">{selectedUser.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Total Scraping Jobs:</span>
                <span className="font-mono text-[#1D1E18]">{selectedUser.scraping_jobs_count || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Total Excel Exports:</span>
                <span className="font-mono text-[#1D1E18]">{selectedUser.exports_count || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#F6F8F5]">
                <span className="text-[#68736B]">Registered On:</span>
                <span className="text-[#68736B]">{new Date(selectedUser.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Status Management Buttons (if permitted) */}
            {canManageUsers && (
              <div className="pt-2 border-t border-[#DDE5DE] flex items-center gap-2">
                {selectedUser.status === 'ACTIVE' ? (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(selectedUser.id, 'SUSPENDED')}
                    className="flex-1 py-2 rounded-[8px] bg-red-50 text-[#C94A4A] hover:bg-red-100 border border-[#C94A4A]/20 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Suspend Customer</span>
                  </button>
                ) : (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(selectedUser.id, 'ACTIVE')}
                    className="flex-1 py-2 rounded-[8px] bg-[#EAF4EE] text-[#2F7D4A] hover:bg-[#AAD2BA]/40 border border-[#AAD2BA] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Activate Customer</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full py-2 rounded-[8px] border border-[#DDE5DE] text-[#68736B] text-xs font-semibold hover:bg-[#F6F8F5] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
