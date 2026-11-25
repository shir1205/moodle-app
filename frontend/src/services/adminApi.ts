import { UserRole } from '../config/constants';
import { authFetch } from './apiClient';

export interface BackendUserRecord {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export async function fetchAllUsersFromApi(): Promise<BackendUserRecord[]> {
  const response = await authFetch('/admin/users');
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || 'שגיאה בטעינת רשימת המשתמשים מהשרת');
  }

  return data.users || [];
}

export async function updateUserRoleInApi(
  userId: string,
  role: UserRole
): Promise<BackendUserRecord> {
  const response = await authFetch(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || 'שגיאה בעדכון תפקיד המשתמש בשרת');
  }

  return data.user;
}