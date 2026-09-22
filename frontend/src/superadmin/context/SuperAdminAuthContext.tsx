import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, AdminPermission } from '../types';
import { superAdminApi, superAdminTokenStorage } from '../services/superAdminApi';

interface SuperAdminAuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isOriginalSuperAdmin: boolean;
  isViewOnlySuperAdmin: boolean;
  hasPermission: (key: keyof AdminPermission) => boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    const token = superAdminTokenStorage.get();
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      const user = await superAdminApi.getProfile();
      if (user.role === 'SUPER_ADMIN') {
        setCurrentUser(user);
      } else {
        superAdminTokenStorage.remove();
        setCurrentUser(null);
      }
    } catch {
      superAdminTokenStorage.remove();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      const data = await superAdminApi.login(credentials);
      setCurrentUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    superAdminTokenStorage.remove();
    setCurrentUser(null);
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOriginalSuperAdmin = !!currentUser?.is_original_super_admin;
  const isViewOnlySuperAdmin = currentUser?.role === 'SUPER_ADMIN' && !currentUser?.is_original_super_admin;

  const hasPermission = (key: keyof AdminPermission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (!currentUser.permissions) return false;
    return !!currentUser.permissions[key];
  };

  const isAuthenticated = !!currentUser && currentUser.role === 'SUPER_ADMIN';

  return (
    <SuperAdminAuthContext.Provider
      value={{
        currentUser,
        loading,
        isAuthenticated,
        isSuperAdmin,
        isOriginalSuperAdmin,
        isViewOnlySuperAdmin,
        hasPermission,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
}

export function useSuperAdminAuth(): SuperAdminAuthContextType {
  const context = useContext(SuperAdminAuthContext);
  if (!context) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  }
  return context;
}
