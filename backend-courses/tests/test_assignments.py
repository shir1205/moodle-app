from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_create_assignment_as_draft():
    mock_supabase = MagicMock()

    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "test-123",
            "course_id": "course-1",
            "unit_id": "unit-1",
            "title": "מטלת בדיקה",
            "instructions": "פתרו את השאלות",
            "due_date": "2026-12-15T23:59:00+02:00",
            "max_grade": 100,
            "allowed_formats": [".pdf"],
            "status": "draft",
        }
    ]

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post(
            "/assignments",
            json={
                "courseId": "course-1",
                "unitId": "unit-1",
                "title": "מטלת בדיקה",
                "instructions": "פתרו את השאלות",
                "dueDate": "2026-12-15T23:59:00+02:00",
                "maxGrade": 100,
                "allowedFormats": [".pdf"],
                "status": "draft",
            },
        )

    assert response.status_code == 201
    assert response.json()["status"] == "draft"

    inserted_data = mock_supabase.table.return_value.insert.call_args.args[0]

    assert inserted_data["title"] == "מטלת בדיקה"
    assert inserted_data["status"] == "draft"
    assert inserted_data["course_id"] == "course-1"
    assert inserted_data["id"]
def test_create_assignment_with_short_title():
    response = client.post(
        "/assignments",
        json={
            "courseId": "course-1",
            "unitId": "unit-1",
            "title": "AB",
            "dueDate": "2026-12-15T23:59:00+02:00",
        },
    )

    assert response.status_code == 422


def test_create_assignment_when_database_fails():
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.side_effect = Exception(
        "Database unavailable"
    )

    with patch("main.get_supabase", return_value=mock_supabase):
        response = client.post(
            "/assignments",
            json={
                "courseId": "course-1",
                "unitId": "unit-1",
                "title": "מטלת בדיקה",
                "dueDate": "2026-12-15T23:59:00+02:00",
            },
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Unable to save assignment"
