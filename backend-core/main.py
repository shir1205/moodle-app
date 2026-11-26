"""CampuScope Core & Users (Team 1) - Stories 55, 57, 58, 61 & 67"""
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
from auth_middleware import JWT_ALGORITHM, JWT_SECRET, get_current_user
from pydantic import BaseModel

app = FastAPI(title="CampuScope Core & Users")
app.include_router(notifications_router)
from admin_router import router as admin_router
app.include_router(admin_router)

# מאפשר ל-Frontend (פורט 3000) לפנות לשירות
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# הגדרות JWT (סיפור 67) ונעילת חשבון (סיפור 58)

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



@app.get("/health")
def health():
    """בדיקת תקינות - נבדקת ב-tests/test_integration.py"""
    return {"service": "backend-core", "status": "ok"}


@app.post("/test-write")
def test_write(message: str = "hello from CampuScope"):
    result = get_supabase().table("infra_test").insert({"message": message}).execute()
    return {"saved": result.data}


# ---------------------------------------------------------------------------
# סיפור 55 - הרשמת משתמש חדש (User Registration)
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str


@app.post("/register")
def register(body: RegisterRequest):
    """
    רישום סטודנט חדש ב-Supabase Auth ושמירת הפרופיל בטבלת public.users.
    """
    full_name = body.full_name.strip()
    email = body.email.strip().lower()
    password = body.password

    if not full_name:
        raise HTTPException(status_code=400, detail="נא להזין שם מלא")

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="נא להזין כתובת דוא״ל תקינה")

    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if len(password) < 8 or not has_letter or not has_digit:
        raise HTTPException(
            status_code=400,
            detail="הסיסמה חייבת להכיל לפחות 8 תווים, אות אחת ומספר אחד",
        )

    supabase = get_supabase()
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="חסרים משתני סביבה SUPABASE_URL או SUPABASE_KEY בקובץ .env",
        )

    # 1. רישום המשתמש ב-Supabase Auth ושליחת מייל אימות (שימוש ב-VERIFY_REDIRECT_URL מסיפור 57)
    try:
        auth_res = supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
                "options": {
                    "email_redirect_to": VERIFY_REDIRECT_URL,
                    "data": {"full_name": full_name},
                },
            }
        )
    except Exception as error:
        err_msg = str(error).lower()
        if "already registered" in err_msg or "already exists" in err_msg:
            raise HTTPException(status_code=409, detail="כתובת אימייל זו כבר קיימת במערכת")
        if "rate limit" in err_msg or getattr(error, "status", None) == 429:
            raise HTTPException(status_code=429, detail="נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.")
        raise HTTPException(status_code=400, detail="אירעה שגיאה ברישום המשתמש")

    user = getattr(auth_res, "user", None)
    if user is None:
        raise HTTPException(status_code=400, detail="לא ניתן להשלים את ההרשמה")

    # ב-Supabase: אם המייל כבר קיים ומאומת, חוזר אובייקט משתמש עם רשימת identities ריקה
    identities = getattr(user, "identities", None)
    if identities is not None and len(identities) == 0:
        raise HTTPException(status_code=409, detail="כתובת אימייל זו כבר קיימת במערכת")

    # 2. שמירת המשתמש בטבלת public.users עם תפקיד ברירת מחדל 'student'
    try:
        supabase.table("users").insert(
            {
                "id": user.id,
                "email": email,
                "full_name": full_name,
                "role": "student",
            }
        ).execute()
    except Exception as error:
        err_msg = str(error).lower()
        if "duplicate" in err_msg or "unique" in err_msg:
            raise HTTPException(status_code=409, detail="כתובת אימייל זו כבר קיימת במערכת")
        raise HTTPException(status_code=500, detail="המשתמש נוצר אך שמירת הפרופיל נכשלה")

    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": email,
            "full_name": full_name,
            "role": "student",
        },
    }


# ---------------------------------------------------------------------------
# סיפורים 58 & 67 - התחברות משתמש ו-JWT
# ---------------------------------------------------------------------------

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
# ---------------------------------------------------------------------------

VERIFY_REDIRECT_URL = os.environ.get("VERIFY_REDIRECT_URL", "http://localhost:3000/verify")

EMAIL_NOT_CONFIRMED_MESSAGE = "החשבון טרם אומת. נא לבדוק את תיבת הדוא״ל וללחוץ על קישור האימות."
INVALID_LINK_MESSAGE = "קישור האימות אינו תקף או שפג תוקפו"


class VerifyEmailRequest(BaseModel):
    access_token: str


class ResendVerificationRequest(BaseModel):
    email: str


def is_email_not_confirmed(error: Exception) -> bool:
    code = getattr(error, "code", "") or ""
    return code == "email_not_confirmed" or "email not confirmed" in str(error).lower()


@app.post("/verify-email")
def verify_email(body: VerifyEmailRequest):
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

    return {"sent": True, "message": "אם הכתובת רשומה וטרם אומתה, נשלח אליה מייל אימות חדש."}


# ---------------------------------------------------------------------------
# סיפור 61 - צפייה בפרטים האישיים (Profile View)
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
    except Exception as e:
        print("PROFILE SUPABASE ERROR:", e)
        raise HTTPException(status_code=500, detail=f"לא ניתן לשלוף את פרטי הפרופיל: {e}")

    record = result.data[0] if result.data else None
    if not record:
        raise HTTPException(status_code=404, detail="פרטי המשתמש לא נמצאו")

    profile = {field: record.get(field) for field in PROFILE_FIELDS}
    profile["id"] = current_user.get("id")
    profile["email"] = profile["email"] or email
    profile["role"] = profile["role"] or current_user.get("role", "student")
    return {"profile": profile}

    

# ---------------------------------------------------------------------------
# סיפור 62 - עדכון פרטי משתמש (Profile Update)
#
#   PUT /profile  - המשתמש המחובר מעדכן את הפרטים של עצמו בלבד.
#   המשתמש מזוהה לפי ה-JWT, ולכן אי אפשר לעדכן פרופיל של משתמש אחר.
#   אפשר לעדכן רק שם מלא ומחלקה. מייל ותפקיד לא ניתנים לשינוי כאן
#   (שינוי תפקיד נעשה רק על ידי מנהל - סיפור 64).
# ---------------------------------------------------------------------------

MAX_PROFILE_FIELD_LENGTH = 100


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None


@app.put("/profile")
def update_profile(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    updates = {}

    if body.full_name is not None:
        full_name = body.full_name.strip()
        if not full_name:
            raise HTTPException(status_code=400, detail="השם המלא לא יכול להיות ריק")
        if len(full_name) > MAX_PROFILE_FIELD_LENGTH:
            raise HTTPException(status_code=400, detail="השם המלא ארוך מדי (עד 100 תווים)")
        updates["full_name"] = full_name

    if body.department is not None:
        department = body.department.strip()
        if len(department) > MAX_PROFILE_FIELD_LENGTH:
            raise HTTPException(status_code=400, detail="שם המחלקה ארוך מדי (עד 100 תווים)")
        updates["department"] = department

    if not updates:
        raise HTTPException(status_code=400, detail="לא נשלחו פרטים לעדכון")

    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    email = (current_user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="טוקן אימות לא תקין")

    try:
        result = supabase.table("users").update(updates).eq("email", email).execute()
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לעדכן את הפרופיל כרגע")

    record = result.data[0] if result.data else None
    if not record:
        raise HTTPException(status_code=404, detail="פרטי המשתמש לא נמצאו")

    profile = {field: record.get(field) for field in PROFILE_FIELDS}
    profile["id"] = current_user.get("id")
    profile["email"] = profile["email"] or email
    profile["role"] = profile["role"] or current_user.get("role", "student")
    return {"profile": profile}



# ---------------------------------------------------------------------------
# סיפור 63 - שינוי סיסמה והתנתקות
#
#   POST /change-password  - המשתמש המחובר מחליף סיסמה.
#       1. בדיקה שהסיסמה החדשה עומדת בכללי החוזק (כמו בהרשמה)
#       2. אימות הסיסמה הנוכחית מול Supabase Auth
#       3. עדכון הסיסמה ב-Supabase Auth
#   POST /logout  - סיום החיבור. ה-JWT נשמר רק בדפדפן ואינו נשמר בשרת,
#       ולכן ההתנתקות בפועל היא מחיקת הטוקן בצד הלקוח.
# ---------------------------------------------------------------------------

WRONG_CURRENT_PASSWORD_MESSAGE = "הסיסמה הנוכחית שגויה"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def is_strong_password(password: str) -> bool:
    """אותם כללים כמו בהרשמה (סיפור 56): לפחות 8 תווים, אות אחת ומספר אחד"""
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return len(password) >= 8 and has_letter and has_digit


@app.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    if not body.current_password:
        raise HTTPException(status_code=400, detail="נא להזין את הסיסמה הנוכחית")

    if not is_strong_password(body.new_password):
        raise HTTPException(
            status_code=400,
            detail="הסיסמה החדשה חייבת להכיל לפחות 8 תווים, אות אחת ומספר אחד",
        )

    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="הסיסמה החדשה חייבת להיות שונה מהנוכחית")

    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    email = (current_user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="טוקן אימות לא תקין")

    # אימות הסיסמה הנוכחית. מחזירים 400 ולא 401,
    # כדי שהממשק לא יחשוב שפג תוקף ההתחברות ויתנתק
    try:
        auth_res = supabase.auth.sign_in_with_password(
            {"email": email, "password": body.current_password}
        )
    except Exception:
        auth_res = None

    if not auth_res or not getattr(auth_res, "user", None):
        raise HTTPException(status_code=400, detail=WRONG_CURRENT_PASSWORD_MESSAGE)

    # עדכון הסיסמה (הלקוח מחובר עכשיו בשם המשתמש, אחרי האימות)
    try:
        supabase.auth.update_user({"password": body.new_password})
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לעדכן את הסיסמה כרגע")

    return {"changed": True, "message": "הסיסמה עודכנה בהצלחה"}


@app.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    return {"logged_out": True}
# ---------------------------------------------------------------------------
# סיפור 88 - אכיפת הרשאות מבוססת תפקידים (RBAC Middleware / Dependency)
# ---------------------------------------------------------------------------

VALID_ROLES = {"student", "ta", "lecturer", "admin"}


def require_roles(*allowed_roles: str):
    """Dependency לאכיפת הרשאות לפי תפקיד - מחזיר 403 Forbidden למשתמש לא מורשה"""
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = (current_user.get("role") or "student").strip().lower()
        email = (current_user.get("email") or "").strip().lower()

        supabase = get_supabase()
        if supabase and email:
            try:
                res = (
                    supabase.table("users")
                    .select("role")
                    .eq("email", email)
                    .limit(1)
                    .execute()
                )
                if res.data and res.data[0].get("role"):
                    user_role = res.data[0]["role"].strip().lower()
            except Exception:
                pass

        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="אין לך הרשאה לבצע פעולה זו",
            )
        return {**current_user, "role": user_role}

    return role_checker


# ---------------------------------------------------------------------------
# סיפור 87 (Tasks #184, #185) - ניהול תפקידים והרשאות (RBAC)
# ---------------------------------------------------------------------------

from rbac import ALLOWED_ROLES, UserRole, require_admin, require_lecturer


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


@app.get("/users")
def list_users_roles(current_user: dict = Depends(require_admin)):
    """שליפת רשימת משתמשים ותפקידים - מוגבל למנהל מערכת (admin) בלבד"""
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    try:
        result = supabase.table("users").select("id, email, full_name, role").execute()
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לשלוף את רשימת המשתמשים כרגע")

    return {"users": result.data or []}


@app.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    body: UpdateUserRoleRequest,
    current_user: dict = Depends(require_admin),
):
    """עדכון תפקיד משתמש (student / lecturer / admin) - מוגבל למנהל (admin) בלבד"""
    new_role = body.role.value
    if new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="תפקיד לא חוקי")

    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    try:
        result = (
            supabase.table("users")
            .update({"role": new_role})
            .eq("id", user_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לעדכן את תפקיד המשתמש כרגע")

    record = result.data[0] if result.data else None
    if not record:
        raise HTTPException(status_code=404, detail="המשתמש לא נמצא")

    return {
        "updated": True,
        "user": {
            "id": record.get("id"),
            "email": record.get("email"),
            "full_name": record.get("full_name"),
            "role": record.get("role"),
        },
    }


@app.get("/rbac/lecturer-only")
def lecturer_only_check(current_user: dict = Depends(require_lecturer)):
    """נקודת בדיקה להרשאות מרצה/מנהל (מחזירה 403 לסטודנט)"""
    return {
        "allowed": True,
        "user_id": current_user["user_id"],
        "role": current_user["role"],
    }
