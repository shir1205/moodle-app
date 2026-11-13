/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AssignmentService } from '../services/assignmentService';
import { CourseService } from '../services/courseService';
import { EmptyState } from '../components/common/EmptyState';
import {
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Award,
} from 'lucide-react';

export const MySubmissionsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const studentId = currentUser?.id || 'user-student-1';
  const submissions = AssignmentService.getStudentAllSubmissions(studentId);
  const courses = CourseService.getCourses();

  const getCourse = (courseId: string) => courses.find((c) => c.id === courseId);
  const getAssignment = (assignmentId: string) =>
    AssignmentService.getAssignmentById(assignmentId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-indigo-600" />
          <span>ההגשות שלי (My Submissions)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          מעקב מרוכז אחר כלל הקבצים שהוגשו, זמני הגשה, ציונים ומשובים פדגוגיים מהמרצים
        </p>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="טרם הגשת מטלות במערכת"
          description="גש/י לאחד הקורסים שלך והגש/י את הפתרון לפני מועד היעד."
          actionText="מעבר לקורסים שלי"
          onAction={() => window.location.assign('/courses')}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-semibold text-start">שם המטלה והקורס</th>
                  <th className="py-3 px-4 font-semibold text-start">קובץ שהוגש</th>
                  <th className="py-3 px-4 font-semibold text-start">מועד הגשה</th>
                  <th className="py-3 px-4 font-semibold text-start">סטטוס</th>
                  <th className="py-3 px-4 font-semibold text-start">ציון</th>
                  <th className="py-3 px-4 font-semibold text-start">משוב מרצה</th>
                  <th className="py-3 px-4 font-semibold text-end">צפייה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {submissions.map((sub) => {
                  const course = getCourse(sub.courseId);
                  const assignment = getAssignment(sub.assignmentId);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div>{assignment?.title || 'מטלה'}</div>
                        <div className="text-[11px] font-normal text-slate-400">
                          {course ? `${course.code} - ${course.title}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono">
                        {sub.fileName}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-500">
                        {new Date(sub.submittedAt).toLocaleString('he-IL')}
                      </td>
                      <td className="py-3.5 px-4">
                        {sub.status === 'graded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>נבדק</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>ממתין לבדיקה</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-bold">
                        {sub.grade !== undefined ? (
                          <span className={sub.grade >= 60 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}>
                            {sub.grade} / {assignment ? assignment.maxGrade : 100}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {sub.feedback ? `"${sub.feedback}"` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <Link
                          to={`/courses/${sub.courseId}/assignments/${sub.assignmentId}`}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <span>פרטים</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
