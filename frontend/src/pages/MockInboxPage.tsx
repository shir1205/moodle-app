/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Mail,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  Sparkles,
  Inbox,
  ShieldCheck,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MockEmail {
  id: string;
  toUserId?: string;
  toEmail?: string;
  subject: string;
  body: string;
  verificationToken?: string;
  userId?: string;
  sentAt: string;
}

export const MockInboxPage: React.FC = () => {
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const [verificationSuccessMessage, setVerificationSuccessMessage] = useState<string>('');
  const { refreshUsers } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadEmails = () => {
    const list = StorageService.get<MockEmail[]>(StorageService.keys.MOCK_INBOX, []);
    setEmails(list);
    if (list.length > 0 && !selectedEmail) {
      setSelectedEmail(list[0]);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleVerifyAccount = (userId: string, token?: string) => {
    const ok = AuthService.verifyEmail(userId || token || '');
    if (ok) {
      refreshUsers();
      setVerificationSuccessMessage('החשבון אומת בהצלחה, אפשר להתחבר');
      showToast('החשבון אומת בהצלחה, אפשר להתחבר', 'success');
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } else {
      showToast('שגיאה באימות החשבון', 'error');
    }
  };

  const handleClearInbox = () => {
    StorageService.set(StorageService.keys.MOCK_INBOX, []);
    setEmails([]);
    setSelectedEmail(null);
    showToast('תיבת הדואר המדומה נוקתה', 'info');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              תיבת דואר מדומה (Demo Inbox)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            סימולציית שרת דוא״ל המציגה הודעות אימות הרשמה, הודעות ציונים והתראות מערכת לצורכי בדיקה
          </p>
        </div>

        <div className="flex items-center gap-2">
          {emails.length > 0 && (
            <button
              onClick={handleClearInbox}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>נקה תיבה</span>
            </button>
          )}
          <Link
            to="/"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>חזרה למסך הבית</span>
          </Link>
        </div>
      </div>

      {/* Verification Success Banner */}
      {verificationSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold">{verificationSuccessMessage}</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                החשבון פעיל כעת בסביבת הנתונים. ניתן להתחבר ישירות.
              </div>
            </div>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-sm"
          >
            התחבר עכשיו &larr;
          </Link>
        </div>
      )}

      {/* Main Mailbox Interface */}
      {emails.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">
            תיבת הדואר המדומה ריקה כרגע
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            בצע/י הרשמת סטודנט חדש או שלח/י התראת ציונים כדי לצפות בהודעות הנשלחות כאן בזמן אמת.
          </p>
          <Link
            to="/"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl inline-block"
          >
            מעבר להרשמה / התחברות
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Email Messages Sidebar */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[550px] overflow-y-auto">
            {emails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              const isVerification = Boolean(email.verificationToken);

              return (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`w-full text-start p-4 transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/60 border-r-4 border-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {email.subject}
                    </span>
                    {isVerification && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                        אימות חשבון
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 truncate mb-1">
                    נשלח אל: {email.toEmail || email.toUserId}
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(email.sentAt).toLocaleString('he-IL')}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Email Preview & Verification Action Card */}
          <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedEmail.subject}
                  </h2>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                    <span>
                      אל:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {selectedEmail.toEmail || selectedEmail.toUserId}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>{new Date(selectedEmail.sentAt).toLocaleString('he-IL')}</span>
                  </div>
                </div>

                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedEmail.body}
                </div>

                {/* Direct Clickable Verification Button if Verification Email */}
                {selectedEmail.verificationToken && selectedEmail.userId && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>פעולת אימות חשבון נדרשת (אימות כתובת מייל):</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleVerifyAccount(selectedEmail.userId!, selectedEmail.verificationToken)
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 group"
                    >
                      <Check className="w-4 h-4" />
                      <span>אימות כתובת המייל (הפעלת החשבון)</span>
                    </button>
                    <div className="text-[11px] text-slate-500 text-center">
                      לחיצה על הכפתור תעדכן את החשבון כמאומת ותאפשר התחברות מיידית.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400">
                בחר/י מייל מהרשימה לצפייה בפרטים
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
