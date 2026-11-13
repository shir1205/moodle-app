/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AuthService } from '../services/authService';
import { ROLE_LABELS } from '../config/constants';
import {
  User,
  Building,
  Mail,
  ShieldCheck,
  Camera,
  Save,
  CheckCircle2,
  Lock,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentUser, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(currentUser?.name || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [avatarUrl, setAvatarUrl] = useState(
    currentUser?.avatarUrl ||
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
  );
  const [isSaved, setIsSaved] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Live password validation
  const passCheck = AuthService.validatePassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const ok = updateProfile({
      name: name.trim(),
      department: department.trim(),
      avatarUrl,
    });

    if (ok) {
      setIsSaved(true);
      showToast('הפרופיל עודכן בהצלחה!', 'success');
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('נא להזין את הסיסמה הנוכחית');
      return;
    }

    if (!passCheck.isValid) {
      setPasswordError(passCheck.errorMessage || 'הסיסמה החדשה אינה עומדת בדרישות האבטחה');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('אימות הסיסמה אינו תואם לסיסמה החדשה');
      return;
    }

    setIsUpdatingPassword(true);
    const res = changePassword(currentPassword, newPassword);
    setIsUpdatingPassword(false);

    if (!res.success) {
      setPasswordError(res.error || 'הסיסמה הנוכחית שגויה');
      return;
    }

    showToast('הסיסמה עודכנה בהצלחה', 'success');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          הפרופיל האישי שלי
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          ניהול פרטים אישיים, תמונת פרופיל ושיוך מחלקתי
        </p>
      </div>

      {/* Profile Details Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="relative group">
            <img
              src={avatarUrl}
              alt={name}
              className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow-md"
              referrerPolicy="no-referrer"
            />
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 end-0 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow transition-transform group-hover:scale-110"
              title="החלף תמונת פרופיל"
            >
              <Camera className="w-4 h-4" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </div>

          <div className="text-center sm:text-start space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{name}</h2>
            <div className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1">
              <Mail className="w-3.5 h-3.5" />
              <span>{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                {ROLE_LABELS[currentUser.role]}
              </span>
              {currentUser.twoFactorEnabled && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>2FA מופעל</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              שם מלא
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              מחלקה / פקולטה
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>הפרטים נשמרו בהצלחה במערכת.</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>שמירת שינויים</span>
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Section (Scenario 1, Step 10) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" />
            <span>שינוי סיסמה</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            הגדרת סיסמה חדשה לחשבונך. הסיסמה חייבת לכלול לפחות 8 תווים, אות ומספר.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              סיסמה נוכחית
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="••••••••"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              סיסמה חדשה (לפחות 8 תווים, אות ומספר)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="••••••••"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Live Password Strength Meter */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passCheck.isValid
                        ? 'bg-emerald-500'
                        : passCheck.strengthPercent > 40
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${passCheck.strengthPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={
                      passCheck.isValid
                        ? 'text-emerald-600 font-bold'
                        : 'text-slate-500'
                    }
                  >
                    {passCheck.isValid
                      ? 'סיסמה חזקה ותקינה ✓'
                      : 'דרושים: 8+ תווים, אות ומספר'}
                  </span>
                  {!passCheck.isValid && (
                    <span className="text-rose-600 font-medium">{passCheck.errorMessage}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              אימות סיסמה חדשה
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="••••••••"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <div className="text-rose-600 text-xs mt-1 font-medium">הסיסמאות אינן תואמות</div>
            )}
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>עדכון סיסמה</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
