"""CampuScope Core & Users (Team 1)"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CampuScope Core & Users")

# מאפשר ל-Frontend (פורט 3000) לפנות לשירות
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """בדיקת תקינות - נבדקת ב-tests/test_integration.py"""
    return {"service": "backend-core", "status": "ok"}


def get_supabase():
    """חיבור ל-Supabase לפי המפתחות שב-.env"""
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@app.post("/test-write")
def test_write(message: str = "hello from CampuScope"):
    """
    בדיקת תשתית מקצה לקצה (סעיף 4.1):
    Frontend -> Backend -> Supabase.
    לפני השימוש: ליצור ב-Supabase טבלה בשם infra_test עם עמודה message (text).
    """
    result = get_supabase().table("infra_test").insert({"message": message}).execute()
    return {"saved": result.data}


# ---------------------------------------------------------------------------
# סיפור 57 - אימות כתובת דוא"ל (Email Verification)
#
# את המייל עצמו שולח Supabase Auth אוטומטית אחרי sign_up (סיפור 55),
# בתנאי שבלוח הבקרה של Supabase מופעל "Confirm email"
# (Authentication -> Sign In / Providers -> Email).
#
#   POST /verify-email          - אישור הקישור שהמשתמש לחץ עליו במייל
#   POST /resend-verification   - שליחה חוזרת של מייל האימות
#   is_email_not_confirmed()    - עזר לנתיב /login (סיפור 58)
# ---------------------------------------------------------------------------

EMAIL_NOT_CONFIRMED_MESSAGE = "החשבון טרם אומת. נא לבדוק את תיבת הדוא״ל וללחוץ על קישור האימות."
INVALID_LINK_MESSAGE = "קישור האימות אינו תקף או שפג תוקפו"


class VerifyEmailRequest(BaseModel):
    token_hash: str


class ResendVerificationRequest(BaseModel):
    email: str


def is_email_not_confirmed(error: Exception) -> bool:
    """
    האם השגיאה מ-Supabase נובעת ממשתמש שעוד לא אימת את המייל.
    לשימוש ב-/login: במקרה כזה מחזירים 403 עם EMAIL_NOT_CONFIRMED_MESSAGE.
    """
    code = getattr(error, "code", "") or ""
    return code == "email_not_confirmed" or "email not confirmed" in str(error).lower()


@app.post("/verify-email")
def verify_email(body: VerifyEmailRequest):
    """
    המשתמש לחץ על הקישור במייל, והממשק שולח לכאן את ה-token_hash שבקישור.
    Supabase מסמן את המשתמש כמאומת (email_confirmed_at).
    """
    if not body.token_hash.strip():
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    try:
        result = get_supabase().auth.verify_otp(
            {"type": "signup", "token_hash": body.token_hash}
        )
    except Exception:
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    user = getattr(result, "user", None)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    return {"verified": True, "user_id": user.id, "email": user.email}


@app.post("/resend-verification")
def resend_verification(body: ResendVerificationRequest):
    """
    שליחה חוזרת של מייל האימות.
    התשובה זהה גם כשהמייל לא רשום, כדי שאי אפשר יהיה לגלות אילו כתובות קיימות.
    """
    email = body.email.strip()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="כתובת אימייל לא תקינה")

    try:
        get_supabase().auth.resend({"type": "signup", "email": email})
    except Exception as error:
        if getattr(error, "status", None) == 429 or "rate limit" in str(error).lower():
            raise HTTPException(status_code=429, detail="נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.")
        # כל שגיאה אחרת (למשל מייל לא רשום) - לא חושפים פרטים

    return {"sent": True, "message": "אם הכתובת רשומה וטרם אומתה, נשלח אליה מייל אימות חדש."}