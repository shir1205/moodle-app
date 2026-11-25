import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../config/constants';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * מציג רכיבי ממשק (כפתורים, פעולות ניהול) רק למשתמשים בעלי תפקיד מורשה
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback = null,
}) => {
  const { currentUser, role } = useAuth();

  if (!currentUser || !role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};