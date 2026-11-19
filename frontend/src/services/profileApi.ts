/**
 * סיפור 61 - צפייה בפרטים האישיים (צוות 1)
 * שליפת פרטי המשתמש המחובר מהשרת backend-core, עם ה-JWT מסיפור 67.
 */

import { authFetch, getAuthToken } from './apiClient';

export interface ServerProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  department: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

export type ProfileResult =
  | { status: 'ok'; profile: ServerProfile }
  | { status: 'no-session' }
  | { status: 'unauthorized'; message: string }
  | { status: 'error'; message: string };

export async function fetchMyProfile(): Promise<ProfileResult> {
  // משתמשי הדמו של אב-הטיפוס מתחברים בלי JWT - אצלם ממשיכים עם הנתונים המקומיים
  if (!getAuthToken()) return { status: 'no-session' };

  try {
    const response = await authFetch('/profile');
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.profile) return { status: 'ok', profile: data.profile };
    if (response.status === 401) {
      return { status: 'unauthorized', message: data.detail || 'פג תוקף ההתחברות, נא להתחבר מחדש' };
    }
    return { status: 'error', message: data.detail || 'לא הצלחנו לטעון את פרטי הפרופיל' };
  } catch {
    return { status: 'error', message: 'השרת לא זמין כרגע. נסו שוב בעוד רגע.' };
  }
}