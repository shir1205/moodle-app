/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AssignmentService for CampuScope
 * Handles assignment creation, publishing, submissions, live deadline checks,
 * lecturer grading, and notification triggering.
 */

import { Assignment, Submission, User } from '../types';
import { StorageService } from './storage';
import { SEED_ASSIGNMENTS, SEED_SUBMISSIONS, SEED_USERS } from '../data/seedData';
import { NotificationService } from './notificationService';
import { CourseService } from './courseService';
import { ACADEMIC_THRESHOLDS, ROLES } from '../config/constants';

export class AssignmentService {
  private static init(): void {
    if (!localStorage.getItem(StorageService.keys.ASSIGNMENTS)) {
      StorageService.set(StorageService.keys.ASSIGNMENTS, SEED_ASSIGNMENTS);
    }
    if (!localStorage.getItem(StorageService.keys.SUBMISSIONS)) {
      StorageService.set(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    }
  }

  static getAssignments(courseId?: string): Assignment[] {
    this.init();
    const all = StorageService.get<Assignment[]>(StorageService.keys.ASSIGNMENTS, SEED_ASSIGNMENTS);
    if (!courseId) return all;
    return all.filter((a) => a.courseId === courseId);
  }

  static getAssignmentById(assignmentId: string): Assignment | undefined {
    this.init();
    const all = this.getAssignments();
    return all.find((a) => a.id === assignmentId);
  }

  static createAssignment(params: {
    courseId: string;
    unitId: string;
    title: string;
    instructions: string;
    dueDate: string;
    maxGrade?: number;
    allowedFormats?: string[];
    status?: 'published' | 'draft';
  }): { success: boolean; assignment?: Assignment; error?: string } {
    this.init();

    if (!params.title || !params.title.trim()) {
      return { success: false, error: 'כותרת המטלה היא שדה חובה' };
    }

    if (!params.dueDate) {
      return { success: false, error: 'יש לבחור תאריך ושעת יעד להגשה' };
    }

    const dueTime = new Date(params.dueDate).getTime();
    if (isNaN(dueTime)) {
      return { success: false, error: 'תאריך היעד אינו תקין' };
    }

    if (params.status === 'published' && dueTime <= Date.now()) {
      return { success: false, error: 'מועד ההגשה אינו יכול להיות בעבר בעת פרסום מטלה' };
    }

    const maxGrade = params.maxGrade ?? ACADEMIC_THRESHOLDS.MAX_GRADE_DEFAULT;
    if (maxGrade < ACADEMIC_THRESHOLDS.MAX_GRADE_MIN_ALLOWED || maxGrade > ACADEMIC_THRESHOLDS.MAX_GRADE_MAX_ALLOWED) {
      return { success: false, error: `ציון מקסימלי חייב להיות בין ${ACADEMIC_THRESHOLDS.MAX_GRADE_MIN_ALLOWED} ל-${ACADEMIC_THRESHOLDS.MAX_GRADE_MAX_ALLOWED}` };
    }

    const newAssignment: Assignment = {
      id: `assign-${Date.now()}`,
      courseId: params.courseId,
      unitId: params.unitId,
      title: params.title.trim(),
      instructions: params.instructions || '',
      dueDate: new Date(params.dueDate).toISOString(),
      maxGrade,
      allowedFormats: params.allowedFormats && params.allowedFormats.length > 0
        ? params.allowedFormats
        : ['.pdf', '.zip'],
      status: params.status || 'published',
      createdAt: new Date().toISOString(),
    };

    const all = this.getAssignments();
    all.push(newAssignment);
    StorageService.set(StorageService.keys.ASSIGNMENTS, all);

    // If published, notify enrolled students and course TAs
    if (newAssignment.status === 'published') {
      const course = CourseService.getCourseById(params.courseId);
      if (course) {
        course.enrolledStudentIds.forEach((studentId) => {
          NotificationService.createNotification({
            userId: studentId,
            type: 'assignment',
            title: `מטלה חדשה: ${newAssignment.title}`,
            content: `פורסמה מטלה חדשה בקורס "${course.title}". מועד ההגשה: ${new Date(newAssignment.dueDate).toLocaleString('he-IL')}.`,
            link: `/courses/${course.id}/assignments/${newAssignment.id}`,
          });
        });

        // Notify TAs assigned to this course
        const allUsers = StorageService.get<User[]>(StorageService.keys.USERS, SEED_USERS);
        const courseTAs = allUsers.filter(
          (u) =>
            u.role === ROLES.TA &&
            (u.assignedCourseIds?.includes(params.courseId) || u.assignedCourseIds?.length === 0)
        );
        courseTAs.forEach((ta) => {
          NotificationService.createNotification({
            userId: ta.id,
            type: 'assignment',
            title: `פורסמה מטלה חדשה לבדיקה: ${newAssignment.title}`,
            content: `פורסמה מטלה חדשה לבדיקה בקורס "${course.title}". מועד ההגשה: ${new Date(newAssignment.dueDate).toLocaleString('he-IL')}.`,
            link: `/lecturer/grading`,
          });
        });
      }
    }

    return { success: true, assignment: newAssignment };
  }

  static getSubmissionsForAssignment(assignmentId: string): Submission[] {
    this.init();
    const all = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    return all.filter((s) => s.assignmentId === assignmentId);
  }

  static getStudentSubmission(assignmentId: string, studentId: string): Submission | undefined {
    this.init();
    const all = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    return all.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
  }

  static getStudentAllSubmissions(studentId: string): Submission[] {
    this.init();
    const all = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    return all.filter((s) => s.studentId === studentId);
  }

  static isSubmissionWindowOpen(dueDateIso: string): boolean {
    return new Date(dueDateIso).getTime() > Date.now();
  }

  static submitAssignment(params: {
    assignmentId: string;
    courseId: string;
    studentId: string;
    studentName: string;
    fileName: string;
    fileSize: string;
  }): { success: boolean; submission?: Submission; error?: string } {
    this.init();
    const assignment = this.getAssignmentById(params.assignmentId);
    if (!assignment) {
      return { success: false, error: 'המטלה לא נמצאה' };
    }

    const now = Date.now();
    const dueTime = new Date(assignment.dueDate).getTime();
    const isPastDue = now > dueTime;

    if (isPastDue) {
      return {
        success: false,
        error: 'מועד ההגשה חלף – חלון ההגשות נעול ולא ניתן להגיש קבצים נוספים.',
      };
    }

    const allSubmissions = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    const existingIndex = allSubmissions.findIndex(
      (s) => s.assignmentId === params.assignmentId && s.studentId === params.studentId
    );

    const submissionData: Submission = {
      id: existingIndex >= 0 ? allSubmissions[existingIndex].id : `sub-${Date.now()}`,
      assignmentId: params.assignmentId,
      courseId: params.courseId,
      studentId: params.studentId,
      studentName: params.studentName,
      submittedAt: new Date().toISOString(),
      fileName: params.fileName,
      fileSize: params.fileSize || '1.2 MB',
      fileUrl: '#',
      isLate: false,
      status: 'submitted',
    };

    if (existingIndex >= 0) {
      // Retain existing grade if replacing file before deadline
      if (allSubmissions[existingIndex].grade !== undefined) {
        submissionData.grade = allSubmissions[existingIndex].grade;
        submissionData.feedback = allSubmissions[existingIndex].feedback;
        submissionData.status = 'graded';
      }
      allSubmissions[existingIndex] = submissionData;
    } else {
      allSubmissions.push(submissionData);
    }

    StorageService.set(StorageService.keys.SUBMISSIONS, allSubmissions);

    // Notify lecturer
    const course = CourseService.getCourseById(params.courseId);
    if (course) {
      NotificationService.createNotification({
        userId: course.lecturerId,
        type: 'assignment',
        title: `הגשה חדשה: ${params.studentName}`,
        content: `הסטודנט/ית ${params.studentName} הגיש/ה את מטלה "${assignment.title}" בקורס "${course.title}".`,
        link: `/lecturer/grading`,
      });

      // Notify course TAs
      const allUsers = StorageService.get<User[]>(StorageService.keys.USERS, SEED_USERS);
      const courseTAs = allUsers.filter(
        (u) =>
          u.role === ROLES.TA &&
          (u.assignedCourseIds?.includes(params.courseId) || u.assignedCourseIds?.length === 0)
      );
      courseTAs.forEach((ta) => {
        NotificationService.createNotification({
          userId: ta.id,
          type: 'assignment',
          title: `התקבלה הגשה חדשה מ-${params.studentName} במטלה: ${assignment.title}`,
          content: `הסטודנט/ית ${params.studentName} הגיש/ה פתרון למטלה "${assignment.title}" בקורס "${course.title}". ממתין לבדיקה.`,
          link: `/lecturer/grading`,
        });
      });
    }

    return { success: true, submission: submissionData };
  }

  static updateAssignment(
    assignmentId: string,
    params: Partial<Assignment>
  ): { success: boolean; assignment?: Assignment; error?: string } {
    this.init();
    const all = this.getAssignments();
    const index = all.findIndex((a) => a.id === assignmentId);
    if (index === -1) {
      return { success: false, error: 'המטלה לא נמצאה במערכת' };
    }

    const updated = {
      ...all[index],
      ...params,
    };
    all[index] = updated;
    StorageService.set(StorageService.keys.ASSIGNMENTS, all);
    return { success: true, assignment: updated };
  }

  static deleteAssignment(assignmentId: string): { success: boolean; error?: string } {
    this.init();
    let all = this.getAssignments();
    const exists = all.some((a) => a.id === assignmentId);
    if (!exists) {
      return { success: false, error: 'המטלה לא נמצאה' };
    }

    all = all.filter((a) => a.id !== assignmentId);
    StorageService.set(StorageService.keys.ASSIGNMENTS, all);

    // Also remove associated submissions
    const allSubs = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    const filteredSubs = allSubs.filter((s) => s.assignmentId !== assignmentId);
    StorageService.set(StorageService.keys.SUBMISSIONS, filteredSubs);

    return { success: true };
  }

  static gradeSubmission(params: {
    submissionId: string;
    grade: number;
    feedback: string;
    gradedBy: string;
  }): { success: boolean; submission?: Submission; error?: string } {
    this.init();
    const all = StorageService.get<Submission[]>(StorageService.keys.SUBMISSIONS, SEED_SUBMISSIONS);
    const index = all.findIndex((s) => s.id === params.submissionId);
    if (index === -1) {
      return { success: false, error: 'ההגשה לא נמצאה' };
    }

    const sub = all[index];
    const assignment = this.getAssignmentById(sub.assignmentId);
    const maxGrade = assignment ? assignment.maxGrade : ACADEMIC_THRESHOLDS.MAX_GRADE_DEFAULT;

    if (params.grade < 0 || params.grade > maxGrade) {
      return { success: false, error: `הציון חייב להיות בין 0 ל-${maxGrade}` };
    }

    sub.grade = params.grade;
    sub.feedback = params.feedback;
    sub.gradedAt = new Date().toISOString();
    sub.gradedBy = params.gradedBy;
    sub.status = 'graded';

    all[index] = sub;
    StorageService.set(StorageService.keys.SUBMISSIONS, all);

    // Publish notification to the student
    const course = CourseService.getCourseById(sub.courseId);
    NotificationService.createNotification({
      userId: sub.studentId,
      type: 'grade',
      title: `פורסם ציון במטלה: ${assignment ? assignment.title : ''}`,
      content: `${params.gradedBy} בדק/ה את הגשתך. הציון שהתקבל: ${params.grade}/${maxGrade}. ${params.feedback ? `משוב: "${params.feedback.substring(0, 60)}..."` : ''}`,
      link: `/courses/${sub.courseId}/assignments/${sub.assignmentId}`,
    });

    return { success: true, submission: sub };
  }
}
