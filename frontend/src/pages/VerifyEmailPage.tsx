/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AuthService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, AlertCircle, ArrowLeft, LogIn } from 'lucide-react';
import confetti from 'canvas-confetti';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const userId = searchParams.get('userId') || '';
  const navigate = useNavigate();
  const { refreshUsers } = useAuth();

  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const identifier = userId || token;
    if (identifier) {
      const success = AuthService.verifyEmail(identifier);
      setVerified(success);
      if (success) {
        refreshUsers();
        try {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        } catch {}
      }
    } else {
      setVerified(false);
    }
  }, [token, userId, refreshUsers]);

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
              קישור האימות אינו תקף או שפג תוקפו
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              לא הצלחנו לאמת את החשבון. אנא נסה/י להתחבר או בקש/י שליחה חוזרת של מייל האימות.
            </p>
          </div>

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
