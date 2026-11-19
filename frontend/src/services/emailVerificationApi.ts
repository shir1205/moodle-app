/**
 * סיפור 57 - אימות כתובת דוא"ל (צוות 1)
 * פניות לשרת backend-core (פורט 8001) לאימות מייל ולשליחה חוזרת של מייל האימות.
 */

const CORE_API_URL = 'http://localhost:8001';

export interface ApiResult {
  success: boolean;
  message: string;
}

/**
 * Supabase מאמת את המייל בעצמו ומחזיר את המשתמש ל-/verify עם access_token בכתובת.
 * כאן שולחים את הטוקן לשרת, שבודק מול Supabase שהמייל באמת אומת.
 */
export async function verifyEmailWithServer(accessToken: string): Promise<ApiResult> {
  try {
    const response = await fetch(`${CORE_API_URL}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.verified) {
      return { success: true, message: 'החשבון אומת בהצלחה, אפשר להתחבר' };
    }
    return { success: false, message: data.detail || 'קישור האימות אינו תקף או שפג תוקפו' };
  } catch {
    return { success: false, message: 'השרת לא זמין כרגע. נסו שוב בעוד רגע.' };
  }
}

/** בקשה מהשרת לשלוח שוב את מייל האימות */
export async function resendVerificationEmail(email: string): Promise<ApiResult> {
  try {
    const response = await fetch(`${CORE_API_URL}/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { success: true, message: data.message || 'נשלח מייל אימות חדש' };
    }
    return { success: false, message: data.detail || 'לא הצלחנו לשלוח את המייל. נסו שוב.' };
  } catch {
    return { success: false, message: 'השרת לא זמין כרגע. נסו שוב בעוד רגע.' };
  }
}