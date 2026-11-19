from datetime import datetime, timezone

MOCK_COURSE_MATERIALS = {
    "course-1": [
        {
            "id": "mat-101",
            "course_id": "course-1",
            "unit_id": "unit-1",
            "title": "מצגת שבוע 1 - מבוא לעצים בינאריים",
            "file_type": "PDF",
            "file_url": "https://supabase.co/storage/v1/object/public/materials/lec1.pdf",
            "uploaded_at": "2026-11-16T10:00:00Z",
            "mock_summary_text": (
                "עץ בינארי הוא מבנה נתונים היררכי שבו לכל צומת יש לכל היותר שני בנים: "
                "בן שמאלי ובן ימני. גובה העץ משפיע על סיבוכיות החיפוש והגישה."
            ),
        }
    ]
}

MOCK_CONVERSATIONS = {}


def get_mock_materials(course_id: str) -> list[dict]:
    return MOCK_COURSE_MATERIALS.get(course_id, [])


def get_mock_conversation(conversation_id: str) -> dict | None:
    return MOCK_CONVERSATIONS.get(conversation_id)


def save_mock_turn(
    conversation_id: str,
    user_message: str,
    assistant_answer: str,
    examples: list[str],
    course_id: str | None = None,
    user_id: str = "user-1",
) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    if conversation_id not in MOCK_CONVERSATIONS:
        MOCK_CONVERSATIONS[conversation_id] = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "course_id": course_id,
            "messages": [],
        }

    MOCK_CONVERSATIONS[conversation_id]["messages"].append({
        "role": "user",
        "content": user_message,
        "timestamp": now_iso,
    })
    MOCK_CONVERSATIONS[conversation_id]["messages"].append({
        "role": "assistant",
        "content": assistant_answer,
        "examples": examples,
        "timestamp": now_iso,
    })
    return MOCK_CONVERSATIONS[conversation_id]