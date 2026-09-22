import React from 'react';
import { SuperAdminAuthProvider, useSuperAdminAuth } from './context/SuperAdminAuthContext';
import { SuperAdminLoginPage } from './components/SuperAdminLoginPage';
import { SuperAdminLayout } from './components/SuperAdminLayout';

interface SuperAdminRootProps {
  onBackToWebsite: () => void;
}

function SuperAdminContent({ onBackToWebsite }: SuperAdminRootProps) {
  const { isAuthenticated, loading } = useSuperAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8F5] flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-3 border-[#6B8F71] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#68736B]">Verifying Super Admin Authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SuperAdminLoginPage onBackToWebsite={onBackToWebsite} />;
  }

  return <SuperAdminLayout onBackToWebsite={onBackToWebsite} />;
}

export function SuperAdminRoot({ onBackToWebsite }: SuperAdminRootProps) {
  return (
    <SuperAdminAuthProvider>
      <SuperAdminContent onBackToWebsite={onBackToWebsite} />
    </SuperAdminAuthProvider>
  );
}

export default SuperAdminRoot;
