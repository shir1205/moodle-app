import json

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

GOOD = json.dumps(
    {"questions": [{
        "question": "מה סיבוכיות החיפוש הממוצעת ב-BST מאוזן?",
        "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
        "correct_answer": "O(log n)",
        "explanation": "בכל צעד מחצים את מרחב החיפוש.",
    }]},
    ensure_ascii=False,
)
BODY = {"topic": "עצי חיפוש בינאריים", "difficulty": "בינוני", "count": 1}
CHECK = {
    "question": "מה סיבוכיות החיפוש הממוצעת ב-BST מאוזן?",
    "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    "correct_answer": "O(log n)",
    "student_answer": "O(n)",
    "explanation": "הסבר שמור",
}


class FakeAPIError(Exception):
    """מדמה שגיאת SDK: מספיק שיש לה .code"""
    def __init__(self, code):
        super().__init__(f"{code} error")
        self.code = code


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_API_KEY", "test-key")
    monkeypatch.setenv("GOOGLE_AI_MODEL", "model-a")
    monkeypatch.delenv("GOOGLE_AI_FALLBACK_MODELS", raising=False)
    monkeypatch.delenv("AI_MOCK_MODE", raising=False)
    monkeypatch.setattr(main.time, "sleep", lambda _s: None)  # בלי המתנות אמיתיות


def patch_gemini(monkeypatch, behaviour):
    """behaviour(call_number, model) מחזיר טקסט או זורק חריגה. מחזיר רשימת המודלים שנקראו."""
    calls = []

    def fake(prompt, model, schema=None):
        calls.append(model)
        return behaviour(len(calls), model)

    monkeypatch.setattr(main, "_generate_text", fake)
    return calls


# ---------- generate-questions ----------
def test_success(monkeypatch):
    patch_gemini(monkeypatch, lambda n, m: GOOD)
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 200
    q = r.json()["questions"][0]
    assert q["id"] == "q1" and q["topic"] == BODY["topic"]
    assert q["correct_answer"] in q["options"]


def test_retries_after_503_then_succeeds(monkeypatch):
    def behaviour(n, m):
        if n < 3:
            raise FakeAPIError(503)
        return GOOD

    calls = patch_gemini(monkeypatch, behaviour)
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 200 and len(calls) == 3


def test_persistent_503_returns_friendly_503(monkeypatch):
    def behaviour(n, m):
        raise FakeAPIError(503)

    calls = patch_gemini(monkeypatch, behaviour)
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 503
    assert r.headers["retry-after"] == "10"
    assert "AI" in r.json()["detail"]
    assert len(calls) == 3


def test_falls_back_to_next_model(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_FALLBACK_MODELS", "model-b")

    def behaviour(n, m):
        if m == "model-a":
            raise FakeAPIError(503)
        return GOOD

    calls = patch_gemini(monkeypatch, behaviour)
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 200
    assert calls == ["model-a"] * 3 + ["model-b"]


def test_404_skips_straight_to_next_model(monkeypatch):
    monkeypatch.setenv("GOOGLE_AI_FALLBACK_MODELS", "model-b")

    def behaviour(n, m):
        if m == "model-a":
            raise FakeAPIError(404)
        return GOOD

    calls = patch_gemini(monkeypatch, behaviour)
    assert client.post("/api/ai/generate-questions", json=BODY).status_code == 200
    assert calls == ["model-a", "model-b"]


def test_non_retryable_error_is_not_retried(monkeypatch):
    def behaviour(n, m):
        raise FakeAPIError(400)

    calls = patch_gemini(monkeypatch, behaviour)
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 503 and len(calls) == 1


def test_invalid_json_returns_502(monkeypatch):
    calls = patch_gemini(monkeypatch, lambda n, m: "not json")
    r = client.post("/api/ai/generate-questions", json=BODY)
    assert r.status_code == 502 and len(calls) == 2


def test_correct_answer_not_in_options_returns_502(monkeypatch):
    bad = json.dumps({"questions": [{
        "question": "?", "options": ["א", "ב"], "correct_answer": "ג", "explanation": "",
    }]}, ensure_ascii=False)
    patch_gemini(monkeypatch, lambda n, m: bad)
    assert client.post("/api/ai/generate-questions", json=BODY).status_code == 502


def test_blank_topic_returns_400():
    r = client.post("/api/ai/generate-questions", json={**BODY, "topic": "   "})
    assert r.status_code == 400


def test_count_out_of_range_returns_422():
    r = client.post("/api/ai/generate-questions", json={**BODY, "count": 0})
    assert r.status_code == 422


def test_mock_mode_never_calls_gemini(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")

    def boom(*a, **k):
        raise AssertionError("Gemini must not be called in mock mode")

    monkeypatch.setattr(main, "_generate_text", boom)
    r = client.post("/api/ai/generate-questions", json={**BODY, "count": 3})
    assert r.status_code == 200 and len(r.json()["questions"]) == 3


# ---------- check-answer ----------
def test_check_answer_wrong_uses_ai_explanation(monkeypatch):
    patch_gemini(monkeypatch, lambda n, m: "הסבר מה-AI")
    body = client.post("/api/ai/check-answer", json=CHECK).json()
    assert body["is_correct"] is False
    assert body["explanation"] == "הסבר מה-AI" and body["ai_generated"] is True
    assert "אינו ציון רשמי" in body["disclaimer"]


def test_check_answer_correct(monkeypatch):
    patch_gemini(monkeypatch, lambda n, m: "הסבר מחזק")
    body = client.post(
        "/api/ai/check-answer", json={**CHECK, "student_answer": "O(log n)"}
    ).json()
    assert body["is_correct"] is True


def test_check_answer_survives_ai_outage(monkeypatch):
    def behaviour(n, m):
        raise FakeAPIError(503)

    patch_gemini(monkeypatch, behaviour)
    r = client.post("/api/ai/check-answer", json=CHECK)
    body = r.json()
    assert r.status_code == 200
    assert body["is_correct"] is False
    assert body["explanation"] == "הסבר שמור" and body["ai_generated"] is False
    assert body["disclaimer"]


def test_check_answer_rejects_unknown_option():
    r = client.post("/api/ai/check-answer", json={**CHECK, "student_answer": "לא קיים"})
    assert r.status_code == 422