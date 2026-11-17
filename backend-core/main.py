"""CampuScope Core & Users (Team 1)"""
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="CampuScope Core & Users")

# מאפשר ל-Frontend (3000 או 5173) לפנות לשרת (8001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
)

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class LoginRequest(BaseModel):
    email: str
    password: str


@app.get("/health")
def health():
    """בדיקת תקינות - נבדקת ב-tests/test_integration.py"""
    return {"service": "backend-core", "status": "ok"}


@app.post("/login")
def login(payload: LoginRequest):
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

    # 4. הצלחת התחברות: איפוס מונה כישלונות ונעילה
    if user_record:
        try:
            supabase.table("users").update(
                {"failed_login_attempts": 0, "locked_until": None}
            ).eq("id", user_record["id"]).execute()
        except Exception:
            pass

    return {
        "message": "התחברת בהצלחה",
        "user": {
            "id": auth_res.user.id,
            "email": auth_res.user.email,
            "full_name": user_record.get("full_name", "") if user_record else "",
            "role": user_record.get("role", "student") if user_record else "student",
        },
    }