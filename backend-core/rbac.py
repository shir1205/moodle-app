"""
מנגנון ניהול תפקידים והרשאות (RBAC - User Story #87, Task #185)
תפקידים מותרים במערכת: student, lecturer, admin
מחזיר 403 Forbidden כאשר למשתמש המחובר אין הרשאה מתאימה.
"""
from enum import Enum
from typing import Callable

from fastapi import Depends, HTTPException, status

from auth_middleware import get_current_user


class UserRole(str, Enum):
    STUDENT = "student"
    LECTURER = "lecturer"
    ADMIN = "admin"


ALLOWED_ROLES = {role.value for role in UserRole}
DEFAULT_ROLE = UserRole.STUDENT.value


def require_roles(*allowed_roles: UserRole | str) -> Callable:
    """
    FastAPI Dependency לאכיפת הרשאות לפי תפקיד.
    דוגמת שימוש:
        @app.post("/courses")
        def create_course(user: dict = Depends(require_roles(UserRole.LECTURER, UserRole.ADMIN))):
            ...
    """
    normalized_allowed = {
        r.value if isinstance(r, UserRole) else str(r).lower()
        for r in allowed_roles
    }

    def _role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = (current_user.get("role") or DEFAULT_ROLE).lower()

        if user_role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"תפקיד משתמש לא חוקי: {user_role}",
            )

        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="אין לך הרשאה לבצע פעולה זו (403 Forbidden)",
            )

        return current_user

    return _role_checker


# קיצורי דרך נוחים לשימוש בכל השירותים (צוותים 1, 2, 3 ו-4)
require_student = require_roles(UserRole.STUDENT, UserRole.LECTURER, UserRole.ADMIN)
require_lecturer = require_roles(UserRole.LECTURER, UserRole.ADMIN)
require_admin = require_roles(UserRole.ADMIN)