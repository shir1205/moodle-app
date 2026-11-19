/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * סיפור 57 - מסך אימות כתובת דוא"ל
 * Supabase מאמת את המייל ומחזיר לכאן עם access_token (או error) אחרי ה-# בכתובת.
 * השרת backend-core בודק את הטוקן ומוודא שהמייל אכן אומת.
 * קישור דמה של אב-הטיפוס (token / userId) ממשיך לעבוד כמו קודם.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AuthService } from '../services/authService';
import { verifyEmailWithServer, resendVerificationEmail } from '../services/emailVerificationApi';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, AlertCircle, ArrowLeft, LogIn, Mail } from 'lucide-react';
import confetti from 'canvas-confetti';

/** קריאת הפרמטרים ש-Supabase מוסיף אחרי ה-# בכתובת (ולפעמים אחרי ה-?) */
function readSupabaseRedirect(searchParams: URLSearchParams) {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const pick = (key: string) => hash.get(key) || searchParams.get(key) || '';
  return {
    accessToken: pick('access_token'),
    errorCode: pick('error_code') || pick('error'),
  };
}

const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'פג תוקף קישור האימות',
  access_denied: 'קישור האימות אינו תקף או שפג תוקפו',
};

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [{ accessToken, errorCode }] = useState(() => readSupabaseRedirect(searchParams));
  const token = searchParams.get('token') || '';
  const userId = searchParams.get('userId') || '';
  const { refreshUsers } = useAuth();

  const [verified, setVerified] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // שליחה חוזרת של מייל האימות
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const celebrate = () => {
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}
    };

    // מוחקים את הטוקן משורת הכתובת, כדי שלא יישאר בהיסטוריה של הדפדפן
    if (accessToken || errorCode) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Supabase החזיר שגיאה (למשל קישור שפג תוקפו)
    if (errorCode) {
      setVerified(false);
      setErrorMessage(SUPABASE_ERROR_MESSAGES[errorCode] || 'קישור האימות אינו תקף או שפג תוקפו');
      return;
    }

    // Supabase אימת את המייל -> בדיקה בצד השרת שהמשתמש אכן מאומת
    if (accessToken) {
      let cancelled = false;
      verifyEmailWithServer(accessToken).then((result) => {
        if (cancelled) return;
        setVerified(result.success);
        if (result.success) celebrate();
        else setErrorMessage(result.message);
      });
      return () => {
        cancelled = true;
      };
    }

    // קישור דמה של אב-הטיפוס
    const identifier = userId || token;
    if (identifier) {
      const success = AuthService.verifyEmail(identifier);
      setVerified(success);
      if (success) {
        refreshUsers();
        celebrate();
      }
    } else {
      setVerified(false);
    }
  }, [accessToken, errorCode, token, userId, refreshUsers]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    setResendResult(await resendVerificationEmail(resendEmail.trim()));
    setResendLoading(false);
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      {verified === true && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl space-y-5 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              החשבון אומת בהצלחה, אפשר להתחבר
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              כתובת הדוא״ל שלך אומתה בהצלחה במערכת CampuScope. כעת באפשרותך להתחבר עם הסיסמה שהגדרת.
            </p>
          </div>

          <Link
            to="/"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
          >
            <LogIn className="w-4 h-4" />
            <span>מעבר למסך ההתחברות</span>
          </Link>
        </div>
      )}

      {verified === false && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {errorMessage || 'קישור האימות אינו תקף או שפג תוקפו'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              לא הצלחנו לאמת את החשבון. אפשר לבקש כאן מייל אימות חדש.
            </p>
          </div>

          {/* שליחה חוזרת של מייל האימות */}
          <form onSubmit={handleResend} className="space-y-3 text-right">
            <label htmlFor="resend-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              כתובת הדוא״ל שאיתה נרשמת
            </label>
            <input
              id="resend-email"
              type="email"
              dir="ltr"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={resendLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>{resendLoading ? 'שולח...' : 'שליחת מייל אימות חדש'}</span>
            </button>
            {resendResult && (
              <p
                role="status"
                className={`text-xs font-bold ${
                  resendResult.success
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {resendResult.message}
              </p>
            )}
          </form>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>חזרה למסך הראשי</span>
          </Link>
        </div>
      )}

      {verified === null && (
        <div className="py-12 text-center text-slate-500 text-xs">
          מאמת את החשבון במערכת...
        </div>
      )}
    </div>
  );
};