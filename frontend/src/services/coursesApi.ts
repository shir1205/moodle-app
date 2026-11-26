import { authFetch } from "./apiClient";

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

  const res = await authFetch(
    `${API_BASE}/api/assignments/${assignmentId}/submit`,
    {
      method: 'POST',
      body: formData,
    }
  );
  return handleResponse(res);
}

export async function fetchStudentSubmission(assignmentId: string, studentId: string) {
  const res = await fetch(
    `${API_BASE}/api/assignments/${assignmentId}/submissions?student_id=${encodeURIComponent(studentId)}`
  );
  return handleResponse<any[]>(res);
}

export interface PublishedGrade {
  grade: number;
  feedback: string;
  published_at: string;
}

export async function fetchMyAssignmentGrade(
  assignmentId: string,
  signal?: AbortSignal
): Promise<PublishedGrade | null> {
  const response = await authFetch(
    `${API_BASE}/api/assignments/${encodeURIComponent(assignmentId)}/my-grade`,
    { signal }
  );

  if (response.status === 404) {
    return null;
  }

  return handleResponse<PublishedGrade>(response);
}

export interface MySubmission {
  id: string;
  assignment_id: string | null;
  file_name: string;
  submitted_at: string | null;
}

export async function fetchMySubmissions(
  signal?: AbortSignal
): Promise<MySubmission[]> {
  const response = await authFetch(`${API_BASE}/api/me/submissions`, { signal });
  return handleResponse<MySubmission[]>(response);
}
export interface GradeDraftInput {
  grade: number;
  feedback: string;
}

export interface GradingGrade extends GradeDraftInput {
  published_at: string | null;
}

export interface GradingSubmissionsResponse {
  assignment: {
    course_id: string;
    title: string;
    max_grade: number;
  };
  submissions: {
    id: string;
    file_name: string;
    submitted_at: string | null;
    submission_grades: GradingGrade | null;
  }[];
}

export async function fetchGradingSubmissions(
  assignmentId: string,
  signal?: AbortSignal
): Promise<GradingSubmissionsResponse> {
  const url = `${API_BASE}/api/assignments/${encodeURIComponent(assignmentId)}/grading-submissions`;
  return handleResponse<GradingSubmissionsResponse>(await authFetch(url, { signal }));
}

export async function saveGradeDraft(
  submissionId: string,
  draft: GradeDraftInput
): Promise<GradingGrade> {
  const url = `${API_BASE}/api/submissions/${encodeURIComponent(submissionId)}/grade`;
  const response = await authFetch(url, {
    method: 'PUT',
    body: JSON.stringify(draft),
  });
  return handleResponse<GradingGrade>(response);
}

export async function publishSubmissionGrade(
  submissionId: string
): Promise<GradingGrade> {
  const url = `${API_BASE}/api/submissions/${encodeURIComponent(submissionId)}/grade/publish`;
  const response = await authFetch(url, { method: 'POST' });
  return handleResponse<GradingGrade>(response);
}