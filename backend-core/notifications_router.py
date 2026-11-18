import os
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    link: Optional[str] = None


def get_supabase() -> Client:
    """Connect to Supabase using credentials from the .env file."""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment variables")
    return create_client(url, key)


def resolve_user_id(x_user_id: Optional[str]) -> str:
    # TODO: Replace with Team 1 JWT extraction once their PR is merged
    return x_user_id or "mock-user-123"


@router.get("/")
async def get_notifications(x_user_id: Optional[str] = Header(default=None, alias="X-User-Id")):
    current_user_id = resolve_user_id(x_user_id)
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"Database error (GET /notifications): {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications from database")


@router.post("/", status_code=201)
async def create_notification(payload: NotificationCreate):
    try:
        supabase = get_supabase()
        row = {
            "user_id": payload.user_id,
            "title": payload.title,
            "message": payload.message,
            "is_read": False,
            "link": payload.link,
        }
        response = supabase.table("notifications").insert(row).execute()
        return response.data[0] if response.data else row
    except Exception as e:
        print(f"Database error (POST /notifications): {e}")
        raise HTTPException(status_code=500, detail="Failed to create notification")


@router.patch("/read-all")
async def mark_all_as_read(x_user_id: Optional[str] = Header(default=None, alias="X-User-Id")):
    current_user_id = resolve_user_id(x_user_id)
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("user_id", current_user_id)
            .eq("is_read", False)
            .execute()
        )
        return {"updated_count": len(response.data)}
    except Exception as e:
        print(f"Database error (PATCH /notifications/read-all): {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: int):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("id", notification_id)
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