"""סיפור 45 - הודעת גיבוי כשה-AI לא זמין.

עוטף כל קריאה ל-Gemini: אם היא נכשלת (עומס 503, תקלת רשת, מפתח חסר),
מוחזרת הודעה ידידותית עם fallback=True במקום שגיאה, כדי שהמסך לא יקרוס
והפרונט יוכל להציג כפתור "נסה שוב".
"""
import logging

logger = logging.getLogger("backend-ai")

FALLBACK_MESSAGE = (
    "שירות ה-AI עמוס או לא זמין כרגע. השאלה שלך נשמרה, "
    "אפשר ללחוץ על 'נסה שוב' בעוד כמה רגעים."
)


def safe_generate(generate) -> dict:
    """מריץ את הפונקציה generate (קריאה ל-AI) ומחזיר תמיד תשובה מסודרת.

    generate - פונקציה בלי פרמטרים שמחזירה את טקסט התשובה.
    מחזיר: {"answer": str, "fallback": bool}
    """
    try:
        text = generate()
        if not text or not str(text).strip():
            raise ValueError("Empty response from AI")
        return {"answer": str(text), "fallback": False}
    except Exception as error:  # כל כשל של השירות החיצוני מטופל אותו דבר
        logger.warning("AI unavailable, returning fallback: %s", error)
        return {"answer": FALLBACK_MESSAGE, "fallback": True}
