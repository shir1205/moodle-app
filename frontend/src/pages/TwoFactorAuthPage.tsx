/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { AUTH_LIMITS, ROLES, ROLE_LANDING_ROUTES } from '../config/constants';
import {
  ShieldCheck,
  Smartphone,
  QrCode,
  KeyRound,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Sparkles,
  User as UserIcon,
  Inbox,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const TwoFactorAuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUsers, switchUser } = useAuth();

  // Find target lecturer being configured
  const users = AuthService.getUsers();
  const passedUserId = location.state?.userId;
  const targetUser =
    users.find((u) => u.id === passedUserId) ||
    users.find((u) => u.role === ROLES.LECTURER && !u.twoFactorEnabled) ||
    users.find((u) => u.id === 'user-lecturer-1') ||
    users[0];

  const userId = targetUser?.id || 'user-lecturer-1';

  // 3-step wizard state: 1 = App Info, 2 = QR & Code Verification, 3 = Backup Codes & Finish
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Rotating TOTP state
  const [currentCodeInfo, setCurrentCodeInfo] = useState(() => AuthService.generateCurrentTotp());
  const [inputCode, setInputCode] = useState('');
  const [validationError, setValidationError] = useState('');

  // Backup codes (exactly 8 codes)
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [hasDownloadedBackupCodes, setHasDownloadedBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);

  // Send 2FA code to mock inbox on mount
  useEffect(() => {
    if (userId) {
      AuthService.sendTwoFactorEmailCode(userId);
    }
  }, [userId]);

  // Update rotating code every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCodeInfo(AuthService.generateCurrentTotp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerifyStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const isValid = AuthService.verifyTotp(inputCode, userId);
    if (!isValid) {
      setValidationError('הקוד שגוי, נסי שוב');
      return;
    }

    // Generate 8 one-time backup codes according to AUTH_LIMITS.TOTP_BACKUP_CODES_COUNT
    const codes = AuthService.generateBackupCodes();
    setBackupCodes(codes);
    setCurrentStep(3);

    // Launch celebratory confetti
    try {
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
    } catch {
      // safe fallback
    }
  };

  const handleFillDemoCode = (code: string) => {
    setInputCode(code);
    setValidationError('');
  };

  const handleCopyBackupCodes = () => {
    const formatted = backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    navigator.clipboard.writeText(
      `CampuScope קודי גיבוי לחשבון ${targetUser?.name || 'מרצה'} (${targetUser?.email || ''}):\n${formatted}`
    );
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const handleDownloadBackupCodes = () => {
    const fileContent = `CampuScope - קודי גיבוי לשחזור חשבון מרצה
נוצר בתאריך: ${new Date().toLocaleDateString('he-IL')} בשעה ${new Date().toLocaleTimeString('he-IL')}
משתמש: ${targetUser?.name || 'מרצה'} (${targetUser?.email || ''})
מחלקה: ${targetUser?.department || 'מדעי המחשב'}
------------------------------------------------------
שמור קודים אלו במקום מאובטח.
להלן 8 קודי גיבוי חד-פעמיים. כל קוד ניתן לשימוש פעם אחת בלבד בעת התחברות ללא גישה לאפליקציית האימות:

${backupCodes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

------------------------------------------------------
בכל מקרה של אובדן גישה, ניתן לפנות למנהל המערכת (Admin).`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CampuScope-backup-codes-8-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setHasDownloadedBackupCodes(true);
  };

  const handleFinish = () => {
    AuthService.complete2FASetup(userId);
    switchUser(userId);
    refreshUsers();
    const landingRoute = ROLE_LANDING_ROUTES[ROLES.LECTURER] || '/courses';
    navigate(landingRoute);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center mb-3 shadow-sm border border-teal-200 dark:border-teal-800">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          הגדרת אימות דו-שלבי חובה למרצים (2FA)
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-lg mx-auto leading-relaxed">
          בהתאם למדיניות האבטחה האקדמית, כל מרצה במערכת מחויב/ת בהפעלת אימות דו-שלבי
          ולקבל <strong>8 קודי גיבוי</strong> לשחזור החשבון.
        </p>

        {/* Current Lecturer Chip */}
        {targetUser && (
          <div className="inline-flex items-center gap-2 mt-3 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <UserIcon className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-semibold">{targetUser.name}</span>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-[11px] text-slate-500">{targetUser.email}</span>
          </div>
        )}
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-8 max-w-md mx-auto px-4">
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep >= 1 ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30' : 'bg-slate-200 text-slate-500'
            }`}
          >
            1
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">הורדת אפליקציה</span>
        </div>
        <div className={`flex-1 h-0.5 mx-2 transition-all ${currentStep >= 2 ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep >= 2 ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30' : 'bg-slate-200 text-slate-500'
            }`}
          >
            2
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">סריקה ואימות</span>
        </div>
        <div className={`flex-1 h-0.5 mx-2 transition-all ${currentStep >= 3 ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
        <div className="flex flex-col items-center gap-1">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep === 3 ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30' : 'bg-slate-200 text-slate-500'
            }`}
          >
            3
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">8 קודי גיבוי</span>
        </div>
      </div>

      {/* Step 1: Explanation */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-teal-600" />
            <span>שלב 1 מתוך 3: הורדת אפליקציית מאמת (Authenticator)</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            להשלמת ההגדרה, ודא/י שמותקנת בטלפון הנייד שלך אפליקציית אימות (Authenticator) המפיקה קודים מתחלפים בזמן אמת:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Google Authenticator</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 leading-relaxed">
                זמין בחינם בחנויות Google Play ו-Apple App Store. מומלץ לשימוש אקדמי.
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Microsoft Authenticator / Authy</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 leading-relaxed">
                תומך בסנכרון מאובטח, גיבוי מוצפן ואימות רב-מכשירי.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>הערת אבטחה מכללתית:</span>
            </div>
            <p className="leading-relaxed">
              השלב השלישי יציג עבורך <strong>8 קודי גיבוי חד-פעמיים</strong>. שמירתם תאפשר שחזור גישה במקרה של תקלה במכשיר הנייד.
            </p>
          </div>

          <button
            onClick={() => setCurrentStep(2)}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
          >
            <span>המשך לשלב 2: סריקת קוד ה-QR ואימות קוד ראשוני</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: QR Code & 6-digit verification */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-600" />
              <span>שלב 2 מתוך 3: סריקת קוד QR ואימות קוד</span>
            </h2>
            <button
              onClick={() => setCurrentStep(1)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              חזרה לשלב 1
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            {/* Visual SVG QR Code Mock */}
            <div className="p-3 bg-white rounded-xl shadow border border-slate-200 shrink-0">
              <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" fill="white" />
                <path d="M10 10H40V40H10V10ZM16 16V34H34V16H16Z" fill="#0F172A" />
                <rect x="22" y="22" width="6" height="6" fill="#0F172A" />
                <path d="M60 10H90V40H60V10ZM66 16V34H84V16H66Z" fill="#0F172A" />
                <rect x="72" y="22" width="6" height="6" fill="#0F172A" />
                <path d="M10 60H40V90H10V60ZM16 66V84H34V66H16Z" fill="#0F172A" />
                <rect x="22" y="72" width="6" height="6" fill="#0F172A" />
                <rect x="50" y="50" width="8" height="8" fill="#0D9488" />
                <rect x="65" y="65" width="8" height="8" fill="#0F172A" />
                <rect x="80" y="50" width="8" height="8" fill="#0F172A" />
                <rect x="50" y="75" width="8" height="8" fill="#0F172A" />
                <rect x="75" y="80" width="10" height="8" fill="#0D9488" />
              </svg>
            </div>

            <div className="flex-1 text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
              <p className="font-semibold text-slate-900 dark:text-white">
                סרוק/י את הקוד באפליקציית המאמת שבמכשירך:
              </p>
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                <span>מפתח סודי ידני: </span>
                <code className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  CAMPUS-COPE-{targetUser?.id?.toUpperCase() || 'MICHAL'}-AUTH
                </code>
              </div>

              {/* Real-time rotating code indicator & quick fill */}
              <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold">
                    סימולטור קוד חי (מתחלף כל 30 שניות):
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{currentCodeInfo.secondsRemaining} שניות</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xl font-mono font-bold text-teal-900 dark:text-white tracking-widest">
                    {currentCodeInfo.code}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFillDemoCode(currentCodeInfo.code)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors shadow-sm"
                    >
                      הזן קוד חי
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillDemoCode('123456')}
                      className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      הזן 123456
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerifyStep2} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                הזן את 6 הספרות מהאפליקציה או מהמייל שנשלח:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="flex-1 py-2.5 text-center font-mono text-2xl tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                />
                <Link
                  to="/mock-inbox"
                  className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                  title="פתיחת תיבת הדואר לקבלת קוד האימות שנשלח"
                >
                  <Inbox className="w-4 h-4" />
                  <span>פתח את תיבת הדואר</span>
                </Link>
              </div>
            </div>

            {validationError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
            >
              <span>אמת קוד והמשך לשלב 3: קבלת 8 קודי גיבוי</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Step 3: Backup codes & Finish (Displays exactly 8 codes) */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-7 h-7 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  האימות הדו-שלבי הוגדר בהצלחה!
                </h2>
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  שלב 3 מתוך 3: שמירת {AUTH_LIMITS.TOTP_BACKUP_CODES_COUNT} קודי גיבוי לשחזור החשבון
                </div>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-bold">
              8 קודי גיבוי
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>הנחיית אבטחה חיונית למרצים:</span>
            </div>
            <p className="leading-relaxed">
              להלן <strong>8 קודי גיבוי חד-פעמיים</strong> שנוצרו במיוחד עבורך. כל קוד ניתן לשימוש פעם אחת בלבד לכניסה במקרה של אובדן או תקלה במכשיר הנייד.
              עליך להוריד ולשמור אותם במקום מוגן.
            </p>
          </div>

          {/* Grid of exactly 8 backup codes */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>רשימת 8 קודי הגיבוי החד-פעמיים:</span>
              <span className="text-[11px] text-slate-500 font-mono">תקן CampuScope 2FA</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center gap-1 hover:border-teal-500 transition-colors"
                >
                  <span className="text-[10px] text-slate-400 font-sans font-normal">
                    קוד {idx + 1} מתוך 8
                  </span>
                  <span className="tracking-wider text-sm text-teal-800 dark:text-teal-300">{code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons: Copy, Download */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleCopyBackupCodes}
              className="py-2.5 px-4 rounded-xl border border-teal-600 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {copiedCodes ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">8 הקודים הועתקו ללוח!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>העתק את כל 8 הקודים ללוח</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadBackupCodes}
              className="py-2.5 px-4 rounded-xl border border-teal-600 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>
                {hasDownloadedBackupCodes ? 'הורד שוב קובץ (.txt)' : 'הורד 8 קודי גיבוי כקובץ (.txt)'}
              </span>
            </button>
          </div>

          {/* Confirmation Checkbox */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="confirmSaved"
              checked={hasConfirmedSaved}
              onChange={(e) => setHasConfirmedSaved(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <label
              htmlFor="confirmSaved"
              className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none leading-relaxed"
            >
              <strong>אישור שמירה:</strong> אני מאשר/ת שהורדתי או שמרתי את 8 קודי הגיבוי במקום מאובטח.
            </label>
          </div>

          {/* Finish Button ("סיימתי") */}
          <div className="pt-2">
            <button
              onClick={handleFinish}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>סיימתי</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
