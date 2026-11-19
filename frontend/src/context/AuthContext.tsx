/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { UserRole } from '../config/constants';
import { AuthService } from '../services/authService';
import { NotificationService } from '../services/notificationService';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  role: UserRole | null;
  unreadCount: number;
  login: (email: string, pass: string) => ReturnType<typeof AuthService.login>;
  loginWithBackendUser: (backendUser: { id: string; email: string; full_name?: string; role: string }) => void;
  logout: () => void;
  switchUser: (userId: string) => User | null;
  updateProfile: (data: { name?: string; department?: string; avatarUrl?: string }) => boolean;
  changePassword: (currentPass: string, newPass: string) => { success: boolean; error?: string };
  refreshUsers: () => void;
  refreshUnreadCount: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  allUsers: [],
  role: null,
  unreadCount: 0,
  login: () => ({ success: false }),
  loginWithBackendUser: () => {},
  logout: () => {},
  switchUser: () => null,
  updateProfile: () => false,
  changePassword: () => ({ success: false, error: 'לא מחובר' }),
  refreshUsers: () => {},
  refreshUnreadCount: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => AuthService.getCurrentUser());
  const [allUsers, setAllUsers] = useState<User[]>(() => AuthService.getUsers());
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshUsers = useCallback(() => {
    setAllUsers(AuthService.getUsers());
    setCurrentUser(AuthService.getCurrentUser());
  }, []);

  const refreshUnreadCount = useCallback(() => {
    if (currentUser) {
      setUnreadCount(NotificationService.getUnreadCount(currentUser.id));
    } else {
      setUnreadCount(0);
    }
  }, [currentUser]);

useEffect(() => {
    refreshUnreadCount();
    if (!currentUser) return;

    let isMounted = true;
    const syncFromBackend = () => {
      NotificationService.fetchNotifications(currentUser.id).then((fetched) => {
        if (isMounted) {
          setUnreadCount(fetched.filter((n) => !n.isRead).length);
        }
      });
    };

    syncFromBackend();
    const interval = setInterval(syncFromBackend, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser, refreshUnreadCount]);

  const login = (email: string, pass: string) => {
    const result = AuthService.login(email, pass);
    if (result.success && result.user && !result.requires2FA) {
      setCurrentUser(result.user);
      refreshUsers();
      refreshUnreadCount();
    }
    return result;
  };
  const loginWithBackendUser = (backendUser: { id: string; email: string; full_name?: string; role: string }) => {
  const mappedUser: User = {
    id: backendUser.id,
    name: backendUser.full_name || backendUser.email.split('@')[0],
    email: backendUser.email,
    role: (backendUser.role as UserRole) || 'student',
    department: 'מדעי המחשב',
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(backendUser.full_name || backendUser.email)}`,
    isVerified: true,
    twoFactorEnabled: false,
    hasSetupTwoFactor: false,
    registeredAt: new Date().toISOString(),
    assignedCourseIds: ['course-1', 'course-2'],
    status: 'active',
  };
  AuthService.setCurrentUser(mappedUser);
  setCurrentUser(mappedUser);
  refreshUsers();
  refreshUnreadCount();
};

  const logout = () => {
    AuthService.logout();
    setCurrentUser(null);
    setUnreadCount(0);
  };

  const switchUser = (userId: string) => {
    const user = AuthService.switchUserQuick(userId);
    if (user) {
      setCurrentUser(user);
      refreshUsers();
      refreshUnreadCount();
    }
    return user;
  };

  const updateProfile = (data: { name?: string; department?: string; avatarUrl?: string }) => {
    if (!currentUser) return false;
    const ok = AuthService.updateProfile(currentUser.id, data);
    if (ok) {
      refreshUsers();
    }
    return ok;
  };

  const changePassword = (currentPass: string, newPass: string) => {
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const res = AuthService.changePassword(currentUser.id, currentPass, newPass);
    if (res.success) {
      refreshUsers();
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        role: currentUser ? currentUser.role : null,
        unreadCount,
        login,
        loginWithBackendUser,
        logout,
        switchUser,
        updateProfile,
        changePassword,
        refreshUsers,
        refreshUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
