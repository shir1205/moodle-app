/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { AnalyticsService } from '../services/analyticsService';
import { AiService } from '../services/aiService';
import { NotificationService } from '../services/notificationService';
import { AtRiskStudent } from '../types';
import { Modal } from '../components/common/Modal';
import {
  AlertTriangle,
  Sparkles,
  Send,
  CheckCircle2,
  BookOpen,
  Filter,
  User,
  Mail,
  Loader2,
  Check,
} from 'lucide-react';

export const AtRiskStudentsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const lecturerId = currentUser?.id || 'user-lecturer-1';
  const courses = CourseService.getCoursesForUser(lecturerId, 'lecturer', currentUser?.assignedCourseIds || []);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // AI Encouragement draft modal state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [targetStudent, setTargetStudent] = useState<AtRiskStudent | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const atRiskStudents = AnalyticsService.getAtRiskStudents(
    selectedCourseId === 'all' ? undefined : selectedCourseId
  );

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === atRiskStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(atRiskStudents.map((s) => s.studentId));
    }
  };

  const handleOpenDraftForStudent = async (student: AtRiskStudent) => {
    setTargetStudent(student);
    setShowDraftModal(true);
    setIsDrafting(true);
    setDraftSubject(`פנייה אישית ממרצה הקורס - ${student.courseTitle}`);

    try {
      const res = await AiService.generateEncouragementDraft({
        studentName: student.studentName,
        courseTitle: student.courseTitle,
        warningReason: student.warningReason,
        lecturerName: currentUser?.name || 'ד"ר מיכל לוי',
      });
      setDraftContent(res.draft);
    } catch {
      setDraftContent(
        `שלום ${student.studentName},\nאני פונה אליך לגבי הקורס ${student.courseTitle}. אשמח שנתאם שיחה קצרה ונעזור לך להשלים את הפערים. בברכה.`
      );
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSendNotification = () => {
    if (!targetStudent || !draftContent.trim()) return;

    setIsSending(true);
    // Send in-app notification & mock email
    NotificationService.createNotification({
      userId: targetStudent.studentId,
      type: 'at_risk',
      title: draftSubject || `הודעת מרצה: ${targetStudent.courseTitle}`,
      content: draftContent,
      link: `/courses/${targetStudent.courseId}`,
    });

    setIsSending(false);
    setShowDraftModal(false);
    showToast(`התראת העידוד נשלחה בהצלחה ל-${targetStudent.studentName} (באתר ובדוא״ל)`, 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <span>מוקד מעקב סטודנטים בסיכון אקדמי (S4-T5)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            אלגוריתם זיהוי אוטומטי לסטודנטים עם ממוצע מתחת לסף או צבירת 2+ מטלות חסרות, וניסוח מודרך של הודעות עידוד
          </p>
        </div>

        {/* Filter by course */}
        <div className="flex items-center gap-2 shrink-0">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">כל הקורסים בהוראתי</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* At-Risk Table or Zero-State Card */}
      {atRiskStudents.length === 0 ? (
        /* Zero At-Risk Celebration Card (Mandatory Requirement) */
        <div className="p-8 sm:p-12 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 font-black text-3xl flex items-center justify-center mx-auto shadow-sm">
            0
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-100">
              מצוין! כלל הסטודנטים בקורס עומדים כעת ביעדים האקדמיים
            </h3>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 max-w-md mx-auto">
              אין סטודנטים עם ממוצע מתחת לסף המעבר או עם שתי מטלות חסרות שמועדן חלף.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                זוהו {atRiskStudents.length} סטודנטים הדורשים התערבות לימודית
              </h2>
              <p className="text-xs text-slate-400">
                ניתן לבחור סטודנט ולנסח עבורו מכתב עידוד אישי בעזרת בינה מלאכותית
              </p>
            </div>

            <div className="text-xs text-slate-500">
              סף ציון מעבר נוכחי במערכת: <strong>60</strong> · סף מטלות חסרות: <strong>2</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 text-start w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedStudentIds.length === atRiskStudents.length &&
                        atRiskStudents.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded text-indigo-600"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-start">שם הסטודנט</th>
                  <th className="py-2.5 px-3 font-semibold text-start">קורס</th>
                  <th className="py-2.5 px-3 font-semibold text-start">ממוצע ציונים</th>
                  <th className="py-2.5 px-3 font-semibold text-start">מטלות שלא הוגשו</th>
                  <th className="py-2.5 px-3 font-semibold text-start">סיבת התראה</th>
                  <th className="py-2.5 px-3 font-semibold text-start">רמת חומרה</th>
                  <th className="py-2.5 px-3 font-semibold text-end">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {atRiskStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.studentId);
                  return (
                    <tr
                      key={`${student.courseId}-${student.studentId}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(student.studentId)}
                          className="rounded text-indigo-600"
                        />
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{student.studentName}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {student.courseTitle}
                      </td>
                      <td className="py-3 px-3 font-bold tabular-nums text-rose-600">
                        {student.currentAverage > 0 ? student.currentAverage : 'טרם נבדק'}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-bold text-rose-700">
                        {student.missedSubmissionsCount} מטלות
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {student.warningReason}
                      </td>
                      <td className="py-3 px-3">
                        {student.severity === 'high' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800 shadow-xs">
                            רמת סיכון: גבוהה
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-50 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 shadow-xs">
                            רמת סיכון: בינונית
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-end">
                        <button
                          onClick={() => handleOpenDraftForStudent(student)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5 ms-auto"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>נסח הודעת עידוד בעזרת AI</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: AI Encouragement Draft Editor */}
      <Modal
        isOpen={showDraftModal}
        onClose={() => setShowDraftModal(false)}
        title={`ניסוח הודעת עידוד אישית עבור ${targetStudent?.studentName}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <div>
              קורס: <strong>{targetStudent?.courseTitle}</strong>
            </div>
            <div>
              סיבת ההתראה: <strong>{targetStudent?.warningReason}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              נושא ההודעה
            </label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              תוכן ההודעה (ניתן לעריכה חופשית לפני שליחה)
            </label>
            {isDrafting ? (
              <div className="h-44 flex items-center justify-center border rounded-xl border-dashed text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>מנסח מכתב עידוד תומך בעזרת AI...</span>
              </div>
            ) : (
              <textarea
                rows={8}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans leading-relaxed"
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-slate-400">
              ההודעה תישלח כהתראת פעמון באתר ובמקביל לדוא״ל הסטודנט ({targetStudent?.studentEmail})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={isDrafting || isSending || !draftContent.trim()}
                onClick={handleSendNotification}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>שלח התראה (באתר + דוא״ל)</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
