import os
from fastapi import APIRouter, HTTPException
from supabase import create_client, Client

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def get_supabase() -> Client:
    """Connect to Supabase using credentials from the .env file"""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase credentials not found in environment variables")
    return create_client(url, key)

@router.get("/")
async def get_notifications():
    # TODO: In the future, extract the real user_id from the incoming JWT (Team 1)
    current_user_id = "mock-user-123" 
    
    try:
        supabase = get_supabase()
        # Fetch notifications for the specific user, ordered from newest to oldest
        response = supabase.table("notifications") \
            .select("*") \
            .eq("user_id", current_user_id) \
            .order("created_at", desc=True) \
            .execute()
        
        return response.data
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications from database")