"""CampuScope Courses & Assignments (Team 2)"""
import os
import uuid
import time
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_CORE_DIR = Path(__file__).resolve().parent.parent / "backend-core"
if str(_CORE_DIR) not in sys.path:
    sys.path.insert(0, str(_CORE_DIR))

from auth_middleware import get_current_user as get_authenticated_user  # noqa: E402
from rbac import require_roles  # noqa: E402

ALLOWED_MATERIAL_EXTENSIONS = {"PDF", "DOCX", "PPTX"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
submissions_db = (
    create_client(SUPABASE_URL, service_role_key)
    if SUPABASE_URL and service_role_key
    else None
)

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
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20MB

@app.post("/api/courses/{course_id}/materials", status_code=201)
async def upload_course_material(
    course_id: str,
    unit_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    uploaded_by: str = Form("lecturer-michal"),
    role: Optional[str] = Form(None),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    file: UploadFile = File(...),
):
    # 1. בדיקת הרשאת מרצה (תומך גם ב-Header, גם בשדה Form וגם במזהה המשתמש)
    effective_role = (x_user_role or role or "").strip().upper()
    is_lecturer_id = uploaded_by.lower().startswith("lecturer")
    if effective_role and effective_role != "LECTURER":
        raise HTTPException(status_code=403, detail="רק מרצה רשאי להעלות חומרי לימוד")
    if not effective_role and not is_lecturer_id:
        raise HTTPException(status_code=403, detail="רק מרצה רשאי להעלות חומרי לימוד")

    # 2. בדיקת סיומת קובץ
    allowed_exts = {".pdf", ".docx", ".pptx"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="פורמט קובץ לא נתמך (מותר PDF/DOCX/PPTX)")

    # 3. קריאת הקובץ ובדיקת הגבלת גודל של 20MB
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="גודל הקובץ חורג מהמותר (מקסימום 20MB)")

    # 4. יצירת שם קובץ בטוח באנגלית עבור Supabase Storage
    safe_filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{file_ext}"
    storage_path = f"{course_id}/{unit_id}/{safe_filename}"

    supabase.storage.from_("materials").upload(
        storage_path,
        file_bytes,
        {"content-type": file.content_type or "application/octet-stream"},
    )

    public_url = supabase.storage.from_("materials").get_public_url(storage_path)

    # 5. שמירת הרשומה בטבלת course_materials
    record = {
        "id": f"mat-{uuid.uuid4().hex[:8]}",
        "course_id": course_id,
        "unit_id": unit_id,
        "title": title,
        "description": description,
        "file_name": file.filename,
        "file_type": file_ext.replace(".", "").upper(),
        "file_url": public_url,
        "uploaded_by": uploaded_by,
    }
    res = supabase.table("course_materials").insert(record).execute()
    return res.data[0] if res.data else record


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

    # =====================================================================
# Stories 22 & 25: Draft Assignments & Active Fetch (Tasks 113, 115)
# =====================================================================
class AssignmentCreate(BaseModel):
    course_id: str
    unit_id: Optional[str] = None
    title: str = Field(..., min_length=3)
    instructions: Optional[str] = ""
    due_date: datetime
    max_grade: int = Field(default=100, ge=1)
    status: str = Field(default="draft")


@app.post("/api/assignments", status_code=201)
def create_assignment(assignment: AssignmentCreate, user: dict = Depends(get_current_user)):
    ensure_db()
    if user["role"] not in {"LECTURER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only lecturers can create assignments.")

    normalized_status = assignment.status.lower()
    if normalized_status not in {"draft", "published"}:
        raise HTTPException(status_code=400, detail="סטטוס לא תקין. יש לבחור draft או published.")

    now_utc = datetime.now(timezone.utc)
    due_utc = assignment.due_date if assignment.due_date.tzinfo else assignment.due_date.replace(tzinfo=timezone.utc)

    if normalized_status == "published" and due_utc <= now_utc:
        raise HTTPException(status_code=400, detail="לא ניתן לפרסם מטלה שתאריך ההגשה שלה כבר עבר.")

    payload = assignment.model_dump()
    payload["id"] = f"assign-{uuid.uuid4().hex[:8]}"
    payload["status"] = normalized_status
    payload["due_date"] = due_utc.isoformat()
    payload["created_by"] = user["user_id"]

    res = supabase.table("assignments").insert(payload).execute()
    return res.data[0]


@app.patch("/api/assignments/{assignment_id}/publish")
def publish_draft_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    ensure_db()
    if user["role"] not in {"LECTURER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Only lecturers can publish assignments.")

    existing = supabase.table("assignments").select("*").eq("id", assignment_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="המטלה לא נמצאה.")

    due_utc = datetime.fromisoformat(existing.data[0]["due_date"].replace("Z", "+00:00"))
    if due_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="לא ניתן לפרסם מטלה שתאריך היעד שלה בעבר.")

    res = (
        supabase.table("assignments")
        .update({"status": "published"})
        .eq("id", assignment_id)
        .execute()
    )
    return res.data[0]


@app.get("/api/courses/{course_id}/assignments")
def get_course_assignments(course_id: str, user: dict = Depends(get_current_user)):
    ensure_db()
    query = supabase.table("assignments").select("*").eq("course_id", course_id)

    # Students only see published assignments (drafts are hidden)
    if user["role"] == "STUDENT":
        query = query.eq("status", "published")

    res = query.order("due_date", desc=False).execute()
    return res.data

    # =====================================================================
# Story 26: Submit & Replace Solution Before Deadline (Task 118)
# =====================================================================
ALLOWED_SUBMISSION_EXTENSIONS = {"PDF", "ZIP", "PY", "JAVA", "CS", "TXT"}


@app.post("/api/assignments/{assignment_id}/submit", status_code=201)
async def submit_or_replace_solution(
    assignment_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_authenticated_user),
):
    ensure_db()
    assign_res = supabase.table("assignments").select("*").eq("id", assignment_id).execute()
    if not assign_res.data:
        raise HTTPException(status_code=404, detail="המטלה לא נמצאה.")

    assignment = assign_res.data[0]
    if assignment["status"].lower() != "published":
        raise HTTPException(status_code=400, detail="לא ניתן להגיש פתרון למטלה שנמצאת במצב טיוטה.")

    now_utc = datetime.now(timezone.utc)
    due_utc = datetime.fromisoformat(assignment["due_date"].replace("Z", "+00:00"))
    if now_utc > due_utc:
        raise HTTPException(status_code=403, detail="מועד ההגשה חלף. אזור ההעלאה ננעל.")

    safe_name = file.filename or "submission.bin"
    ext = safe_name.split(".")[-1].upper() if "." in safe_name else ""
    if ext not in ALLOWED_SUBMISSION_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"סוג קובץ לא מורשה להגשה: {ext}")

    if submissions_db is None:
        raise HTTPException(
            status_code=503,
            detail="שמירת הגשות אינה זמינה כרגע.",
        )

    content = await file.read()
    storage_path = f"{assignment_id}/{user['user_id']}/{uuid.uuid4().hex}.{ext.lower()}"
    supabase.storage.from_("submissions").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )
    public_url = supabase.storage.from_("submissions").get_public_url(storage_path)

    res = submissions_db.rpc(
        "save_assignment_submission",
        {
            "p_assignment_id": assignment_id,
            "p_student_id": user["user_id"],
            "p_file_name": safe_name,
            "p_file_url": public_url,
            "p_submitted_at": now_utc.isoformat(),
        },
    ).execute()
    return res.data[0]

def require_grading_access(
    submission_id: str,
    user: dict = Depends(require_roles("lecturer", "admin")),
):
    if submissions_db is None:
        raise HTTPException(status_code=503, detail="שירות הציונים אינו זמין כרגע.")

    submission = (
        submissions_db.table("submissions")
        .select("assignment_id")
        .eq("id", submission_id)
        .limit(1)
        .execute()
    )
    if not submission.data or submission.data[0]["assignment_id"] is None:
        raise HTTPException(status_code=404, detail="ההגשה לא נמצאה.")

    assignment = (
        submissions_db.table("assignments")
        .select("course_id, max_grade")
        .eq("id", submission.data[0]["assignment_id"])
        .limit(1)
        .execute()
    )
    if not assignment.data:
        raise HTTPException(status_code=404, detail="המטלה לא נמצאה.")

    assignment_info = assignment.data[0]
    if user["role"].lower() != "admin":
        membership = (
            submissions_db.table("course_lecturers")
            .select("lecturer_id")
            .eq("course_id", assignment_info["course_id"])
            .eq("lecturer_id", user["user_id"])
            .limit(1)
            .execute()
        )
        if not membership.data:
            raise HTTPException(status_code=403, detail="אין הרשאת בדיקה בקורס זה.")

    return assignment_info

class GradeDraft(BaseModel):
    grade: float = Field(ge=0, allow_inf_nan=False)
    feedback: str = ""


@app.put("/api/submissions/{submission_id}/grade")
def save_grade_draft(
    submission_id: str,
    body: GradeDraft,
    assignment_info: dict = Depends(require_grading_access),
):
    if body.grade > assignment_info["max_grade"]:
        raise HTTPException(status_code=400, detail="הציון חורג מהציון המרבי במטלה.")

    values = {"grade": body.grade, "feedback": body.feedback}
    grades = submissions_db.table("submission_grades")

    inserted = grades.upsert(
        {"submission_id": submission_id, **values},
        on_conflict="submission_id",
        ignore_duplicates=True,
    ).execute()
    if inserted.data:
        return inserted.data[0]

    updated = (
        grades.update(values)
        .eq("submission_id", submission_id)
        .is_("published_at", "null")
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=409, detail="לא ניתן לערוך ציון שכבר פורסם.")

    return updated.data[0]
@app.post("/api/submissions/{submission_id}/grade/publish")
def publish_submission_grade(
    submission_id: str,
    assignment_info: dict = Depends(require_grading_access),
):
    result = (
        submissions_db.table("submission_grades")
        .update({"published_at": datetime.now(timezone.utc).isoformat()})
        .eq("submission_id", submission_id)
        .is_("published_at", "null")
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=409,
            detail="אין טיוטת ציון זמינה לפרסום.",
        )

    return result.data[0]
@app.get("/api/assignments/{assignment_id}/grading-submissions")
def get_grading_submissions(
    assignment_id: str,
    user: dict = Depends(require_roles("lecturer", "admin")),
):
    if submissions_db is None:
        raise HTTPException(status_code=503, detail="שירות הציונים אינו זמין כרגע.")

    assignment = (
        submissions_db.table("assignments")
        .select("course_id, title, max_grade")
        .eq("id", assignment_id)
        .limit(1)
        .execute()
    )
    if not assignment.data:
        raise HTTPException(status_code=404, detail="המטלה לא נמצאה.")

    assignment_info = assignment.data[0]
    if user["role"].lower() != "admin":
        membership = (
            submissions_db.table("course_lecturers")
            .select("lecturer_id")
            .eq("course_id", assignment_info["course_id"])
            .eq("lecturer_id", user["user_id"])
            .limit(1)
            .execute()
        )
        if not membership.data:
            raise HTTPException(status_code=403, detail="אין הרשאת בדיקה בקורס זה.")

    submissions = (
        submissions_db.table("submissions")
        .select("id, file_name, submitted_at, submission_grades(grade, feedback, published_at)")
        .eq("assignment_id", assignment_id)
        .order("submitted_at", desc=True, nullsfirst=False)
        .execute()
    )
    return {"assignment": assignment_info, "submissions": submissions.data}
@app.get("/api/me/submissions")
def get_my_submissions(user: dict = Depends(get_authenticated_user)):
    if submissions_db is None:
        raise HTTPException(
            status_code=503,
            detail="רשימת ההגשות אינה זמינה כרגע.",
        )

    result = (
        submissions_db.table("submissions")
        .select("id, assignment_id, file_name, submitted_at")
        .eq("student_id", user["user_id"])
        .order("submitted_at", desc=True, nullsfirst=False)
        .execute()
    )
    return result.data

@app.get("/api/assignments/{assignment_id}/my-grade")
def get_my_assignment_grade(
    assignment_id: str,
    user: dict = Depends(get_authenticated_user),
):
    ensure_db()

    submission = (
        supabase.table("submissions")
        .select("id")
        .eq("assignment_id", assignment_id)
        .eq("student_id", user["user_id"])
        .limit(1)
        .execute()
    )
    if not submission.data:
        raise HTTPException(status_code=404, detail="אין ציון שפורסם למטלה זו.")

    if submissions_db is None:
        raise HTTPException(
            status_code=503,
            detail="הצגת ציון אינה זמינה כרגע.",
        )
    result = (
        submissions_db.table("submission_grades")
        .select("grade, feedback, published_at")
        .eq("submission_id", submission.data[0]["id"])
        .not_.is_("published_at", "null")
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="אין ציון שפורסם למטלה זו.")

    return result.data[0]


@app.get("/api/assignments/{assignment_id}/submissions")
def get_assignment_submissions(assignment_id: str, student_id: Optional[str] = None):
    ensure_db()
    query = supabase.table("submissions").select("*").eq("assignment_id", assignment_id)
    if student_id:
        query = query.eq("student_id", student_id)
    res = query.execute()
    return res.data
