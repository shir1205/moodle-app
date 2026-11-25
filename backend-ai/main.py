"""CampuScope AI Assistant (Team 3)"""
import json
import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

from fallback import safe_generate
from mock_data import get_mock_conversation, get_mock_materials, save_mock_turn
from navigation import find_destination, is_navigation_question

load_dotenv()
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# חיבור למודול האימות המשותף של צוות 1 (backend-core/auth_middleware.py)
_CORE_DIR = Path(__file__).resolve().parent.parent / "backend-core"
if str(_CORE_DIR) not in sys.path:
    sys.path.insert(0, str(_CORE_DIR))

from auth_middleware import get_current_user  # noqa: E402

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


def _get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY is missing")
    return genai.Client(api_key=api_key)


def ask_gemini(question: str) -> str:
    """קריאה ל-Google AI. מיובא כאן כדי שהבדיקות יוכלו לרוץ גם בלי מפתח."""
    client = _get_gemini_client()
    response = client.models.generate_content(
        model=os.environ.get("GOOGLE_AI_MODEL", "gemini-2.5-flash"),
        contents=question,
    )
    return (response.text or "").strip()


@app.post("/ask")
def ask(q: Question):
    """שולח שאלה ל-Google AI ומחזיר את התשובה.
    סיפור 45: אם ה-AI לא זמין, מוחזרת הודעת גיבוי עם fallback=true."""
    if not q.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    return safe_generate(lambda: ask_gemini(q.question))


@app.post("/api/ai/navigate")
def navigate(q: Question):
    """סיפור 44: שאלת ניווט - מחזיר הסבר וקישור למסך המתאים."""
    if not q.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    result = find_destination(q.question)
    result["is_navigation"] = is_navigation_question(q.question)
    return result


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
        raw_text = ask_gemini(prompt)
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


class FeedbackRequest(BaseModel):
    question: str
    solution: str
    course_id: str | None = None
    assignment_id: str | None = None


class LogicalError(BaseModel):
    issue: str
    location: str = "כללי בפתרון"
    explanation: str
    fix_hint: str = ""


class FeedbackResponse(BaseModel):
    user_id: str
    course_id: str | None = None
    assignment_id: str | None = None
    positive_points: list[str]
    logical_errors: list[LogicalError]
    improvement_suggestions: list[str]
    is_logical_valid: bool
    is_fallback: bool = False


def _extract_json_block(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No valid JSON object in model response")
    return json.loads(cleaned[start : end + 1])


@app.post("/api/ai/feedback", response_model=FeedbackResponse)
def ai_feedback(
    req: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """Story 69 (3.3.1): משוב ראשוני על פתרון | Story 70 (3.3.2): זיהוי טעויות לוגיות"""
    question_text = (req.question or "").strip()
    solution_text = (req.solution or "").strip()

    # אם חסרה שאלה או פתרון — לא שולחים בקשה לשירות ה-AI
    if not question_text and not solution_text:
        raise HTTPException(
            status_code=400,
            detail="יש להשלים את השאלה ואת הפתרון לפני קבלת משוב",
        )
    if not question_text:
        raise HTTPException(
            status_code=400,
            detail="יש להשלים את שדה השאלה החסר לפני קבלת משוב",
        )
    if not solution_text:
        raise HTTPException(
            status_code=400,
            detail="יש להשלים את שדה הפתרון החסר לפני קבלת משוב",
        )

    materials_text = ""
    if req.course_id:
        materials = get_mock_materials(req.course_id)
        if materials:
            parts = [
                f"- {m['title']}: {m.get('mock_summary_text', '')}"
                for m in materials
            ]
            materials_text = "\nחומרי לימוד רלוונטיים מהקורס:\n" + "\n".join(parts)

    assignment_line = f"\nמזהה מטלה: {req.assignment_id}" if req.assignment_id else ""

    prompt = (
        "את עוזרת הוראה אקדמית בעברית. נתח את הפתרון של הסטודנטית לשאלה, "
        "והחזר תשובת JSON בלבד (ללא טקסט נוסף וללא markdown) במבנה המדויק הבא:\n"
        "{\n"
        '  "positive_points": ["נקודה חיובית 1"],\n'
        '  "logical_errors": [\n'
        "    {\n"
        '      "issue": "שם קצר של הטעות הלוגית",\n'
        '      "location": "החלק בפתרון שבו מופיעה הטעות",\n'
        '      "explanation": "הסבר מדוע יש כאן טעות לוגית",\n'
        '      "fix_hint": "רמז קצר לתיקון"\n'
        "    }\n"
        "  ],\n"
        '  "improvement_suggestions": ["הצעה לשיפור 1"]\n'
        "}\n"
        "אם אין טעויות לוגיות, החזר רשימה ריקה עבור logical_errors."
        f"{assignment_line}{materials_text}\n"
        f"השאלה:\n{question_text}\n\n"
        f"פתרון הסטודנטית:\n{solution_text}"
    )

    try:
        raw_text = ask_gemini(prompt)
        parsed = _extract_json_block(raw_text)

        positive_points = [
            str(item).strip()
            for item in parsed.get("positive_points", [])
            if str(item).strip()
        ] or ["הפתרון מנסה להתמודד ישירות עם דרישות השאלה"]

        raw_errors = parsed.get("logical_errors", [])
        logical_errors: list[LogicalError] = []
        if isinstance(raw_errors, list):
            for err in raw_errors:
                if isinstance(err, dict) and str(err.get("issue", "")).strip():
                    logical_errors.append(
                        LogicalError(
                            issue=str(err.get("issue")).strip(),
                            location=str(err.get("location") or "כללי בפתרון").strip(),
                            explanation=str(
                                err.get("explanation") or "נמצאה בעיה לוגית בפתרון"
                            ).strip(),
                            fix_hint=str(err.get("fix_hint") or "").strip(),
                        )
                    )

        improvement_suggestions = [
            str(item).strip()
            for item in parsed.get("improvement_suggestions", [])
            if str(item).strip()
        ] or ["מומלץ לבדוק מקרי קצה ולאמת כל שלב מול הגדרות השאלה"]

        return FeedbackResponse(
            user_id=str(current_user.get("user_id", "")),
            course_id=req.course_id,
            assignment_id=req.assignment_id,
            positive_points=positive_points,
            logical_errors=logical_errors,
            improvement_suggestions=improvement_suggestions,
            is_logical_valid=len(logical_errors) == 0,
            is_fallback=False,
        )
    except HTTPException:
        raise
    except Exception:
        return FeedbackResponse(
            user_id=str(current_user.get("user_id", "")),
            course_id=req.course_id,
            assignment_id=req.assignment_id,
            positive_points=["התקבל ניסיון פתרון מסודר המכוון לשאלה"],
            logical_errors=[],
            improvement_suggestions=[
                "כרגע שירות ה-AI במצב גיבוי; מומלץ לבדוק מקרי קצה ותנאי עצירה/הנחות בסיס ידנית"
            ],
            is_logical_valid=True,
            is_fallback=True,
        )