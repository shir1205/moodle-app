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


from google import genai
from pydantic import BaseModel


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