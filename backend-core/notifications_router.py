import os
from typing import Optional
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client

router = APIRouter(prefix="/notifications", tags=["Notifications"])

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    os.environ.get("SUPABASE_KEY", "campuscope-dev-secret-key"),
)
JWT_ALGORITHM = "HS256"


class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
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


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Validate Bearer JWT issued by backend-core and extract user claims."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header (Bearer <token>)",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "student"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", current_user["id"])
            .order("created_at", desc=True)
            .execute()
        )
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
    target_user_id = payload.user_id or current_user["id"]
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


@router.patch("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("notifications")
            .update({"is_read": True})
            .eq("user_id", current_user["id"])
            .eq("is_read", False)
            .execute()
        )
        return {"updated_count": len(response.data)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error (PATCH /notifications/read-all): {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")


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
            .eq("user_id", current_user["id"])
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