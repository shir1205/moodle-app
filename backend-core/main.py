"""CampuScope Core & Users (Team 1)"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from fastapi import HTTPException

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
@app.get("/api/notifications/{user_id}")
def get_notifications(user_id: str, is_read: Optional[bool] = None):
    """Task 140: מנגנון סינון התראות בשרת"""
    supabase = get_supabase()
    query = supabase.table("notifications").select("*").eq("user_id", user_id)
    if is_read is not None:
        query = query.eq("is_read", is_read)
    result = query.execute()
    return result.data

@app.patch("/api/notifications/{notification_id}/read")
def mark_as_read(notification_id: str):
    """Task 139: פיתוח Endpoint לעדכון סטטוס התראה לנקראה"""
    supabase = get_supabase()
    result = supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return result.data[0]