"""CampuScope Admin User Management Router (Team 1 - Story #64)"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth_middleware import get_current_user

router = APIRouter(tags=["Admin"])

VALID_ROLES = {"student", "ta", "lecturer", "admin"}


def _get_supabase():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """מאפשר גישה למנהל מערכת (admin) בלבד"""
    user_role = (current_user.get("role") or "student").strip().lower()
    if user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="אין לך הרשאה לבצע פעולה זו (נדרשת הרשאת מנהל מערכת)",
        )
    return current_user


class UpdateUserRoleRequest(BaseModel):
    role: str


@router.get("/admin/users")
@router.get("/api/admin/users", include_in_schema=False)
def list_all_users(current_user: dict = Depends(require_admin)):
    """שליפת רשימת כל המשתמשים במערכת מ-Supabase (פתוח ל-admin בלבד)"""
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    try:
        result = (
            supabase.table("users")
            .select("id, email, full_name, role, department, avatar_url, created_at")
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לשלוף את רשימת המשתמשים כרגע")

    users = sorted(
        result.data or [],
        key=lambda u: u.get("created_at") or "",
        reverse=True,
    )
    return {"users": users}


@router.patch("/admin/users/{user_id}/role")
@router.patch("/api/admin/users/{user_id}/role", include_in_schema=False)
def update_user_role(
    user_id: str,
    body: UpdateUserRoleRequest,
    current_user: dict = Depends(require_admin),
):
    """עדכון תפקיד משתמש ב-Supabase (פתוח ל-admin בלבד)"""
    new_role = body.role.strip().lower()
    if new_role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail="תפקיד לא תקין. הערכים המותרים הם: student, ta, lecturer, admin",
        )

    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="חיבור ל-Supabase אינו מוגדר בשרת")

    try:
        result = (
            supabase.table("users")
            .update({"role": new_role})
            .eq("id", user_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="לא ניתן לעדכן את תפקיד המשתמש כרגע")

    updated_user = result.data[0] if result.data else None
    if not updated_user:
        raise HTTPException(status_code=404, detail="המשתמש המבוקש לא נמצא")

    return {
        "success": True,
        "message": "תפקיד המשתמש עודכן בהצלחה",
        "user": updated_user,
    }