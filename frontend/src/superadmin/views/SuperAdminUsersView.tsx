import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  Key,
  Edit2,
  Trash2,
  Lock,
  RefreshCw,
  Mail,
  User as UserIcon,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserListItem, UserRole, UserStatus, AdminPermission } from '../types';
import { superAdminApi } from '../services/superAdminApi';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { useToast } from '../../context';

export function SuperAdminUsersView() {
  const { isSuperAdmin, isOriginalSuperAdmin, isViewOnlySuperAdmin, currentUser } = useSuperAdminAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  const isSelf = !!currentUser && selectedUser?.id === currentUser?.id;
  const isSubSuperAdmin = currentUser?.role === 'SUPER_ADMIN' && !currentUser?.is_original_super_admin;
  const isSelfSubSuperAdmin = isSubSuperAdmin && isSelf;

  // Form states
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('CUSTOMER');
  const [createPermissions, setCreatePermissions] = useState<AdminPermission>({
    can_manage_users: true,
    can_manage_businesses: true,
    can_manage_scrapers: true,
    can_manage_exports: true,
    can_manage_plans: false,
    can_view_analytics: true,
    can_view_audit_logs: false,
  });

  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('CUSTOMER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editCurrentPassword, setEditCurrentPassword] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [editPermissions, setEditPermissions] = useState<AdminPermission>({
    can_manage_users: true,
    can_manage_businesses: true,
    can_manage_scrapers: true,
    can_manage_exports: true,
    can_manage_plans: false,
    can_view_analytics: true,
    can_view_audit_logs: false,
  });

  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminApi.listUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword) return;
    setActionLoading(true);
    setError(null);
    try {
      await superAdminApi.createUser({
        email: createEmail,
        password: createPassword,
        full_name: createFullName || undefined,
        role: createRole,
        permissions: createRole === 'ADMIN' ? createPermissions : undefined,
      });
      setShowCreateModal(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreateRole('CUSTOMER');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const isSelf = !!currentUser && selectedUser.id === currentUser.id;
    const isSubSuperAdmin = currentUser?.role === 'SUPER_ADMIN' && !currentUser?.is_original_super_admin;
    const isSelfSubSuperAdmin = isSubSuperAdmin && isSelf;

    const hasNewPassword = editPassword.trim().length > 0;
    const hasCurrentPassword = editCurrentPassword.trim().length > 0;
    const hasConfirmPassword = editConfirmPassword.trim().length > 0;
    const isPasswordChangeInitiated = hasNewPassword || hasCurrentPassword || hasConfirmPassword;

    if (isSelfSubSuperAdmin && isPasswordChangeInitiated) {
      if (!hasCurrentPassword) {
        toast.error('Please enter your current password.');
        return;
      }
      if (!hasNewPassword) {
        toast.error('Please enter a new password.');
        return;
      }
      if (editCurrentPassword.trim() === editPassword.trim()) {
        toast.error('New password must be different from your current password.');
        return;
      }
      if (editPassword.trim().length < 8) {
        toast.error('New password must be at least 8 characters long.');
        return;
      }
      if (!hasConfirmPassword || editPassword.trim() !== editConfirmPassword.trim()) {
        toast.error('New password and confirm password do not match.');
        return;
      }
    } else if (hasNewPassword) {
      if (editPassword.trim().length < 8) {
        toast.error('New password must be at least 8 characters long.');
        return;
      }
    }

    setActionLoading(true);
    setError(null);
    try {
      const payload: any = {
        full_name: editFullName,
        role: isSuperAdmin ? editRole : undefined,
        status: editStatus,
      };

      if (isSelfSubSuperAdmin) {
        if (hasNewPassword) {
          payload.password = editPassword.trim();
          payload.current_password = editCurrentPassword.trim();
          payload.confirm_password = editConfirmPassword.trim();
        }
      } else if (hasNewPassword) {
        payload.password = editPassword.trim();
      }

      await superAdminApi.updateUser(selectedUser.id, payload);

      if (isSelfSubSuperAdmin && hasNewPassword) {
        toast.success('Password changed successfully.');
      } else if (hasNewPassword) {
        toast.success('Password reset successfully.');
      } else {
        toast.success('User updated successfully.');
      }

      setShowEditModal(false);
      setEditCurrentPassword('');
      setEditPassword('');
      setEditConfirmPassword('');
      fetchUsers();
    } catch (err: any) {
      const msg = err.message || 'Failed to update user account.';
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermissionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await superAdminApi.updateAdminPermissions(selectedUser.id, editPermissions);
      setShowPermissionsModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update admin permissions.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await superAdminApi.deleteUser(selectedUser.id);
      setShowDeleteModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: UserListItem) => {
    setSelectedUser(user);
    setEditFullName(user.full_name || '');
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditCurrentPassword('');
    setEditPassword('');
    setEditConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowAdminPassword(false);
    setShowEditModal(true);
  };

  const openPermissionsModal = (user: UserListItem) => {
    setSelectedUser(user);
    if (user.permissions) {
      setEditPermissions({ ...user.permissions });
    } else {
      setEditPermissions({
        can_manage_users: true,
        can_manage_businesses: true,
        can_manage_scrapers: true,
        can_manage_exports: true,
        can_manage_plans: false,
        can_view_analytics: true,
        can_view_audit_logs: false,
      });
    }
    setShowPermissionsModal(true);
  };

  const openDeleteModal = (user: UserListItem) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Filters */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#6B8F71]" />
              User & Administrator Management
            </h1>
            <p className="text-xs text-[#68736B] mt-0.5">
              Total registered users: <span className="font-bold text-[#1D1E18]">{total}</span>
            </p>
          </div>

          {isOriginalSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New User / Admin</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-[#F6F8F5]">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#68736B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name or email address..."
              className="w-full pl-9 pr-20 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#DDE5DE] rounded-md hover:bg-[#EEF4F0] text-[#1D1E18]"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="CUSTOMER">Customer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-[#1D1E18] focus:bg-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <button
              onClick={fetchUsers}
              className="p-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] hover:bg-white text-[#68736B]"
              title="Refresh users"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F5] border-b border-[#DDE5DE] text-[#68736B] font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Scrapes</th>
                <th className="py-3 px-4">Exports</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DE]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    <div className="w-6 h-6 border-2 border-[#6B8F71] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#68736B]">
                    No users matching the specified search or filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F6F8F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1D1E18]">
                        {u.full_name || 'No Name Set'}
                      </div>
                      <div className="text-[11px] text-[#68736B] font-mono">{u.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                            : u.role === 'ADMIN'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {u.role === 'SUPER_ADMIN' && <Shield className="w-3 h-3" />}
                        {u.role === 'SUPER_ADMIN'
                          ? u.is_original_super_admin
                            ? 'SUPER ADMIN'
                            : 'SUB SUPER ADMIN'
                          : u.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-[#EAF4EE] text-[#2F7D4A]'
                            : u.status === 'SUSPENDED'
                            ? 'bg-red-50 text-[#C94A4A]'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'ACTIVE'
                              ? 'bg-[#2F7D4A]'
                              : u.status === 'SUSPENDED'
                              ? 'bg-[#C94A4A]'
                              : 'bg-gray-400'
                          }`}
                        />
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono">{u.scraping_jobs_count}</td>
                    <td className="py-3 px-4 font-mono">{u.exports_count}</td>

                    <td className="py-3 px-4 text-[#68736B] text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1">
                      {isOriginalSuperAdmin && u.role === 'ADMIN' && (
                        <button
                          onClick={() => openPermissionsModal(u)}
                          className="p-1.5 text-[#68736B] hover:text-[#6B8F71] hover:bg-white rounded border border-transparent hover:border-[#DDE5DE]"
                          title="Configure Granular Permissions"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 text-[#68736B] hover:text-[#1D1E18] hover:bg-white rounded border border-transparent hover:border-[#DDE5DE]"
                        title="Edit User Details & Status"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {isOriginalSuperAdmin && u.id !== currentUser?.id && (
                        <button
                          onClick={() => openDeleteModal(u)}
                          className="p-1.5 text-[#C94A4A] hover:bg-red-50 rounded"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modal: Create User / Admin --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-lg p-6 modal-safe animate-toast-in">
            <h2 className="text-base font-bold font-heading text-[#1D1E18] mb-1">
              Create New User or Administrator
            </h2>
            <p className="text-xs text-[#68736B] mb-4">
              Add a customer account or assign administrative capabilities with custom permissions.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Full Name</label>
                <input
                  type="text"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Role Assignment</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  >
                    <option value="CUSTOMER">CUSTOMER (Standard User)</option>
                    <option value="ADMIN">ADMIN (Configurable Permissions)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Sub Super Admin)</option>
                  </select>
                </div>
              )}

              {/* Granular permissions if creating an ADMIN */}
              {isSuperAdmin && createRole === 'ADMIN' && (
                <div className="p-3.5 bg-[#F6F8F5] rounded-[12px] border border-[#DDE5DE] space-y-2">
                  <div className="text-xs font-bold font-heading text-[#1D1E18]">
                    Configure Initial Admin Permissions
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_manage_users}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_manage_users: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>Manage Users</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_manage_businesses}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_manage_businesses: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>Manage Businesses</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_manage_scrapers}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_manage_scrapers: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>Manage Scrapers</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_manage_exports}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_manage_exports: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>Manage Exports</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_view_analytics}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_view_analytics: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>View Analytics</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createPermissions.can_view_audit_logs}
                        onChange={(e) => setCreatePermissions({ ...createPermissions, can_view_audit_logs: e.target.checked })}
                        className="rounded text-[#6B8F71] focus:ring-[#6B8F71]"
                      />
                      <span>View Audit Logs</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDE5DE]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Edit User --- */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-md p-6 modal-safe animate-toast-in">
            <h2 className="text-base font-bold font-heading text-[#1D1E18] mb-1">
              Edit User: {selectedUser.email}
            </h2>
            <p className="text-xs text-[#68736B] mb-4">
              Update account status, role, or reset account password.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Full access)</option>
                  <option value="INACTIVE">INACTIVE (Temporarily disabled)</option>
                  <option value="SUSPENDED">SUSPENDED (Locked)</option>
                </select>
              </div>

              {isSuperAdmin && selectedUser.id !== currentUser?.id && (
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              )}

              {/* Scenario A: Sub Super Admin changing their own password */}
              {isSelfSubSuperAdmin ? (
                <div className="space-y-3 pt-2 border-t border-[#DDE5DE]">
                  <div>
                    <h3 className="text-xs font-bold font-heading text-[#1D1E18]">Change Password</h3>
                    <p className="text-[11px] text-[#68736B]">Enter your current password to continue</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1D1E18] mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={editCurrentPassword}
                        onChange={(e) => setEditCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        className="w-full pl-3 pr-10 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68736B] hover:text-[#1D1E18] p-0.5 transition-colors"
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1D1E18] mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="w-full pl-3 pr-10 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68736B] hover:text-[#1D1E18] p-0.5 transition-colors"
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1D1E18] mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={editConfirmPassword}
                        onChange={(e) => setEditConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className="w-full pl-3 pr-10 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68736B] hover:text-[#1D1E18] p-0.5 transition-colors"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : isOriginalSuperAdmin ? (
                /* Scenario B: Super Admin managing user password */
                <div>
                  <label className="block text-xs font-semibold text-[#1D1E18] mb-1">
                    Reset Password <span className="text-[#68736B] font-normal">(leave blank to keep unchanged)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="New password (optional)"
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68736B] hover:text-[#1D1E18] p-0.5 transition-colors"
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDE5DE]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditCurrentPassword('');
                    setEditPassword('');
                    setEditConfirmPassword('');
                  }}
                  className="px-4 py-2 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Edit Admin Permissions --- */}
      {showPermissionsModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-md p-6 modal-safe animate-toast-in">
            <h2 className="text-base font-bold font-heading text-[#1D1E18] mb-1">
              Admin Permissions: {selectedUser.email}
            </h2>
            <p className="text-xs text-[#68736B] mb-4">
              Super Admin control to grant or revoke specific feature access.
            </p>

            <form onSubmit={handlePermissionsSubmit} className="space-y-3">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">User Management</div>
                  <div className="text-[11px] text-[#68736B]">Create, edit, and view user accounts</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_manage_users}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_manage_users: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">Business Management</div>
                  <div className="text-[11px] text-[#68736B]">View and manage Google and scraped business records</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_manage_businesses}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_manage_businesses: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">Scraper Monitor</div>
                  <div className="text-[11px] text-[#68736B]">View scraper jobs and trigger re-enrichment</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_manage_scrapers}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_manage_scrapers: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">Export Management</div>
                  <div className="text-[11px] text-[#68736B]">Monitor export logs and download history</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_manage_exports}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_manage_exports: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">Analytics</div>
                  <div className="text-[11px] text-[#68736B]">View platform growth and usage trends</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_view_analytics}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_view_analytics: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[#DDE5DE] hover:bg-[#F6F8F5] cursor-pointer">
                <div>
                  <div className="text-xs font-semibold text-[#1D1E18]">Audit Logs</div>
                  <div className="text-[11px] text-[#68736B]">View administrative audit trail</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPermissions.can_view_audit_logs}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_view_audit_logs: e.target.checked })}
                  className="rounded text-[#6B8F71] focus:ring-[#6B8F71] w-4 h-4"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDE5DE]">
                <button
                  type="button"
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-2 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Confirm Delete User --- */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE5DE] rounded-[20px] shadow-xl w-full max-w-sm p-6 modal-safe animate-toast-in">
            <div className="w-10 h-10 rounded-full bg-red-100 text-[#C94A4A] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold font-heading text-center text-[#1D1E18] mb-1">
              Delete User Account?
            </h2>
            <p className="text-xs text-[#68736B] text-center mb-5">
              Are you sure you want to permanently delete user <span className="font-bold text-[#1D1E18]">{selectedUser.email}</span>? This action is recorded in the audit log and cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 px-3 rounded-[10px] border border-[#DDE5DE] text-xs font-semibold text-[#68736B] hover:bg-[#F6F8F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={actionLoading}
                className="flex-1 py-2 px-3 rounded-[10px] bg-[#C94A4A] hover:bg-red-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
