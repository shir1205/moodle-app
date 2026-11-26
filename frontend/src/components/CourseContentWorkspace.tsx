import { AssignmentGrading } from './AssignmentGrading';
import React, { useEffect, useState } from 'react';
import {
  AuthContext,
  UserRole,
  fetchUnits,
  createUnit,
  fetchMaterials,
  uploadMaterial,
  fetchAssignments,
  createAssignment,
  publishAssignment,
  submitSolution,
  fetchStudentSubmission,
} from '../services/coursesApi';

interface Props {
  courseId?: string;
}

export const CourseContentWorkspace: React.FC<Props> = ({ courseId = 'course-ds-101' }) => {
  const [role, setRole] = useState<UserRole>('LECTURER');
  const auth: AuthContext = {
    userId: role === 'LECTURER' ? 'lecturer-michal' : 'student-shira',
    role,
  };

  const [units, setUnits] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, any>>({});
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Unit form (Story 19)
  const [unitTitle, setUnitTitle] = useState('');
  const [unitDesc, setUnitDesc] = useState('');

  // Material form (Story 20)
  const [matUnitId, setMatUnitId] = useState('');
  const [matTitle, setMatTitle] = useState('');
  const [matFile, setMatFile] = useState<File | null>(null);

  // Assignment form (Story 22)
  const [assignUnitId, setAssignUnitId] = useState('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignMaxGrade, setAssignMaxGrade] = useState(100);

  // Submission files map (Story 26)
  const [selectedSubFiles, setSelectedSubFiles] = useState<Record<string, File | null>>({});

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadAllData = async () => {
    try {
      const [uData, mData, aData] = await Promise.all([
        fetchUnits(courseId),
        fetchMaterials(courseId),
        fetchAssignments(auth, courseId),
      ]);
      setUnits(uData);
      setMaterials(mData);
      setAssignments(aData);

      if (uData.length > 0 && !matUnitId) {
        setMatUnitId(uData[0].id);
        setAssignUnitId(uData[0].id);
      }

      if (role === 'STUDENT') {
        const subsMap: Record<string, any> = {};
        await Promise.all(
          aData.map(async (a: any) => {
            const subs = await fetchStudentSubmission(a.id, auth.userId);
            if (subs.length > 0) subsMap[a.id] = subs[0];
          })
        );
        setMySubmissions(subsMap);
      }
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [role, courseId]);

  // Handlers
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUnit(auth, {
        course_id: courseId,
        title: unitTitle,
        description: unitDesc,
        order_index: units.length + 1,
      });
      setUnitTitle('');
      setUnitDesc('');
      showMsg('ok', 'יחידת הלימוד נוצרה ונשמרה במסד הנתונים');
      loadAllData();
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matFile) return showMsg('err', 'יש לבחור קובץ להעלאה');
    try {
      const fd = new FormData();
      fd.append('unit_id', matUnitId);
      fd.append('title', matTitle);
      fd.append('file', matFile);
      await uploadMaterial(auth, courseId, fd);
      setMatTitle('');
      setMatFile(null);
      showMsg('ok', 'חומר הלימוד הועלה בהצלחה');
      loadAllData();
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  const handleCreateAssignment = async (status: 'draft' | 'published') => {
    try {
      await createAssignment(auth, {
        course_id: courseId,
        unit_id: assignUnitId || null,
        title: assignTitle,
        instructions: assignInstructions,
        due_date: new Date(assignDueDate).toISOString(),
        max_grade: Number(assignMaxGrade),
        status,
      });
      setAssignTitle('');
      setAssignInstructions('');
      showMsg('ok', status === 'draft' ? 'המטלה נשמרה כטיוטה (מוסתרת מסטודנטים)' : 'המטלה פורסמה לסטודנטים');
      loadAllData();
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishAssignment(auth, id);
      showMsg('ok', 'המטלה פורסמה בהצלחה');
      loadAllData();
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  const handleStudentSubmit = async (assignmentId: string) => {
    const file = selectedSubFiles[assignmentId];
    if (!file) return showMsg('err', 'יש לבחור קובץ פתרון להגשה');
    try {
      await submitSolution(auth, assignmentId, file);
      showMsg('ok', 'הפתרון הוגש/עודכן בהצלחה');
      loadAllData();
    } catch (e: any) {
      showMsg('err', e.message);
    }
  };

  const isAssignFormValid = assignTitle.trim().length >= 3 && assignDueDate !== '';

  return (
    <div dir="rtl" className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header & Role Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">תוכן קורס ומטלות — {courseId}</h1>
          <p className="text-sm text-slate-500">משתמש פעיל: {auth.userId} ({role})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRole('LECTURER')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              role === 'LECTURER' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            תצוגת מרצה
          </button>
          <button
            onClick={() => setRole('STUDENT')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              role === 'STUDENT' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            תצוגת סטודנט
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Lecturer Management Panel (Stories 19, 20, 22) */}
      {role === 'LECTURER' && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Story 19: Create Unit */}
          <form onSubmit={handleCreateUnit} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h2 className="font-semibold text-slate-800">1. יחידת לימוד חדשה</h2>
            <input
              required
              placeholder="שם היחידה (למשל: שבוע 2)"
              value={unitTitle}
              onChange={(e) => setUnitTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="תיאור קצר"
              value={unitDesc}
              onChange={(e) => setUnitDesc(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium">
              הוסף יחידה
            </button>
          </form>

          {/* Story 20: Upload Material */}
          <form onSubmit={handleUploadMaterial} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h2 className="font-semibold text-slate-800">2. העלאת חומר לימוד</h2>
            <select
              value={matUnitId}
              onChange={(e) => setMatUnitId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </select>
            <input
              required
              placeholder="כותרת הקובץ"
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="file"
              onChange={(e) => setMatFile(e.target.files?.[0] || null)}
              className="w-full text-xs"
            />
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium">
              העלה (PDF / DOCX / PPTX)
            </button>
          </form>

          {/* Story 22: Create Assignment (Draft / Publish) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h2 className="font-semibold text-slate-800">3. יצירת מטלה</h2>
            <input
              placeholder="כותרת מטלה (לפחות 3 תווים)"
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              placeholder="הנחיות הגשה"
              value={assignInstructions}
              onChange={(e) => setAssignInstructions(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!isAssignFormValid}
                onClick={() => handleCreateAssignment('draft')}
                className="flex-1 border border-slate-300 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
              >
                שמור טיוטה
              </button>
              <button
                type="button"
                disabled={!isAssignFormValid}
                onClick={() => handleCreateAssignment('published')}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-40"
              >
                פרסם מיד
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Units & Materials Display */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">יחידות לימוד וחומרים</h2>
        {units.length === 0 && <p className="text-sm text-slate-500">אין יחידות לימוד עדיין.</p>}
        {units.map((u) => (
          <div key={u.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
            <div className="font-semibold text-slate-800">{u.title}</div>
            {u.description && <p className="text-xs text-slate-500 mb-2">{u.description}</p>}
            <ul className="space-y-1">
              {materials
                .filter((m) => m.unit_id === u.id)
                .map((m) => (
                  <li key={m.id} className="text-sm flex items-center justify-between bg-white px-3 py-1.5 rounded border">
                    <span>📄 {m.title} ({m.file_type})</span>
                    <a href={m.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs underline">
                      צפה / הורד
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Assignments & Submissions Display (Stories 25 & 26) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          {role === 'LECTURER' ? 'כל המטלות בקורס (כולל טיוטות)' : 'מטלות פתוחות להגשה'}
        </h2>
        {assignments.length === 0 && <p className="text-sm text-slate-500">אין מטלות להצגה.</p>}
        <div className="space-y-3">
          {assignments.map((a) => {
            const isExpired = new Date(a.due_date) < new Date();
            const existingSub = mySubmissions[a.id];

            return (
              <div key={a.id} className="border rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{a.title}</span>
                    {a.status === 'draft' && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        טיוטה (מוסתר מסטודנטים)
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${isExpired ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                    דד-ליין: {new Date(a.due_date).toLocaleString('he-IL')}
                  </span>
                </div>

                {a.instructions && <p className="text-sm text-slate-600">{a.instructions}</p>}

                {role === 'LECTURER' && a.status === 'published' && (
                  <AssignmentGrading assignmentId={a.id} />
                )}

                {/* Lecturer Publish Action */}
                {role === 'LECTURER' && a.status === 'draft' && (
                  <div>
                    <button
                      onClick={() => handlePublish(a.id)}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
                    >
                      פרסם טיוטה לסטודנטים
                    </button>
                  </div>
                )}

                {/* Student Submission Action (Story 26) */}
                {role === 'STUDENT' && (
                  <div className="mt-2 pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      {existingSub
                        ? `✅ הוגש קובץ: ${existingSub.file_name} (${new Date(existingSub.updated_at).toLocaleString('he-IL')})`
                        : 'טרם הוגש פתרון'}
                    </div>

                    {isExpired ? (
                      <span className="text-xs bg-rose-50 text-rose-700 px-3 py-1 rounded-md border border-rose-200">
                        מועד ההגשה חלף — ההעלאה נעולה
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) =>
                            setSelectedSubFiles((prev) => ({
                              ...prev,
                              [a.id]: e.target.files?.[0] || null,
                            }))
                          }
                          className="text-xs"
                        />
                        <button
                          onClick={() => handleStudentSubmit(a.id)}
                          className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                        >
                          {existingSub ? 'החלף קובץ הגשה' : 'הגש פתרון'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};