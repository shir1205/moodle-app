const API_BASE_URL = 'http://127.0.0.1:8001';

export function getAuthToken(): string | null {
  return localStorage.getItem('campuscope_token');
}

export function clearAuthSession(): void {
  localStorage.removeItem('campuscope_token');
  localStorage.removeItem('campuscope_user');
}

/**
 * פונקציית fetch מאובטחת המצרפת אוטומטית את ה-JWT Token לכל בקשה
 */
export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(url, { ...options, headers });
}