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
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """מאפשר גישה למנהל מערכת (admin) בלבד לפי התפקיד העדכני ב-Supabase"""
    user_role = (current_user.get("role") or "student").strip().lower()
    email = (current_user.get("email") or "").strip().lower()

    supabase = _get_supabase()
    if supabase and email:
        try:
            res = (
                supabase.table("users")
                .select("role")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("role"):
                user_role = res.data[0]["role"].strip().lower()
        except Exception:
            pass

    if user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="אין לך הרשאה לבצע פעולה זו (נדרשת הרשאת מנהל מערכת)",
        )
    return {**current_user, "role": user_role}


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
        result = supabase.table("users").select("*").execute()
    except Exception as e:
        print("ADMIN LIST USERS ERROR:", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"שגיאת מסד נתונים בשליפת משתמשים: {e}",
        )

    raw_users = result.data or []
    users = [
        {
            "id": u.get("id"),
            "email": u.get("email", ""),
            "full_name": u.get("full_name", ""),
            "role": u.get("role", "student"),
            "department": u.get("department"),
            "avatar_url": u.get("avatar_url"),
            "created_at": u.get("created_at"),
        }
        for u in raw_users
    ]

    users.sort(key=lambda u: u.get("created_at") or "", reverse=True)
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
    except Exception as e:
        print("ADMIN UPDATE ROLE ERROR:", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"שגיאת מסד נתונים בעדכון תפקיד: {e}",
        )

    updated_user = result.data[0] if result.data else None
    if not updated_user:
        raise HTTPException(status_code=404, detail="המשתמש המבוקש לא נמצא")

    return {
        "success": True,
        "message": "תפקיד המשתמש עודכן בהצלחה",
        "user": updated_user,
    }