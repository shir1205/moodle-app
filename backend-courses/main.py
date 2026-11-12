"""CampuScope Courses & Assignments (Team 2)"""
import os

from fastapi import FastAPI
from pydantic import BaseModel
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


class Course(BaseModel):
    name: str
    lecturer: str


courses = [
    {"id": 1, "name": "מבוא למדעי המחשב", "lecturer": 'ד"ר כהן'}
]


@app.get("/courses")
def list_courses():
    """רשימת כל הקורסים"""
    return courses


@app.post("/courses")
def create_course(course: Course):
    """הוספת קורס חדש"""
    new_course = {"id": len(courses) + 1, **course.model_dump()}
    courses.append(new_course)
    return new_course

