/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CampuScope Global System Constants and Configuration
 * All limits, timings, thresholds, and role definitions are consolidated here to avoid magic numbers.
 */

export const APP_CONFIG = {
  APP_NAME: 'CampuScope',
  APP_SUBTITLE: 'מערכת ניהול למידה אקדמית מתקדמת',
  VERSION: '2.4.0',
  ACADEMIC_YEAR: 'תשפ״ו (2026)',
} as const;

export const ROLES = {
  STUDENT: 'student',
  LECTURER: 'lecturer',
  TA: 'ta',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.STUDENT]: 'סטודנט',
  [ROLES.LECTURER]: 'מרצה',
  [ROLES.TA]: 'מתרגל (TA)',
  [ROLES.ADMIN]: 'מנהל מערכת',
};

export const ROLE_LANDING_ROUTES: Record<UserRole, string> = {
  [ROLES.STUDENT]: '/courses',
  [ROLES.LECTURER]: '/courses',
  [ROLES.TA]: '/courses',
  [ROLES.ADMIN]: '/admin/users',
};

export const AUTO_VERIFY_IN_DEMO = false;

export const AUTH_LIMITS = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_LETTER: true,
  PASSWORD_REQUIRE_NUMBER: true,
  TOTP_ROTATION_SECONDS: 30,
  TOTP_CODE_LENGTH: 6,
  TOTP_BACKUP_CODES_COUNT: 8,
  TOTP_BACKUP_CODE_LENGTH: 8,
  TWO_FACTOR_EMAIL_CODE_VALIDITY_SECONDS: 300,
  TEMP_PASSWORD_LENGTH: 10,
  AUTO_VERIFY_IN_DEMO,
} as const;

export const ACADEMIC_THRESHOLDS = {
  DEFAULT_PASSING_GRADE: 60,
  EXCELLENCE_GRADE_THRESHOLD: 85,
  AT_RISK_GRADE_THRESHOLD_DEFAULT: 60,
  AT_RISK_MISSED_ASSIGNMENTS_THRESHOLD_DEFAULT: 2,
  MAX_GRADE_DEFAULT: 100,
  MAX_GRADE_MIN_ALLOWED: 10,
  MAX_GRADE_MAX_ALLOWED: 100,
} as const;

export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE_MB: 25,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  ALLOWED_MATERIAL_EXTENSIONS: ['.pdf', '.docx', '.pptx'] as const,
  ALLOWED_MATERIAL_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ] as const,
  ALLOWED_ASSIGNMENT_SUBMISSION_EXTENSIONS: [
    '.pdf',
    '.zip',
    '.py',
    '.java',
    '.cpp',
    '.sql',
  ] as const,
  UPLOAD_SIMULATION_STEP_DELAY_MS: 120,
  UPLOAD_SIMULATION_STEPS: 8,
} as const;

export const AI_CONFIG = {
  DEFAULT_PRACTICE_QUESTIONS_COUNT: 5,
  MIN_PRACTICE_QUESTIONS: 3,
  MAX_PRACTICE_QUESTIONS: 10,
  MAX_SUMMARY_INPUT_CHARS: 8000,
  BUSY_FALLBACK_MESSAGE: 'שירות ה-AI עמוס כרגע, ניתן לצפות בנתוני הגרפים ולנסות שוב בעוד מספר דקות',
  DISCLAIMER_TEXT: 'משוב אוטומטי לצורכי למידה בלבד ואינו מהווה ציון רשמי או תחליף לבדיקת המתרגל.',
  SIMULATED_RESPONSE_LATENCY_MS: 950,
} as const;

export const NOTIFICATION_CONFIG = {
  DEFAULT_AUTO_DISMISS_TOAST_MS: 4000,
  SIMULATED_EMAIL_SUCCESS_RATE_PERCENT: 96.5,
  POLLING_INTERVAL_MS: 30000,
} as const;

export const ANALYTICS_TARGETS = {
  TARGET_PAGE_LOAD_MAX_MS: 2000,
  SIMULATED_AGGREGATION_LATENCY_MS: 140,
  HISTOGRAM_BINS: [
    { label: '0-59', min: 0, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ] as const,
} as const;

export const UI_TIMINGS = {
  TRANSITION_FAST_MS: 150,
  TRANSITION_NORMAL_MS: 250,
  COUNTDOWN_TICK_INTERVAL_MS: 1000,
} as const;

export const THEME_COLORS = {
  PRIMARY: '#4F46E5',
  SECONDARY: '#14B8A6',
  ACCENT: '#FB7185',
  GOLD: '#F59E0B',
  BACKGROUND: '#F8FAFC',
  SUCCESS: '#22C55E',
  WARNING: '#EAB308',
  DANGER: '#EF4444',
} as const;
