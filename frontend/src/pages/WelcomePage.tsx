/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { ROLES, ROLE_LANDING_ROUTES, AUTH_LIMITS, UserRole } from '../config/constants';
import { User } from '../types';
import confetti from 'canvas-confetti';
import {
  GraduationCap,
  Mail,
  Lock,
  User as UserIcon,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Inbox,
  RotateCw,
  ExternalLink,
  Check,
} from 'lucide-react';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';

export const WelcomePage: React.FC = () => {
  const { currentUser, login, switchUser, refreshUsers } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If a logged-in user refreshes or visits root address /, redirect to their role's landing screen
  useEffect(() => {
    if (currentUser) {
      const landingRoute = ROLE_LANDING_ROUTES[currentUser.role] || '/courses';
      navigate(landingRoute, { replace: true });
    }
  }, [currentUser, navigate]);

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Handle ?focus=login query param from top bar
  useEffect(() => {
    if (searchParams.get('focus') === 'login') {
      setActiveTab('login');
      const emailInput = document.getElementById('login-email-input');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 200);
      }
    }
  }, [searchParams]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [unverifiedEmailForResend, setUnverifiedEmailForResend] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDepartment, setRegDepartment] = useState('מדעי המחשב');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');
  const [registeredUser, setRegisteredUser] = useState<{
    id: string;
    name: string;
    email: string;
    verificationToken?: string;
  } | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // 2FA modal state for returning lecturer login
  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');

  // Live password validation
  const passCheck = AuthService.validatePassword(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    setResendSuccess(false);

    const res = login(loginEmail, loginPassword);
    setLoginLoading(false);

    if (!res.success) {
      if (res.isUnverified) {
        setUnverifiedEmailForResend(res.unverifiedEmail || loginEmail);
        setLoginError(res.error || 'החשבון טרם אומת. נא לבדוק את תיבת הדוא״ל וללחוץ על קישור האימות.');
      } else {
        setUnverifiedEmailForResend(null);
        setLoginError(res.error || 'הקוד שגוי, נסי שוב');
      }
      return;
    }

    setUnverifiedEmailForResend(null);

    if (res.requires2FA && res.requiresFirstTime2FASetup && res.user) {
      // Navigate to full 3-step 2FA setup wizard
      navigate('/two-factor-setup', { state: { userId: res.user.id } });
      return;
    }

    if (res.requires2FA && !res.requiresFirstTime2FASetup && res.user) {
      // Prompt 6-digit TOTP code
      setPendingUser(res.user);
      setShow2FAPrompt(true);
      return;
    }

    // Direct login success -> navigate to role's dedicated landing screen
    if (res.user) {
      const targetRoute = ROLE_LANDING_ROUTES[res.user.role] || '/courses';
      navigate(targetRoute);
    }
  };

  const handleResendEmail = () => {
    if (!unverifiedEmailForResend) return;
    const res = AuthService.resendVerificationEmail(unverifiedEmailForResend);
    if (res.success) {
      setResendSuccess(true);
    }
  };

  const handleDirectVerify = (userIdOrToken: string) => {
    const ok = AuthService.verifyEmail(userIdOrToken);
    if (ok) {
      refreshUsers();
      setVerificationSuccess(true);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}
    }
  };

  const handleTotpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    const isValid = AuthService.verifyTotp(totpCode, pendingUser?.id);
    if (!isValid) {
      setTotpError('הקוד שגוי, נסי שוב');
      return;
    }
    // Success: log in pending user
    if (pendingUser) {
      AuthService.setCurrentUser(pendingUser);
      setShow2FAPrompt(false);
      const targetRoute = ROLE_LANDING_ROUTES[pendingUser.role] || '/courses';
      navigate(targetRoute);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccessMessage('');
    setVerificationSuccess(false);

    if (!regName.trim()) {
      setRegError('נא להזין שם מלא');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('נא להזין כתובת דוא״ל מכללתית תקינה');
      return;
    }

    if (!passCheck.isValid) {
      setRegError(passCheck.errorMessage || 'הסיסמה אינה עומדת בדרישות האבטחה');
      return;
    }

    if (!passwordsMatch) {
      setRegError('הסיסמאות אינן תואמות');
      return;
    }

    const res = AuthService.register({
      name: regName,
      email: regEmail,
      department: regDepartment,
      password: regPassword,
    });

    if (!res.success) {
      setRegError(res.error || 'אירעה שגיאה ברישום');
      return;
    }

    if (res.user) {
      setRegisteredUser({
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        verificationToken: res.verificationToken,
      });
    }

    setRegSuccessMessage(
      'שלחנו לך מייל לאימות הכתובת לתיבת הדואר המדומה. נא לגשת לתיבת הדואר או להשלים את האימות ישירות מהכרטיסייה למטה.'
    );
  };

  const handleQuickLogin = (userId: string) => {
    const user = AuthService.getUsers().find((u) => u.id === userId);
    if (!user) {
      switchUser(userId);
      navigate('/courses');
      return;
    }

    // First login (lecturer with twoFactorEnabled = false): show mandatory 2FA setup flow
    if (user.role === ROLES.LECTURER && !user.twoFactorEnabled) {
      AuthService.sendTwoFactorEmailCode(user.id);
      navigate('/two-factor-setup', { state: { userId: user.id } });
      return;
    }

    // Returning login (lecturer with twoFactorEnabled = true): prompt 6-digit TOTP
    if (user.role === ROLES.LECTURER && user.twoFactorEnabled) {
      AuthService.sendTwoFactorEmailCode(user.id);
      setPendingUser(user);
      setShow2FAPrompt(true);
      return;
    }

    // Students, TA, Admin
    switchUser(userId);
    const targetRoute = ROLE_LANDING_ROUTES[user.role] || '/courses';
    navigate(targetRoute);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10">
      {/* Hero Welcome Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>סביבת למידה אקדמית חכמה מבוססת בינה מלאכותית</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          ברוכים הבאים ל-CampuScope
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          מערכת ניהול הלמידה האקדמית (LMS) להוראה, הגשת מטלות, משוב חכם בזמן אמת ומעקב התקדמות אישי.
        </p>
      </div>


      {/* Quick Test Demo Account Bar - exactly 4 cards with name and role only */}
      <div className="mb-8 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>כניסה מהירה למשתמשי הדגמה (לבדיקה ללא צורך בהקלדה):</span>
          <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400">קליק אחד לכניסה</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleQuickLogin('user-student-1')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/70 transition-colors text-start group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              דכ
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">
                דנה כהן
              </div>
              <div className="text-[10px] text-slate-500">סטודנטית</div>
            </div>
          </button>

          <button
            onClick={() => handleQuickLogin('user-ta-1')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/50 dark:bg-cyan-950/30 hover:bg-cyan-100/70 transition-colors text-start group"
          >
            <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              אמ
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600">
                איתי המתרגל
              </div>
              <div className="text-[10px] text-slate-500">מתרגל (TA)</div>
            </div>
          </button>

          <button
            onClick={() => handleQuickLogin('user-lecturer-1')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/70 transition-colors text-start group"
          >
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              מל
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600">
                ד"ר מיכל לוי
              </div>
              <div className="text-[10px] text-slate-500">מרצה</div>
            </div>
          </button>

          <button
            onClick={() => handleQuickLogin('user-admin-1')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 transition-colors text-start group"
          >
            <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              יב
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600">
                יוסי ברק
              </div>
              <div className="text-[10px] text-slate-500">מנהל מערכת (Admin)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div id="auth-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-w-xl mx-auto scroll-mt-20">
        {/* Tabs: Login / Register */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-1.5">
          <button
            onClick={() => {
              setActiveTab('login');
              setLoginError('');
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'login'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            התחברות למערכת
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setRegError('');
              setRegSuccessMessage('');
            }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              activeTab === 'register'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            הרשמת סטודנט חדש
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  כתובת דוא״ל מכללתית
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="dana@campus.ac.il"
                    className="w-full ps-9 pe-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    סיסמה
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>שכחתי סיסמה</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-900 space-y-2.5">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{loginError}</span>
                  </div>

                  {unverifiedEmailForResend && (
                    <div className="pt-2 border-t border-rose-200/70 dark:border-rose-800/70 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleResendEmail}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>שלח שוב את מייל האימות</span>
                        </button>
                        <Link
                          to="/mock-inbox"
                          className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1"
                        >
                          <span>פתיחת תיבת הדואר המדומה</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      {resendSuccess && (
                        <div className="p-2 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>מייל אימות חדש נשלח בהצלחה לתיבת הדואר המדומה (Demo Inbox)!</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-50"
              >
                <span>התחברות</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {verificationSuccess ? (
                /* Post-Verification Confirmed State */
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 text-center space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      החשבון אומת בהצלחה, אפשר להתחבר
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      כתובת הדוא״ל שלך אומתה בהצלחה במערכת CampuScope. כעת באפשרותך להתחבר עם הסיסמה שהגדרת.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setLoginEmail(registeredUser?.email || regEmail);
                      setRegSuccessMessage('');
                      setVerificationSuccess(false);
                      setRegisteredUser(null);
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    <span>התחבר עכשיו</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              ) : regSuccessMessage && registeredUser ? (
                /* Registration Success with Demo Inbox Panel */
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      <span>שלחנו לך מייל לאימות הכתובת!</span>
                    </div>
                    <p className="text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
                      הודעת האימות זמינה כעת בתיבת הדואר המדומה (Demo Inbox). ניתן לבצע את האימות ישירות מהכרטיסייה להלן, או לפתוח את תיבת הדואר המלאה.
                    </p>
                  </div>

                  {/* Demo Inbox Panel */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border-2 border-indigo-200 dark:border-indigo-800 shadow-md space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                        <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>תיבת דואר מדומה (Demo Inbox)</span>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200 px-2 py-0.5 rounded-full">
                        הודעה חדשה
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          אימות כתובת אימייל ב-CampuScope
                        </span>
                        <span className="text-[10px] text-slate-400">עכשיו</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        אל: <strong className="text-slate-700 dark:text-slate-300">{registeredUser.email}</strong>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        שלום {registeredUser.name},<br />
                        ברוך/ה הבא/ה ל-CampuScope. לחץ/י על הקישור להשלמת אימות החשבון:
                      </div>

                      {/* Clickable verification button */}
                      <button
                        type="button"
                        onClick={() => handleDirectVerify(registeredUser.id)}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>אימות כתובת המייל</span>
                      </button>
                    </div>

                    {/* Direct button to open dedicated /mock-inbox page */}
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        to="/mock-inbox"
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <span>פתח את תיבת הדואר המדומה (Demo Inbox)</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('login');
                          setLoginEmail(registeredUser.email);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        מעבר להתחברות
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      שם מלא
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      כתובת דוא״ל מכללתית
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="israel@campus.ac.il"
                        className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      מחלקה / חוג
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value)}
                        className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="מדעי המחשב">מדעי המחשב</option>
                        <option value="הנדסת תוכנה">הנדסת תוכנה</option>
                        <option value="מתמטיקה">מתמטיקה</option>
                        <option value="מערכות מידע">מערכות מידע</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      סיסמה (לפחות 8 תווים, אות ומספר)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Live Password Strength Meter */}
                    {regPassword.length > 0 && (
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
                            <span className="text-rose-600">{passCheck.errorMessage}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      אימות סיסמה
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {regConfirmPassword.length > 0 && !passwordsMatch && (
                      <div className="text-rose-600 text-xs mt-1">הסיסמאות אינן תואמות</div>
                    )}
                  </div>

                  {regError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    <span>הירשם למערכת כסטודנט</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Returning Lecturer 2FA Modal */}
      {show2FAPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              אימות דו-שלבי למרצה (2FA)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              הזן את הקוד בן 6 הספרות מאפליקציית האימות, או את הקוד שנשלח לתיבת הדואר שלך (קוד לדוגמה: <strong>123456</strong> או הקוד המתחלף).
            </p>

            <form onSubmit={handleTotpVerify} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="flex-1 py-2.5 text-center font-mono text-2xl tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Link
                  to="/mock-inbox"
                  className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                  title="פתיחת תיבת הדואר המדומה לקבלת קוד האימות שנשלח"
                >
                  <Inbox className="w-4 h-4" />
                  <span>פתח את תיבת הדואר</span>
                </Link>
              </div>

              {totpError && (
                <div className="text-xs text-rose-600 font-medium">{totpError}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShow2FAPrompt(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
                >
                  אימות וכניסה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        initialEmail={loginEmail}
      />
    </div>
  );
};
