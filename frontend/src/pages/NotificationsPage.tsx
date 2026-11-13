/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { NotificationService } from '../services/notificationService';
import { Notification, NotificationPreference, NotificationType } from '../types';
import { EmptyState } from '../components/common/EmptyState';
import {
  Bell,
  CheckCheck,
  Award,
  Sparkles,
  FileCheck,
  Clock,
  MessageSquare,
  AlertTriangle,
  Mail,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { currentUser, refreshUnreadCount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'center' | 'preferences'>('center');
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    currentUser ? NotificationService.getNotifications(currentUser.id) : []
  );

  // Preferences state
  const [prefs, setPrefs] = useState<NotificationPreference>(() =>
    currentUser
      ? NotificationService.getPreferences(currentUser.id)
      : {
          userId: '',
          gradeInApp: true,
          gradeEmail: true,
          aiFeedbackInApp: true,
          aiFeedbackEmail: false,
          newAssignmentInApp: true,
          newAssignmentEmail: true,
          reminderInApp: true,
          reminderEmail: true,
          lecturerMessageInApp: true,
          lecturerMessageEmail: true,
        }
  );

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'unread') return !n.isRead;
    return true;
  });

  const handleMarkAllAsRead = () => {
    if (!currentUser) return;
    NotificationService.markAllAsRead(currentUser.id);
    setNotifications(NotificationService.getNotifications(currentUser.id));
    refreshUnreadCount();
    showToast('כל ההתראות סומנו כנקראו', 'success');
  };

  const handleNotificationClick = (n: Notification) => {
    NotificationService.markAsRead(n.id);
    refreshUnreadCount();
    setNotifications(currentUser ? NotificationService.getNotifications(currentUser.id) : []);

    if (n.link) {
      navigate(n.link);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    NotificationService.updatePreferences(prefs);
    showToast('העדפות ההתראה נשמרו בהצלחה!', 'success');
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'grade':
        return <Award className="w-5 h-5 text-emerald-600" />;
      case 'ai_feedback':
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
      case 'assignment':
        return <FileCheck className="w-5 h-5 text-teal-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'lecturer_message':
      case 'at_risk':
        return <MessageSquare className="w-5 h-5 text-rose-600" />;
      default:
        return <Bell className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            <span>מרכז התראות והודעות מערכת</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            מעקב אחר פרסום ציונים, מטלות חדשות, תזכורות הגשה והתאמת ערוצי שליחה (באתר ובדוא״ל)
          </p>
        </div>

        {/* Action button if in Center tab */}
        {activeTab === 'center' && notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-sm shrink-0"
          >
            <CheckCheck className="w-4 h-4 text-indigo-600" />
            <span>סמן הכל כנקרא</span>
          </button>
        )}
      </div>

      {/* Tabs: Center vs Preferences */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('center')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'center'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          מרכז ההתראות (S4-T1)
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'preferences'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>העדפות התראה (S4-T2)</span>
        </button>
      </div>

      {/* S4-T1: NOTIFICATION CENTER */}
      {activeTab === 'center' && (
        <div className="space-y-4">
          {/* Filters: All vs Unread */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              הכל ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterType === 'unread'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              לא נקראו ({notifications.filter((n) => !n.isRead).length})
            </button>
          </div>

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={filterType === 'unread' ? 'אין התראות שלא נקראו' : 'אין התראות במערכת'}
              description="התראות על ציונים, מטלות ומשוב יופיעו כאן בזמן אמת."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 sm:p-5 flex items-start gap-4 transition-colors cursor-pointer ${
                    !notif.isRead
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Icon */}
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        className={`text-sm ${
                          !notif.isRead
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {notif.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(notif.createdAt).toLocaleDateString('he-IL')} ·{' '}
                          {new Date(notif.createdAt).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {/* Blue dot for unread status */}
                        {!notif.isRead && (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"
                            title="לא נקרא"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {notif.content}
                    </p>

                    {/* Delivery channel badge */}
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      {notif.channel === 'both' ? (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>נשלח גם בדוא״ל</span>
                          {notif.emailStatus === 'failed' && (
                            <span className="text-rose-500 font-bold">(נכשלה שליחה במייל)</span>
                          )}
                        </span>
                      ) : (
                        <span>התראה באתר בלבד</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* S4-T2: NOTIFICATION PREFERENCES TABLE */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                הגדרת ערוצי קבלת התראות
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                בחר/י עבור כל סוג אירוע האם לקבל התראה באתר, בדוא״ל או בשניהם יחד.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-3 px-4 font-semibold text-start">סוג אירוע</th>
                    <th className="py-3 px-4 font-semibold text-center">התראה באתר (בפעמון)</th>
                    <th className="py-3 px-4 font-semibold text-center">הודעת דוא״ל</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Event 1: Grade published */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      ציון חדש במטלה
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.gradeInApp}
                        onChange={(e) => setPrefs({ ...prefs, gradeInApp: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.gradeEmail}
                        onChange={(e) => setPrefs({ ...prefs, gradeEmail: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>

                  {/* Event 2: AI feedback */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      משוב AI והמלצות למידה
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.aiFeedbackInApp}
                        onChange={(e) => setPrefs({ ...prefs, aiFeedbackInApp: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.aiFeedbackEmail}
                        onChange={(e) => setPrefs({ ...prefs, aiFeedbackEmail: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>

                  {/* Event 3: New Assignment */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      פרסום מטלה חדשה
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.newAssignmentInApp}
                        onChange={(e) =>
                          setPrefs({ ...prefs, newAssignmentInApp: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.newAssignmentEmail}
                        onChange={(e) =>
                          setPrefs({ ...prefs, newAssignmentEmail: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>

                  {/* Event 4: Submission reminder */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      תזכורת לקראת מועד הגשה
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.reminderInApp}
                        onChange={(e) => setPrefs({ ...prefs, reminderInApp: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.reminderEmail}
                        onChange={(e) => setPrefs({ ...prefs, reminderEmail: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>

                  {/* Event 5: Lecturer message / At-risk encouragement */}
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      הודעת מרצה / התראת עידוד אקדמית
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.lecturerMessageInApp}
                        onChange={(e) =>
                          setPrefs({ ...prefs, lecturerMessageInApp: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={prefs.lecturerMessageEmail}
                        onChange={(e) =>
                          setPrefs({ ...prefs, lecturerMessageEmail: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>שמירת העדפות</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
