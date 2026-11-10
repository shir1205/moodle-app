"""CampuScope Core & Users (Team 1)"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
