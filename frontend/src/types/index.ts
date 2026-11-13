/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CampuScope Domain Types and Interfaces
 */

import { UserRole } from '../config/constants';
export type { UserRole };

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  hasSetupTwoFactor?: boolean;
  registeredAt: string;
  assignedCourseIds: string[];
  status: 'active' | 'suspended';
  password?: string;
}

export interface Material {
  id: string;
  unitId: string;
  courseId: string;
  title: string;
  description: string;
  fileType: 'pdf' | 'docx' | 'pptx';
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  fileUrl: string;
}

export interface LearningUnit {
  id: string;
  courseId: string;
  weekNumber: number;
  title: string;
  description: string;
  materials: Material[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  lecturerId: string;
  lecturerName: string;
  accentColor: string;
  coverImage: string;
  fallbackGradient: string;
  semester: string;
  department: string;
  enrolledStudentIds: string[];
  units: LearningUnit[];
  createdAt: string;
}

export type SubmissionType = 'pdf' | 'zip' | 'code';

export interface Assignment {
  id: string;
  courseId: string;
  unitId: string;
  title: string;
  instructions: string;
  dueDate: string; // ISO string
  maxGrade: number;
  allowedFormats: string[];
  status: 'published' | 'draft';
  createdAt: string;
}

export type SubmissionState = 'not_submitted' | 'submitted' | 'late' | 'graded';

export interface RubricLevel {
  levelId: string;
  title: string;
  points: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  maxPoints: number;
  levels: RubricLevel[];
}

export interface SubmissionVersion {
  versionNumber: number;
  submittedAt: string;
  fileName: string;
  fileSize: string;
  comment?: string;
  codePreview?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  fileName: string;
  fileSize: string;
  fileUrl: string;
  grade?: number;
  feedback?: string;
  gradedAt?: string;
  gradedBy?: string;
  isLate: boolean;
  status: SubmissionState;
  versions?: SubmissionVersion[];
  rubricScores?: Record<string, number>;
  codeSnippet?: string;
  aiSuggestedGrade?: number;
  aiSuggestedFeedback?: string;
}

export type NotificationType =
  | 'grade'
  | 'ai_feedback'
  | 'assignment'
  | 'reminder'
  | 'lecturer_message'
  | 'at_risk';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  channel: 'in_app' | 'email' | 'both';
  emailStatus?: 'delivered' | 'failed';
}

export interface NotificationPreference {
  userId: string;
  gradeInApp: boolean;
  gradeEmail: boolean;
  aiFeedbackInApp: boolean;
  aiFeedbackEmail: boolean;
  newAssignmentInApp: boolean;
  newAssignmentEmail: boolean;
  reminderInApp: boolean;
  reminderEmail: boolean;
  lecturerMessageInApp: boolean;
  lecturerMessageEmail: boolean;
}

export interface AuditLogEntry {
  id: string;
  performedByUserId: string;
  performedByUserName: string;
  targetUserId: string;
  targetUserName: string;
  action: string;
  previousRole?: UserRole;
  newRole?: UserRole;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  minGradeThreshold: number;
  missedSubmissionsThreshold: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpStatus: 'connected' | 'disconnected' | 'testing';
  lastSettingsUpdate: string;
}

// AI Assistant types
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  importantConcepts: { term: string; explanation: string }[];
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  topic: string;
}

export interface PracticeQuiz {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: PracticeQuestion[];
}

export interface AssignmentFeedbackResult {
  strengths: string[];
  possibleMistakes: string[];
  improvementSuggestions: string[];
  summaryNote: string;
}

// Analytics types
export interface AtRiskStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  currentAverage: number;
  missedSubmissionsCount: number;
  warningReason: string;
  severity: 'high' | 'medium';
}

export interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  enrolledStudentsCount: number;
  classAverage: number;
  classMedian: number;
  submissionRatePercent: number;
  atRiskCount: number;
  histogram: { range: string; count: number }[];
  weeklySubmissionTrends: { week: string; count: number; totalExpected: number }[];
}

export interface StudentCourseProgress {
  courseId: string;
  courseTitle: string;
  completionRatePercent: number;
  completedAssignmentsCount: number;
  totalAssignmentsCount: number;
  completedMaterialsCount: number;
  totalMaterialsCount: number;
  studentAverage: number;
  classAverage: number;
  assignmentGrades: {
    assignmentId: string;
    assignmentTitle: string;
    studentGrade: number | null;
    classAverageGrade: number;
    maxGrade: number;
    dueDate: string;
    submittedAt?: string;
  }[];
  upcomingAssignments: Assignment[];
}
