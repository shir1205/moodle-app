"""CampuScope Core & Users (Team 1) - Stories 58 & 67 (Login + JWT)"""
import os
from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    for env_path in [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]:
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from notifications_router import router as notifications_router
from pydantic import BaseModel

app = FastAPI(title="CampuScope Core & Users")
app.include_router(notifications_router)

# מאפשר ל-Frontend (פורט 3000) לפנות לשירות
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# הגדרות JWT (סיפור 67) ונעילת חשבון (סיפור 58)
JWT_SECRET = os.environ.get("JWT_SECRET", os.environ.get("SUPABASE_KEY", "campuscope-dev-secret-key"))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24 שעות

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class LoginRequest(BaseModel):
    email: str
    password: str


def get_supabase():
    """חיבור ל-Supabase לפי המפתחות שב-.env"""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def create_access_token(user_id: str, email: str, role: str = "student") -> str:
    """הנפקת JWT המכיל sub, email, role ותוקף (exp)"""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Middleware / Dependency שבודק את ה-JWT בכל בקשה מאובטחת"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="חסר טוקן אימות תקין (Authorization: Bearer <token>)",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "role": payload.get("role", "student"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="פג תוקף הטוקן, נא להתחבר מחדש")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="טוקן אימות לא תקין")


@app.get("/health")
def health():
    """בדיקת תקינות - נבדקת ב-tests/test_integration.py"""
    return {"service": "backend-core", "status": "ok"}


@app.post("/test-write")
def test_write(message: str = "hello from CampuScope"):
    result = get_supabase().table("infra_test").insert({"message": message}).execute()
    return {"saved": result.data}


@app.post("/login")
def login(payload: LoginRequest):
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    email = payload.email.strip().lower()
    now = datetime.now(timezone.utc)

    # 1. שליפת נתוני המשתמש מטבלת users לבדיקת נעילה (מוגן מקריסה אם הטבלה חסרה)
    user_record = None
    try:
        user_res = supabase.table("users").select("*").eq("email", email).execute()
        user_record = user_res.data[0] if user_res.data else None
    except Exception:
        user_record = None

    if user_record and user_record.get("locked_until"):
        locked_until = datetime.fromisoformat(
            user_record["locked_until"].replace("Z", "+00:00")
        )
        if locked_until > now:
            remaining_minutes = max(1, int((locked_until - now).total_seconds() // 60) + 1)
            raise HTTPException(
                status_code=423,
                detail=f"החשבון נעול זמנית עקב ריבוי ניסיונות כושלים. נסה שוב בעוד {remaining_minutes} דקות.",
            )

    # 2. אימות סיסמה מול Supabase Auth
    try:
        auth_res = supabase.auth.sign_in_with_password(
            {"email": email, "password": payload.password}
        )
    except Exception:
        auth_res = None
    # 3. טיפול בכישלון התחברות: עדכון מונה ונעילה אחרי 5 ניסיונות
    if not auth_res or not auth_res.user:
        if user_record:
            attempts = (user_record.get("failed_login_attempts") or 0) + 1
            update_data: dict = {"failed_login_attempts": attempts}

            if attempts >= MAX_LOGIN_ATTEMPTS:
                lock_time = now + timedelta(minutes=LOCKOUT_MINUTES)
                update_data["locked_until"] = lock_time.isoformat()
                try:
                    supabase.table("users").update(update_data).eq("id", user_record["id"]).execute()
                except Exception:
                    pass
                raise HTTPException(
                    status_code=423,
                    detail=f"הזנת סיסמה שגויה {MAX_LOGIN_ATTEMPTS} פעמים. החשבון ננעל ל-{LOCKOUT_MINUTES} דקות.",
                )

            try:
                supabase.table("users").update(update_data).eq("id", user_record["id"]).execute()
            except Exception:
                pass

        raise HTTPException(status_code=401, detail="אימייל או סיסמה שגויים")

    # 4. הצלחת התחברות: איפוס מונה כישלונות ונעילה + הנפקת JWT
    if user_record:
        try:
            supabase.table("users").update(
                {"failed_login_attempts": 0, "locked_until": None}
            ).eq("id", user_record["id"]).execute()
        except Exception:
            pass

    user_role = user_record.get("role", "student") if user_record else "student"
    full_name = user_record.get("full_name", "") if user_record else ""
    access_token = create_access_token(
        user_id=str(auth_res.user.id),
        email=auth_res.user.email or email,
        role=user_role,
    )

    return {
        "message": "התחברת בהצלחה",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(auth_res.user.id),
            "email": auth_res.user.email or email,
            "full_name": full_name,
            "role": user_role,
        },
    }

@app.get("/auth/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    """נקודת קצה לבדיקת תקינות ה-JWT Token"""
    return {"authenticated": True, "user": current_user}
# ---------------------------------------------------------------------------
# סיפור 57 - אימות כתובת דוא"ל (Email Verification)
#
# הזרימה (Supabase בגרסה החינמית, תבנית המייל לא ניתנת לעריכה):
#   1. sign_up (סיפור 55) עם email_redirect_to = VERIFY_REDIRECT_URL
#   2. Supabase שולח מייל. הקישור עובר דרך Supabase, שמאמת את המייל בעצמו
#   3. Supabase מחזיר את המשתמש ל-/verify עם access_token בכתובת
#   4. מסך /verify שולח את ה-access_token ל-POST /verify-email
#      והשרת בודק מול Supabase שהמייל באמת אומת (email_confirmed_at)
#
#   POST /verify-email          - בדיקה בצד השרת שהמשתמש מאומת
#   POST /resend-verification   - שליחה חוזרת של מייל האימות
#   is_email_not_confirmed()    - עזר לנתיב /login (סיפור 58)
# ---------------------------------------------------------------------------

# לאן Supabase מחזיר את המשתמש אחרי לחיצה על הקישור במייל.
# להשתמש באותו ערך גם ב-sign_up (סיפור 55):
#   options={"email_redirect_to": VERIFY_REDIRECT_URL}
VERIFY_REDIRECT_URL = os.environ.get("VERIFY_REDIRECT_URL", "http://localhost:3000/verify")

EMAIL_NOT_CONFIRMED_MESSAGE = "החשבון טרם אומת. נא לבדוק את תיבת הדוא״ל וללחוץ על קישור האימות."
INVALID_LINK_MESSAGE = "קישור האימות אינו תקף או שפג תוקפו"


class VerifyEmailRequest(BaseModel):
    access_token: str


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
    Supabase כבר אימת את המייל והחזיר את המשתמש ל-/verify עם access_token.
    כאן בודקים בצד השרת שהטוקן אמיתי ושהמייל אכן מסומן כמאומת,
    כדי לא לסמוך רק על מה שכתוב בכתובת בדפדפן.
    """
    if not body.access_token.strip():
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    try:
        result = get_supabase().auth.get_user(body.access_token)
    except Exception:
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    user = getattr(result, "user", None)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_MESSAGE)

    if not getattr(user, "email_confirmed_at", None):
        raise HTTPException(status_code=403, detail=EMAIL_NOT_CONFIRMED_MESSAGE)

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
        get_supabase().auth.resend(
            {
                "type": "signup",
                "email": email,
                "options": {"email_redirect_to": VERIFY_REDIRECT_URL},
            }
        )
    except Exception as error:
        if getattr(error, "status", None) == 429 or "rate limit" in str(error).lower():
            raise HTTPException(status_code=429, detail="נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.")
        # כל שגיאה אחרת (למשל מייל לא רשום) - לא חושפים פרטים

    return {"sent": True, "message": "אם הכתובת רשומה וטרם אומתה, נשלח אליה מייל אימות חדש."}




# ---------------------------------------------------------------------------
# סיפור 61 - צפייה בפרטים האישיים (Profile View)
#
#   GET /profile  - מחזיר את פרטי המשתמש המחובר בלבד.
#   המשתמש מזוהה אך ורק לפי ה-JWT (get_current_user, סיפור 67),
#   כך שאי אפשר לבקש פרופיל של משתמש אחר.
#   מוחזרים רק שדות "בטוחים" - בלי מונה ניסיונות, נעילה או סיסמה.
# ---------------------------------------------------------------------------

PROFILE_FIELDS = ("full_name", "email", "role", "department", "avatar_url", "created_at")


@app.get("/profile")
def read_profile(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    email = (current_user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="טוקן אימות לא תקין")

    try:
        result = supabase.table("users").select("*").eq("email", email).limit(1).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לשלוף את פרטי הפרופיל כרגע")

    record = result.data[0] if result.data else None
    if not record:
        raise HTTPException(status_code=404, detail="פרטי המשתמש לא נמצאו")

    profile = {field: record.get(field) for field in PROFILE_FIELDS}
    profile["id"] = current_user.get("id")
    profile["email"] = profile["email"] or email
    profile["role"] = profile["role"] or current_user.get("role", "student")
    return {"profile": profile}