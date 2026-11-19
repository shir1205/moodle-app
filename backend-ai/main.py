"""CampuScope AI Assistant (Team 3)"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


from fastapi import HTTPException
from pydantic import BaseModel

from fallback import safe_generate
from navigation import find_destination, is_navigation_question


class Question(BaseModel):
    question: str


def ask_gemini(question: str) -> str:
    """קריאה ל-Google AI. מיובא כאן כדי שהבדיקות יוכלו לרוץ גם בלי מפתח."""
    from google import genai

    client = genai.Client(api_key=os.environ["GOOGLE_AI_API_KEY"])
    response = client.models.generate_content(
        model=os.environ.get("GOOGLE_AI_MODEL", "gemini-2.5-flash"),
        contents=question,
    )
    return response.text


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