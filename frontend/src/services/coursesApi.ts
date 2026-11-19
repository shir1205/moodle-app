// @ts-ignore
const API_BASE = (import.meta as any).env?.VITE_COURSES_API_URL || 'http://localhost:8002';

export type UserRole = 'LECTURER' | 'STUDENT';

export interface AuthContext {
  userId: string;
  role: UserRole;
  token?: string; // מוכן למיזוג ה-JWT של צוות 1
}

function buildHeaders(auth: AuthContext, isJson = true): HeadersInit {
  const headers: Record<string, string> = {
    'X-User-Id': auth.userId,
    'X-User-Role': auth.role,
  };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'שגיאת שרת לא צפויה' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Story 19: Learning Units ---
export async function fetchUnits(courseId: string) {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/units`);
  return handleResponse<any[]>(res);
}

export async function createUnit(
  auth: AuthContext,
  data: { course_id: string; title: string; description: string; order_index: number }
) {
  const res = await fetch(`${API_BASE}/api/units`, {
    method: 'POST',
    headers: buildHeaders(auth, true),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// --- Story 20: Course Materials ---
export async function fetchMaterials(courseId: string) {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/materials`);
  return handleResponse<any[]>(res);
}

export async function uploadMaterial(
  auth: AuthContext,
  courseId: string,
  formData: FormData
) {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/materials`, {
    method: 'POST',
    headers: buildHeaders(auth, false), // ללא Content-Type כדי שהדפדפן יגדיר boundary לקובץ
    body: formData,
  });
  return handleResponse(res);
}

// --- Stories 22 & 25: Assignments (Draft / Published) ---
export async function fetchAssignments(auth: AuthContext, courseId: string) {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/assignments`, {
    headers: buildHeaders(auth, false),
  });
  return handleResponse<any[]>(res);
}

export async function createAssignment(
  auth: AuthContext,
  data: {
    course_id: string;
    unit_id?: string | null;
    title: string;
    instructions: string;
    due_date: string;
    max_grade: number;
    status: 'draft' | 'published';
  }
) {
  const res = await fetch(`${API_BASE}/api/assignments`, {
    method: 'POST',
    headers: buildHeaders(auth, true),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function publishAssignment(auth: AuthContext, assignmentId: string) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/publish`, {
    method: 'PATCH',
    headers: buildHeaders(auth, false),
  });
  return handleResponse(res);
}

// --- Story 26: Student Submissions ---
export async function submitSolution(
  auth: AuthContext,
  assignmentId: string,
  file: File
) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: buildHeaders(auth, false),
    body: formData,
  });
  return handleResponse(res);
}

export async function fetchStudentSubmission(assignmentId: string, studentId: string) {
  const res = await fetch(
    `${API_BASE}/api/assignments/${assignmentId}/submissions?student_id=${encodeURIComponent(studentId)}`
  );
  return handleResponse<any[]>(res);
}