import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from supabase import create_client, Client

from auth_middleware import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
    title: str
    message: str
    link: Optional[str] = None


class EncouragementNotificationCreate(BaseModel):
    student_id: str
    title: str
    message: str
    course_id: Optional[str] = None
    link: Optional[str] = None

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("student_id must not be empty")
        try:
            return str(uuid.UUID(cleaned))
        except ValueError as exc:
            raise ValueError("student_id must be a valid UUID") from exc

    @field_validator("title", "message")
    @classmethod
    def validate_non_empty_text(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Field must not be empty")
        return cleaned


class NotificationPreferencesUpdate(BaseModel):
    grade_in_app: bool = True
    grade_email: bool = True
    ai_feedback_in_app: bool = True
    ai_feedback_email: bool = False
    new_assignment_in_app: bool = True
    new_assignment_email: bool = True
    reminder_in_app: bool = True
    reminder_email: bool = True
    lecturer_message_in_app: bool = True
    lecturer_message_email: bool = True


def _default_preferences(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "grade_in_app": True,
        "grade_email": True,
        "ai_feedback_in_app": True,
        "ai_feedback_email": False,
        "new_assignment_in_app": True,
        "new_assignment_email": True,
        "reminder_in_app": True,
        "reminder_email": True,
        "lecturer_message_in_app": True,
        "lecturer_message_email": True,
    }


def get_supabase() -> Client:
    """Connect to Supabase using credentials from the .env file."""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment variables")
    return create_client(url, key)


@router.get("/")
async def get_notifications(
    is_read: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        supabase = get_supabase()
        query = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", current_user["user_id"])
        )
        if is_read is not None:
            query = query.eq("is_read", is_read)
        response = query.order("created_at", desc=True).execute()
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (GET /notifications): {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications from database")


@router.post("/", status_code=201)
async def create_notification(
    payload: NotificationCreate,
    current_user: dict = Depends(get_current_user),
):
    target_user_id = payload.user_id or current_user["user_id"]
    try:
        supabase = get_supabase()
        row = {
            "user_id": target_user_id,
            "title": payload.title,
            "message": payload.message,
            "is_read": False,
            "link": payload.link,
        }
        response = supabase.table("notifications").insert(row).execute()
        return response.data[0] if response.data else row
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (POST /notifications): {e}")
        raise HTTPException(status_code=500, detail="Failed to create notification")


@router.post("/encouragement", status_code=201)
async def send_encouragement_notification(
    payload: EncouragementNotificationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Send an encouragement notification from a lecturer/admin to an at-risk student."""
    # TODO: Replace with Depends(require_lecturer) once backend-core/rbac.py (Story #87) is merged to main
    role = (current_user.get("role") or "").strip().lower()
    if role not in {"lecturer", "admin"}:
        raise HTTPException(
            status_code=403,
            detail="אין הרשאה לבצע פעולה זו",
        )

    link = (payload.link or "").strip() or (
        f"/courses/{payload.course_id.strip()}"
        if payload.course_id and payload.course_id.strip()
        else None
    )

    try:
        supabase = get_supabase()
        row = {
            "user_id": payload.student_id,
            "title": payload.title,
            "message": payload.message,
            "is_read": False,
            "link": link,
        }
        response = supabase.table("notifications").insert(row).execute()
        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to save encouragement notification",
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (POST /notifications/encouragement): {e}")
        raise HTTPException(status_code=500, detail="Failed to send encouragement notification")


@router.patch("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("user_id", current_user["user_id"])
            .eq("is_read", False)
            .execute()
        )
        return {"updated_count": len(response.data)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (PATCH /notifications/read-all): {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")


@router.get("/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .execute()
        )
        if not response.data:
            return _default_preferences(current_user["user_id"])
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (GET /notifications/preferences): {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification preferences")


@router.put("/preferences")
async def update_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    try:
        supabase = get_supabase()
        row = {
            "user_id": current_user["user_id"],
            "grade_in_app": payload.grade_in_app,
            "grade_email": payload.grade_email,
            "ai_feedback_in_app": payload.ai_feedback_in_app,
            "ai_feedback_email": payload.ai_feedback_email,
            "new_assignment_in_app": payload.new_assignment_in_app,
            "new_assignment_email": payload.new_assignment_email,
            "reminder_in_app": payload.reminder_in_app,
            "reminder_email": payload.reminder_email,
            "lecturer_message_in_app": payload.lecturer_message_in_app,
            "lecturer_message_email": payload.lecturer_message_email,
        }
        response = (
            supabase.table("notification_preferences")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
        return response.data[0] if response.data else row
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (PUT /notifications/preferences): {e}")
        raise HTTPException(status_code=500, detail="Failed to save notification preferences")


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
            .eq("user_id", current_user["user_id"])
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (PATCH /notifications/{notification_id}/read): {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification")