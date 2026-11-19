/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CourseService } from '../services/courseService';
import { AssignmentService } from '../services/assignmentService';
import { AnalyticsService } from '../services/analyticsService';
import { AiService } from '../services/aiService';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Award,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  BookOpen,
  Filter,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const LecturerDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const lecturerId = currentUser?.id || 'user-lecturer-1';
  const courses = CourseService.getCoursesForUser(lecturerId, 'lecturer', currentUser?.assignedCourseIds || []);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses.length > 0 ? courses[0].id : ''
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('all');

  // AI Class Insights State
  const [classInsights, setClassInsights] = useState<string>('');
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);

  const selectedCourse = CourseService.getCourseById(selectedCourseId);
  const assignments = AssignmentService.getAssignments(selectedCourseId);
  const analytics = AnalyticsService.getCourseAnalytics(selectedCourseId, selectedAssignmentId);

  const handleGenerateClassInsights = async () => {
    if (!selectedCourse) return;
    setInsightsLoading(true);
    setClassInsights('');

    const histogramSummary = analytics.histogram
      .map((h) => `${h.range}: ${h.count} סטודנטים`)
      .join(', ');

    try {
      const res = await AiService.getClassInsights({
        courseTitle: selectedCourse.title,
        classAverage: analytics.classAverage,
        classMedian: analytics.classMedian,
        submissionRatePercent: analytics.submissionRatePercent,
        atRiskCount: analytics.atRiskCount,
        histogramSummary,
      });
      setClassInsights(res.insights);
    } catch {
      setClassInsights('השירות זמנית אינו זמין, ניתן לעיין בנתוני הגרפים.');
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            <span>לוח מחוונים פדגוגי למרצה (S4-T4)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ניתוח התפלגות ציונים, מעקב שיעורי הגשה, זיהוי סטודנטים בסיכון ותובנות AI כיתתיות
          </p>
        </div>

        {/* Course & Assignment Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedAssignmentId('all');
                setClassInsights('');
              }}
              className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedAssignmentId}
              onChange={(e) => {
                setSelectedAssignmentId(e.target.value);
                setClassInsights('');
              }}
              className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">כלל המטלות בקורס</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards (Scenario 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Class Average */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">ממוצע כיתתי</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {analytics.classAverage}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">סולם ציונים מתוך 100</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Class Median */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">חציון ציונים</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {analytics.classMedian}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">מדד מיקום מרכזי</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Submission Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">שיעור הגשות</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {analytics.submissionRatePercent}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">מתוך {analytics.enrolledStudentsCount} רשומים</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* At-Risk Students Count (Red Pulsing Card as requested!) */}
        <Link
          to="/lecturer/at-risk"
          className="p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between group shadow-sm bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/70 hover:shadow-md animate-pulse"
        >
          <div>
            <div className="text-xs font-bold text-rose-800 dark:text-rose-300 mb-1 flex items-center gap-1.5">
              <span>סטודנטים בסיכון</span>
              <span className="text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 px-1.5 rounded-full">
                דרוש מעקב
              </span>
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {analytics.atRiskCount}
            </div>
            <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 group-hover:underline">
              מעבר למוקד הטיפול &larr;
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* AI Class Insights Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span>תובנות AI פדגוגיות על הכיתה</span>
            </h3>
            <p className="text-xs text-slate-500">
              פרטיות מובטחת: ל-AI נשלחים מדדים סטטיסטיים אגרגטיביים בלבד (ללא שמות או תעודות זהות)
            </p>
          </div>

          <button
            onClick={handleGenerateClassInsights}
            disabled={insightsLoading}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {insightsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>הפק תובנות AI על הכיתה (&lt; 2 שניות)</span>
          </button>
        </div>

        {classInsights ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap animate-in fade-in">
            {classInsights}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            לחץ/י על הכפתור להפקת תובנות פדגוגיות מבוססות AI על התפלגות הכיתה, צווארי בקבוק ונושאים לחיזוק.
          </div>
        )}
      </div>

      {/* Visual Analytics Charts: Histogram & Submission Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution Histogram */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            היסטוגרמת התפלגות ציונים (Grade Histogram)
          </h3>
          <p className="text-xs text-slate-400">
            התפלגות תלמידי הקורס בחלוקה לטווחי ציונים (0-59, 60-69, 70-79, 80-89, 90-100)
          </p>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.histogram} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="מספר סטודנטים" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Submission Trends Over Weeks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            מגמת הגשות לאורך שבועות הסמסטר (Submission Trends)
          </h3>
          <p className="text-xs text-slate-400">
            מעקב אחר כמות ההגשות בפועל לעומת מספר הסטודנטים הרשומים
          </p>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.weeklySubmissionTrends} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="הגשות בפועל"
                  stroke="#14B8A6"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
