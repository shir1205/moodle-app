"""בדיקות לסיפורים 44 (ניווט) ו-45 (גיבוי כשה-AI לא זמין).
ה-AI מוחלף ב-Mock, אין צורך במפתח או בחיבור לאינטרנט.

הרצה מתוך התיקייה backend-ai:
    pip install pytest httpx
    python -m pytest tests -v
"""
from unittest.mock import patch

from fastapi.testclient import TestClient

from fallback import FALLBACK_MESSAGE, safe_generate
from main import app
from navigation import find_destination, is_navigation_question

client = TestClient(app)


# ---------- סיפור 44: ניווט ----------

def test_detects_navigation_question():
    assert is_navigation_question("איפה מגישים מטלה?")
    assert is_navigation_question("איך מגיעים להתראות")


def test_study_question_is_not_navigation():
    assert not is_navigation_question("מה ההבדל בין מחסנית לתור?")


def test_submit_assignment_goes_to_courses():
    result = find_destination("איפה מגישים מטלה?")
    assert result["found"] is True
    assert result["link"] == "/courses"


def test_grades_go_to_submissions():
    assert find_destination("איפה אני רואה את הציונים שלי")["link"] == "/submissions"


def test_password_goes_to_profile():
    assert find_destination("איך משנים סיסמה?")["link"] == "/profile"


def test_unknown_screen_points_to_home():
    result = find_destination("איפה הקפיטריה?")
    assert result["found"] is False
    assert result["link"] == "/"


def test_navigate_endpoint():
    response = client.post("/api/ai/navigate", json={"question": "איפה ההתראות?"})
    assert response.status_code == 200
    body = response.json()
    assert body["link"] == "/notifications"
    assert body["is_navigation"] is True


def test_navigate_empty_question_returns_400():
    response = client.post("/api/ai/navigate", json={"question": "   "})
    assert response.status_code == 400


# ---------- סיפור 45: גיבוי ----------

def test_safe_generate_success():
    assert safe_generate(lambda: "תשובה") == {"answer": "תשובה", "fallback": False}


def test_safe_generate_on_error_returns_fallback():
    def broken():
        raise RuntimeError("503 UNAVAILABLE")

    result = safe_generate(broken)
    assert result["fallback"] is True
    assert result["answer"] == FALLBACK_MESSAGE


def test_safe_generate_on_empty_answer_returns_fallback():
    assert safe_generate(lambda: "")["fallback"] is True


def test_ask_returns_answer_when_ai_works():
    with patch("main.ask_gemini", return_value="מחסנית היא LIFO"):
        response = client.post("/ask", json={"question": "מה זו מחסנית?"})
    assert response.status_code == 200
    assert response.json() == {"answer": "מחסנית היא LIFO", "fallback": False}


def test_ask_returns_fallback_when_ai_down():
    with patch("main.ask_gemini", side_effect=RuntimeError("503 UNAVAILABLE")):
        response = client.post("/ask", json={"question": "מה זו מחסנית?"})
    assert response.status_code == 200
    assert response.json()["fallback"] is True


def test_ask_empty_question_returns_400():
    response = client.post("/ask", json={"question": ""})
    assert response.status_code == 400


def test_ask_returns_fallback_when_api_key_missing():
    """משימה 102: בלי מפתח ה-AI, המערכת לא קורסת ומחזירה תשובת גיבוי."""
    with patch.dict("os.environ", {}, clear=True):
        response = client.post("/ask", json={"question": "מה זו מחסנית?"})
    assert response.status_code == 200
    assert response.json()["fallback"] is True
