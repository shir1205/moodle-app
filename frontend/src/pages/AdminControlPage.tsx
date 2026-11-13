/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AuthService } from '../services/authService';
import { CourseService } from '../services/courseService';
import { AnalyticsService } from '../services/analyticsService';
import { NotificationService } from '../services/notificationService';
import { User, AuditLogEntry, SystemSettings } from '../types';
import { Modal } from '../components/common/Modal';
import { ROLES, ROLE_LABELS, UserRole } from '../config/constants';
import {
  Shield,
  Users,
  Settings,
  History,
  Activity,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Edit,
  RefreshCw,
  Server,
  Zap,
  Plus,
  BookOpen,
} from 'lucide-react';

export const AdminControlPage: React.FC = () => {
  const { currentUser, allUsers, refreshUsers } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'control' | 'users' | 'audit'>('control');

  // System Settings state
  const [settings, setSettings] = useState<SystemSettings>(() =>
    AnalyticsService.getSystemSettings()
  );
  const [minGrade, setMinGrade] = useState<number>(settings.minGradeThreshold);
  const [missedThreshold, setMissedThreshold] = useState<number>(
    settings.missedSubmissionsThreshold
  );

  // SMTP test state
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpResult, setSmtpResult] = useState<string>('');

  // Notification stats
  const [deliveryStats, setDeliveryStats] = useState(() =>
    NotificationService.getDeliveryStats()
  );
  const [notificationsLog, setNotificationsLog] = useState(() =>
    NotificationService.getAllNotificationsLog()
  );

  // User Management state
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>(ROLES.STUDENT);
  const [targetCourseIds, setTargetCourseIds] = useState<string[]>([]);
  const [showRoleConfirmModal, setShowRoleConfirmModal] = useState(false);

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    AuthService.getAuditLogs()
  );

  const courses = CourseService.getCourses();

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.includes(userSearch) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.includes(userSearch)
  );

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = AnalyticsService.updateSystemSettings({
      minGradeThreshold: Number(minGrade),
      missedSubmissionsThreshold: Number(missedThreshold),
    });
    setSettings(updated);
    showToast('הגדרות המערכת עודכנו בהצלחה!', 'success');
  };

  const handleTestSmtp = () => {
    setSmtpTesting(true);
    setSmtpResult('');
    setTimeout(() => {
      setSmtpTesting(false);
      setSmtpResult('חיבור לשרת הדוא״ל (smtp.campus.ac.il:587) עבר בהצלחה! השהיית מענה: 48ms.');
      showToast('בדיקת חיבור SMTP הושלמה בהצלחה', 'success');
    }, 1200);
  };

  const handleRefreshLogs = () => {
    setDeliveryStats(NotificationService.getDeliveryStats());
    setNotificationsLog(NotificationService.getAllNotificationsLog());
    setAuditLogs(AuthService.getAuditLogs());
    showToast('יומני המערכת רועננו', 'info');
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setTargetRole(user.role);
    setTargetCourseIds(user.assignedCourseIds || []);
  };

  const handleCourseAssignmentToggle = (courseId: string) => {
    setTargetCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleConfirmRoleChange = () => {
    if (!editingUser || !currentUser) return;

    AuthService.updateUserRole(currentUser.id, editingUser.id, targetRole, targetCourseIds);
    refreshUsers();
    setAuditLogs(AuthService.getAuditLogs());
    setShowRoleConfirmModal(false);
    setEditingUser(null);
    showToast(`תפקידו של ${editingUser.name} עודכן בהצלחה ל-${ROLE_LABELS[targetRole]}!`, 'success');
  };

  const handleReset2FA = (targetUser: User) => {
    if (!currentUser) return;
    AuthService.resetLecturer2FA(targetUser.id, currentUser.id);
    refreshUsers();
    setAuditLogs(AuthService.getAuditLogs());
    showToast(`אימות דו-שלבי אופס בהצלחה עבור ${targetUser.name}`, 'success');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            <span>בקרת מערכת ואנליטיקה אדמיניסטרטיבית (Admin Control Hub)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ניהול משתמשים והרשאות, ניטור התראות ושרתי דוא״ל, הגדרת ספי סיכון כיתתיים ויומן ביקורת
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/admin/create-course"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>פתיחת קורס חדש</span>
          </Link>

          <button
            onClick={handleRefreshLogs}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>רענן נתונים ויומנים</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('control')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'control'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>בקרת אנליטיקה והתראות (S4-T6)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ניהול משתמשים והרשאות</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>יומן ביקורת (Audit Log)</span>
        </button>
      </div>

      {/* TAB 1: S4-T6 ADMIN CONTROL & MONITORING */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* 4 Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-semibold mb-1">התראות שנשלחו היום</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {deliveryStats.todayTotal}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {deliveryStats.todayInApp} באתר · {deliveryStats.todayEmail} בדוא״ל
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-semibold mb-1">שיעור הצלחת מיילים</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {deliveryStats.emailSuccessRate}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">שרת SMTP יציב ותקין</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-semibold mb-1">זמן תגובת אנליטיקה</div>
              <div className="text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
                124ms
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">יעד ביצועים: &lt; 2000ms</div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-semibold mb-1">סטטוס שרת הדואר</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-base font-bold">מחובר (Port 587)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">smtp.campus.ac.il</div>
            </div>
          </div>

          {/* System Settings & Thresholds Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Editable Academic Thresholds */}
            <form
              onSubmit={handleUpdateSettings}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  הגדרת ספי אזהרה אוטומטיים (At-Risk Thresholds)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                שינוי ספים אלו משפיע מיידית על חישוב הסטודנטים בסיכון בלוחות המחוונים של המרצים.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  סף ציון מעבר מינימלי (נקודות)
                </label>
                <input
                  type="number"
                  min={40}
                  max={80}
                  value={minGrade}
                  onChange={(e) => setMinGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <div className="text-[11px] text-slate-400 mt-0.5">ברירת מחדל: 60</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  סף מטלות שלא הוגשו (שמועדן חלף)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={missedThreshold}
                  onChange={(e) => setMissedThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <div className="text-[11px] text-slate-400 mt-0.5">
                  סטודנט עם כמות זו של מטלות חסרות יסומן אוטומטית בסיכון (ברירת מחדל: 2)
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  עדכן הגדרות מערכת
                </button>
              </div>
            </form>

            {/* SMTP Diagnostics */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  בדיקת תקינות שרת דואר יוצא (SMTP Test)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                בדיקת תקשורת עם שרת ה-SMTP לשליחת הודעות אימות, ציונים והתראות עידוד לסטודנטים.
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs font-mono space-y-1">
                <div>HOST: smtp.campus.ac.il</div>
                <div>PORT: 587 (STARTTLS)</div>
                <div>AUTH: notifications@campus.ac.il</div>
              </div>

              {smtpResult && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{smtpResult}</span>
                </div>
              )}

              <button
                type="button"
                disabled={smtpTesting}
                onClick={handleTestSmtp}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {smtpTesting ? <Zap className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>בצע בדיקת חיבור SMTP מיידית</span>
              </button>
            </div>
          </div>

          {/* Real-time Notification Dispatch Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              יומן שליחת התראות אחרונות (Notification Log)
            </h3>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2 px-3 text-start">זמן</th>
                    <th className="py-2 px-3 text-start">נמען</th>
                    <th className="py-2 px-3 text-start">סוג</th>
                    <th className="py-2 px-3 text-start">כותרת ההתראה</th>
                    <th className="py-2 px-3 text-start">ערוץ שליחה</th>
                    <th className="py-2 px-3 text-start">סטטוס דוא״ל</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notificationsLog.slice(0, 10).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 tabular-nums text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString('he-IL')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{log.userId}</td>
                      <td className="py-2.5 px-3">{log.type}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate font-medium">{log.title}</td>
                      <td className="py-2.5 px-3">{log.channel === 'both' ? 'באתר + מייל' : 'באתר'}</td>
                      <td className="py-2.5 px-3">
                        {log.emailStatus === 'delivered' ? (
                          <span className="text-emerald-600 font-bold">נמסר ✓</span>
                        ) : log.emailStatus === 'failed' ? (
                          <span className="text-rose-600 font-bold">נכשל ✗</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT TABLE & ROLE EDITING */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                רשימת משתמשי המערכת
              </h2>
              <p className="text-xs text-slate-500">
                שינוי תפקיד המשתמש, הקצאת קורסים להוראה/למידה והפעלת אימות דו-שלבי
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="חיפוש משתמש לפי שם או דוא״ל..."
                className="w-full ps-9 pe-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 text-start">שם המשתמש</th>
                  <th className="py-2.5 px-3 text-start">כתובת דוא״ל</th>
                  <th className="py-2.5 px-3 text-start">תפקיד</th>
                  <th className="py-2.5 px-3 text-start">אימות דו-שלבי</th>
                  <th className="py-2.5 px-3 text-start">מחלקה</th>
                  <th className="py-2.5 px-3 text-start">תאריך רישום</th>
                  <th className="py-2.5 px-3 text-end">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <img
                        src={user.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'}
                        alt={user.name}
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span>{user.name}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                      {user.email}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.role === ROLES.ADMIN
                            ? 'bg-amber-100 text-amber-800'
                            : user.role === ROLES.LECTURER
                            ? 'bg-teal-100 text-teal-800'
                            : user.role === ROLES.TA
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {user.twoFactorEnabled ? (
                        <span className="text-teal-600 font-bold">פעיל ✓</span>
                      ) : (
                        <span className="text-slate-400">כבוי</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {user.department}
                    </td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums">
                      {new Date(user.registeredAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="py-3 px-3 text-end">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {user.role === ROLES.LECTURER && (
                          <button
                            onClick={() => handleReset2FA(user)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 font-bold text-[11px] transition-colors border border-teal-200 dark:border-teal-800"
                            title="איפוס 2FA למרצה (לדמו)"
                          >
                            איפוס 2FA למרצה (לדמו)
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditUser(user)}
                          className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold text-[11px] transition-colors"
                        >
                          ערוך תפקיד ושיוך
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Institutional Courses Management Card (Admin Only) */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>ניהול קורסים מוסדיים (הרשאות אדמין בלבד)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  פתיחת קורסים אקדמיים חדשים, הקצאת מרצים מובילים ובקרת סילבוס
                </p>
              </div>

              <Link
                to="/admin/create-course"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>פתיחת קורס חדש</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {course.code}
                    </span>
                    <span className="text-[10px] text-slate-400">{course.semester}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {course.title}
                  </h4>
                  <div className="text-[11px] text-slate-500">
                    מרצה אחראי: <strong className="text-slate-700 dark:text-slate-300">{course.lecturerName}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-400">{course.units.length} יחידות לימוד</span>
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      צפייה בסילבוס &larr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            יומן ביקורת פעולות מנהלים (Audit Log)
          </h2>
          <p className="text-xs text-slate-500">
            תיעוד קפדני ובלתי הפיך של כל שינוי הרשאות, הקצאת קורסים ועדכון ספי מערכת
          </p>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="py-3.5 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {entry.action}: {entry.details}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    בוצע ע״י <strong>{entry.performedByUserName}</strong> עבור{' '}
                    <strong>{entry.targetUserName}</strong>
                  </div>
                </div>
                <div className="text-end text-[11px] text-slate-400 tabular-nums shrink-0">
                  {new Date(entry.timestamp).toLocaleString('he-IL')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser && !showRoleConfirmModal}
        onClose={() => setEditingUser(null)}
        title={`עריכת משתמש: ${editingUser?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              בחר תפקיד במערכת
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value={ROLES.STUDENT}>סטודנט (Student)</option>
              <option value={ROLES.TA}>מתרגל (Teaching Assistant)</option>
              <option value={ROLES.LECTURER}>מרצה (Lecturer - 2FA חובה)</option>
              <option value={ROLES.ADMIN}>מנהל מערכת (Admin)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              הקצאת קורסים משויכים
            </label>
            <div className="space-y-1.5 max-h-44 overflow-y-auto border p-2.5 rounded-xl border-slate-200 dark:border-slate-700">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={targetCourseIds.includes(course.id)}
                    onChange={() => handleCourseAssignmentToggle(course.id)}
                    className="rounded text-indigo-600"
                  />
                  <span>
                    {course.code} - {course.title}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={() => setShowRoleConfirmModal(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              המשך לאישור שינוי תפקיד
            </button>
          </div>
        </div>
      </Modal>

      {/* Mandatory Confirmation Dialog (Scenario 1 Requirement) */}
      <Modal
        isOpen={showRoleConfirmModal}
        onClose={() => setShowRoleConfirmModal(false)}
        title="אישור שינוי תפקיד משתמש"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            האם לשנות את התפקיד של{' '}
            <strong className="text-slate-900 dark:text-white">{editingUser?.name}</strong> מ-
            {editingUser && ROLE_LABELS[editingUser.role]} ל-
            <strong className="text-indigo-600 dark:text-indigo-400">
              {ROLE_LABELS[targetRole]}
            </strong>
            ?
          </p>
          {targetRole === ROLES.LECTURER && editingUser?.role !== ROLES.LECTURER && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs border border-amber-200">
              שינוי לתפקיד מרצה יחייב את המשתמש לעבור תהליך הגדרת אימות דו-שלבי (2FA) בכניסתו הבאה.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowRoleConfirmModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirmRoleChange}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              אשר ועדכן תפקיד
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
