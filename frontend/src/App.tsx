import React, { useState, useEffect } from 'react';
import { Building2, Globe, Shield, ShieldCheck } from 'lucide-react';
import { GoogleBusinessView } from './components/GoogleBusinessView';
import { WebsiteScraperView } from './components/WebsiteScraperView';
import { API_CONFIG } from './config/api.config';
import { ToastProvider } from './context';
import { SuperAdminRoot } from './superadmin/SuperAdminRoot';
import { AdminRoot } from './admin/AdminRoot';

export function App() {
  const [activeTab, setActiveTab] = useState<'google' | 'scraper'>('google');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Check URL pathname, hash, or search params for Super Admin (/superadmin, /super-admin)
  const getIsSuperAdminRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith('/superadmin') ||
      path.startsWith('/super-admin') ||
      path.startsWith('/super_admin') ||
      hash.startsWith('#superadmin') ||
      hash.startsWith('#super-admin') ||
      hash.startsWith('#super_admin') ||
      search.includes('view=superadmin') ||
      search.includes('view=super-admin') ||
      search.includes('view=super_admin')
    );
  };

  // Check URL pathname, hash, or search params for Operations Admin (/admin)
  const getIsAdminRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();

    // If it's a Super Admin route, it takes precedence
    if (getIsSuperAdminRoute()) return false;

    return (
      path.startsWith('/admin') ||
      hash.startsWith('#admin') ||
      search.includes('view=admin')
    );
  };

  const [isSuperAdminMode, setIsSuperAdminMode] = useState<boolean>(getIsSuperAdminRoute);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(getIsAdminRoute);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsSuperAdminMode(getIsSuperAdminRoute());
      setIsAdminMode(getIsAdminRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateToSuperAdmin = () => {
    window.history.pushState({}, '', '/superadmin');
    setIsSuperAdminMode(true);
    setIsAdminMode(false);
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setIsAdminMode(true);
    setIsSuperAdminMode(false);
  };

  const navigateToWebsite = () => {
    try {
      sessionStorage.removeItem('gbp_admin_access_token');
      localStorage.removeItem('gbp_admin_access_token');
    } catch {}
    window.history.pushState({}, '', '/');
    setIsSuperAdminMode(false);
    setIsAdminMode(false);
  };

  useEffect(() => {
    if (isSuperAdminMode) {
      document.title = 'Super Admin Console | Google Business Profile';
    } else if (isAdminMode) {
      document.title = 'Admin Portal | Operations Console';
    } else {
      document.title = 'Google Business Profile Management & Scraper';
    }
  }, [isSuperAdminMode, isAdminMode]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthUrl = API_CONFIG.BASE_URL ? `${API_CONFIG.BASE_URL}${API_CONFIG.HEALTH}` : API_CONFIG.HEALTH;
        const res = await fetch(healthUrl);
        if (res.ok) {
          const data = await res.json();
          setBackendOnline(data.status === 'healthy');
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // 1. If in Super Admin Mode, render the isolated Super Admin Master System
  if (isSuperAdminMode) {
    return (
      <ToastProvider>
        <SuperAdminRoot onBackToWebsite={navigateToWebsite} />
      </ToastProvider>
    );
  }

  // 2. If in Admin Mode, render the dedicated Operations Admin Portal
  if (isAdminMode) {
    return (
      <ToastProvider>
        <AdminRoot onBackToWebsite={navigateToWebsite} />
      </ToastProvider>
    );
  }

  // 3. Otherwise, render the exact 100% untouched customer application
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F6F8F5] text-[#1D1E18] flex flex-col font-sans selection:bg-[#AAD2BA] selection:text-[#1D1E18]">
        {/* Top Header Navigation */}
        <header className="border-b border-[#DDE5DE] bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-sm">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] bg-[#6B8F71] flex items-center justify-center text-white font-heading font-extrabold text-sm sm:text-base shadow-sm shrink-0">
                G
              </div>
              <div className="min-w-0">
                <div className="font-heading font-bold text-sm sm:text-base md:text-lg text-[#1D1E18] tracking-tight leading-tight truncate">
                  Google Business Profile
                </div>
                <div className="text-[11px] text-[#68736B] font-medium hidden sm:block truncate">
                  Nearby Business Search &bull; Data Management &bull; Excel Export
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center bg-[#F6F8F5] p-1 rounded-[10px] border border-[#DDE5DE] shrink-0">
              <button
                onClick={() => setActiveTab('google')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-[#6B8F71] text-white shadow-sm'
                    : 'text-[#68736B] hover:text-[#1D1E18] hover:bg-white/70'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Business Profiles</span>
                <span className="inline sm:hidden">Profiles</span>
              </button>

              <button
                onClick={() => setActiveTab('scraper')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all cursor-pointer ${
                  activeTab === 'scraper'
                    ? 'bg-[#6B8F71] text-white shadow-sm'
                    : 'text-[#68736B] hover:text-[#1D1E18] hover:bg-white/70'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Website Scraper</span>
                <span className="inline sm:hidden">Scraper</span>
              </button>
            </nav>

            {/* Right Group: Backend Status Indicator, Admin Portal & Super Admin Access */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
              <div className="hidden md:flex items-center gap-2">
                {backendOnline === true ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF4EE] border border-[#AAD2BA] text-[#2F7D4A] font-mono text-[11px] font-medium" title="Backend connected">
                    <span className="w-2 h-2 rounded-full bg-[#2F7D4A] animate-pulse"></span>
                    FastAPI: <span className="font-semibold text-[#1D1E18]">Connected</span>
                  </span>
                ) : backendOnline === false ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-[#C94A4A]/30 text-[#C94A4A] font-mono text-[11px] font-medium" title="FastAPI backend is offline. Run scripts/start-backend.bat">
                    <span className="w-2 h-2 rounded-full bg-[#C94A4A]"></span>
                    FastAPI: <span className="font-semibold text-[#C94A4A]">Offline</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6F8F5] border border-[#DDE5DE] text-[#68736B] font-mono text-[11px] font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#68736B] animate-pulse"></span>
                    FastAPI: <span className="font-semibold text-[#68736B]">Checking...</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {activeTab === 'google' ? (
            <GoogleBusinessView />
          ) : (
            <WebsiteScraperView />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#DDE5DE] bg-white py-4 sm:py-5 text-xs text-[#68736B] px-4">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div>
              Google Business Profile Management &bull; Excel Export &bull; Python FastAPI & MySQL
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={navigateToAdmin}
                className="text-[11px] text-[#64748B] hover:text-[#3B82F6] transition-colors inline-flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-[#3B82F6]" />
                <span>Admin Portal</span>
              </button>
              <span className="text-[#DDE5DE]">&bull;</span>
              <button
                onClick={navigateToSuperAdmin}
                className="text-[11px] text-[#68736B] hover:text-[#6B8F71] transition-colors inline-flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Shield className="w-3 h-3 text-[#6B8F71]" />
                <span>Super Admin Console</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

export default App;

