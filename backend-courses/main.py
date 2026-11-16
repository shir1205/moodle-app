"""CampuScope Courses & Assignments (Team 2)"""
import os

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
from fastapi import HTTPException

from models import AssignmentCreate
from database import get_supabase

app = FastAPI(title="CampuScope Courses & Assignments")

# מאפשר ל-Frontend (פורט 3000) לפנות לשירות
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    ],
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

@app.post("/assignments", status_code=201)
def create_assignment(assignment: AssignmentCreate):
    data = assignment.model_dump(mode="json")

    new_assignment = {
        "id": str(uuid4()),
        "course_id": data["courseId"],
        "unit_id": data["unitId"],
        "title": data["title"],
        "instructions": data["instructions"],
        "due_date": data["dueDate"],
        "max_grade": data["maxGrade"],
        "allowed_formats": data["allowedFormats"],
        "status": "draft",
    }

    try:
        response = (
            get_supabase()
            .table("assignments")
            .insert(new_assignment)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Unable to save assignment"
        )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail="Assignment was not returned"
        )

    return response.data[0]


@app.get("/assignments")
def list_assignments():
    try:
        response = (
            get_supabase()
            .table("assignments")
            .select("*")
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Unable to load assignments"
        )

    return response.data

@app.get("/courses/{course_id}/assignments/active")
def list_active_assignments(course_id: str):
    try:
        response = (
            get_supabase()
            .table("assignments")
            .select("*")
            .eq("course_id", course_id)
            .eq("status", "published")
            .order("due_date", desc=False)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Unable to load active assignments"
        )

    return response.data
