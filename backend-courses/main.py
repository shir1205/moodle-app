"""CampuScope Courses & Assignments (Team 2)"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CampuScope Courses & Assignments")

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
    return {"service": "backend-courses", "status": "ok"}
