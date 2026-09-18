import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, AdminPermission, UserRole } from '../types';
import { adminApi, adminTokenStorage } from '../services/adminApi';

interface AdminAuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  hasPermission: (key: keyof AdminPermission) => boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    const token = adminTokenStorage.get();
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      const user = await adminApi.getProfile();
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        setCurrentUser(user);
      } else {
        adminTokenStorage.remove();
        setCurrentUser(null);
      }
    } catch {
      adminTokenStorage.remove();
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
      const data = await adminApi.login(credentials);
      setCurrentUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    adminTokenStorage.remove();
    setCurrentUser(null);
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const hasPermission = (key: keyof AdminPermission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN') return true;
    if (!currentUser.permissions) return false;
    return !!currentUser.permissions[key];
  };

  const isAuthenticated = !!currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN');

  return (
    <AdminAuthContext.Provider
      value={{
        currentUser,
        loading,
        isAuthenticated,
        isSuperAdmin,
        hasPermission,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
