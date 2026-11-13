/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LocalStorage wrapper with fallback and JSON parsing
 */

const STORAGE_KEYS = {
  USERS: 'campuscope_users',
  CURRENT_USER: 'campuscope_current_user',
  COURSES: 'campuscope_courses',
  ASSIGNMENTS: 'campuscope_assignments',
  SUBMISSIONS: 'campuscope_submissions',
  NOTIFICATIONS: 'campuscope_notifications',
  PREFERENCES: 'campuscope_preferences',
  AUDIT_LOGS: 'campuscope_audit_logs',
  SYSTEM_SETTINGS: 'campuscope_system_settings',
  MOCK_INBOX: 'campuscope_mock_inbox',
  THEME_MODE: 'campuscope_theme_mode',
  PENDING_2FA_EMAIL_CODES: 'campuscope_pending_2fa_email_codes',
} as const;

export class StorageService {
  static get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove error:', e);
    }
  }

  static clearAll(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
  }

  static keys = STORAGE_KEYS;
}
