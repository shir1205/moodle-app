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
from pydantic import BaseModel

app = FastAPI(title="CampuScope Core & Users")

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