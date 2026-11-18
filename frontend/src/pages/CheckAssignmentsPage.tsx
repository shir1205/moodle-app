/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { AssignmentService } from '../services/assignmentService';
import { Submission, RubricCriterion, SubmissionVersion } from '../types';
import { Modal } from '../components/common/Modal';
import { ROLES } from '../config/constants';
import {
  FileCheck,
  Award,
  BookOpen,
  Filter,
  Download,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
  History,
  GitCompare,
  Sliders,
  Check,
  FileCode,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronDown,
  ArrowRight,
  Code2,
} from 'lucide-react';

// Built-in standard rubric criteria for academic assignments
const DEFAULT_RUBRICS: RubricCriterion[] = [
  {
    id: 'rubric-correctness',
    name: 'נכונות אלגוריתמית וקוד',
    maxPoints: 40,
    levels: [
      {
        levelId: 'c-40',
        title: 'מעולה (40 נק\')',
        points: 40,
        description: 'הפתרון נכון לחלוטין, עובר 100% ממבחני הקצה ומטפל בכל חריגה אפשרית.',
      },
      {
        levelId: 'c-32',
        title: 'טוב מאוד (32 נק\')',
        points: 32,
        description: 'הקוד תקין ועובר את רוב הבדיקות, קיים פגם קל בטיפול במקרה קצה בודד.',
      },
      {
        levelId: 'c-22',
        title: 'בינוני (22 נק\')',
        points: 22,
        description: 'הקוד פועל עבור קלטים בסיסיים בלבד, שגיאות זמן ריצה בקלט מורכב.',
      },
      {
        levelId: 'c-10',
        title: 'טעון שיפור (10 נק\')',
        points: 10,
        description: 'שגיאות לוגיות מהותיות במימוש האלגוריתם, אי-עמידה בדרישות הסף.',
      },
    ],
  },
  {
    id: 'rubric-complexity',
    name: 'סיבוכיות זמן וזיכרון',
    maxPoints: 20,
    levels: [
      {
        levelId: 'cmp-20',
        title: 'אופטימלי (20 נק\')',
        points: 20,
        description: 'עמידה מלאה ביעדי סיבוכיות המטלה O(N log N) או O(N) ושימוש מזערי בזיכרון עזר.',
      },
      {
        levelId: 'cmp-15',
        title: 'סביר (15 נק\')',
        points: 15,
        description: 'הפתרון עובד אך דורש אופטימיזציה נוספת (למשל שימוש בלולאה מקוננת O(N^2)).',
      },
      {
        levelId: 'cmp-8',
        title: 'לקוי (8 נק\')',
        points: 8,
        description: 'צוואר בקבוק משמעותי בזמן ריצה או הקצאת זיכרון בלתי יעילה.',
      },
    ],
  },
  {
    id: 'rubric-style',
    name: 'סגנון, מודולריות ותקן קוד',
    maxPoints: 20,
    levels: [
      {
        levelId: 's-20',
        title: 'מעולה (20 נק\')',
        points: 20,
        description: 'חלוקה מודולרית מושלמת לפונקציות קצרות, שמות אינפורמטיביים והקפדה על PEP-8.',
      },
      {
        levelId: 's-15',
        title: 'טוב (15 נק\')',
        points: 15,
        description: 'קוד קריא ומסודר ברובו, כפילות קוד קלה או שמות משתנים שניתן לשפר.',
      },
      {
        levelId: 's-8',
        title: 'לקוי (8 נק\')',
        points: 8,
        description: 'קוד ספגטי מונוליתי ללא חלוקה לפונקציות, שמות אותיות יחידות לא ברורים.',
      },
    ],
  },
  {
    id: 'rubric-docs',
    name: 'תיעוד, בדיקות קצה ו-Docstrings',
    maxPoints: 20,
    levels: [
      {
        levelId: 'd-20',
        title: 'מלא (20 נק\')',
        points: 20,
        description: 'תיעוד עשיר, הסבר טענות כניסה ויציאה וסט בדיקות יחידה (Unit Tests) מקיף.',
      },
      {
        levelId: 'd-14',
        title: 'חלקי (14 נק\')',
        points: 14,
        description: 'הערות בסיסיות על הפונקציות אך חסר פירוט על הנחות יסוד ומקרי שגיאה.',
      },
      {
        levelId: 'd-6',
        title: 'חסר (6 נק\')',
        points: 6,
        description: 'כמעט ללא הערות או תיעוד, ללא בדיקות עצמיות.',
      },
    ],
  },
];

// Rich mock version histories for demonstration
const MOCK_VERSION_HISTORIES: Record<string, { versions: SubmissionVersion[]; diffSummary: string }> = {
  'sub-1': {
    versions: [
      {
        versionNumber: 1,
        submittedAt: '2025-10-13T14:15:20Z',
        fileName: 'Dana_Cohen_HW1_v1.py',
        fileSize: '14 KB',
        comment: 'גרסה ראשונית של התרגיל: מימוש בסיסי של הפונקציות המבוקשות.',
        codePreview: `def calculate_statistics(numbers):
    # Initial implementation
    if len(numbers) == 0:
        return 0, 0, 0
    total = sum(numbers)
    mean = total / len(numbers)
    # TODO: implement proper variance and std
    return mean, 0, 0`,
      },
      {
        versionNumber: 2,
        submittedAt: '2025-10-14T18:22:10Z',
        fileName: 'Dana_Cohen_HW1.py',
        fileSize: '18 KB',
        comment: 'גרסה מעודכנת וסופית: תיקון חישוב סטיית תקן, טיפול במקרה קצה של קלט ריק, הוספת docstrings ובדיקות יחידה.',
        codePreview: `def calculate_statistics(numbers: list[float]) -> tuple[float, float, float]:
    """Calculates mean, median, and sample standard deviation."""
    if not numbers:
        raise ValueError("List cannot be empty")
    n = len(numbers)
    mean = sum(numbers) / n
    sorted_nums = sorted(numbers)
    median = sorted_nums[n // 2] if n % 2 != 0 else (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in numbers) / (n - 1 if n > 1 else 1)
    std_dev = variance ** 0.5
    return mean, median, std_dev`,
      },
    ],
    diffSummary: 'בגרסה 2 נוספו 14 שורות קוד: הוספת הגדרת Type Hints, טיפול בחריגת ValueError לקלט ריק, וחישוב מדויק של שונות וחציון.',
  },
};

export const CheckAssignmentsPage: React.FC = () => {
  const { currentUser, role } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const urlCourseId = searchParams.get('courseId');
  const urlAssignmentId = searchParams.get('assignmentId');

  const userRoleKey = role === ROLES.TA ? 'ta' : role === ROLES.ADMIN ? 'admin' : 'lecturer';
  const courses = CourseService.getCoursesForUser(
    currentUser?.id || '',
    userRoleKey,
    currentUser?.assignedCourseIds || []
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    if (urlCourseId && courses.some((c) => c.id === urlCourseId)) {
      return urlCourseId;
    }
    return courses.length > 0 ? courses[0].id : '';
  });

  const assignments = AssignmentService.getAssignments(selectedCourseId);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    if (urlAssignmentId && assignments.some((a) => a.id === urlAssignmentId)) {
      return urlAssignmentId;
    }
    return assignments.length > 0 ? assignments[0].id : '';
  });

  const [submissionsList, setSubmissionsList] = useState<Submission[]>(() =>
    AssignmentService.getSubmissionsForAssignment(selectedAssignmentId)
  );

  const activeAssignment = AssignmentService.getAssignmentById(selectedAssignmentId);

  // Sync state if selected assignment changes
  useEffect(() => {
    setSubmissionsList(AssignmentService.getSubmissionsForAssignment(selectedAssignmentId));
  }, [selectedAssignmentId]);

  // Grading modal state
  const [gradingSub, setGradingSub] = useState<Submission | null>(null);
  const [inputGrade, setInputGrade] = useState<number>(85);
  const [inputFeedback, setInputFeedback] = useState<string>('');
  const [gradeError, setGradeError] = useState<string>('');
  const [activeGradingTab, setActiveGradingTab] = useState<'rubric' | 'direct'>('rubric');

  // Rubric scores tracking
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({
    'rubric-correctness': 32,
    'rubric-complexity': 20,
    'rubric-style': 20,
    'rubric-docs': 14,
  });

  // AI Auto-grading Assistant State
  const [isAiGrading, setIsAiGrading] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggestedGrade: number;
    feedback: string;
    scores: Record<string, number>;
  } | null>(null);

  // Version History Modal State
  const [versionModalSub, setVersionModalSub] = useState<Submission | null>(null);
  const [activeVersionTab, setActiveVersionTab] = useState<'versions' | 'diff'>('versions');

  // Recalculate inputGrade whenever rubricScores changes in rubric tab
  const handleSelectRubricLevel = (criterionId: string, points: number) => {
    const updated = { ...rubricScores, [criterionId]: points };
    setRubricScores(updated);
    const sum = Object.values(updated).reduce((acc, curr) => acc + curr, 0);
    setInputGrade(sum);
  };

  const handleOpenGrading = (sub: Submission) => {
    setGradingSub(sub);
    setAiSuggestion(null);
    setGradeError('');
    setActiveGradingTab('rubric');

    if (sub.grade !== undefined) {
      setInputGrade(sub.grade);
      setInputFeedback(sub.feedback || '');
    } else {
      // Default to initial rubric score sum
      const sum = Object.values(rubricScores).reduce((acc, curr) => acc + curr, 0);
      setInputGrade(sum);
      setInputFeedback(
        'עבודה ראויה להערכה. הקוד עובד כנדרש. שימת לב מיוחדת להמשך בהוספת הערות לפונקציות מורכבות.'
      );
    }
  };

  const handleRunAiAutoGrading = () => {
    if (!gradingSub) return;
    setIsAiGrading(true);

    setTimeout(() => {
      setIsAiGrading(false);
      const isDana = gradingSub.studentName.includes('דנה');
      const suggestedGrade = isDana ? 94 : 88;
      const scores = isDana
        ? {
            'rubric-correctness': 40,
            'rubric-complexity': 20,
            'rubric-style': 20,
            'rubric-docs': 14,
          }
        : {
            'rubric-correctness': 32,
            'rubric-complexity': 20,
            'rubric-style': 15,
            'rubric-docs': 20,
          };

      const feedback = `הערכה ראשונית אוטומטית (AI Assistant):
1. נכונות קוד: הפתרון עבר בהצלחה 100% ממבחני הקצה, כולל טיפול בקלט ריק ובדיקת גבולות.
2. סיבוכיות: המימוש עומד ביעדי הסיבוכיות הנדרשים O(N log N) ללא הקצאות זיכרון מיותרות.
3. סגנון ותיעוד: הקוד נקי ומודולרי לפי תקן PEP-8 עם docstrings מפורטים.
המלצת ציון על פי מחוון המטלה: ${suggestedGrade} נקודות.`;

      setAiSuggestion({ suggestedGrade, feedback, scores });
      showToast('הצעת ציון ומשוב אוטומטי מבוסס AI הופקו בהצלחה!', 'info');
    }, 900);
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setInputGrade(aiSuggestion.suggestedGrade);
    setInputFeedback(aiSuggestion.feedback);
    setRubricScores(aiSuggestion.scores);
    showToast('הצעת ה-AI הוחלה בהצלחה על המחוון וטופס המשוב!', 'success');
  };

  const handleGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSub || !activeAssignment) return;

    if (inputGrade < 0 || inputGrade > activeAssignment.maxGrade) {
      setGradeError(`הציון חייב להיות בין 0 ל-${activeAssignment.maxGrade}`);
      return;
    }

    const res = AssignmentService.gradeSubmission({
      submissionId: gradingSub.id,
      grade: Number(inputGrade),
      feedback: inputFeedback.trim(),
      gradedBy: currentUser?.name || (role === ROLES.TA ? 'מתרגל הקורס' : 'מרצה הקורס'),
    });

    if (!res.success) {
      setGradeError(res.error || 'שגיאה בשמירת הציון');
      return;
    }

    setSubmissionsList(AssignmentService.getSubmissionsForAssignment(selectedAssignmentId));
    setGradingSub(null);
    showToast(`הציון ${inputGrade} פורסם בהצלחה והודעה נשלחה לסטודנט/ית!`, 'success');
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    const nextAssigns = AssignmentService.getAssignments(courseId);
    const nextAssignId = nextAssigns.length > 0 ? nextAssigns[0].id : '';
    setSelectedAssignmentId(nextAssignId);
    setSubmissionsList(AssignmentService.getSubmissionsForAssignment(nextAssignId));
  };

  const handleAssignmentChange = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setSubmissionsList(AssignmentService.getSubmissionsForAssignment(assignmentId));
  };

  const currentCourse =
    courses.find((c) => c.id === selectedCourseId) ||
    CourseService.getCourseById(selectedCourseId);
  const enrolledStudentCount = currentCourse ? currentCourse.enrolledStudentIds.length : 0;
  const totalSubmissions = submissionsList.length;
  const notSubmittedCount = Math.max(0, enrolledStudentCount - totalSubmissions);
  const gradedCount = submissionsList.filter(
    (s) => s.status === 'graded' || s.grade !== undefined
  ).length;
  const pendingReviewCount = submissionsList.filter(
    (s) => s.status !== 'graded' && s.grade === undefined
  ).length;
  const lateCount = submissionsList.filter((s) => s.isLate).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-bold mb-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>בדיקה מתקדמת: מחוונים (Rubrics), סיוע AI והשוואת גרסאות הגשה</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-teal-600" />
            <span>בדיקות והגשות (Submissions & Grading)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            סקירת פתרונות, מתן ציונים על פי מחוון רב-קריטריונים, סיוע AI בבדיקה ומעקב גרסאות סטודנט
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <select
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
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
              onChange={(e) => handleAssignmentChange(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TOP 5 KPI OVERVIEW CARDS (rounded-2xl) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total submitted out of enrolled */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">סך ההגשות</span>
            <FileCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalSubmissions}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              / {enrolledStudentCount} רשומים
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">שיעור הגשה כולל</div>
        </div>

        {/* KPI 2: Not submitted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">טרם הוגש</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300">
            {notSubmittedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">סטודנטים ללא הגשה</div>
        </div>

        {/* KPI 3: Graded */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">נבדקו</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {gradedCount}
          </div>
          <div className="text-[11px] text-emerald-600/80 font-medium mt-1">הוזן ציון ומשוב</div>
        </div>

        {/* KPI 4: Pending Review - PROMINENT IN AMBER/YELLOW */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 shadow-sm flex flex-col justify-between ring-2 ring-amber-400/20">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-200 mb-2">
            <span className="text-xs font-black">ממתינות לבדיקה</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-200">
            {pendingReviewCount}
          </div>
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-1">
            דורשות מתן ציון ע״י מתרגל/מרצה
          </div>
        </div>

        {/* KPI 5: Late Submissions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">הוגשו באיחור</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {lateCount}
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-1">לאחר תאריך היעד</div>
        </div>
      </div>

      {/* Submissions List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              הגשות עבור: {activeAssignment ? activeAssignment.title : 'המטלה שנבחרה'}
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              ציון מרבי: {activeAssignment ? activeAssignment.maxGrade : 100} נקודות · מועד אחרון:{' '}
              {activeAssignment && new Date(activeAssignment.dueDate).toLocaleString('he-IL')}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              סך הכל {submissionsList.length} הגשות במערכת
            </span>
          </div>
        </div>

        {submissionsList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            אין הגשות הממתינות לבדיקה במטלה זו.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3 text-start">שם סטודנט/ית</th>
                  <th className="py-2.5 px-3 text-start">תאריך ושעת הגשה</th>
                  <th className="py-2.5 px-3 text-start">עמידה בזמנים</th>
                  <th className="py-2.5 px-3 text-start">גרסה</th>
                  <th className="py-2.5 px-3 text-start">קובץ שהוגש</th>
                  <th className="py-2.5 px-3 text-start">סטטוס בדיקה</th>
                  <th className="py-2.5 px-3 text-start">ציון נוכחי</th>
                  <th className="py-2.5 px-3 text-end">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {submissionsList.map((sub) => {
                  const hasVersions = !!MOCK_VERSION_HISTORIES[sub.id];
                  const versionCount = hasVersions ? 2 : 1;
                  const isGraded = sub.status === 'graded' || sub.grade !== undefined;

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Student Name + Avatar */}
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            {sub.studentName.slice(0, 2)}
                          </div>
                          <span>{sub.studentName}</span>
                        </div>
                      </td>

                      {/* 2. Exact Submission Date & Time */}
                      <td className="py-3 px-3 tabular-nums text-slate-600 dark:text-slate-300">
                        <div>{new Date(sub.submittedAt).toLocaleDateString('he-IL')}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(sub.submittedAt).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* 3. Timeliness Badge: On-time (green) / Late (red) */}
                      <td className="py-3 px-3">
                        {sub.isLate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>איחור</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>הוגש בזמן</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Version Badge & History Diff Modal Trigger */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setVersionModalSub(sub);
                            setActiveVersionTab('versions');
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${
                            versionCount > 1
                              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                          title="לחץ לצפייה בהיסטוריית גרסאות והשוואת שינויים (Diff)"
                        >
                          <History className="w-3 h-3" />
                          <span>גרסה {versionCount}</span>
                        </button>
                      </td>

                      {/* 5. Download / View File Link */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() =>
                            showToast(`הורדת קובץ הפתרון "${sub.fileName}" החלה`, 'info')
                          }
                          className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-[11px]"
                          title="הורד קובץ פתרון"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[130px]">{sub.fileName}</span>
                        </button>
                      </td>

                      {/* 6. Review Status: Pending (Amber) vs Graded (Emerald) */}
                      <td className="py-3 px-3">
                        {isGraded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>נבדק</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>ממתין לבדיקה</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Current Grade */}
                      <td className="py-3 px-3 font-bold tabular-nums">
                        {sub.grade !== undefined ? (
                          <span
                            className={
                              sub.grade >= 60
                                ? 'text-teal-600 dark:text-teal-400 font-extrabold'
                                : 'text-rose-600 dark:text-rose-400 font-extrabold'
                            }
                          >
                            {sub.grade} / {activeAssignment?.maxGrade || 100}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">טרם הוזן</span>
                        )}
                      </td>

                      {/* 8. Action Button: "בדוק הגשה" or "ערוך ציון ומשוב" */}
                      <td className="py-3 px-3 text-end">
                        <button
                          onClick={() => handleOpenGrading(sub)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ms-auto shadow-xs ${
                            isGraded
                              ? 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{isGraded ? 'ערוך ציון ומשוב' : 'בדוק הגשה'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADVANCED GRADING WITH RUBRICS & AI AUTO-GRADING */}
      <Modal
        isOpen={!!gradingSub}
        onClose={() => setGradingSub(null)}
        title={`בדיקת פתרון והזנת מחוון: ${gradingSub?.studentName}`}
        maxWidth="3xl"
      >
        <form onSubmit={handleGradeSubmit} className="space-y-5">
          {/* Top File Summary Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-white">
                  {gradingSub?.fileName}
                </span>
                <span className="text-slate-400">({gradingSub?.fileSize})</span>
              </div>
              <div className="text-slate-500">
                הוגש: {gradingSub && new Date(gradingSub.submittedAt).toLocaleString('he-IL')} ·
                גרסה 2 מתוך 2
              </div>
            </div>

            {/* AI Auto-grading Trigger Button */}
            <button
              type="button"
              disabled={isAiGrading}
              onClick={handleRunAiAutoGrading}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiGrading ? 'מנתח פתרון בעזרת AI...' : 'סיוע AI להערכה אוטומטית'}</span>
            </button>
          </div>

          {/* AI Suggestion Banner if Generated */}
          {aiSuggestion && (
            <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>הצעת הערכה אוטומטית מטעם ה-AI (ציון מוערך: {aiSuggestion.suggestedGrade}/100)</span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAiSuggestion}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  החל הצעה זו על המחוון
                </button>
              </div>
              <div className="text-xs text-indigo-900 dark:text-indigo-200 font-sans leading-relaxed whitespace-pre-wrap">
                {aiSuggestion.feedback}
              </div>
            </div>
          )}

          {/* Grading Mode Tabs: Rubric vs Direct */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs font-bold gap-4">
            <button
              type="button"
              onClick={() => setActiveGradingTab('rubric')}
              className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeGradingTab === 'rubric'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>מטריצת הערכה מובנית (Rubrics)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveGradingTab('direct')}
              className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeGradingTab === 'direct'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>הזנת ציון ישירה</span>
            </button>
          </div>

          {/* TAB: RUBRICS MATRIX */}
          {activeGradingTab === 'rubric' ? (
            <div className="space-y-4 max-h-[380px] overflow-y-auto pe-1">
              {DEFAULT_RUBRICS.map((criterion) => {
                const currentScore = rubricScores[criterion.id] ?? criterion.levels[0].points;

                return (
                  <div
                    key={criterion.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{criterion.name}</span>
                        <span className="text-slate-400 font-normal">
                          (עד {criterion.maxPoints} נק')
                        </span>
                      </div>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                        נוקד: {currentScore} / {criterion.maxPoints}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {criterion.levels.map((lvl) => {
                        const isSelected = currentScore === lvl.points;

                        return (
                          <button
                            key={lvl.levelId}
                            type="button"
                            onClick={() => handleSelectRubricLevel(criterion.id, lvl.points)}
                            className={`p-2.5 rounded-xl border text-start transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[11px] font-bold ${
                                  isSelected
                                    ? 'text-teal-900 dark:text-teal-200'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {lvl.title}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug">
                              {lvl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ציון ידני ישיר (0 - {activeAssignment?.maxGrade || 100})
              </label>
              <input
                type="number"
                min={0}
                max={activeAssignment?.maxGrade || 100}
                value={inputGrade}
                onChange={(e) => setInputGrade(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>
          )}

          {/* Total Grade Summary Bar */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ציון סופי מחושב במטלה:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                {inputGrade}
              </span>
              <span className="text-xs text-slate-400">
                / {activeAssignment?.maxGrade || 100}
              </span>
            </div>
          </div>

          {/* Feedback Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              משוב פדגוגי והערות מילוליות לסטודנט
            </label>
            <textarea
              rows={4}
              placeholder="כתוב פירוט על נקודות חוזק, הצעות לשיפור או הערות ספציפיות על הקוד..."
              value={inputFeedback}
              onChange={(e) => setInputFeedback(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans leading-relaxed"
            />
          </div>

          {gradeError && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
              {gradeError}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setGradingSub(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>פרסם ציון ומשוב</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: SUBMISSION VERSION HISTORY & CODE DIFF INSPECTION */}
      <Modal
        isOpen={!!versionModalSub}
        onClose={() => setVersionModalSub(null)}
        title={`מעקב גרסאות פתרון: ${versionModalSub?.studentName}`}
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {/* Subheader Information */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                מעקב שינויים והיסטוריית הגשות לפני מועד הסגירה (Deadline)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                הוגש בזמן חלון ההגשה ✓
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              סטודנטים רשאים לעדכן גרסת פתרון עד למועד האחרון. המערכת שומרת ארכיון גרסאות מלא לצורכי השוואה ובקרה.
            </p>
          </div>

          {/* Tabs: Versions Timeline vs Code Diff */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs font-bold gap-4">
            <button
              type="button"
              onClick={() => setActiveVersionTab('versions')}
              className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeVersionTab === 'versions'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>ציר זמן של גרסאות (2)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVersionTab('diff')}
              className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeVersionTab === 'diff'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>השוואת הבדלים בין הגשות (Diff View)</span>
            </button>
          </div>

          {activeVersionTab === 'versions' ? (
            /* Versions List Timeline */
            <div className="space-y-3">
              {/* Version 2 (Current) */}
              <div className="p-4 rounded-xl border-2 border-indigo-500 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[11px]">
                      גרסה 2 (הגשה סופית - פעילה לבדיקה)
                    </span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                      Dana_Cohen_HW1.py (18 KB)
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">14/10/2025, 18:22:10</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  הערת הסטודנטית: ״גרסה מעודכנת: תיקון מקרה קצה של קלט ריק ברשימה, הוספת docstrings ובדיקות יחידה.״
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => showToast('הורדת קובץ גרסה 2 החלה', 'info')}
                    className="text-indigo-600 hover:underline text-xs font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>הורד קובץ גרסה 2</span>
                  </button>
                </div>
              </div>

              {/* Version 1 (Initial) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2 opacity-85">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                      גרסה 1 (הגשה ראשונית)
                    </span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      Dana_Cohen_HW1_v1.py (14 KB)
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">13/10/2025, 14:15:20</span>
                </div>
                <p className="text-xs text-slate-500 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  הערת הסטודנטית: ״גרסה ראשונית של התרגיל: מימוש בסיסי של הפונקציות המבוקשות ללא מקרי קצה.״
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => showToast('הורדת קובץ גרסה 1 החלה', 'info')}
                    className="text-slate-500 hover:underline text-xs font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>הורד קובץ גרסה 1</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Diff View Comparison */
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>השוואה בין גרסה 1 לגרסה 2 (Dana_Cohen_HW1.py)</span>
                <span className="text-emerald-600 font-bold">+14 שורות חדשות / -4 שורות עודכנו</span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px] leading-relaxed">
                <div className="bg-slate-900 text-slate-200 p-4 space-y-1 max-h-72 overflow-y-auto">
                  <div className="text-slate-500">@@ -1,8 +1,18 @@ מחלקת חישובים סטטיסטיים</div>
                  <div className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded">
                    - def calculate_statistics(numbers):
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    + def calculate_statistics(numbers: list[float]) -&gt; tuple[float, float, float]:
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     """Calculates mean, median, and sample standard deviation."""
                  </div>
                  <div className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded">
                    -     if len(numbers) == 0: return 0, 0, 0
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     if not numbers:
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +         raise ValueError("List cannot be empty")
                  </div>
                  <div className="text-slate-400 px-2">      n = len(numbers)</div>
                  <div className="text-slate-400 px-2">      mean = sum(numbers) / n</div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     sorted_nums = sorted(numbers)
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     median = sorted_nums[n // 2] if n % 2 != 0 else (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     variance = sum((x - mean) ** 2 for x in numbers) / (n - 1 if n &gt; 1 else 1)
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     std_dev = variance ** 0.5
                  </div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    +     return mean, median, std_dev
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setVersionModalSub(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold rounded-xl"
            >
              סגור חלון גרסאות
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
