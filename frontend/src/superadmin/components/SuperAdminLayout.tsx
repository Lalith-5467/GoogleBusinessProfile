import React, { useState } from 'react';
import {
  Shield,
  LayoutDashboard,
  Users,
  Building2,
  Globe,
  FileSpreadsheet,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  ArrowLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { SuperAdminDashboardView } from '../views/SuperAdminDashboardView';
import { SuperAdminUsersView } from '../views/SuperAdminUsersView';
import { SuperAdminBusinessesView } from '../views/SuperAdminBusinessesView';
import { SuperAdminScraperView } from '../views/SuperAdminScraperView';
import { SuperAdminExportsView } from '../views/SuperAdminExportsView';
import { SuperAdminAnalyticsView } from '../views/SuperAdminAnalyticsView';
import { SuperAdminAuditLogsView } from '../views/SuperAdminAuditLogsView';
import { SuperAdminSettingsView } from '../views/SuperAdminSettingsView';

interface SuperAdminLayoutProps {
  onBackToWebsite: () => void;
}

export function SuperAdminLayout({ onBackToWebsite }: SuperAdminLayoutProps) {
  const { currentUser, isSuperAdmin, isViewOnlySuperAdmin, hasPermission, logout } = useSuperAdminAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const navItems = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      allowed: hasPermission('can_manage_users'),
    },
    {
      id: 'businesses',
      label: 'Business Data',
      icon: Building2,
      allowed: hasPermission('can_manage_businesses'),
    },
    {
      id: 'scrapers',
      label: 'Scraper Monitor',
      icon: Globe,
      allowed: hasPermission('can_manage_scrapers'),
    },
    {
      id: 'exports',
      label: 'Export History',
      icon: FileSpreadsheet,
      allowed: hasPermission('can_manage_exports'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      allowed: hasPermission('can_view_analytics'),
    },
    {
      id: 'audit_logs',
      label: 'Audit Trail',
      icon: FileText,
      allowed: isSuperAdmin || hasPermission('can_view_audit_logs'),
    },
    {
      id: 'settings',
      label: 'Security & Settings',
      icon: Settings,
      allowed: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F5] text-[#1D1E18] flex flex-col font-sans selection:bg-[#AAD2BA] selection:text-[#1D1E18]">
      {/* Top Admin Navigation Header */}
      <header className="border-b border-[#DDE5DE] bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-3">
          {/* Brand & Super Admin Badge */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] bg-[#6B8F71] flex items-center justify-center text-white font-heading font-extrabold text-sm sm:text-base shadow-sm shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm sm:text-base md:text-lg text-[#1D1E18] tracking-tight leading-tight truncate">
                  Super Admin Console
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                    isSuperAdmin
                      ? 'bg-[#EAF4EE] text-[#2F7D4A] border border-[#AAD2BA]'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {currentUser?.role === 'SUPER_ADMIN'
                    ? isViewOnlySuperAdmin
                      ? 'SUB SUPER ADMIN'
                      : 'SUPER ADMIN'
                    : currentUser?.role?.replace('_', ' ')}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#1D1E18] bg-[#F6F8F5] hover:bg-[#EEF4F0] border border-[#DDE5DE] transition-colors"
              title="Return to public customer website"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#68736B]" />
              <span className="hidden md:inline">Return to Website</span>
              <span className="inline md:hidden">Website</span>
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#C94A4A] bg-red-50 hover:bg-red-100 border border-[#C94A4A]/20 transition-colors"
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-heading font-semibold transition-all ${
                      isActive
                        ? 'bg-[#6B8F71] text-white shadow-sm'
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
        {activeTab === 'dashboard' && <SuperAdminDashboardView onNavigateTab={(tab) => setActiveTab(tab)} />}
        {activeTab === 'users' && <SuperAdminUsersView />}
        {activeTab === 'businesses' && <SuperAdminBusinessesView />}
        {activeTab === 'scrapers' && <SuperAdminScraperView />}
        {activeTab === 'exports' && <SuperAdminExportsView />}
        {activeTab === 'analytics' && <SuperAdminAnalyticsView />}
        {activeTab === 'audit_logs' && <SuperAdminAuditLogsView />}
        {activeTab === 'settings' && <SuperAdminSettingsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DDE5DE] bg-white py-4 text-center text-xs text-[#68736B] px-4">
        Google Business Profile &bull; Enterprise Super Admin System &bull; Cryptographic RBAC & MySQL
      </footer>
    </div>
  );
}
