from fastapi import APIRouter

# Team 4 router setup - Notifications
router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
async def get_notifications():
    # TODO: In the future, extract user_id from Team 1's JWT
    # TODO: In the future, fetch real data from Supabase
    
    # Mock data for immediate frontend integration and testing
    mock_notifications = [
        {
            "id": "1",
            "user_id": "mock-user-123",
            "title": "ציון חדש הוסף",
            "message": "קיבלת 98 בקורס תכנות מתקדם (C++)",
            "is_read": False,
            "link": "/courses/1/assignments",
            "created_at": "2026-11-16T10:00:00Z"
        },
        {
            "id": "2",
            "user_id": "mock-user-123",
            "title": "הודעת מערכת",
            "message": "ברוכים הבאים למערכת CampuScope!",
            "is_read": True,
            "link": None,
            "created_at": "2026-11-15T08:30:00Z"
        }
    ]
    
    return mock_notifications