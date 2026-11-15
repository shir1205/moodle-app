/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AuthService for CampuScope
 * Handles authentication, registration, email verification, TOTP 2FA for lecturers,
 * backup codes, user management RBAC, and audit logs.
 */

import { User, AuditLogEntry } from '../types';
import { StorageService } from './storage';
import { SEED_USERS, SEED_AUDIT_LOGS } from '../data/seedData';
import { AUTH_LIMITS, ROLES, UserRole } from '../config/constants';

export interface VerificationToken {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
}

export class AuthService {
  private static init(): void {
    if (!localStorage.getItem(StorageService.keys.USERS)) {
      StorageService.set(StorageService.keys.USERS, SEED_USERS);
    } else {
      let currentUsers = StorageService.get<User[]>(StorageService.keys.USERS, []);
      let updated = false;

      // Remove temporary user-lecturer-new if it was stored
      if (currentUsers.some((u) => u.id === 'user-lecturer-new')) {
        currentUsers = currentUsers.filter((u) => u.id !== 'user-lecturer-new');
        updated = true;
      }

      // Ensure seed user-ta-1 is present
      if (!currentUsers.some((u) => u.id === 'user-ta-1')) {
        const taUser = SEED_USERS.find((u) => u.id === 'user-ta-1');
        if (taUser) {
          currentUsers.push(taUser);
          updated = true;
        }
      }

      // Ensure all users have password and default password123
      currentUsers.forEach((u) => {
        if (!u.password) {
          u.password = 'password123';
          updated = true;
        }
      });

      if (updated) {
        StorageService.set(StorageService.keys.USERS, currentUsers);
      }
    }
    if (!localStorage.getItem(StorageService.keys.AUDIT_LOGS)) {
      StorageService.set(StorageService.keys.AUDIT_LOGS, SEED_AUDIT_LOGS);
    }
    if (!localStorage.getItem(StorageService.keys.CURRENT_USER)) {
      // Default to student Dana Cohen for frictionless exploration
      const users = StorageService.get<User[]>(StorageService.keys.USERS, SEED_USERS);
      const defaultUser = users.find((u) => u.id === 'user-student-1') || users[0];
      StorageService.set(StorageService.keys.CURRENT_USER, defaultUser);
    }
  }

  static getUsers(): User[] {
    this.init();
    return StorageService.get<User[]>(StorageService.keys.USERS, SEED_USERS);
  }

  static getCurrentUser(): User | null {
    this.init();
    return StorageService.get<User | null>(StorageService.keys.CURRENT_USER, null);
  }

  static setCurrentUser(user: User | null): void {
    StorageService.set(StorageService.keys.CURRENT_USER, user);
  }

  static validatePassword(password: string): {
    isValid: boolean;
    hasMinLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
    strengthPercent: number;
    errorMessage?: string;
  } {
    const hasMinLength = password.length >= AUTH_LIMITS.PASSWORD_MIN_LENGTH;
    const hasLetter = /[a-zA-Z\u0590-\u05FF]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    let score = 0;
    if (hasMinLength) score += 40;
    if (hasLetter) score += 30;
    if (hasNumber) score += 30;

    let errorMessage = '';
    if (!hasMinLength) {
      errorMessage = `הסיסמה חייבת להכיל לפחות ${AUTH_LIMITS.PASSWORD_MIN_LENGTH} תווים`;
    } else if (!hasLetter || !hasNumber) {
      errorMessage = 'הסיסמה חייבת לכלול לפחות אות אחת ומספר אחד';
    }

    const isValid = hasMinLength && hasLetter && hasNumber;
    return {
      isValid,
      hasMinLength,
      hasLetter,
      hasNumber,
      strengthPercent: score,
      errorMessage: isValid ? undefined : errorMessage,
    };
  }

  static register(params: {
    name: string;
    email: string;
    department: string;
    password: string;
  }): { success: boolean; user?: User; verificationToken?: string; error?: string } {
    this.init();
    const users = this.getUsers();

    if (users.some((u) => u.email.toLowerCase() === params.email.toLowerCase())) {
      return { success: false, error: 'כתובת אימייל זו כבר קיימת במערכת' };
    }

    const passCheck = this.validatePassword(params.password);
    if (!passCheck.isValid) {
      return { success: false, error: passCheck.errorMessage };
    }

    const isAutoVerified = Boolean(AUTH_LIMITS.AUTO_VERIFY_IN_DEMO);
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: params.name,
      email: params.email,
      role: ROLES.STUDENT, // Every new user starts as Student
      department: params.department || 'מדעי המחשב',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(params.name)}`,
      isVerified: isAutoVerified,
      twoFactorEnabled: false,
      hasSetupTwoFactor: false,
      registeredAt: new Date().toISOString(),
      assignedCourseIds: ['course-1', 'course-2'],
      status: 'active',
      password: params.password,
    };

    users.push(newUser);
    StorageService.set(StorageService.keys.USERS, users);

    // Create verification token & mock email
    const verificationToken = `verify-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const inbox = StorageService.get<Array<any>>(StorageService.keys.MOCK_INBOX, []);
    inbox.unshift({
      id: `verify-email-${Date.now()}`,
      toUserId: newUser.id,
      toEmail: newUser.email,
      subject: 'אימות כתובת אימייל ב-CampuScope',
      body: `שלום ${newUser.name},\nברוך/ה הבא/ה ל-CampuScope. לחץ/י על הקישור להשלמת אימות החשבון:\n/verify?token=${verificationToken}&userId=${newUser.id}`,
      verificationToken,
      userId: newUser.id,
      sentAt: new Date().toISOString(),
    });
    StorageService.set(StorageService.keys.MOCK_INBOX, inbox);

    return { success: true, user: newUser, verificationToken };
  }

  static verifyEmail(userIdOrToken: string): boolean {
    this.init();
    const users = this.getUsers();
    let userIndex = users.findIndex((u) => u.id === userIdOrToken);

    // Check if token was provided instead of userId
    if (userIndex === -1) {
      const inbox = StorageService.get<Array<any>>(StorageService.keys.MOCK_INBOX, []);
      const matchingEmail = inbox.find(
        (e) => e.verificationToken === userIdOrToken || e.userId === userIdOrToken
      );
      if (matchingEmail && matchingEmail.userId) {
        userIndex = users.findIndex((u) => u.id === matchingEmail.userId);
      }
    }

    if (userIndex === -1) return false;

    users[userIndex].isVerified = true;
    StorageService.set(StorageService.keys.USERS, users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === users[userIndex].id) {
      currentUser.isVerified = true;
      this.setCurrentUser(currentUser);
    }
    return true;
  }

  static resendVerificationEmail(email: string): { success: boolean; error?: string } {
    this.init();
    const users = this.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, error: 'כתובת האימייל לא נמצאה במערכת' };
    }

    if (user.isVerified) {
      return { success: false, error: 'חשבון זה כבר מאומת במערכת' };
    }

    const verificationToken = `verify-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const inbox = StorageService.get<Array<any>>(StorageService.keys.MOCK_INBOX, []);
    inbox.unshift({
      id: `verify-email-${Date.now()}`,
      toUserId: user.id,
      toEmail: user.email,
      subject: 'אימות כתובת אימייל ב-CampuScope (שליחה חוזרת)',
      body: `שלום ${user.name},\nלבקשתך, נשלח קישור אימות חדש עבור חשבונך ב-CampuScope:\n/verify?token=${verificationToken}&userId=${user.id}`,
      verificationToken,
      userId: user.id,
      sentAt: new Date().toISOString(),
    });
    StorageService.set(StorageService.keys.MOCK_INBOX, inbox);

    return { success: true };
  }

  static login(email: string, password: string): {
    success: boolean;
    user?: User;
    requires2FA?: boolean;
    requiresFirstTime2FASetup?: boolean;
    isUnverified?: boolean;
    unverifiedEmail?: string;
    error?: string;
  } {
    this.init();
    const users = this.getUsers();
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() ||
        (u.id === 'user-ta-1' &&
          (email.toLowerCase() === 'ta@campuscope.ac.il' ||
            email.toLowerCase() === 'itai.ta@campuscope.ac.il' ||
            email.toLowerCase() === 'ta@campus.ac.il'))
    );

    if (!user) {
      return { success: false, error: 'הקוד שגוי, נסי שוב' };
    }

    if (!user.isVerified) {
      return {
        success: false,
        isUnverified: true,
        unverifiedEmail: user.email,
        error: 'החשבון טרם אומת. נא לבדוק את תיבת הדוא״ל וללחוץ על קישור האימות.',
      };
    }

    // Password verification against saved password or default demo password
    const expectedPassword = user.password || 'password123';
    if (password !== expectedPassword) {
      return { success: false, error: 'הקוד שגוי, נסי שוב' };
    }

    // Lecturer 2FA logic:
    // First login vs returning login decided by account state: twoFactorEnabled
    if (user.role === ROLES.LECTURER) {
      // Fix 4: send 2FA email code to mock inbox on lecturer login attempt
      this.sendTwoFactorEmailCode(user.id);
      if (!user.twoFactorEnabled) {
        return { success: true, user, requires2FA: true, requiresFirstTime2FASetup: true };
      }
      return { success: true, user, requires2FA: true, requiresFirstTime2FASetup: false };
    }

    // Students, TA, and Admin do not require 2FA
    this.setCurrentUser(user);
    return { success: true, user, requires2FA: false };
  }

  static sendTwoFactorEmailCode(userId: string): { code: string; expiresAt: number } {
    this.init();
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);

    // Generate 6-digit verification code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + AUTH_LIMITS.TWO_FACTOR_EMAIL_CODE_VALIDITY_SECONDS * 1000;

    const pendingMap = StorageService.get<Record<string, { code: string; expiresAt: number }>>(
      StorageService.keys.PENDING_2FA_EMAIL_CODES,
      {}
    );
    pendingMap[userId] = { code, expiresAt };
    StorageService.set(StorageService.keys.PENDING_2FA_EMAIL_CODES, pendingMap);

    if (user) {
      const inbox = StorageService.get<Array<any>>(StorageService.keys.MOCK_INBOX, []);
      inbox.unshift({
        id: `2fa-email-${Date.now()}`,
        toUserId: user.id,
        toEmail: user.email,
        subject: 'קוד אימות דו-שלבי',
        body: `שלום ${user.name},\nקוד האימות הדו-שלבי שלך עבור כניסה למערכת CampuScope הוא:\n\n${code}\n\nהקוד תקף למשך ${Math.floor(
          AUTH_LIMITS.TWO_FACTOR_EMAIL_CODE_VALIDITY_SECONDS / 60
        )} דקות.\nניתן להזין קוד זה או את הקוד מאפליקציית האימות.`,
        code,
        userId: user.id,
        sentAt: new Date().toISOString(),
      });
      StorageService.set(StorageService.keys.MOCK_INBOX, inbox);
    }

    return { code, expiresAt };
  }

  static forgotPassword(email: string): { success: boolean; message: string } {
    this.init();
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    const userIndex = users.findIndex(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        (u.id === 'user-ta-1' &&
          (cleanEmail === 'ta@campuscope.ac.il' ||
            cleanEmail === 'itai.ta@campuscope.ac.il' ||
            cleanEmail === 'ta@campus.ac.il'))
    );

    const neutralMessage = 'אם הכתובת קיימת במערכת, נשלחה אליה סיסמה זמנית';

    if (userIndex === -1) {
      return { success: true, message: neutralMessage };
    }

    const user = users[userIndex];
    // Generate temporary password meeting requirements: min 8 chars, letter + number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const randomLetters = Math.random().toString(36).substring(2, 6).toUpperCase();
    const tempPassword = `Camp${randomLetters}${randomNum}`;

    // Update user password in the data layer
    user.password = tempPassword;
    users[userIndex] = user;
    StorageService.set(StorageService.keys.USERS, users);

    // Send email to mock inbox
    const inbox = StorageService.get<Array<any>>(StorageService.keys.MOCK_INBOX, []);
    inbox.unshift({
      id: `pw-reset-${Date.now()}`,
      toUserId: user.id,
      toEmail: user.email,
      subject: 'קיבלת סיסמה זמנית חדשה',
      body: `שלום ${user.name},\nלבקשתך, הופקה עבורך סיסמה זמנית חדשה לכניסה למערכת CampuScope:\n\nסיסמה זמנית: ${tempPassword}\n\nנא להתחבר באמצעות סיסמה זו ולהחליפה לסיסמה אישית קבועה במסך "הפרופיל שלי".`,
      tempPassword,
      userId: user.id,
      sentAt: new Date().toISOString(),
    });
    StorageService.set(StorageService.keys.MOCK_INBOX, inbox);

    // Record audit log entry without storing the password in the log
    const auditLogs = StorageService.get<AuditLogEntry[]>(StorageService.keys.AUDIT_LOGS, []);
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      performedByUserId: user.id,
      performedByUserName: user.name,
      targetUserId: user.id,
      targetUserName: user.name,
      action: 'PASSWORD_RESET_REQUESTED',
      details: 'שחזור סיסמה (password reset requested)',
      timestamp: new Date().toISOString(),
    });
    StorageService.set(StorageService.keys.AUDIT_LOGS, auditLogs);

    return { success: true, message: neutralMessage };
  }

  static generateCurrentTotp(secret = 'CAMPUSCOPE_KEY'): { code: string; secondsRemaining: number } {
    // Generate deterministic 6-digit TOTP code that rotates every 30 seconds
    const now = Math.floor(Date.now() / 1000);
    const timeStep = AUTH_LIMITS.TOTP_ROTATION_SECONDS;
    const epochStep = Math.floor(now / timeStep);
    const secondsRemaining = timeStep - (now % timeStep);

    // Simple pseudo-random hash based on epochStep
    let hash = 0;
    const seedStr = `${secret}_${epochStep}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    const code = String(positiveHash % 1000000).padStart(6, '0');
    return { code, secondsRemaining };
  }

  static verifyTotp(inputCode: string, userIdOrSecret?: string): boolean {
    const trimmed = inputCode.trim();
    if (!trimmed) return false;

    // 1. Check rotating TOTP simulator and demo static code
    const { code } = this.generateCurrentTotp('CAMPUSCOPE_KEY');
    const now = Math.floor(Date.now() / 1000);
    const prevEpochStep = Math.floor(now / AUTH_LIMITS.TOTP_ROTATION_SECONDS) - 1;
    let prevHash = 0;
    const prevSeed = `CAMPUSCOPE_KEY_${prevEpochStep}`;
    for (let i = 0; i < prevSeed.length; i++) {
      prevHash = (prevHash << 5) - prevHash + prevSeed.charCodeAt(i);
      prevHash |= 0;
    }
    const prevCode = String(Math.abs(prevHash) % 1000000).padStart(6, '0');

    if (trimmed === code || trimmed === prevCode || trimmed === '123456') {
      return true;
    }

    // 2. Check pending 2FA code sent via email to mock inbox
    const pendingMap = StorageService.get<Record<string, { code: string; expiresAt: number }>>(
      StorageService.keys.PENDING_2FA_EMAIL_CODES,
      {}
    );

    const nowMs = Date.now();
    if (userIdOrSecret && pendingMap[userIdOrSecret]) {
      const entry = pendingMap[userIdOrSecret];
      if (entry.code === trimmed && nowMs <= entry.expiresAt) {
        delete pendingMap[userIdOrSecret];
        StorageService.set(StorageService.keys.PENDING_2FA_EMAIL_CODES, pendingMap);
        return true;
      }
    } else {
      for (const [uid, entry] of Object.entries(pendingMap)) {
        if (entry.code === trimmed && nowMs <= entry.expiresAt) {
          delete pendingMap[uid];
          StorageService.set(StorageService.keys.PENDING_2FA_EMAIL_CODES, pendingMap);
          return true;
        }
      }
    }

    return false;
  }

  static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < AUTH_LIMITS.TOTP_BACKUP_CODES_COUNT; i++) {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  static complete2FASetup(userId: string): void {
    this.init();
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index >= 0) {
      users[index].twoFactorEnabled = true;
      users[index].hasSetupTwoFactor = true;
      StorageService.set(StorageService.keys.USERS, users);
      this.setCurrentUser(users[index]);
    }
  }

  static resetLecturer2FA(userId: string = 'user-lecturer-1', adminUserId?: string): void {
    this.init();
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index >= 0) {
      users[index].twoFactorEnabled = false;
      users[index].hasSetupTwoFactor = false;
      StorageService.set(StorageService.keys.USERS, users);

      // Add audit log entry for 2FA reset (Fix 4)
      const currentUser = this.getCurrentUser();
      const admin = adminUserId ? users.find((u) => u.id === adminUserId) : currentUser;
      const auditLogs = StorageService.get<AuditLogEntry[]>(StorageService.keys.AUDIT_LOGS, []);
      auditLogs.unshift({
        id: `audit-${Date.now()}`,
        performedByUserId: admin?.id || 'user-admin-1',
        performedByUserName: admin?.name || 'מנהל מערכת',
        targetUserId: users[index].id,
        targetUserName: users[index].name,
        action: '2FA_RESET',
        details: `איפוס 2FA למרצה (לדמו) - ${users[index].name}`,
        timestamp: new Date().toISOString(),
      });
      StorageService.set(StorageService.keys.AUDIT_LOGS, auditLogs);
    }
  }

  static changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): { success: boolean; error?: string } {
    this.init();
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'משתמש לא נמצא במערכת' };
    }

    const user = users[index];
    const expectedPass = user.password || 'password123';
    if (currentPass !== expectedPass) {
      return { success: false, error: 'הסיסמה הנוכחית שגויה' };
    }

    const passCheck = this.validatePassword(newPass);
    if (!passCheck.isValid) {
      return { success: false, error: passCheck.errorMessage || 'הסיסמה החדשה אינה עומדת בדרישות האבטחה' };
    }

    // Save new password in data layer
    user.password = newPass;
    users[index] = user;
    StorageService.set(StorageService.keys.USERS, users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      currentUser.password = newPass;
      this.setCurrentUser(currentUser);
    }

    // Audit log entry without storing the password itself
    const auditLogs = StorageService.get<AuditLogEntry[]>(StorageService.keys.AUDIT_LOGS, []);
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      performedByUserId: user.id,
      performedByUserName: user.name,
      targetUserId: user.id,
      targetUserName: user.name,
      action: 'PASSWORD_CHANGE',
      details: 'שינוי סיסמת משתמש (password changed)',
      timestamp: new Date().toISOString(),
    });
    StorageService.set(StorageService.keys.AUDIT_LOGS, auditLogs);

    return { success: true };
  }

  static updateUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: UserRole,
    assignedCourseIds?: string[]
  ): { success: boolean; error?: string } {
    this.init();
    const users = this.getUsers();
    const targetIndex = users.findIndex((u) => u.id === targetUserId);
    if (targetIndex === -1) return { success: false, error: 'משתמש לא נמצא' };

    const targetUser = users[targetIndex];
    const previousRole = targetUser.role;

    targetUser.role = newRole;
    if (assignedCourseIds) {
      targetUser.assignedCourseIds = assignedCourseIds;
    }

    // Fix 3: When admin changes user's role to lecturer, set twoFactorEnabled = false so their first login uses setup flow
    if (newRole === ROLES.LECTURER && previousRole !== ROLES.LECTURER) {
      targetUser.twoFactorEnabled = false;
      targetUser.hasSetupTwoFactor = false;
    }

    users[targetIndex] = targetUser;
    StorageService.set(StorageService.keys.USERS, users);

    // Update current user if editing self
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === targetUserId) {
      this.setCurrentUser(targetUser);
    }

    // Log to Audit
    const adminUser = users.find((u) => u.id === adminUserId) || currentUser;
    const auditLogs = StorageService.get<AuditLogEntry[]>(StorageService.keys.AUDIT_LOGS, []);
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      performedByUserId: adminUserId,
      performedByUserName: adminUser ? adminUser.name : 'מנהל מערכת',
      targetUserId,
      targetUserName: targetUser.name,
      action: 'ROLE_UPDATE',
      previousRole,
      newRole,
      details: `שינוי תפקיד מ-${previousRole} ל-${newRole}`,
      timestamp: new Date().toISOString(),
    };
    auditLogs.unshift(newEntry);
    StorageService.set(StorageService.keys.AUDIT_LOGS, auditLogs);

    return { success: true };
  }

  static getAuditLogs(): AuditLogEntry[] {
    this.init();
    return StorageService.get<AuditLogEntry[]>(StorageService.keys.AUDIT_LOGS, []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  static updateProfile(
    userId: string,
    data: { name?: string; department?: string; avatarUrl?: string }
  ): boolean {
    this.init();
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return false;

    if (data.name) users[index].name = data.name;
    if (data.department) users[index].department = data.department;
    if (data.avatarUrl) users[index].avatarUrl = data.avatarUrl;

    StorageService.set(StorageService.keys.USERS, users);

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      this.setCurrentUser(users[index]);
    }
    return true;
  }

  static switchUserQuick(userId: string): User | null {
    this.init();
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (user) {
      this.setCurrentUser(user);
      return user;
    }
    return null;
  }

  static logout(): void {
    StorageService.remove(StorageService.keys.CURRENT_USER);
  }
}
