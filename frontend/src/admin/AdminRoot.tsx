import React from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminLoginPage } from './components/AdminLoginPage';
import { AdminLayout } from './components/AdminLayout';

interface AdminRootProps {
  onBackToWebsite: () => void;
}

function AdminContent({ onBackToWebsite }: AdminRootProps) {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8F5] flex flex-col items-center justify-center font-sans selection:bg-[#AAD2BA] selection:text-[#1D1E18]">
        <div className="w-10 h-10 border-3 border-[#6B8F71] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#68736B]">Verifying Administrator Authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginPage onBackToWebsite={onBackToWebsite} />;
  }

  return <AdminLayout onBackToWebsite={onBackToWebsite} />;
}

export function AdminRoot({ onBackToWebsite }: AdminRootProps) {
  return (
    <AdminAuthProvider>
      <AdminContent onBackToWebsite={onBackToWebsite} />
    </AdminAuthProvider>
  );
}

export default AdminRoot;
