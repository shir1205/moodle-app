/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { AssignmentService } from '../services/assignmentService';
import { ACADEMIC_THRESHOLDS, FILE_UPLOAD_LIMITS, ROLES } from '../config/constants';
import {
  FileCheck,
  Calendar,
  Clock,
  Award,
  AlertCircle,
  ArrowRight,
  Save,
  Check,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const CreateAssignmentPage: React.FC = () => {
  const { courseId: paramCourseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId?: string;
  }>();
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isEditing = Boolean(assignmentId);
  const existingAssignment = assignmentId
    ? AssignmentService.getAssignmentById(assignmentId)
    : undefined;

  const courses = CourseService.getCoursesForUser(
    currentUser?.id || '',
    role || ROLES.LECTURER,
    currentUser?.assignedCourseIds || []
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    paramCourseId || (courses.length > 0 ? courses[0].id : '')
  );
  const selectedCourse = CourseService.getCourseById(selectedCourseId);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [maxGrade, setMaxGrade] = useState<number>(ACADEMIC_THRESHOLDS.MAX_GRADE_DEFAULT);

  // Allowed formats checkboxes
  const [allowedFormats, setAllowedFormats] = useState<string[]>(['.pdf', '.zip']);
  const [formError, setFormError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Enforce RBAC: TAs cannot create, edit, or delete assignments
  if (role === ROLES.TA) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h2 className="text-base font-bold">אין לך הרשאה לצפות בעמוד זה</h2>
          <p className="text-xs mt-1">
            סמכות יצירה, עריכה ומחיקה של מטלות נתונה למרצה הקורס ולאדמין בלבד.
          </p>
        </div>
        <Link
          to={`/courses/${paramCourseId || ''}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>חזרה לקורס</span>
        </Link>
      </div>
    );
  }

  // Populate fields if editing
  useEffect(() => {
    if (existingAssignment) {
      setTitle(existingAssignment.title);
      setInstructions(existingAssignment.instructions);
      setSelectedUnitId(existingAssignment.unitId);
      setSelectedCourseId(existingAssignment.courseId);
      setMaxGrade(existingAssignment.maxGrade);
      setAllowedFormats(existingAssignment.allowedFormats);

      const d = new Date(existingAssignment.dueDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setDueDate(`${yyyy}-${mm}-${dd}`);
        setDueTime(`${hh}:${min}`);
      }
    } else {
      // Set default due date to 7 days in future for new assignments
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const yyyy = nextWeek.getFullYear();
      const mm = String(nextWeek.getMonth() + 1).padStart(2, '0');
      const dd = String(nextWeek.getDate()).padStart(2, '0');
      setDueDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [existingAssignment]);

  useEffect(() => {
    if (!isEditing && selectedCourse && selectedCourse.units.length > 0 && !selectedUnitId) {
      setSelectedUnitId(selectedCourse.units[0].id);
    }
  }, [selectedCourse, isEditing, selectedUnitId]);

  const handleFormatToggle = (fmt: string) => {
    setAllowedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  };

  // Validation
  const fullDueIso = dueDate && dueTime ? new Date(`${dueDate}T${dueTime}:00`).toISOString() : '';
  const dueTimestamp = fullDueIso ? new Date(fullDueIso).getTime() : 0;
  const isDueInPast = !isEditing && dueTimestamp <= Date.now();
  const isTitleValid = title.trim().length >= 3;
  const isFormValid =
    isTitleValid &&
    selectedCourseId &&
    selectedUnitId &&
    dueDate &&
    !isDueInPast &&
    allowedFormats.length > 0;

  const handleSubmit = (status: 'published' | 'draft') => {
    setFormError('');

    if (!isTitleValid) {
      setFormError('נא להזין כותרת תקינה למטלה (לפחות 3 תווים)');
      return;
    }

    if (!dueDate || (!isEditing && isDueInPast)) {
      setFormError('מועד ההגשה חייב להיות תאריך ושעה עתידיים');
      return;
    }

    if (allowedFormats.length === 0) {
      setFormError('נא לבחור לפחות סוג קובץ מורשה אחד להגשה');
      return;
    }

    if (isEditing && assignmentId) {
      const res = AssignmentService.updateAssignment(assignmentId, {
        courseId: selectedCourseId,
        unitId: selectedUnitId,
        title: title.trim(),
        instructions,
        dueDate: fullDueIso,
        maxGrade,
        allowedFormats,
        status,
      });

      if (!res.success) {
        setFormError(res.error || 'אירעה שגיאה בעדכון המטלה');
        return;
      }

      showToast('המטלה עודכנה בהצלחה!', 'success');
      navigate(`/courses/${selectedCourseId}/assignments/${assignmentId}`);
    } else {
      const res = AssignmentService.createAssignment({
        courseId: selectedCourseId,
        unitId: selectedUnitId,
        title: title.trim(),
        instructions,
        dueDate: fullDueIso,
        maxGrade,
        allowedFormats,
        status,
      });

      if (!res.success) {
        setFormError(res.error || 'אירעה שגיאה ביצירת המטלה');
        return;
      }

      showToast(status === 'published' ? 'המטלה פורסמה בהצלחה לסטודנטים!' : 'המטלה נשמרה כטיוטה', 'success');
      navigate(`/courses/${selectedCourseId}`);
    }
  };

  const handleDeleteAssignment = () => {
    if (!assignmentId) return;
    const res = AssignmentService.deleteAssignment(assignmentId);
    if (res.success) {
      setShowDeleteModal(false);
      showToast('המטלה וכל ההגשות המשויכות אליה נמחקו בהצלחה', 'info');
      navigate(`/courses/${selectedCourseId}`);
    } else {
      setFormError(res.error || 'שגיאה במחיקת המטלה');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Link
            to={
              isEditing && assignmentId
                ? `/courses/${selectedCourseId}/assignments/${assignmentId}`
                : selectedCourseId
                ? `/courses/${selectedCourseId}`
                : '/courses'
            }
            className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mb-1 hover:underline"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{isEditing ? 'חזרה לפרטי המטלה' : 'חזרה לקורס'}</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {isEditing ? `עריכת מטלה: ${title || existingAssignment?.title || ''}` : 'יצירת מטלה חדשה'}
          </h1>
        </div>

        {/* Delete option when editing */}
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>מחק מטלה</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Course & Unit Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              שיוך לקורס
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              שיוך ליחידת לימוד (שבוע)
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {selectedCourse && selectedCourse.units.length > 0 ? (
                selectedCourse.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    שבוע {u.weekNumber}: {u.title}
                  </option>
                ))
              ) : (
                <option value="">אין יחידות לימוד – נא להוסיף יחידה תחילה</option>
              )}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            כותרת המטלה <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="למשל: מטלה 3: מימוש עץ AVL ואיזון צמתים"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            הנחיות למטלה ודגשי בדיקה
          </label>
          <textarea
            rows={5}
            placeholder="פרט את דרישות המטלה, סעיפי השאלות, מבנה הקבצים המבוקש ומקרי קצה..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
          />
        </div>

        {/* Due Date & Max Grade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              תאריך יעד אחרון להגשה <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              שעת יעד אחרונה (נעילת חלון) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="time"
                required
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ציון מקסימלי (נקודות)
            </label>
            <div className="relative">
              <Award className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min={ACADEMIC_THRESHOLDS.MAX_GRADE_MIN_ALLOWED}
                max={ACADEMIC_THRESHOLDS.MAX_GRADE_MAX_ALLOWED}
                value={maxGrade}
                onChange={(e) => setMaxGrade(Number(e.target.value))}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {isDueInPast && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>מועד ההגשה שנבחר הוא בעבר. נא לקבוע מועד עתידי לצורך פתיחת חלון ההגשות.</span>
          </div>
        )}

        {/* Checkboxes for allowed submission formats */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            פורמטים מורשים להגשת הסטודנט:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { ext: '.pdf', label: 'קובץ מסמך (PDF)' },
              { ext: '.zip', label: 'ארכיון מכווץ (ZIP)' },
              { ext: '.py', label: 'קוד Python (.py)' },
              { ext: '.java', label: 'קוד Java (.java)' },
              { ext: '.cpp', label: 'קוד C++ (.cpp)' },
              { ext: '.sql', label: 'סקריפט SQL (.sql)' },
            ].map(({ ext, label }) => {
              const isChecked = allowedFormats.includes(ext);
              return (
                <label
                  key={ext}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleFormatToggle(ext)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() =>
              navigate(
                isEditing && assignmentId
                  ? `/courses/${selectedCourseId}/assignments/${assignmentId}`
                  : `/courses/${selectedCourseId}`
              )
            }
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            ביטול
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isEditing && (
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>שמור כטיוטה</span>
              </button>
            )}

            <button
              type="button"
              disabled={!isFormValid}
              onClick={() => handleSubmit('published')}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'שמור שינויים במטלה' : 'פרסם מטלה לסטודנטים'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="מחיקת מטלה"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">האם את/ה בטוח/ה שברצונך למחוק מטלה זו?</p>
              <p>
                פעולה זו תמחק לצמיתות את המטלה <strong>"{title || existingAssignment?.title}"</strong> ואת כל ההגשות והציונים המשויכים אליה.
              </p>
              <p className="text-rose-600 dark:text-rose-400 font-semibold pt-1">
                לא ניתן לבטל פעולה זו לאחר הביצוע.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleDeleteAssignment}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>כן, מחק מטלה זו</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
