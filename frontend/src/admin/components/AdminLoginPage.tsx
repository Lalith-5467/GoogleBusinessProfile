import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, ArrowLeft, AlertCircle, HelpCircle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

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
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both your administrative email and password.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await login({ email: cleanEmail, password: cleanPassword });
    } catch (err: any) {
      setError(err.message || 'Invalid administrator email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#1D1E18] flex flex-col justify-center items-center px-4 py-8 relative font-sans selection:bg-[#AAD2BA] selection:text-[#1D1E18]">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-[#AAD2BA]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-12 right-1/4 w-96 h-96 bg-[#6B8F71]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between z-10">
        <button
          onClick={onBackToWebsite}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#68736B] hover:text-[#1D1E18] transition-colors py-1.5 px-3 rounded-lg hover:bg-white border border-transparent hover:border-[#DDE5DE]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Website
        </button>

        <span className="text-[11px] font-mono text-[#68736B] px-2.5 py-1 rounded-full bg-white border border-[#DDE5DE] shadow-2xs">
          Admin Portal &bull; Operations
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-[#DDE5DE] rounded-[20px] shadow-lg p-6 sm:p-8 z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-[14px] bg-[#6B8F71] text-white flex items-center justify-center shadow-md mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-[#1D1E18] tracking-tight">
            Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-[#68736B] mt-1">
            Sign in to manage businesses, monitor scrapers, and oversee operations
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-[10px] bg-red-50 border border-[#C94A4A]/30 text-[#C94A4A] text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C94A4A]" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

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
                placeholder="admin@yourcompany.com"
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
            className="w-full mt-2 py-2.5 px-4 rounded-[10px] bg-[#6B8F71] hover:bg-[#597A5F] active:bg-[#4E6B52] text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Admin Portal</span>
              </>
            )}
          </button>

          <div className="pt-3 border-t border-[#DDE5DE] flex items-center justify-between text-xs text-[#68736B]">
            <span>Need access assistance?</span>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="font-semibold text-[#6B8F71] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Contact Super Admin</span>
            </button>
          </div>
        </form>

        {showHelp && (
          <div className="mt-4 p-3.5 rounded-[10px] bg-[#EAF4EE] border border-[#AAD2BA] text-xs text-[#2F7D4A] animate-fadeIn">
            <strong>Admin Account Info:</strong> Admin accounts are created and managed by the System Super Administrator. If you need credentials or your password reset, please contact your Super Admin.
          </div>
        )}
      </div>

      {/* Security Note Footer */}
      <div className="text-center text-[11px] text-[#68736B] mt-6 max-w-md">
        Protected by role-based cryptographic JWT authorization &bull; Google Business Profile Operations
      </div>
    </div>
  );
}
