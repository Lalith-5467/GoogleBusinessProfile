import React, { useState } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, ArrowLeft, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminApi } from '../services/adminApi';

interface AdminLoginPageProps {
  onBackToWebsite: () => void;
}

export function AdminLoginPage({ onBackToWebsite }: AdminLoginPageProps) {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap modal state for first-time setup
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapName, setBootstrapName] = useState('System Super Admin');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapSuccess, setBootstrapSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapEmail || !bootstrapPassword) {
      setError('Please enter email and password for Super Admin.');
      return;
    }
    if (bootstrapPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError(null);
    setBootstrapLoading(true);

    try {
      await adminApi.bootstrap({
        email: bootstrapEmail,
        password: bootstrapPassword,
        full_name: bootstrapName,
        bootstrap_secret: bootstrapSecret || undefined,
      });
      setBootstrapSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Super Admin bootstrap failed.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#1D1E18] flex flex-col justify-center items-center px-4 py-8 relative">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-[#AAD2BA]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-[#6B8F71]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Back to Website Button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between z-10">
        <button
          onClick={onBackToWebsite}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#68736B] hover:text-[#1D1E18] transition-colors py-1.5 px-3 rounded-lg hover:bg-white border border-transparent hover:border-[#DDE5DE]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Website
        </button>

        <span className="text-[11px] font-mono text-[#68736B] px-2.5 py-1 rounded-full bg-white border border-[#DDE5DE]">
          Security: PBKDF2 + JWT
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-[#DDE5DE] rounded-[20px] shadow-lg p-6 sm:p-8 z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-[14px] bg-[#6B8F71] text-white flex items-center justify-center shadow-md mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#1D1E18]">
            Super Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-[#68736B] mt-1">
            Sign in to manage users, scrapers, businesses & system settings
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-[10px] bg-red-50 border border-[#C94A4A]/30 text-[#C94A4A] text-xs flex items-start gap-2 animate-toast-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {bootstrapSuccess && (
          <div className="mb-5 p-3.5 rounded-[10px] bg-[#EAF4EE] border border-[#AAD2BA] text-[#2F7D4A] text-xs flex items-center gap-2 animate-toast-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Super Admin initialized successfully! Logging you in...</span>
          </div>
        )}

        {!showBootstrap ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1.5 font-heading">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68736B]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm text-[#1D1E18] placeholder-[#68736B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1.5 font-heading">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#68736B]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm text-[#1D1E18] placeholder-[#68736B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#68736B] hover:text-[#1D1E18] p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>

            <div className="pt-3 border-t border-[#DDE5DE] flex items-center justify-between text-xs text-[#68736B]">
              <span>First time setup?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowBootstrap(true);
                }}
                className="font-semibold text-[#6B8F71] hover:underline inline-flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Initialize Super Admin
              </button>
            </div>
          </form>
        ) : (
          /* Bootstrap Super Admin Form */
          <form onSubmit={handleBootstrapSubmit} className="space-y-3.5">
            <div className="p-3 bg-[#EAF4EE] rounded-[10px] border border-[#AAD2BA] text-xs text-[#2F7D4A]">
              <strong>One-Time Super Admin Bootstrap:</strong> Creates the primary administrative account with full unrestricted permissions.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Super Admin Full Name</label>
              <input
                type="text"
                value={bootstrapName}
                onChange={(e) => setBootstrapName(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Super Admin Email</label>
              <input
                type="email"
                required
                value={bootstrapEmail}
                onChange={(e) => setBootstrapEmail(e.target.value)}
                placeholder="superadmin@yourdomain.com"
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1">Password (min 8 characters)</label>
              <input
                type="password"
                required
                value={bootstrapPassword}
                onChange={(e) => setBootstrapPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1E18] mb-1">
                Bootstrap Secret <span className="text-[#68736B] font-normal">(optional if first setup)</span>
              </label>
              <input
                type="text"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="Leave blank unless BOOTSTRAP_SECRET is set"
                className="w-full px-3 py-2 rounded-[10px] border border-[#DDE5DE] bg-[#F6F8F5] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B8F71]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowBootstrap(false);
                  setError(null);
                }}
                className="flex-1 py-2 px-3 rounded-[10px] border border-[#DDE5DE] text-[#68736B] text-xs font-semibold hover:bg-[#F6F8F5]"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={bootstrapLoading}
                className="flex-1 py-2 px-3 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] text-white text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {bootstrapLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Create Super Admin</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security Note Footer */}
      <div className="text-center text-[11px] text-[#68736B] mt-6 max-w-md">
        Protected by role-based cryptographic JWT authorization. All administrative actions are recorded in immutable audit logs.
      </div>
    </div>
  );
}
