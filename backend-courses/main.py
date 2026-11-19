"""CampuScope Courses & Assignments (Team 2)"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

ALLOWED_MATERIAL_EXTENSIONS = {"PDF", "DOCX", "PPTX"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="CampuScope Courses & Assignments")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health check - verified by tests/test_integration.py"""
    return {"service": "backend-courses", "status": "ok"}


class Course(BaseModel):
    name: str
    lecturer: str


courses = [
    {"id": 1, "name": "מבוא למדעי המחשב", "lecturer": 'ד"ר כהן'}
]


@app.get("/courses")
def list_courses():
    return courses


@app.post("/courses")
def create_course(course: Course):
    new_course = {"id": len(courses) + 1, **course.model_dump()}
    courses.append(new_course)
    return new_course


class LearningUnitCreate(BaseModel):
    course_id: str
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    order_index: int = 1


def get_current_user(
    x_user_id: str = Header(default="lecturer-michal"),
    x_user_role: str = Header(default="LECTURER"),
):
    return {"user_id": x_user_id, "role": x_user_role.upper()}


def ensure_db():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase credentials are not configured in .env")


# ==========================================
# Story 19: Learning Units API (Tasks 107)
# ==========================================
@app.post("/api/units", status_code=201)
def create_learning_unit(unit: LearningUnitCreate, user: dict = Depends(get_current_user)):
    ensure_db()
    if user["role"] not in {"LECTURER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only lecturers can create learning units.")

    payload = unit.model_dump()
    payload["id"] = f"unit-{uuid.uuid4().hex[:8]}"
    res = supabase.table("learning_units").insert(payload).execute()
    return res.data[0]


@app.get("/api/courses/{course_id}/units")
def get_course_units(course_id: str):
    ensure_db()
    res = (
        supabase.table("learning_units")
        .select("*")
        .eq("course_id", course_id)
        .order("order_index", desc=False)
        .execute()
    )
    return res.data


# ========================================================
# Story 20: Course Materials Upload & Fetch (Tasks 109, 110)
# ========================================================
@app.post("/api/courses/{course_id}/materials", status_code=201)
async def upload_course_material(
    course_id: str,
    unit_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(default=""),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    ensure_db()
    if user["role"] not in {"LECTURER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only lecturers can upload materials.")

    ext = file.filename.split(".")[-1].upper() if "." in file.filename else ""
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"פורמט קובץ לא מורשה. הפורמטים המותרים הם: {', '.join(ALLOWED_MATERIAL_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="גודל הקובץ חורג מהמותר (מקסימום 20MB).")

    storage_path = f"{course_id}/{unit_id}/{int(datetime.now(timezone.utc).timestamp())}_{file.filename}"
    supabase.storage.from_("materials").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )
    public_url = supabase.storage.from_("materials").get_public_url(storage_path)

    record = {
        "id": f"mat-{uuid.uuid4().hex[:8]}",
        "course_id": course_id,
        "unit_id": unit_id,
        "title": title,
        "description": description,
        "file_name": file.filename,
        "file_type": ext,
        "file_url": public_url,
        "uploaded_by": user["user_id"],
    }
    res = supabase.table("course_materials").insert(record).execute()
    return res.data[0]


@app.get("/api/courses/{course_id}/materials")
def get_course_materials(course_id: str):
    ensure_db()
    res = (
        supabase.table("course_materials")
        .select("*")
        .eq("course_id", course_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data