"""
CampuScope Shared Authentication Middleware (Story #89 - Task #181)
מודול אימות משותף לכלל שירותי המערכת (צוותים 1, 2, 3 ו-4).
מפענח את כותרת Authorization: Bearer <token> ומחזיר user_id, email ו-role.
"""
import os
from typing import Optional

import jwt
from fastapi import Header, HTTPException

# שימוש באותו מפתח סודי ואלגוריתם בדיוק כפי שהוגדרו ב-backend-core (סיפור 67)
JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    os.environ.get("SUPABASE_KEY", "campuscope-dev-secret-key"),
)
JWT_ALGORITHM = "HS256"


def decode_bearer_token(authorization: Optional[str]) -> dict:
    """
    פונקציית ליבה לפענוח ואימות JWT מתוך כותרת Authorization.
    ניתן להשתמש בה ישירות ב-Middleware או דרך ה-Dependency get_current_user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="חסר טוקן אימות תקין (Authorization: Bearer <token>)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="חסר טוקן אימות תקין (Authorization: Bearer <token>)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="פג תוקף הטוקן, נא להתחבר מחדש",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="טוקן אימות לא תקין",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="טוקן אימות חסר מזהה משתמש (sub)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = payload.get("role", "student")

    return {
        "user_id": user_id,  # המפתח המבוקש עבור צוותים 2, 3 ו-4 (סיפור #89)
        "id": user_id,       # תאימות מלאה לאחור עבור נקודות הקצה הקיימות ב-backend-core
        "email": payload.get("email"),
        "role": role,
    }


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI Dependency לשימוש בכל נקודת קצה מוגנת:
    current_user: dict = Depends(get_current_user)
    """
    return decode_bearer_token(authorization)