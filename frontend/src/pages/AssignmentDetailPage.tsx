/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { AssignmentService } from '../services/assignmentService';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { Modal } from '../components/common/Modal';
import { ROLES, ACADEMIC_THRESHOLDS } from '../config/constants';
import { Submission } from '../types';
import {
  FileCheck,
  Upload,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Download,
  Send,
  Edit,
  User,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const AssignmentDetailPage: React.FC = () => {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();

  const course = CourseService.getCourseById(courseId || '');
  const [assignment, setAssignment] = useState(() =>
    AssignmentService.getAssignmentById(assignmentId || '')
  );

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    AssignmentService.getSubmissionsForAssignment(assignmentId || '')
  );

  // Student specific submission
  const studentSubmission = currentUser
    ? submissions.find((s) => s.studentId === currentUser.id)
    : undefined;

  // Student upload form state
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Lecturer grading modal
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [inputGrade, setInputGrade] = useState<number>(90);
  const [inputFeedback, setInputFeedback] = useState<string>('');
  const [gradingError, setGradingError] = useState<string>('');

  if (!assignment || !course) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold">המטלה לא נמצאה</h2>
        <Link to="/courses" className="text-indigo-600 underline text-sm mt-2 inline-block">
          חזרה לרשימת הקורסים
        </Link>
      </div>
    );
  }

  const isStaff = role === ROLES.LECTURER || role === ROLES.TA || role === ROLES.ADMIN;
  const canEditAssignment = role === ROLES.LECTURER || role === ROLES.ADMIN;
  const isSubmissionWindowOpen = AssignmentService.isSubmissionWindowOpen(assignment.dueDate);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isSubmissionWindowOpen) setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!isSubmissionWindowOpen) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setSubmissionError('');
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!assignment.allowedFormats.includes(ext)) {
      setSubmissionError(
        `סוג קובץ לא מורשה (${ext}). הפורמטים המותרים למטלה זו הם: ${assignment.allowedFormats.join(', ')}`
      );
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !currentUser) {
      setSubmissionError('נא לבחור קובץ פתרון להגשה');
      return;
    }

    if (!isSubmissionWindowOpen) {
      setSubmissionError('מועד ההגשה חלף – חלון ההגשות נעול.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError('');

    const formattedSize = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';
    const res = AssignmentService.submitAssignment({
      assignmentId: assignment.id,
      courseId: course.id,
      studentId: currentUser.id,
      studentName: currentUser.name,
      fileName: selectedFile.name,
      fileSize: formattedSize,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setSubmissionError(res.error || 'אירעה שגיאה בעת ההגשה');
      return;
    }

    setSubmissions(AssignmentService.getSubmissionsForAssignment(assignment.id));
    setSelectedFile(null);
    showToast('המטלה הוגשה בהצלחה!', 'success');

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    if (inputGrade < 0 || inputGrade > assignment.maxGrade) {
      setGradingError(`הציון חייב להיות בין 0 ל-${assignment.maxGrade}`);
      return;
    }

    const res = AssignmentService.gradeSubmission({
      submissionId: gradingSubmission.id,
      grade: Number(inputGrade),
      feedback: inputFeedback.trim(),
      gradedBy: currentUser?.name || (role === ROLES.TA ? 'מתרגל הקורס' : 'מרצה הקורס'),
    });

    if (!res.success) {
      setGradingError(res.error || 'שגיאה בשמירת הציון');
      return;
    }

    setSubmissions(AssignmentService.getSubmissionsForAssignment(assignment.id));
    setGradingSubmission(null);
    showToast('הציון והמשוב פורסמו ונשלחה התראה לסטודנט!', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back breadcrumb */}
      <div>
        <Link
          to={`/courses/${course.id}`}
          className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>חזרה לקורס: {course.title}</span>
        </Link>
      </div>

      {/* Read-Only Assignment Area */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                {course.code}
              </span>
              <span className="text-xs text-slate-500">
                ציון מרבי: <strong>{assignment.maxGrade}</strong> נקודות
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {assignment.title}
            </h1>
          </div>

          {/* Live Countdown Timer & Staff Edit Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <CountdownTimer dueDate={assignment.dueDate} />
            {canEditAssignment && (
              <Link
                to={`/courses/${course.id}/assignments/${assignment.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>ערוך מטלה</span>
              </Link>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            הנחיות ודרישות המטלה
          </h3>
          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {assignment.instructions}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-2">
          <span>
            מועד יעד אחרון:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {new Date(assignment.dueDate).toLocaleString('he-IL')}
            </strong>
          </span>
          <span>·</span>
          <span>
            פורמטים מורשים להגשה:{' '}
            <strong className="text-indigo-600 dark:text-indigo-400">
              {assignment.allowedFormats.join(', ')}
            </strong>
          </span>
        </div>
      </div>

      {/* STUDENT SUBMISSION ZONE */}
      {role === ROLES.STUDENT && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>אזור הגשת פתרון למטלה</span>
            </h2>

            {/* Status Badge */}
            <div>
              {studentSubmission ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>הוגש בהצלחה</span>
                </span>
              ) : !isSubmissionWindowOpen ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>הוגש באיחור / לא הוגש</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>טרם הוגש</span>
                </span>
              )}
            </div>
          </div>

          {/* Submission Feedback / Grade Banner if graded */}
          {studentSubmission && studentSubmission.grade !== undefined && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  ציון שנקבע על ידי המתרגל/ת ({studentSubmission.gradedBy}):
                </span>
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {studentSubmission.grade} / {assignment.maxGrade}
                </span>
              </div>
              {studentSubmission.feedback && (
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1 border-t border-indigo-200/60 dark:border-indigo-800">
                  <strong>משוב המרצה:</strong> "{studentSubmission.feedback}"
                </div>
              )}
            </div>
          )}

          {/* Existing Submission Confirmation */}
          {studentSubmission && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {studentSubmission.fileName} ({studentSubmission.fileSize})
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    הוגש ב-{new Date(studentSubmission.submittedAt).toLocaleDateString('he-IL')} בשעה{' '}
                    {new Date(studentSubmission.submittedAt).toLocaleTimeString('he-IL')}
                  </div>
                </div>
              </div>

              {isSubmissionWindowOpen && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  ניתן להחליף קובץ כל עוד חלון ההגשות פתוח
                </span>
              )}
            </div>
          )}

          {/* Upload Area or Locked Notice */}
          {!isSubmissionWindowOpen ? (
            /* Prominent Locked Notice */
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-900 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                מועד ההגשה חלף – חלון ההגשות נעול
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
                לא ניתן להעלות או לעדכן קבצים לאחר מועד היעד שנקבע על ידי המרצה. לבירורים מיוחדים יש לפנות ישירות לצוות ההוראה.
              </p>
            </div>
          ) : (
            /* Active Upload & Drag Drop Zone */
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                  dragOver
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/40 dark:bg-slate-800/30'
                }`}
              >
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  גרור/י לכאן את קובץ הפתרון או לחץ/י לבחירה
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  קבצים מורשים: {assignment.allowedFormats.join(', ')}
                </div>

                <input
                  type="file"
                  id="student-file-input"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="student-file-input"
                  className="mt-4 inline-block px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm"
                >
                  בחר קובץ מהמחשב
                </label>

                {selectedFile && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 font-bold">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>

              {submissionError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!selectedFile || isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{studentSubmission ? 'עדכן/החלף קובץ' : 'הגש מטלה'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Quick shortcut to AI Assignment Feedback */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>רוצה לקבל משוב אוטומטי מקדים על טיוטת הפתרון לפני הגשה?</span>
            </div>
            <Link
              to={`/ai-assistant?tab=feedback&courseId=${course.id}`}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              קבל משוב AI &larr;
            </Link>
          </div>
        </div>
      )}

      {/* STAFF: CHECK ASSIGNMENTS / GRADING HUB (Lecturer, TA, Admin) */}
      {isStaff && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600" />
                <span>בדיקת הגשות מטלה ({submissions.length} סטודנטים הגישו)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                הורדת פתרונות, הזנת ציון, כתיבת משוב ושליחת התראה אוטומטית לסטודנט עם פרסום הציון
              </p>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              טרם התקבלו הגשות למטלה זו.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-start">
                    <th className="py-2.5 px-3 font-semibold text-start">שם הסטודנט</th>
                    <th className="py-2.5 px-3 font-semibold text-start">קובץ שהוגש</th>
                    <th className="py-2.5 px-3 font-semibold text-start">מועד הגשה</th>
                    <th className="py-2.5 px-3 font-semibold text-start">ציון</th>
                    <th className="py-2.5 px-3 font-semibold text-start">סטטוס</th>
                    <th className="py-2.5 px-3 font-semibold text-end">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sub.studentName}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {sub.fileName} ({sub.fileSize})
                      </td>
                      <td className="py-3 px-3 text-slate-500 tabular-nums">
                        {new Date(sub.submittedAt).toLocaleString('he-IL')}
                      </td>
                      <td className="py-3 px-3 font-bold tabular-nums">
                        {sub.grade !== undefined ? (
                          <span className={sub.grade >= 60 ? 'text-emerald-600' : 'text-rose-600'}>
                            {sub.grade} / {assignment.maxGrade}
                          </span>
                        ) : (
                          <span className="text-slate-400">טרם נבדק</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {sub.status === 'graded' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            נבדק
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                            ממתין לבדיקה
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              showToast(`הורדת הקובץ ${sub.fileName} החלה`, 'info');
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                            title="הורד קובץ הגשה"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setGradingSubmission(sub);
                              setInputGrade(sub.grade ?? 90);
                              setInputFeedback(sub.feedback || '');
                              setGradingError('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-colors"
                          >
                            {sub.grade !== undefined ? 'ערוך ציון' : 'הזן ציון'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Grade Submission Dialog */}
      <Modal
        isOpen={!!gradingSubmission}
        onClose={() => setGradingSubmission(null)}
        title={`בדיקת הגשה עבור ${gradingSubmission?.studentName}`}
      >
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
            <div>
              קובץ הסטודנט: <strong>{gradingSubmission?.fileName}</strong>
            </div>
            <div>
              מועד הגשה: {gradingSubmission && new Date(gradingSubmission.submittedAt).toLocaleString('he-IL')}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ציון (0 - {assignment.maxGrade}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={assignment.maxGrade}
              required
              value={inputGrade}
              onChange={(e) => setInputGrade(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              משוב כתוב לסטודנט
            </label>
            <textarea
              rows={4}
              placeholder="פרט חוזקות, הערות לשיפור, ונקודות ציון על הקוד או הפתרון..."
              value={inputFeedback}
              onChange={(e) => setInputFeedback(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {gradingError && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
              {gradingError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGradingSubmission(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm"
            >
              פרסם ציון ושלח התראה
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
