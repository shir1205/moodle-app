import { useState } from 'react';
import {
  fetchGradingSubmissions,
  publishSubmissionGrade,
  saveGradeDraft,
  type GradingSubmissionsResponse,
} from '../services/coursesApi';

export function AssignmentGrading({ assignmentId }: { assignmentId: string }) {
  const [data, setData] = useState<GradingSubmissionsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'הפעולה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  async function loadSubmissions() {
    setData(await fetchGradingSubmissions(assignmentId));
  }

  return (
    <section className="mt-2 space-y-3 border-t pt-3">
      <button type="button" disabled={busy} onClick={() => void run(loadSubmissions)}>
        {data ? 'רענני הגשות' : 'בדיקת הגשות'}
      </button>

      {busy && <p role="status">מעבד בקשה…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {data?.submissions.length === 0 && <p>אין הגשות למטלה זו.</p>}

      {data?.submissions.map((submission) => {
        const savedGrade = submission.submission_grades;
        const published = Boolean(savedGrade?.published_at);

        return (
          <form
            key={submission.id}
            className="space-y-2 rounded-lg border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              void run(async () => {
                await saveGradeDraft(submission.id, {
                  grade: Number(fields.get('grade')),
                  feedback: String(fields.get('feedback') ?? ''),
                });
                await loadSubmissions();
              });
            }}
          >
            <p className="font-semibold">{submission.file_name}</p>
            <p>{published ? 'ציון פורסם' : savedGrade ? 'טיוטה שמורה' : 'טרם נשמר ציון'}</p>

            <label className="block">
              ציון
              <input
                name="grade"
                type="number"
                min={0}
                max={data.assignment.max_grade}
                step="any"
                required
                defaultValue={savedGrade?.grade}
                disabled={busy || published}
                className="ms-2 w-24 rounded border p-1"
              />
            </label>

            <label className="block">
              משוב
              <textarea
                name="feedback"
                defaultValue={savedGrade?.feedback ?? ''}
                disabled={busy || published}
                className="block w-full rounded border p-2"
              />
            </label>

            <div className="flex gap-3">
              <button type="submit" disabled={busy || published}>
                שמור טיוטה
              </button>
              <button
                type="button"
                disabled={busy || !savedGrade || published}
                onClick={() => void run(async () => {
                  await publishSubmissionGrade(submission.id);
                  await loadSubmissions();
                })}
              >
                פרסם ציון שמור
              </button>
            </div>
          </form>
        );
      })}
    </section>
  );
}