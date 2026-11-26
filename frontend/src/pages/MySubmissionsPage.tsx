/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AssignmentService } from '../services/assignmentService';
import {
  fetchMyAssignmentGrade,
  fetchMySubmissions,
  type MySubmission,
  type PublishedGrade,
} from '../services/coursesApi';

type SubmissionRow = {
  submission: MySubmission;
  grade: PublishedGrade | null;
  gradeError: boolean;
};

type LoadResult = {
  studentId: string;
  rows: SubmissionRow[] | null;
};

export const MySubmissionsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const studentId = currentUser?.id;
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (!studentId) return;
    const controller = new AbortController();

    async function loadSubmissions() {
      try {
        const submissions = await fetchMySubmissions(controller.signal);
        const rows = await Promise.all(
          submissions.map(async (submission): Promise<SubmissionRow> => {
            if (!submission.assignment_id) {
              return { submission, grade: null, gradeError: false };
            }

            try {
              const grade = await fetchMyAssignmentGrade(
                submission.assignment_id,
                controller.signal
              );
              return { submission, grade, gradeError: false };
            } catch {
              return { submission, grade: null, gradeError: true };
            }
          })
        );

        if (!controller.signal.aborted) {
          setResult({ studentId: studentId!, rows });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ studentId: studentId!, rows: null });
        }
      }
    }

    void loadSubmissions();
    return () => controller.abort();
  }, [studentId]);

  if (!studentId) return <p>יש להתחבר כדי לצפות בהגשות.</p>;
  if (result?.studentId !== studentId) return <p>טוען הגשות…</p>;
  if (result.rows === null) return <p>לא ניתן לטעון את רשימת ההגשות.</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-extrabold">ההגשות שלי</h1>

      {result.rows.length === 0 ? (
        <p>עדיין אין הגשות. <Link to="/courses">מעבר לקורסים שלי</Link></p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="p-3 text-start">מטלה</th>
                <th className="p-3 text-start">קובץ שהוגש</th>
                <th className="p-3 text-start">מועד הגשה</th>
                <th className="p-3 text-start">ציון</th>
                <th className="p-3 text-start">משוב מרצה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.rows.map(({ submission, grade, gradeError }) => {
                const assignment = submission.assignment_id
                  ? AssignmentService.getAssignmentById(submission.assignment_id)
                  : undefined;

                return (
                  <tr key={submission.id}>
                    <td className="p-3 font-semibold">
                      {assignment?.title || submission.assignment_id || 'מטלה'}
                    </td>
                    <td className="p-3">{submission.file_name}</td>
                    <td className="p-3">
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString('he-IL')
                        : '—'}
                    </td>
                    <td className="p-3">
                      {gradeError ? 'לא ניתן לטעון את הציון' : grade?.grade ?? 'טרם פורסם ציון'}
                    </td>
                    <td className="p-3">{grade?.feedback || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};