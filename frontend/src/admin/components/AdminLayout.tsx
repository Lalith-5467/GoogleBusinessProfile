import React, { useState } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  Globe,
  FileSpreadsheet,
  TrendingUp,
  Settings,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminDashboardView } from '../views/AdminDashboardView';
import { AdminCustomerUsersView } from '../views/AdminCustomerUsersView';
import { AdminBusinessesView } from '../views/AdminBusinessesView';
import { AdminScraperView } from '../views/AdminScraperView';
import { AdminExportsView } from '../views/AdminExportsView';
import { AdminAnalyticsView } from '../views/AdminAnalyticsView';
import { AdminSettingsView } from '../views/AdminSettingsView';

interface AdminLayoutProps {
  onBackToWebsite: () => void;
}

export function AdminLayout({ onBackToWebsite }: AdminLayoutProps) {
  const { currentUser, isSuperAdmin, hasPermission, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const navItems = [
    {
      id: 'dashboard',
      label: 'Operations Overview',
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      id: 'businesses',
      label: 'Business Data',
      icon: Building2,
      allowed: isSuperAdmin || hasPermission('can_manage_businesses'),
    },
    {
      id: 'scrapers',
      label: 'Scraper Monitor',
      icon: Globe,
      allowed: isSuperAdmin || hasPermission('can_manage_scrapers'),
    },
    {
      id: 'exports',
      label: 'Data Exports',
      icon: FileSpreadsheet,
      allowed: isSuperAdmin || hasPermission('can_manage_exports'),
    },
    {
      id: 'customers',
      label: 'Customer Directory',
      icon: Users,
      allowed: isSuperAdmin || hasPermission('can_manage_users'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      allowed: isSuperAdmin || hasPermission('can_view_analytics'),
    },
    {
      id: 'settings',
      label: 'Account & Security',
      icon: Settings,
      allowed: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#1D1E18] flex flex-col font-sans selection:bg-[#AAD2BA] selection:text-[#1D1E18]">
      {/* Top Admin Navigation Header */}
      <header className="border-b border-[#DDE5DE] bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-3">
          {/* Brand & Admin Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] bg-[#6B8F71] flex items-center justify-center text-white font-extrabold text-sm sm:text-base shadow-sm shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm sm:text-base md:text-lg text-[#1D1E18] tracking-tight leading-tight truncate">
                  Admin Portal
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]">
                  {currentUser?.role?.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] text-[#68736B] font-mono hidden sm:block truncate">
                {currentUser?.email}
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onBackToWebsite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#1D1E18] bg-[#F6F8F5] hover:bg-[#EEF4F0] border border-[#DDE5DE] transition-colors cursor-pointer"
              title="Return to public customer website"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#68736B]" />
              <span className="hidden md:inline">Return to Website</span>
              <span className="inline md:hidden">Website</span>
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#C94A4A] bg-red-50 hover:bg-red-100 border border-[#C94A4A]/20 transition-colors cursor-pointer"
              title="Sign out of Admin Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="border-t border-[#DDE5DE] bg-[#F6F8F5]/50 overflow-x-auto">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center gap-1 py-1.5 min-w-max">
            {navItems
              .filter((item) => item.allowed)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#6B8F71] text-white shadow-xs'
                        : 'text-[#68736B] hover:text-[#1D1E18] hover:bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'dashboard' && <AdminDashboardView onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'businesses' && <AdminBusinessesView />}
        {activeTab === 'scrapers' && <AdminScraperView />}
        {activeTab === 'exports' && <AdminExportsView />}
        {activeTab === 'customers' && <AdminCustomerUsersView />}
        {activeTab === 'analytics' && <AdminAnalyticsView />}
        {activeTab === 'settings' && <AdminSettingsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DDE5DE] bg-white py-4 text-center text-xs text-[#68736B] px-4">
        Google Business Profile &bull; Operations Admin Portal &bull; Cryptographic RBAC & MySQL
      </footer>
    </div>
  );
}
