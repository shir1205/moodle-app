/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CourseService } from '../services/courseService';
import { AnalyticsService } from '../services/analyticsService';
import { AiService } from '../services/aiService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  Loader2,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const studentId = currentUser?.id || 'user-student-1';
  const courses = CourseService.getCoursesForUser(studentId, 'student', currentUser?.assignedCourseIds || []);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses.length > 0 ? courses[0].id : ''
  );

  // AI Recommendation State
  const [aiTip, setAiTip] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const progress = AnalyticsService.getStudentCourseProgress(studentId, selectedCourseId);
  const selectedCourse = CourseService.getCourseById(selectedCourseId);

  // Prepare chart data comparing student grade to anonymous class average
  const chartData = progress.assignmentGrades.map((g) => ({
    name: g.assignmentTitle.length > 20 ? g.assignmentTitle.substring(0, 18) + '...' : g.assignmentTitle,
    'הציון שלי': g.studentGrade !== null ? g.studentGrade : 0,
    'ממוצע כיתתי אנונימי': g.classAverageGrade,
  }));

  const hasGradedAssignments = progress.assignmentGrades.some((g) => g.studentGrade !== null);

  const handleGenerateAiTip = async () => {
    if (!selectedCourse || !currentUser) return;
    setAiLoading(true);
    setAiTip('');

    try {
      const summaryStr = `השלמת ${progress.completionRatePercent}% מהחומרים, ממוצע נוכחי: ${progress.studentAverage}, ממוצע כיתתי: ${progress.classAverage}. ציוני מטלות: ${progress.assignmentGrades.map((g) => `${g.assignmentTitle}: ${g.studentGrade ?? 'טרם הוגש'}`).join(', ')}`;
      const res = await AiService.getStudentRecommendation(
        currentUser.name,
        selectedCourse.title,
        summaryStr
      );
      setAiTip(res.recommendation);
    } catch {
      setAiTip('המשך לתרגל באופן עקבי, שים לב למקרי קצה ובצע בדיקות יחידה טרם הגשת כל מטלה.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Course Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            <span>לוח ביצועים והתקדמות אקדמית (S4-T3)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            מעקב אחר קצב סיום החומרים, השוואה אנונימית מול ממוצע הכיתה, וקבלת המלצות למידה מבוססות AI
          </p>
        </div>

        {/* Course Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setAiTip('');
            }}
            className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Completion Rate Progress Bar (Section 7 Formula) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              התקדמות כללית בקורס: {progress.courseTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              מחושב לפי מטלות שהוגשו וחומרי לימוד שנסקרו ({progress.completedAssignmentsCount + progress.completedMaterialsCount} מתוך {progress.totalAssignmentsCount + progress.totalMaterialsCount} פריטים)
            </p>
          </div>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
            {progress.completionRatePercent}%
          </span>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-l from-indigo-600 to-teal-500 h-full rounded-full transition-all duration-700"
            style={{ width: `${progress.completionRatePercent}%` }}
          />
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Personal Average */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">הממוצע האישי שלי</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
              {hasGradedAssignments ? progress.studentAverage : '0'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hasGradedAssignments ? 'על בסיס מטלות שנבדקו' : 'טרם נבדקו מטלות'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Class Average */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">ממוצע כיתתי (אנונימי)</div>
            <div className="text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
              {progress.classAverage}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">כלל תלמידי הקורס</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Assignments submitted */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-1">מטלות שהוגשו</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {progress.completedAssignmentsCount} / {progress.totalAssignmentsCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">מטלות פעילות בקורס</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Edge Case Warning if no grades exist */}
      {!hasGradedAssignments && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            טרם פורסמו ציונים בקורס זה – הנתונים יתעדכנו עם בדיקת המטלה הראשונה.
          </span>
        </div>
      )}

      {/* Comparison Chart: Student Grade vs Anonymous Class Average */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              השוואת ציונים אישיים מול ממוצע הכיתה האנונימי
            </h3>
            <p className="text-xs text-slate-400">
              פרטיות מובטחת: ציוני סטודנטים אחרים מוצגים אך ורק כממוצע אגרגטיבי ללא שמות
            </p>
          </div>

          {/* AI Recommendation Generator Button (Scenario 4) */}
          <button
            onClick={handleGenerateAiTip}
            disabled={aiLoading}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>הפק המלצת AI לשיפור הישגים</span>
          </button>
        </div>

        {/* AI Tip Display */}
        {aiTip && (
          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed space-y-1.5 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-4 h-4" />
              <span>המלצת AI מותאמת אישית:</span>
            </div>
            <p className="whitespace-pre-wrap">{aiTip}</p>
          </div>
        )}

        {/* Recharts Bar Chart */}
        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="הציון שלי" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ממוצע כיתתי אנונימי" fill="#14B8A6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Grades Table & Upcoming Assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grades Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            פירוט ציוני מטלות
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold text-start">שם המטלה</th>
                  <th className="py-2.5 px-3 font-semibold text-start">מועד הגשה</th>
                  <th className="py-2.5 px-3 font-semibold text-start">ציון אישי</th>
                  <th className="py-2.5 px-3 font-semibold text-start">ממוצע כיתה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {progress.assignmentGrades.map((g) => (
                  <tr key={g.assignmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {g.assignmentTitle}
                    </td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums">
                      {new Date(g.dueDate).toLocaleDateString('he-IL')}
                    </td>
                    <td className="py-3 px-3 tabular-nums font-bold">
                      {g.studentGrade !== null ? (
                        <span
                          className={
                            g.studentGrade >= 60 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'
                          }
                        >
                          {g.studentGrade} / {g.maxGrade}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">טרם נבדק / טרם הוגש</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 tabular-nums font-semibold">
                      {g.classAverageGrade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Assignments List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>מטלות קרובות להגשה</span>
          </h3>

          {progress.upcomingAssignments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              אין מטלות פתוחות להגשה בקורס זה כעת.
            </div>
          ) : (
            <div className="space-y-3">
              {progress.upcomingAssignments.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {a.title}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>מועד יעד: {new Date(a.dueDate).toLocaleString('he-IL')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
