/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { AssignmentService } from '../services/assignmentService';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { ROLES, FILE_UPLOAD_LIMITS } from '../config/constants';
import { Material, LearningUnit, Assignment } from '../types';
import {
  BookOpen,
  FileText,
  Plus,
  Upload,
  Sparkles,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'materials' | 'assignments'>('materials');
  const [course, setCourse] = useState(() => CourseService.getCourseById(courseId || ''));
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    AssignmentService.getAssignments(courseId)
  );

  // Expanded weeks state
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (course) {
      course.units.forEach((u) => {
        init[u.id] = true;
      });
    }
    return init;
  });

  // Modal: Add Unit
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newUnitDescription, setNewUnitDescription] = useState('');
  const [newUnitWeek, setNewUnitWeek] = useState(1);

  // Modal: Upload Material
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Modal: Edit Material
  const [editingMaterial, setEditingMaterial] = useState<{
    unitId: string;
    material: Material;
  } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Modal: Delete Material Confirmation
  const [deletingMaterial, setDeletingMaterial] = useState<{
    unitId: string;
    materialId: string;
    materialTitle: string;
  } | null>(null);

  if (!course) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold">הקורס לא נמצא</h2>
        <Link to="/courses" className="text-indigo-600 underline text-sm mt-2 inline-block">
          חזרה לרשימת הקורסים
        </Link>
      </div>
    );
  }

  const isStaff = role === ROLES.LECTURER || role === ROLES.TA || role === ROLES.ADMIN;
  const canManageCourse = role === ROLES.LECTURER || role === ROLES.ADMIN;
  const canUploadMaterials = role === ROLES.LECTURER || role === ROLES.TA || role === ROLES.ADMIN;
  const canReviewSubmissions = role === ROLES.LECTURER || role === ROLES.TA || role === ROLES.ADMIN;

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const handleAddUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitTitle.trim()) return;

    const newUnit = CourseService.addLearningUnit(course.id, {
      title: newUnitTitle.trim(),
      description: newUnitDescription.trim(),
      weekNumber: Number(newUnitWeek),
    });

    if (newUnit) {
      setCourse(CourseService.getCourseById(course.id));
      setShowAddUnitModal(false);
      setNewUnitTitle('');
      setNewUnitDescription('');
      showToast('יחידת הלימוד נוספה בהצלחה', 'success');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = CourseService.validateMaterialFile(file);
      if (!validation.isValid) {
        setUploadError(validation.error || 'קובץ לא תקין');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!uploadTitle) {
        // Strip extension for title
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedUnitId) {
      setUploadError('נא לבחור קובץ ויחידת לימוד');
      return;
    }

    setUploadError('');
    setIsUploading(true);
    setUploadProgress(10);

    try {
      await CourseService.uploadMaterial(
        course.id,
        selectedUnitId,
        {
          file: selectedFile,
          title: uploadTitle,
          description: uploadDesc,
        },
        (progress) => setUploadProgress(progress)
      );

      setCourse(CourseService.getCourseById(course.id));
      setIsUploading(false);
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadProgress(0);
      showToast('חומר הלימוד הועלה בהצלחה!', 'success');
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err.message || 'שגיאה בהעלאת הקובץ');
    }
  };

  const handleEditMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial || !editTitle.trim()) return;

    CourseService.editMaterial(course.id, editingMaterial.unitId, editingMaterial.material.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
    });

    setCourse(CourseService.getCourseById(course.id));
    setEditingMaterial(null);
    showToast('חומר הלימוד עודכן בהצלחה', 'success');
  };

  const handleDeleteMaterialConfirm = () => {
    if (!deletingMaterial) return;

    CourseService.deleteMaterial(course.id, deletingMaterial.unitId, deletingMaterial.materialId);
    setCourse(CourseService.getCourseById(course.id));
    setDeletingMaterial(null);
    showToast('חומר הלימוד נמחק מהקורס', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Course Hero Banner with image overlay */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-slate-900">
        <div className="h-56 sm:h-64 w-full relative">
          <img
            src={course.coverImage}
            alt={course.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-black/30" />

          {/* Banner text & actions */}
          <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between z-10">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-md text-white border border-white/20">
                {course.code} · {course.department}
              </span>
              <span
                className="w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: course.accentColor }}
                title="צבע זיהוי הקורס"
              />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-sm">
                {course.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl line-clamp-2">
                {course.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-3">
                <span>מרצה: {course.lecturerName}</span>
                <span>·</span>
                <span>{course.semester}</span>
                <span>·</span>
                <span>{course.units.length} שבועות לימוד</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Quick Banner (Scenario 3 Gateway) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-teal-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              עוזר ה-AI החכם של הקורס זמין עבורך
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              צ׳אט חכם עם הקשר הקורס, מחולל סיכומים, מחולל תרגולים עם אבחון נושאים חלשים ומשוב אוטומטי על מטלות
            </p>
          </div>
        </div>
        <Link
          to={`/ai-assistant?courseId=${course.id}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>פתח את עוזר ה-AI</span>
        </Link>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
              activeTab === 'materials'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            חומרי לימוד ({course.units.reduce((acc, u) => acc + u.materials.length, 0)})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
              activeTab === 'assignments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            מטלות והגשות ({assignments.length})
          </button>
        </div>

        {/* Staff Quick Actions */}
        {isStaff && (
          <div className="flex flex-wrap items-center gap-2">
            {canManageCourse && (
              <button
                onClick={() => {
                  setNewUnitWeek(course.units.length + 1);
                  setShowAddUnitModal(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>הוסף יחידת לימוד חדשה</span>
              </button>
            )}

            {canUploadMaterials && (
              <button
                onClick={() => {
                  if (course.units.length > 0) {
                    setSelectedUnitId(course.units[0].id);
                  }
                  setShowUploadModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>העלה חומר לימוד</span>
              </button>
            )}

            {canManageCourse && (
              <Link
                to={`/courses/${course.id}/assignments/new`}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>צור מטלה חדשה</span>
              </Link>
            )}

            {canReviewSubmissions && (
              <Link
                to={`/lecturer/grading?courseId=${course.id}`}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100 text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>בדיקות והגשות הקורס</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Materials Tab: Organized by Learning Units (Weeks) */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {course.units.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="טרם נוספו יחידות לימוד לקורס זה"
              description="המרצה טרם פרסם תכנים לקורס. התכנים יתעדכנו בהמשך הסמסטר."
              actionText={canManageCourse ? 'הוסף שבוע לימוד ראשון' : undefined}
              onAction={canManageCourse ? () => setShowAddUnitModal(true) : undefined}
            />
          ) : (
            course.units.map((unit) => {
              const isExpanded = expandedUnits[unit.id] ?? true;
              return (
                <div
                  key={unit.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
                >
                  {/* Unit Header Accordion */}
                  <div
                    onClick={() => toggleUnit(unit.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shrink-0">
                        {unit.weekNumber}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {unit.title}
                        </h3>
                        {unit.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {unit.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{unit.materials.length} קבצים</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Unit Materials List */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-3">
                      {unit.materials.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-400">
                          אין קבצים ביחידה זו עדיין.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {unit.materials.map((mat) => {
                            let badgeBg = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
                            if (mat.fileType === 'docx') badgeBg = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
                            if (mat.fileType === 'pptx') badgeBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                            return (
                              <div
                                key={mat.id}
                                className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors group"
                              >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm shrink-0 mt-0.5">
                                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {mat.title}
                                      </h4>
                                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${badgeBg}`}>
                                        {mat.fileType}
                                      </span>
                                    </div>
                                    {mat.description && (
                                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {mat.description}
                                      </p>
                                    )}
                                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                      <span>{mat.fileSize}</span>
                                      <span>·</span>
                                      <span>{new Date(mat.uploadedAt).toLocaleDateString('he-IL')}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions: Edit, Delete (if staff), or Download simulated */}
                                <div className="flex items-center gap-1 shrink-0 ms-2">
                                  {canUploadMaterials && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingMaterial({ unitId: unit.id, material: mat });
                                          setEditTitle(mat.title);
                                          setEditDesc(mat.description);
                                        }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 transition-colors"
                                        title="ערוך פרטי קובץ"
                                        aria-label="ערוך חומר לימוד"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          setDeletingMaterial({
                                            unitId: unit.id,
                                            materialId: mat.id,
                                            materialTitle: mat.title,
                                          })
                                        }
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                        title="מחק קובץ מהקורס"
                                        aria-label="מחק חומר לימוד"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <a
                                    href="#download"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      showToast(`הורדת הקובץ "${mat.fileName}" החלה`, 'info');
                                    }}
                                    className="p-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                  >
                                    הורדה
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {assignments.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="אין מטלות שפורסמו בקורס זה עדיין"
              description="המטלות יופיעו כאן עם תאריכי יעד וספירה לאחור."
              actionText={canManageCourse ? 'צור מטלה ראשונה' : undefined}
              onAction={canManageCourse ? () => navigate(`/courses/${course.id}/assignments/new`) : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((assignment) => {
                const isPast = new Date(assignment.dueDate).getTime() < Date.now();
                const studentSub = currentUser
                  ? AssignmentService.getStudentSubmission(assignment.id, currentUser.id)
                  : undefined;

                return (
                  <div
                    key={assignment.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          ציון מקסימלי: {assignment.maxGrade}
                        </span>
                        {/* Countdown or expired */}
                        <CountdownTimer dueDate={assignment.dueDate} />
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                        {assignment.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                        {assignment.instructions}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      {/* Submission status for student */}
                      {role === ROLES.STUDENT && (
                        <div>
                          {studentSub ? (
                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                הוגש {studentSub.grade !== undefined ? `(ציון: ${studentSub.grade})` : ''}
                              </span>
                            </span>
                          ) : isPast ? (
                            <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>טרם הוגש (נעול)</span>
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600">טרם הוגש</span>
                          )}
                        </div>
                      )}

                      {/* Staff submissions count */}
                      {isStaff && (
                        <div className="text-xs text-slate-500">
                          {AssignmentService.getSubmissionsForAssignment(assignment.id).length} הגשות התקבלו
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {canManageCourse && (
                          <Link
                            to={`/courses/${course.id}/assignments/${assignment.id}/edit`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="ערוך מטלה"
                            aria-label="ערוך מטלה"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                        )}

                        <Link
                          to={
                            isStaff
                              ? `/lecturer/grading?courseId=${course.id}&assignmentId=${assignment.id}`
                              : `/courses/${course.id}/assignments/${assignment.id}`
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
                        >
                          {isStaff ? 'בדוק הגשות' : 'צפייה והגשה'}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Learning Unit */}
      <Modal
        isOpen={showAddUnitModal}
        onClose={() => setShowAddUnitModal(false)}
        title="הוספת יחידת לימוד חדשה לקורס"
      >
        <form onSubmit={handleAddUnitSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              מספר שבוע
            </label>
            <input
              type="number"
              min={1}
              max={30}
              required
              value={newUnitWeek}
              onChange={(e) => setNewUnitWeek(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              כותרת יחידת הלימוד
            </label>
            <input
              type="text"
              required
              placeholder="למשל: שבוע 4: עצי AVL ורוטציות"
              value={newUnitTitle}
              onChange={(e) => setNewUnitTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              תיאור קצר (אופציונלי)
            </label>
            <textarea
              rows={3}
              placeholder="נושאי ההרצאה המרכזיים, מטרות למידה..."
              value={newUnitDescription}
              onChange={(e) => setNewUnitDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddUnitModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              הוסף יחידה
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Upload Material (PDF, DOCX, PPTX ONLY) */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => !isUploading && setShowUploadModal(false)}
        title="העלאת חומר לימוד לקורס"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              בחר יחידת לימוד (שבוע)
            </label>
            <select
              required
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              {course.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              בחר קובץ (פורמטים מורשים: PDF, DOCX, PPTX בלבד)
            </label>
            <input
              type="file"
              required
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:me-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <div className="text-[11px] text-slate-400 mt-1">
              מגבלת גודל: עד {FILE_UPLOAD_LIMITS.MAX_FILE_SIZE_MB}MB לקובץ.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              כותרת הקובץ לתצוגה
            </label>
            <input
              type="text"
              required
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="למשל: שקפי הרצאה 4 - עצי AVL"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <input
              type="text"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="הסבר תמציתי על תוכן הקובץ..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>מעלה קובץ לשרת...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setShowUploadModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50"
            >
              {isUploading ? 'מעלה...' : 'העלה קובץ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Material */}
      <Modal
        isOpen={!!editingMaterial}
        onClose={() => setEditingMaterial(null)}
        title="עריכת פרטי חומר לימוד"
      >
        <form onSubmit={handleEditMaterialSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              שם החומר
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              תיאור
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingMaterial(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              שמור שינויים
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete Material */}
      <Modal
        isOpen={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        title="אישור מחיקת חומר לימוד"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            האם את/ה בטוח/ה שברצונך למחוק את הקובץ{' '}
            <strong className="text-slate-900 dark:text-white">
              "{deletingMaterial?.materialTitle}"
            </strong>{' '}
            מתוך הקורס? פעולה זו תסיר את הקובץ מגישת הסטודנטים.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeletingMaterial(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleDeleteMaterialConfirm}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
            >
              מחק קובץ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
