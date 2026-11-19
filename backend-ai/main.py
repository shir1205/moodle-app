"""CampuScope AI Assistant (Team 3)"""
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

from mock_data import get_mock_conversation, get_mock_materials, save_mock_turn

load_dotenv()
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="CampuScope AI Assistant")

# מאפשר ל-Frontend (פורט 3000) לפנות לשירות
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """בדיקת תקינות - נבדקת ב-tests/test_integration.py"""
    return {"service": "backend-ai", "status": "ok"}


class Question(BaseModel):
    question: str


@app.post("/ask")
def ask(q: Question):
    """שולח שאלה ל-Google AI ומחזיר את התשובה"""
    client = genai.Client(api_key=os.environ["GOOGLE_AI_API_KEY"])
    response = client.models.generate_content(
        model=os.environ.get("GOOGLE_AI_MODEL", "gemini-2.5-flash"),
        contents=q.question,
    )
    return {"answer": response.text}


class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    message: str | None = None
    messages: list[ChatMessage] | None = None
    conversation_id: str | None = None
    course_id: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    reply: str
    examples: list[str] = []


def _get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY is missing")
    return genai.Client(api_key=api_key)


@app.post("/api/ai/chat", response_model=ChatResponse)
def ai_chat(req: ChatRequest):
    """Story 42: מענה לשאלות לימודיות עם דוגמאות | Story 43: שמירת הקשר שיחה"""
    incoming_message = (req.message or "").strip()
    incoming_history: list[ChatMessage] = []

    if req.messages:
        user_msgs = [
            m.content.strip()
            for m in req.messages
            if m.role == "user" and m.content.strip()
        ]
        if not incoming_message and user_msgs:
            incoming_message = user_msgs[-1]
        if len(req.messages) > 1:
            incoming_history = req.messages[:-1]

    if not incoming_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conv_id = req.conversation_id or f"conv-{uuid4().hex[:8]}"

    # שליפת היסטוריית שיחה קודמת (Story 43)
    existing_conv = get_mock_conversation(conv_id)
    history_lines = []
    if existing_conv:
        for msg in existing_conv["messages"]:
            role_label = "סטודנט" if msg["role"] == "user" else "עוזר AI"
            history_lines.append(f"{role_label}: {msg['content']}")
    elif incoming_history:
        for msg in incoming_history:
            role_label = "סטודנט" if msg.role == "user" else "עוזר AI"
            history_lines.append(f"{role_label}: {msg.content}")

    # שליפת חומרי לימוד מדומים לפי course_id (חוזה צוות 2)
    materials_text = ""
    if req.course_id:
        materials = get_mock_materials(req.course_id)
        if materials:
            parts = [
                f"- {m['title']}: {m.get('mock_summary_text', '')}"
                for m in materials
            ]
            materials_text = "\nחומרי לימוד רלוונטיים מהקורס:\n" + "\n".join(parts)

    history_block = ""
    if history_lines:
        history_block = "\nהיסטוריית השיחה עד כה:\n" + "\n".join(history_lines)

    prompt = (
        "את עוזרת לימודית חכמה לסטודנטים. עני בעברית בצורה ברורה ומסודרת, "
        "והוסיפי דוגמאות להמחשה בסוף התשובה (כל דוגמה בשורה שמתחילה ב-'- ')."
        f"{materials_text}"
        f"{history_block}\n"
        f"שאלה חדשה של הסטודנט: {incoming_message}"
    )

    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=os.environ.get("GOOGLE_AI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
        )
        raw_text = (response.text or "").strip()
        if not raw_text:
            raise RuntimeError("Empty response from Gemini")
    except HTTPException:
        raise
    except Exception:
        # Fallback במקרה של עומס/חוסר זמינות זמנית בשרתי Gemini (למשל 503)
        raw_text = (
            f"התקבלה שאלתך: \"{incoming_message}\".\n"
            "כרגע שירות המודל החיצוני חווה עומס זמני, ולכן מוצגת תשובת גיבוי לימודית "
            "(הקשר השיחה וחומרי הקורס נשמרים כרגיל).\n"
            "- דוגמה 1: פירוק המושג המרכזי לשלבים פשוטים והגדרות בסיסיות.\n"
            "- דוגמה 2: יישום הרעיון על קלט קטן וברור לפני בדיקת מקרי קצה."
        )

    # פירוק פשוט של דוגמאות אם המודל החזיר שורות עם מקף
    examples = [
        line.lstrip("- ").strip()
        for line in raw_text.splitlines()
        if line.strip().startswith("- ")
    ][:3]

    save_mock_turn(
        conversation_id=conv_id,
        user_message=incoming_message,
        assistant_answer=raw_text,
        examples=examples,
        course_id=req.course_id,
    )

    return ChatResponse(
        conversation_id=conv_id,
        answer=raw_text,
        reply=raw_text,
        examples=examples,
    )


@app.get("/api/ai/conversations/{conversation_id}")
def get_conversation_history(conversation_id: str):
    """Story 43: שליפת היסטוריית הודעות של שיחה קיימת"""
    conv = get_mock_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv