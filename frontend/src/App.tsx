import React, { useState } from 'react';
import { Building2, Globe } from 'lucide-react';
import { GoogleBusinessView } from './components/GoogleBusinessView';
import { WebsiteScraperView } from './components/WebsiteScraperView';
import { API_CONFIG } from './config/api.config';

export function App() {
  const [activeTab, setActiveTab] = useState<'google' | 'scraper'>('google');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  React.useEffect(() => {
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

  return (
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
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all ${
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
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all ${
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

          {/* Backend Status Indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0">
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
      <footer className="border-t border-[#DDE5DE] bg-white py-4 sm:py-5 text-center text-xs text-[#68736B] px-4">
        Google Business Profile Management &bull; Excel Export &bull; Python FastAPI & MySQL
      </footer>
    </div>
  );
}

export default App;
