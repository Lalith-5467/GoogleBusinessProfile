import React, { useState } from 'react';
import {
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  Key,
  Server,
  Database,
  Globe,
  UserCheck
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi } from '../services/adminApi';

export function AdminSettingsView() {
  const { currentUser, isSuperAdmin } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError('Please fill in both current and new password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await adminApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-5 shadow-sm space-y-2">
        <h1 className="text-lg sm:text-xl font-bold font-heading text-[#1D1E18] flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#6B8F71]" />
          Admin Security & System Diagnostics
        </h1>
        <p className="text-xs text-[#68736B]">
          Manage your administrative credentials and inspect platform runtime health
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Administrator Profile Card */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#F6F8F5]">
            <div className="w-12 h-12 rounded-[14px] bg-[#6B8F71] text-white flex items-center justify-center font-bold text-lg">
              {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-[#1D1E18]">
                {currentUser?.full_name || 'Admin User'}
              </h3>
              <div className="text-xs text-[#68736B] font-mono">{currentUser?.email}</div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[#68736B]">Assigned Role:</span>
              <span className="font-bold font-mono text-[#2F7D4A] bg-[#EAF4EE] px-2.5 py-0.5 rounded-full">
                {currentUser?.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736B]">Account Status:</span>
              <span className="font-semibold text-[#1D1E18]">{currentUser?.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736B]">Last Login:</span>
              <span className="font-mono text-[#1D1E18]">
                {currentUser?.last_login_at
                  ? new Date(currentUser.last_login_at).toLocaleString()
                  : 'Current Session'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736B]">Account Created:</span>
              <span className="font-mono text-[#1D1E18]">
                {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#F6F8F5] text-[11px] text-[#68736B]">
            Cryptographic Salt: 32-Byte Per-User &bull; PBKDF2-HMAC-SHA256 (200k iter)
          </div>
        </div>

        {/* Change Password Form */}
        <div className="bg-white border border-[#DDE5DE] rounded-[16px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F6F8F5]">
            <Key className="w-4 h-4 text-[#6B8F71]" />
            <h3 className="text-sm font-bold font-heading text-[#1D1E18]">
              Update Password
            </h3>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-[#C94A4A]/20 rounded-lg text-xs text-[#C94A4A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-[#EAF4EE] border border-[#AAD2BA] rounded-lg text-xs text-[#2F7D4A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated successfully!</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#1D1E18] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1D1E18] mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1D1E18] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
