# moodle-app
CampuScope - Smart Learning Management System

## הרצה ראשונה
1. להתקין Docker Desktop ולוודא שהוא פועל.
2. `git clone https://github.com/shir1205/moodle-app.git`
3. להעתיק את `.env.example` לקובץ חדש בשם `.env` ולמלא את המפתחות (מקבלים בפרטי מראש הפרויקט).
4. להריץ:
   ```
   docker compose up --build
   ```
5. לפתוח בדפדפן: http://localhost:3000

## שירותים ופורטים
| שירות | צוות | כתובת |
|---|---|---|
| frontend | צוות 4 | http://localhost:3000 |
| backend-core | צוות 1 | http://localhost:8001/health |
| backend-courses | צוות 2 | http://localhost:8002/health |
| backend-ai | צוות 3 | http://localhost:8003/health |

תיעוד API אוטומטי לכל שירות: `http://localhost:800X/docs`

## בדיקת אינטגרציה
כשהמערכת רצה:
```
python tests/test_integration.py
```

## כללי עבודה ב-Git
- כל אחד עובד בענף משלו: `feature/teamX-storyID` (לדוגמה `feature/team2-45`).
- אין Merge ישיר ל-`main`. כל שינוי נכנס דרך Pull Request.
- כל PR צריך 2 אישורים: ראש תת-הצוות + ראש הפרויקט השבועי.
- לפני PR: לוודא ש-`docker compose up --build` עולה בלי שגיאות.
