/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CourseService } from '../services/courseService';
import {
  AnalyticsService,
  StudentProgressResponse,
} from '../services/analyticsService';
import { AiService } from '../services/aiService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

const resolveCourseLabel = (courseId: string): string => {
  const localCourse = CourseService.getCourseById(courseId);
  return localCourse ? `${localCourse.code} - ${localCourse.title}` : courseId;
};

const formatDate = (raw: string | null, withTime = false): string => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return withTime ? d.toLocaleString('he-IL') : d.toLocaleDateString('he-IL');
};

export const StudentDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [progress, setProgress] = useState<StudentProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // AI Recommendation State
  const [aiTip, setAiTip] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const loadProgress = useCallback(async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await AnalyticsService.fetchMyProgress(
        courseId === 'all' ? undefined : courseId
      );
      setProgress(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'אירעה שגיאה בטעינת נתוני ההתקדמות והציונים'
      );
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress(selectedCourseId);
  }, [selectedCourseId, loadProgress]);

  const availableCourses = progress?.available_courses ?? [];
  const hasGradedAssignments = Boolean(progress?.has_grades);

  const gradedChartData = (progress?.assignment_grades ?? [])
    .filter((g) => g.student_grade !== null)
    .map((g) => ({
      name:
        g.assignment_title.length > 20
          ? `${g.assignment_title.substring(0, 18)}...`
          : g.assignment_title,
      'הציון שלי': g.student_grade as number,
    }));

  const selectedCourseTitle =
    selectedCourseId === 'all'
      ? 'כל הקורסים'
      : resolveCourseLabel(selectedCourseId);

  const handleGenerateAiTip = async () => {
    if (!progress || !currentUser) return;
    setAiLoading(true);
    setAiTip('');

    try {
      const summaryStr = `השלמת ${progress.completion_rate_percent}% מהמטלות (${progress.completed_assignments_count}/${progress.total_assignments_count}), ממוצע נוכחי: ${progress.student_average ?? 'אין עדיין ציונים'}. פירוט מטלות: ${progress.assignment_grades
        .map((g) => `${g.assignment_title}: ${g.student_grade ?? 'טרם פורסם ציון'}`)
        .join(', ')}`;
      const res = await AiService.getStudentRecommendation(
        currentUser.name,
        selectedCourseTitle,
        summaryStr
      );
      setAiTip(res.recommendation);
    } catch {
      setAiTip(
        'המשך לתרגל באופן עקבי, עקוב אחר מועדי ההגשה הקרובים ובצע בדיקות יחידה לפני כל הגשה.'
      );
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
            <span>לוח ביצועים והתקדמות אקדמית</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            מעקב אישי בזמן אמת אחר הציונים שפורסמו, ממוצע הציונים ואחוז השלמת המטלות שלך
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
            <option value="all">כל הקורסים</option>
            {availableCourses.map((cid) => (
              <option key={cid} value={cid}>
                {resolveCourseLabel(cid)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">טוען נתוני התקדמות וציונים אישיים...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => loadProgress(selectedCourseId)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>נסה שוב</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && progress && (
        <>
          {/* Completion Rate Progress Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  התקדמות כללית: {selectedCourseTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  מחושב לפי מטלות שהוגשו מתוך כלל המטלות הפעילות ({progress.completed_assignments_count} מתוך {progress.total_assignments_count} מטלות)
                </p>
              </div>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {progress.completion_rate_percent}%
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-l from-indigo-600 to-teal-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${progress.completion_rate_percent}%` }}
              />
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Personal Average */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-1">
                  הממוצע האישי שלי
                </div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {hasGradedAssignments && progress.student_average !== null
                    ? progress.student_average
                    : '—'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {hasGradedAssignments
                    ? `על בסיס ${progress.graded_assignments_count} ציונים שפורסמו`
                    : 'טרם פורסמו ציונים'}
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
            </div>

            {/* Completion Percent */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-1">
                  אחוז השלמת פעילויות
                </div>
                <div className="text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
                  {progress.completion_rate_percent}%
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  התקדמות בהגשת מטלות
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Assignments submitted */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold mb-1">
                  מטלות שהוגשו
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {progress.completed_assignments_count} / {progress.total_assignments_count}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  מטלות פעילות
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Empty Grades Notice (Acceptance Criterion #4) */}
          {!hasGradedAssignments && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs">
              <Info className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                {progress.message ||
                  'טרם פורסמו ציונים עבורך – הנתונים יתעדכנו אוטומטית עם פרסום הציון הראשון.'}
              </span>
            </div>
          )}

          {/* Per-Course Summary Cards */}
          {progress.courses_summary.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                סיכום התקדמות וציונים לפי קורס
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {progress.courses_summary.map((course) => (
                  <div
                    key={course.course_id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {resolveCourseLabel(course.course_id)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>התקדמות: {course.completion_rate_percent}% ({course.completed_assignments_count}/{course.total_assignments_count})</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        ממוצע: {course.average_grade !== null ? course.average_grade : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{ width: `${course.completion_rate_percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Grades Chart + AI Tip */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ציונים אישיים במטלות
                </h3>
                <p className="text-xs text-slate-400">
                  מציג אך ורק את הציונים שפורסמו עבור החשבון המחובר
                </p>
              </div>

              <button
                onClick={handleGenerateAiTip}
                disabled={aiLoading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>הפק המלצת AI לשיפור הישגים</span>
              </button>
            </div>

            {aiTip && (
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                  <span>המלצת AI מותאמת אישית:</span>
                </div>
                <p className="whitespace-pre-wrap">{aiTip}</p>
              </div>
            )}

            {gradedChartData.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                אין עדיין ציונים שפורסמו להצגה בגרף.
              </div>
            ) : (
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gradedChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
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
                    <Bar dataKey="הציון שלי" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Grid: Grades Table & Upcoming Assignments */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grades Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                פירוט ציוני מטלות
              </h3>

              {progress.assignment_grades.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  אין מטלות פעילות להצגה כרגע.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold text-start">שם המטלה</th>
                        <th className="py-2.5 px-3 font-semibold text-start">קורס</th>
                        <th className="py-2.5 px-3 font-semibold text-start">מועד הגשה</th>
                        <th className="py-2.5 px-3 font-semibold text-start">ציון אישי</th>
                        <th className="py-2.5 px-3 font-semibold text-start">משוב</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {progress.assignment_grades.map((g) => (
                        <tr
                          key={g.assignment_id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {g.assignment_title}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {resolveCourseLabel(g.course_id)}
                          </td>
                          <td className="py-3 px-3 text-slate-500 tabular-nums">
                            {formatDate(g.due_date)}
                          </td>
                          <td className="py-3 px-3 tabular-nums font-bold">
                            {g.student_grade !== null ? (
                              <span
                                className={
                                  g.student_grade >= 60
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-rose-600'
                                }
                              >
                                {g.student_grade} / {g.max_grade}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">
                                {g.status === 'not_submitted'
                                  ? 'טרם הוגש'
                                  : 'הוגש · ממתין לציון'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {g.feedback || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upcoming Assignments List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>מטלות קרובות להגשה</span>
              </h3>

              {progress.upcoming_assignments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  אין מטלות פתוחות להגשה כעת.
                </div>
              ) : (
                <div className="space-y-3">
                  {progress.upcoming_assignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {a.title}
                        </div>
                        {a.is_submitted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">
                            הוגש
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>מועד יעד: {formatDate(a.due_date, true)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};