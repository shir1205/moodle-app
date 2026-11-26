/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AnalyticsService for CampuScope
 * Computes student completion metrics, anonymous class comparisons,
 * lecturer course KPIs, at-risk student detection algorithms, and admin monitoring telemetry.
 */

import { StudentCourseProgress, CourseAnalytics, AtRiskStudent, SystemSettings, Submission } from '../types';
import { StorageService } from './storage';
import { CourseService } from './courseService';
import { AssignmentService } from './assignmentService';
import { AuthService } from './authService';
import { SEED_SYSTEM_SETTINGS } from '../data/seedData';
import { ANALYTICS_TARGETS } from '../config/constants';
import { authFetch, getAuthToken } from './apiClient';

interface BackendAtRiskStudent {
  student_id: string;
  full_name: string;
  email: string;
  average_grade: number | null;
  missed_assignments_count: number;
  risk_reasons: string[];
  course_id?: string | null;
  courses?: string[];
  severity?: 'high' | 'medium';
}

export interface StudentAssignmentProgressItem {
  assignment_id: string;
  course_id: string;
  assignment_title: string;
  due_date: string | null;
  max_grade: number;
  status: string;
  submitted_at: string | null;
  student_grade: number | null;
  feedback: string | null;
  published_at: string | null;
}

export interface StudentCourseSummary {
  course_id: string;
  total_assignments_count: number;
  completed_assignments_count: number;
  completion_rate_percent: number;
  graded_assignments_count: number;
  average_grade: number | null;
}

export interface UpcomingAssignmentItem {
  id: string;
  course_id: string;
  title: string;
  due_date: string | null;
  max_grade: number;
  is_submitted: boolean;
}

export interface StudentProgressResponse {
  student_id: string;
  course_id: string | null;
  available_courses: string[];
  completion_rate_percent: number;
  completed_assignments_count: number;
  total_assignments_count: number;
  graded_assignments_count: number;
  student_average: number | null;
  has_grades: boolean;
  message: string | null;
  courses_summary: StudentCourseSummary[];
  assignment_grades: StudentAssignmentProgressItem[];
  upcoming_assignments: UpcomingAssignmentItem[];
}

export class AnalyticsService {
  private static init(): void {
    if (!localStorage.getItem(StorageService.keys.SYSTEM_SETTINGS)) {
      StorageService.set(StorageService.keys.SYSTEM_SETTINGS, SEED_SYSTEM_SETTINGS);
    }
  }

  static getSystemSettings(): SystemSettings {
    this.init();
    return StorageService.get<SystemSettings>(StorageService.keys.SYSTEM_SETTINGS, SEED_SYSTEM_SETTINGS);
  }

  static updateSystemSettings(settings: Partial<SystemSettings>): SystemSettings {
    this.init();
    const current = this.getSystemSettings();
    const updated: SystemSettings = {
      ...current,
      ...settings,
      lastSettingsUpdate: new Date().toISOString(),
    };
    StorageService.set(StorageService.keys.SYSTEM_SETTINGS, updated);
    return updated;
  }

  static getStudentCourseProgress(studentId: string, courseId: string): StudentCourseProgress {
    this.init();
    const course = CourseService.getCourseById(courseId);
    const assignments = AssignmentService.getAssignments(courseId).filter((a) => a.status === 'published');
    const studentSubmissions = AssignmentService.getStudentAllSubmissions(studentId).filter(
      (s) => s.courseId === courseId
    );

    let totalMaterialsCount = 0;
    if (course) {
      course.units.forEach((u) => {
        totalMaterialsCount += u.materials.length;
      });
    }

    const completedAssignmentsCount = studentSubmissions.filter((s) => s.status !== 'not_submitted').length;
    const completedMaterialsCount = Math.min(
      totalMaterialsCount,
      Math.max(1, Math.round(totalMaterialsCount * 0.8))
    );

    const totalTrackableItems = assignments.length + totalMaterialsCount;
    const completedTrackableItems = completedAssignmentsCount + completedMaterialsCount;
    const completionRatePercent =
      totalTrackableItems > 0 ? Math.min(100, Math.round((completedTrackableItems / totalTrackableItems) * 100)) : 0;

    const gradedSubmissions = studentSubmissions.filter((s) => s.grade !== undefined);
    const studentAverage =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) / gradedSubmissions.length
          )
        : 0;

    const allCourseSubmissions = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, []);
    const assignmentGrades = assignments.map((assignment) => {
      const studentSub = studentSubmissions.find((s) => s.assignmentId === assignment.id);
      const assignmentSubmissions = allCourseSubmissions.filter(
        (s) => s.assignmentId === assignment.id && s.grade !== undefined
      );

      const classAvg =
        assignmentSubmissions.length > 0
          ? Math.round(
              assignmentSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0) /
                assignmentSubmissions.length
            )
          : 82;

      return {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        studentGrade: studentSub && studentSub.grade !== undefined ? studentSub.grade : null,
        classAverageGrade: classAvg,
        maxGrade: assignment.maxGrade,
        dueDate: assignment.dueDate,
        submittedAt: studentSub?.submittedAt,
      };
    });

    const allGradedCourseSubs = allCourseSubmissions.filter(
      (s) => s.courseId === courseId && s.grade !== undefined
    );
    const classAverage =
      allGradedCourseSubs.length > 0
        ? Math.round(
            allGradedCourseSubs.reduce((acc, curr) => acc + (curr.grade || 0), 0) /
              allGradedCourseSubs.length
          )
        : 84;

    const upcomingAssignments = assignments
      .filter((a) => new Date(a.dueDate).getTime() > Date.now())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return {
      courseId,
      courseTitle: course ? course.title : '',
      completionRatePercent,
      completedAssignmentsCount,
      totalAssignmentsCount: assignments.length,
      completedMaterialsCount,
      totalMaterialsCount,
      studentAverage,
      classAverage,
      assignmentGrades,
      upcomingAssignments,
    };
  }

  static getCourseAnalytics(courseId: string, assignmentFilterId?: string): CourseAnalytics {
    this.init();
    const course = CourseService.getCourseById(courseId);
    const enrolledStudents = course ? course.enrolledStudentIds : [];
    const assignments = AssignmentService.getAssignments(courseId).filter((a) => a.status === 'published');
    const allSubmissions = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, []);

    let filteredSubmissions = allSubmissions.filter((s) => s.courseId === courseId);
    if (assignmentFilterId && assignmentFilterId !== 'all') {
      filteredSubmissions = filteredSubmissions.filter((s) => s.assignmentId === assignmentFilterId);
    }

    const gradedSubs = filteredSubmissions.filter((s) => s.grade !== undefined);
    const grades = gradedSubs.map((s) => s.grade as number).sort((a, b) => a - b);

    const classAverage =
      grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : 0;

    let classMedian = 0;
    if (grades.length > 0) {
      const mid = Math.floor(grades.length / 2);
      classMedian = grades.length % 2 !== 0 ? grades[mid] : Math.round((grades[mid - 1] + grades[mid]) / 2);
    }

    const totalPossibleSubmissions =
      enrolledStudents.length * (assignmentFilterId && assignmentFilterId !== 'all' ? 1 : assignments.length);
    const actualSubmissionsCount = filteredSubmissions.length;
    const submissionRatePercent =
      totalPossibleSubmissions > 0
        ? Math.min(100, Math.round((actualSubmissionsCount / totalPossibleSubmissions) * 100))
        : 0;

    const histogram = ANALYTICS_TARGETS.HISTOGRAM_BINS.map((bin) => {
      const count = grades.filter((g) => g >= bin.min && g <= bin.max).length;
      return { range: bin.label, count };
    });

    const weeklySubmissionTrends = [
      { week: 'שבוע 1', count: 18, totalExpected: 20 },
      { week: 'שבוע 2', count: 17, totalExpected: 20 },
      { week: 'שבוע 3', count: 19, totalExpected: 20 },
      { week: 'שבוע 4', count: 15, totalExpected: 20 },
    ];

    const atRiskStudents = this.getAtRiskStudents(courseId);

    return {
      courseId,
      courseTitle: course ? course.title : '',
      enrolledStudentsCount: enrolledStudents.length,
      classAverage,
      classMedian,
      submissionRatePercent,
      atRiskCount: atRiskStudents.length,
      histogram,
      weeklySubmissionTrends,
    };
  }

  static getAtRiskStudents(courseId?: string): AtRiskStudent[] {
    this.init();
    const settings = this.getSystemSettings();
    const courses = CourseService.getCourses();
    const allUsers = AuthService.getUsers();
    const allAssignments = AssignmentService.getAssignments().filter((a) => a.status === 'published');
    const allSubmissions = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, []);

    const relevantCourses = courseId ? courses.filter((c) => c.id === courseId) : courses;
    const atRiskList: AtRiskStudent[] = [];

    relevantCourses.forEach((c) => {
      const courseAssignments = allAssignments.filter((a) => a.courseId === c.id);
      const pastDueAssignments = courseAssignments.filter((a) => new Date(a.dueDate).getTime() < Date.now());

      c.enrolledStudentIds.forEach((studentId) => {
        const studentUser = allUsers.find((u) => u.id === studentId);
        if (!studentUser) return;

        const studentSubs = allSubmissions.filter(
          (s) => s.studentId === studentId && s.courseId === c.id
        );
        const gradedSubs = studentSubs.filter((s) => s.grade !== undefined);

        const avg =
          gradedSubs.length > 0
            ? Math.round(gradedSubs.reduce((a, b) => a + (b.grade || 0), 0) / gradedSubs.length)
            : 0;

        let missedCount = 0;
        pastDueAssignments.forEach((pda) => {
          const submitted = studentSubs.some((s) => s.assignmentId === pda.id);
          if (!submitted) {
            missedCount++;
          }
        });

        const isAvgBelow = gradedSubs.length > 0 && avg < settings.minGradeThreshold;
        const isMissedSubmissionsExcessive = missedCount >= settings.missedSubmissionsThreshold;

        if (isAvgBelow || isMissedSubmissionsExcessive) {
          let warningReason = '';
          let severity: 'high' | 'medium' = 'medium';

          if (isAvgBelow && isMissedSubmissionsExcessive) {
            warningReason = `ממוצע נמוך (${avg}) ואי-הגשת ${missedCount} מטלות קודמות`;
            severity = 'high';
          } else if (isAvgBelow) {
            warningReason = `ממוצע ציונים נמוך מסף המעבר (${avg} < ${settings.minGradeThreshold})`;
            severity = avg < 50 ? 'high' : 'medium';
          } else {
            warningReason = `צבר/ה ${missedCount} מטלות שמועדן חלף ללא הגשה`;
            severity = missedCount >= 3 ? 'high' : 'medium';
          }

          atRiskList.push({
            studentId,
            studentName: studentUser.name,
            studentEmail: studentUser.email,
            courseId: c.id,
            courseTitle: c.title,
            currentAverage: avg,
            missedSubmissionsCount: missedCount,
            warningReason,
            severity,
          });
        }
      });
    });

    return atRiskList;
  }

  private static mapAtRiskFromBackend(row: BackendAtRiskStudent): AtRiskStudent {
    const resolvedCourseId = row.course_id || row.courses?.[0] || 'course-1';
    const course = CourseService.getCourseById(resolvedCourseId);
    const courseTitle = course
      ? course.title
      : row.courses && row.courses.length > 0
      ? row.courses.join(', ')
      : resolvedCourseId;

    const avg =
      row.average_grade !== null && row.average_grade !== undefined
        ? Math.round(row.average_grade)
        : 0;
    const missed = row.missed_assignments_count ?? 0;

    return {
      studentId: row.student_id,
      studentName: row.full_name || row.email,
      studentEmail: row.email,
      courseId: resolvedCourseId,
      courseTitle,
      currentAverage: avg,
      missedSubmissionsCount: missed,
      warningReason: Array.isArray(row.risk_reasons) ? row.risk_reasons.join(' · ') : '',
      severity:
        row.severity === 'high' || (row.average_grade !== null && avg < 50) || missed >= 3
          ? 'high'
          : 'medium',
    };
  }

  /**
   * Fetch at-risk students from backend-core (GET /analytics/at-risk).
   */
  static async fetchAtRiskStudents(courseId?: string): Promise<AtRiskStudent[]> {
    if (!getAuthToken()) {
      throw new Error('יש להתחבר לחשבון מרצה מאומת כדי לצפות בסטודנטים בסיכון');
    }

    const query =
      courseId && courseId !== 'all'
        ? `?course_id=${encodeURIComponent(courseId)}`
        : '';
    const response = await authFetch(`/analytics/at-risk${query}`, {
      method: 'GET',
    });

    if (!response.ok) {
      let detail = `שגיאת שרת (${response.status})`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.detail === 'string' && errorBody.detail.trim()) {
          detail = errorBody.detail;
        }
      } catch {
        // Keep default status error message
      }
      throw new Error(detail);
    }

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      throw new Error('תגובה לא צפויה משרת האנליטיקה');
    }

    return (rows as BackendAtRiskStudent[]).map((row) => this.mapAtRiskFromBackend(row));
  }

  /**
   * Story #37: Fetch authenticated student's personal progress and published grades
   * from backend-core (GET /analytics/me/progress).
   */
  static async fetchMyProgress(courseId?: string): Promise<StudentProgressResponse> {
    if (!getAuthToken()) {
      throw new Error('יש להתחבר למערכת כדי לצפות בהתקדמות ובציונים האישיים');
    }

    const query =
      courseId && courseId !== 'all'
        ? `?course_id=${encodeURIComponent(courseId)}`
        : '';
    const response = await authFetch(`/analytics/me/progress${query}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('פג תוקף ההתחברות — יש להתחבר מחדש כדי לצפות בנתונים האישיים');
      }
      if (response.status === 403) {
        throw new Error('אין הרשאה לצפות בדשבורד הציונים האישי (מיועד לסטודנטים ולמנהלים בלבד)');
      }

      let detail = `שגיאה בטעינת נתוני ההתקדמות (${response.status})`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.detail === 'string' && errorBody.detail.trim()) {
          detail = errorBody.detail;
        }
      } catch {
        // Keep default status error message
      }
      throw new Error(detail);
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray((data as StudentProgressResponse).assignment_grades)) {
      throw new Error('תגובה לא צפויה משרת האנליטיקה');
    }

    return data as StudentProgressResponse;
  }
}