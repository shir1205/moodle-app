import os
from pathlib import Path
import uuid

import pytest
import requests

# Base URLs matching docker-compose port mappings
SERVICES = {
    "core": "http://localhost:8001",
    "courses": "http://localhost:8002",
    "ai": "http://localhost:8003"
}


def test_all_services_health():
    """Verify that all microservices are up and responding to requests."""
    for name, url in SERVICES.items():
        response = requests.get(f"{url}/health", timeout=5)
        assert response.status_code == 200, f"Service {name} is down!"


# ==========================================
# Team 1: Authentication & JWT (Port 8001)
# ==========================================

#@pytest.mark.skip(reason="Waiting for Team 1 PR (/login, /auth/me) to be merged into main")
class TestTeam1AuthAPI:
    """Integration tests for Team 1 Authentication and JWT module."""

    @pytest.fixture
    def valid_credentials(self):
        return {
            "email": "user@example.com",
            "password": "Password123!"
        }

    @pytest.fixture
    def invalid_credentials(self):
        return {
            "email": "wrong@example.com",
            "password": "wrongpassword"
        }

    def test_authentication_flow(self, valid_credentials):
        """Test POST /login with valid credentials returns 200 and JWT token."""
        url = f"{SERVICES['core']}/login"
        response = requests.post(url, json=valid_credentials, timeout=5)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert "id" in data["user"]
        assert "email" in data["user"]
        assert "role" in data["user"]

    def test_auth_me_success(self, valid_credentials):
        """Test GET /auth/me with a valid JWT token returns 200 and user info."""
        login_resp = requests.post(
            f"{SERVICES['core']}/login",
            json=valid_credentials,
            timeout=5
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        auth_resp = requests.get(
            f"{SERVICES['core']}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        assert auth_resp.status_code == 200
        auth_data = auth_resp.json()
        assert auth_data.get("authenticated") is True
        assert "user" in auth_data
        assert auth_data["user"]["email"] == valid_credentials["email"]

    def test_login_invalid_credentials(self, invalid_credentials):
        """Test POST /login with wrong password returns 401."""
        response = requests.post(
            f"{SERVICES['core']}/login",
            json=invalid_credentials,
            timeout=5
        )
        assert response.status_code == 401

    def test_auth_me_missing_and_invalid_token(self):
        """Test GET /auth/me without token or with malformed token returns 401."""
        missing_resp = requests.get(f"{SERVICES['core']}/auth/me", timeout=5)
        assert missing_resp.status_code in [401, 422]

        invalid_resp = requests.get(
            f"{SERVICES['core']}/auth/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=5
        )
        assert invalid_resp.status_code == 401

    def test_login_account_lockout(self):
        """Test POST /login locks account (423) after 5 failed attempts."""
        lockout_creds = {
            "email": "lockout_test@example.com",
            "password": "WrongPassword123!"
        }
        url = f"{SERVICES['core']}/login"
        for _ in range(5):
            requests.post(url, json=lockout_creds, timeout=5)

        response = requests.post(url, json=lockout_creds, timeout=5)
        assert response.status_code == 423

    def test_register_new_user_success(self):
        """Test POST /register with valid data creates user and returns 200."""
        unique_email = f"reg.test.{uuid.uuid4().hex[:8]}@gmail.com"
        payload = {
            "full_name": "Test Student",
            "email": unique_email,
            "password": "Password123!"
        }
        response = requests.post(
            f"{SERVICES['core']}/register",
            json=payload,
            timeout=10
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["full_name"] == "Test Student"
        assert data["user"]["role"] == "student"
        assert "id" in data["user"]

    def test_register_duplicate_email(self, valid_credentials):
        """Test POST /register with an already registered email returns 409."""
        payload = {
            "full_name": "Duplicate User",
            "email": valid_credentials["email"],
            "password": "Password123!"
        }
        response = requests.post(
            f"{SERVICES['core']}/register",
            json=payload,
            timeout=10
        )
        assert response.status_code == 409

    def test_register_validation_errors(self):
        """Test POST /register rejects empty name, invalid email, or weak password (400)."""
        url = f"{SERVICES['core']}/register"

        # 1. Empty full_name
        resp_empty_name = requests.post(
            url,
            json={"full_name": "   ", "email": "valid@example.com", "password": "Password123!"},
            timeout=5
        )
        assert resp_empty_name.status_code == 400

        # 2. Invalid email format
        resp_bad_email = requests.post(
            url,
            json={"full_name": "Test User", "email": "invalid-email", "password": "Password123!"},
            timeout=5
        )
        assert resp_bad_email.status_code == 400

        # 3. Weak password (less than 8 chars / missing letter or digit)
        resp_weak_pass = requests.post(
            url,
            json={"full_name": "Test User", "email": "valid@example.com", "password": "123"},
            timeout=5
        )
        assert resp_weak_pass.status_code == 400


# ==========================================
# Team 2: Courses, Materials & Assignments (Port 8002)
# ==========================================

class TestTeam2CoursesAPI:
    """Integration tests for Team 2 API contract (Stories 19, 20, 22, 25, 26)."""

    COURSE_ID = "course-ds-101"

    @pytest.fixture
    def lecturer_headers(self):
        return {
            "X-User-Id": "lecturer-michal",
            "X-User-Role": "LECTURER"
        }

    @pytest.fixture
    def student_headers(self):
        return {
            "X-User-Id": "student-shira",
            "X-User-Role": "STUDENT"
        }

    # --- Story 19: Learning Units ---

    def test_create_unit_lecturer_and_get(self, lecturer_headers, student_headers):
        """Story 19: Lecturer creates unit (201 with id & created_at); everyone fetches units (200)."""
        payload = {
            "course_id": self.COURSE_ID,
            "title": "Week 1 - Intro",
            "description": "Course overview",
            "order_index": 1
        }
        create_resp = requests.post(
            f"{SERVICES['courses']}/api/units",
            json=payload,
            headers=lecturer_headers,
            timeout=5
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        assert "id" in data
        assert "created_at" in data

        get_resp = requests.get(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/units",
            headers=student_headers,
            timeout=5
        )
        assert get_resp.status_code == 200
        assert isinstance(get_resp.json(), list)

    def test_create_unit_errors(self, lecturer_headers, student_headers):
        """Story 19: Student gets 403 Forbidden; missing required fields return 422."""
        payload = {
            "course_id": self.COURSE_ID,
            "title": "Unauthorized Unit",
            "description": "Should fail",
            "order_index": 2
        }
        student_resp = requests.post(
            f"{SERVICES['courses']}/api/units",
            json=payload,
            headers=student_headers,
            timeout=5
        )
        assert student_resp.status_code == 403

        invalid_resp = requests.post(
            f"{SERVICES['courses']}/api/units",
            json={"course_id": self.COURSE_ID},
            headers=lecturer_headers,
            timeout=5
        )
        assert invalid_resp.status_code == 422

    # --- Story 20: Learning Materials ---

    def test_materials_upload_and_get(self, lecturer_headers, student_headers):
        """Story 20: Lecturer uploads valid PDF (201 + file_url); everyone fetches materials (200)."""
        upload_resp = requests.post(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/materials",
            headers=lecturer_headers,
            data={"unit_id": "unit-1", "title": "Lecture 1 Slides", "description": "Intro"},
            files={"file": ("lecture1.pdf", b"%PDF-1.4 dummy content", "application/pdf")},
            timeout=5
        )
        assert upload_resp.status_code == 201
        assert "file_url" in upload_resp.json()

        get_resp = requests.get(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/materials",
            headers=student_headers,
            timeout=5
        )
        assert get_resp.status_code == 200
        assert isinstance(get_resp.json(), list)

    def test_materials_upload_errors(self, lecturer_headers, student_headers):
        """Story 20: Student upload gets 403; disallowed file extension gets 400."""
        student_upload = requests.post(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/materials",
            headers=student_headers,
            data={"unit_id": "unit-1", "title": "Student File"},
            files={"file": ("notes.pdf", b"%PDF-1.4 dummy", "application/pdf")},
            timeout=5
        )
        assert student_upload.status_code == 403

        bad_file_upload = requests.post(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/materials",
            headers=lecturer_headers,
            data={"unit_id": "unit-1", "title": "Bad File"},
            files={"file": ("virus.exe", b"MZ dummy", "application/octet-stream")},
            timeout=5
        )
        assert bad_file_upload.status_code == 400

    # --- Stories 22 & 25: Assignments Creation, Publishing & Role Filtering ---

    def test_create_draft_assignment_and_role_filtering(self, lecturer_headers, student_headers):
        """Stories 22 & 25: Draft is visible to lecturer but hidden from student."""
        payload = {
            "course_id": self.COURSE_ID,
            "unit_id": "unit-1",
            "title": "Integration Draft Assignment",
            "instructions": "Complete exercises 1-3",
            "due_date": "2026-12-25T20:00:00Z",
            "max_grade": 100,
            "status": "draft"
        }
        create_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json=payload,
            headers=lecturer_headers,
            timeout=5
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        draft_id = created["id"]
        assert created["status"] == "draft"

        lec_list = requests.get(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/assignments",
            headers=lecturer_headers,
            timeout=5
        )
        assert lec_list.status_code == 200
        assert draft_id in [a["id"] for a in lec_list.json()]

        stu_list = requests.get(
            f"{SERVICES['courses']}/api/courses/{self.COURSE_ID}/assignments",
            headers=student_headers,
            timeout=5
        )
        assert stu_list.status_code == 200
        stu_assignments = stu_list.json()
        assert draft_id not in [a["id"] for a in stu_assignments]
        assert all(a["status"] == "published" for a in stu_assignments)

    def test_create_assignment_errors(self, lecturer_headers, student_headers):
        """Story 22: Student gets 403; publishing with past due_date returns 400."""
        base_payload = {
            "course_id": self.COURSE_ID,
            "unit_id": "unit-1",
            "title": "Assignment Error Test",
            "instructions": "Validation check",
            "due_date": "2026-12-25T20:00:00Z",
            "max_grade": 100,
            "status": "draft"
        }
        student_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json=base_payload,
            headers=student_headers,
            timeout=5
        )
        assert student_resp.status_code == 403

        past_payload = {
            **base_payload,
            "due_date": "2025-01-01T10:00:00Z",
            "status": "published"
        }
        past_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json=past_payload,
            headers=lecturer_headers,
            timeout=5
        )
        assert past_resp.status_code == 400

    def test_publish_draft_assignment_and_errors(self, lecturer_headers, student_headers):
        """Story 22: Lecturer publishes draft (200); student gets 403; missing ID gets 404."""
        payload = {
            "course_id": self.COURSE_ID,
            "unit_id": "unit-1",
            "title": "Assignment To Publish",
            "instructions": "Will be published",
            "due_date": "2026-12-25T20:00:00Z",
            "max_grade": 100,
            "status": "draft"
        }
        create_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json=payload,
            headers=lecturer_headers,
            timeout=5
        )
        assert create_resp.status_code == 201
        assignment_id = create_resp.json()["id"]

        # Student cannot publish
        student_pub = requests.patch(
            f"{SERVICES['courses']}/api/assignments/{assignment_id}/publish",
            headers=student_headers,
            timeout=5
        )
        assert student_pub.status_code == 403

        # Lecturer publishes successfully
        publish_resp = requests.patch(
            f"{SERVICES['courses']}/api/assignments/{assignment_id}/publish",
            headers=lecturer_headers,
            timeout=5
        )
        assert publish_resp.status_code == 200
        assert publish_resp.json()["status"] == "published"

        # Nonexistent assignment returns 404
        not_found = requests.patch(
            f"{SERVICES['courses']}/api/assignments/nonexistent-id-999/publish",
            headers=lecturer_headers,
            timeout=5
        )
        assert not_found.status_code == 404

    # --- Story 26: Assignment Submissions ---

    def test_submit_assignment_flow_and_errors(self, lecturer_headers, student_headers):
        """Story 26: Valid submit (201), invalid extension (400), and draft submit blocked (400)."""
        # Create a draft assignment and verify submission is blocked (400)
        draft_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json={
                "course_id": self.COURSE_ID,
                "unit_id": "unit-1",
                "title": "Draft Assignment No Submit",
                "instructions": "Draft only",
                "due_date": "2026-12-25T20:00:00Z",
                "max_grade": 100,
                "status": "draft"
            },
            headers=lecturer_headers,
            timeout=5
        )
        assert draft_resp.status_code == 201
        draft_id = draft_resp.json()["id"]

        draft_sub = requests.post(
            f"{SERVICES['courses']}/api/assignments/{draft_id}/submit",
            headers=student_headers,
            files={"file": ("solution.py", b"print('hi')", "text/x-python")},
            timeout=5
        )
        assert draft_sub.status_code == 400

        # Create a published assignment for valid + invalid file tests
        pub_resp = requests.post(
            f"{SERVICES['courses']}/api/assignments",
            json={
                "course_id": self.COURSE_ID,
                "unit_id": "unit-1",
                "title": "Assignment For Submission",
                "instructions": "Submit a .py file",
                "due_date": "2026-12-25T20:00:00Z",
                "max_grade": 100,
                "status": "published"
            },
            headers=lecturer_headers,
            timeout=5
        )
        assert pub_resp.status_code == 201
        assignment_id = pub_resp.json()["id"]

        valid_sub = requests.post(
            f"{SERVICES['courses']}/api/assignments/{assignment_id}/submit",
            headers=student_headers,
            files={"file": ("solution.py", b"print('hello')", "text/x-python")},
            timeout=5
        )
        assert valid_sub.status_code == 201
        sub_data = valid_sub.json()
        assert sub_data["assignment_id"] == assignment_id
        for field in ("id", "student_id", "file_name", "file_url", "status"):
            assert field in sub_data

        invalid_sub = requests.post(
            f"{SERVICES['courses']}/api/assignments/{assignment_id}/submit",
            headers=student_headers,
            files={"file": ("bad.exe", b"MZ dummy", "application/octet-stream")},
            timeout=5
        )
        assert invalid_sub.status_code == 400


# ==========================================
# Team 3: AI Assistant (Port 8003)
# ==========================================
#@pytest.mark.skip(reason="Waiting for Team 3 PR (/api/ai/chat, /api/ai/conversations/{id}) to be merged into main — main currently only has /health, /ask, /api/ai/navigate")
class TestTeam3AIAPI:
    """Integration tests for Team 3 (AI Assistant) API contract."""

    def test_ai_chat_new_conversation(self):
        """Test POST /api/ai/chat returns 200 with conversation_id, answer, and examples."""
        payload = {
            "message": "מהם הנושאים המרכזיים בקורס?",
            "course_id": "course-101",
        }
        response = requests.post(
            f"{SERVICES['ai']}/api/ai/chat",
            json=payload,
            timeout=15,
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversation_id" in data and isinstance(data["conversation_id"], str)
        assert "answer" in data and isinstance(data["answer"], str)
        assert "examples" in data and isinstance(data["examples"], list)

    def test_ai_chat_followup_and_history(self):
        """Test follow-up message keeps conversation_id and GET /api/ai/conversations/{id} returns history."""
        first_resp = requests.post(
            f"{SERVICES['ai']}/api/ai/chat",
            json={"message": "תסביר בקצרה מה זה מבנה נתונים", "course_id": "course-101"},
            timeout=15,
        )
        assert first_resp.status_code == 200
        conv_id = first_resp.json()["conversation_id"]

        followup_resp = requests.post(
            f"{SERVICES['ai']}/api/ai/chat",
            json={
                "message": "אפשר דוגמה נוספת?",
                "conversation_id": conv_id,
                "course_id": "course-101",
            },
            timeout=15,
        )
        assert followup_resp.status_code == 200
        followup_data = followup_resp.json()
        assert followup_data["conversation_id"] == conv_id
        assert "answer" in followup_data and "examples" in followup_data

        history_resp = requests.get(
            f"{SERVICES['ai']}/api/ai/conversations/{conv_id}",
            timeout=10,
        )
        assert history_resp.status_code == 200
        assert history_resp.json() is not None

    def test_ai_chat_validation_error(self):
        """Test POST /api/ai/chat with missing required 'message' returns 400 or 422."""
        response = requests.post(
            f"{SERVICES['ai']}/api/ai/chat",
            json={},
            timeout=10,
        )
        assert response.status_code in [400, 422]


# ==========================================
# Team 4: Notification Center & JWT Ownership (Port 8001)
# ==========================================

def test_notifications_integration():
    """Test notifications CRUD, JWT enforcement, and ownership isolation (Team 1 + Team 4)."""
    # 1. Unauthenticated access must be rejected
    unauth_resp = requests.get(f"{SERVICES['core']}/notifications/", timeout=10)
    assert unauth_resp.status_code == 401

    # 2. Authenticate via Team 1 /login endpoint
    login_resp = requests.post(
        f"{SERVICES['core']}/login",
        json={"email": "user@example.com", "password": "Password123!"},
        timeout=10,
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    token = login_data["access_token"]
    user_id = login_data["user"]["id"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 3. Create notification for the authenticated user
    create_resp = requests.post(
        f"{SERVICES['core']}/notifications/",
        json={
            "title": "Story 77 Integration Test",
            "message": "End-to-end JWT notification check",
            "link": "/notifications",
        },
        headers=auth_headers,
        timeout=10,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    notif_id = created["id"]
    assert created["user_id"] == user_id
    assert created["is_read"] is False

    # 4. Retrieve notifications and verify isolation to current user
    list_resp = requests.get(
        f"{SERVICES['core']}/notifications/",
        headers=auth_headers,
        timeout=10,
    )
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert isinstance(items, list)
    assert any(item["id"] == notif_id for item in items)
    assert all(item["user_id"] == user_id for item in items)

    # 5. Mark own notification as read
    read_resp = requests.patch(
        f"{SERVICES['core']}/notifications/{notif_id}/read",
        headers=auth_headers,
        timeout=10,
    )
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # 6. Ownership check: cannot mark another user's notification as read
    other_resp = requests.post(
        f"{SERVICES['core']}/notifications/",
        json={
            "user_id": "other-user-integration-check",
            "title": "Other User Notification",
            "message": "Should not be modifiable by another user",
        },
        headers=auth_headers,
        timeout=10,
    )
    assert other_resp.status_code == 201
    other_id = other_resp.json()["id"]

    hijack_resp = requests.patch(
        f"{SERVICES['core']}/notifications/{other_id}/read",
        headers=auth_headers,
        timeout=10,
    )
    assert hijack_resp.status_code == 404

    # 7. Mark all remaining notifications for current user as read
    read_all_resp = requests.patch(
        f"{SERVICES['core']}/notifications/read-all",
        headers=auth_headers,
        timeout=10,
    )
    assert read_all_resp.status_code == 200
    assert "updated_count" in read_all_resp.json()


def _get_jwt_secret() -> str | None:
    """Read JWT_SECRET or SUPABASE_KEY from env (or root .env read-only) for local test JWT signing."""
    secret = os.environ.get("JWT_SECRET") or os.environ.get("SUPABASE_KEY")
    if secret:
        return secret
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        env_values: dict[str, str] = {}
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if "=" in stripped and not stripped.startswith("#"):
                key, val = stripped.split("=", 1)
                env_values[key.strip()] = val.strip()
        return env_values.get("JWT_SECRET") or env_values.get("SUPABASE_KEY")
    return None


def test_encouragement_notification_e2e():
    """Story #9 E2E: Lecturer sends encouragement notification and student sees it in GET /notifications/."""
    # 1. Unauthenticated request must be rejected with 401
    unauth_resp = requests.post(
        f"{SERVICES['core']}/notifications/encouragement",
        json={
            "student_id": str(uuid.uuid4()),
            "title": "Unauthorized Check",
            "message": "Should fail with 401",
        },
        timeout=10,
    )
    assert unauth_resp.status_code == 401

    # 2. Authenticate as student and verify RBAC blocks students with 403
    student_email = os.environ.get("TEST_STUDENT_EMAIL", "user@example.com")
    student_password = os.environ.get("TEST_STUDENT_PASSWORD", "Password123!")
    student_login = requests.post(
        f"{SERVICES['core']}/login",
        json={"email": student_email, "password": student_password},
        timeout=10,
    )
    assert student_login.status_code == 200
    student_data = student_login.json()
    student_token = student_data["access_token"]
    student_id = student_data["user"]["id"]

    forbidden_resp = requests.post(
        f"{SERVICES['core']}/notifications/encouragement",
        json={
            "student_id": student_id,
            "title": "Forbidden Student Attempt",
            "message": "Students cannot send encouragement notifications",
        },
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=10,
    )
    assert forbidden_resp.status_code == 403
    assert forbidden_resp.json().get("detail") == "אין הרשאה לבצע פעולה זו"

    # 3. Obtain lecturer token (via TEST_LECTURER_* login or JWT secret if configured)
    lecturer_token = None
    lecturer_email = os.environ.get("TEST_LECTURER_EMAIL", "lecturer@example.com")
    lecturer_password = os.environ.get("TEST_LECTURER_PASSWORD", "Password123!")
    lecturer_login = requests.post(
        f"{SERVICES['core']}/login",
        json={"email": lecturer_email, "password": lecturer_password},
        timeout=10,
    )
    if lecturer_login.status_code == 200:
        lecturer_user = lecturer_login.json().get("user", {})
        if (lecturer_user.get("role") or "").lower() in {"lecturer", "admin"}:
            lecturer_token = lecturer_login.json()["access_token"]

    if not lecturer_token:
        jwt_secret = _get_jwt_secret()
        if jwt_secret:
            import jwt as pyjwt

            lecturer_token = pyjwt.encode(
                {
                    "sub": str(uuid.uuid4()),
                    "email": lecturer_email,
                    "role": "lecturer",
                },
                jwt_secret,
                algorithm="HS256",
            )

    if not lecturer_token:
        pytest.skip("Lecturer credentials or JWT_SECRET required to run full Story #9 E2E flow")

    # 4. Lecturer sends encouragement notification to the student
    unique_title = f"Story 9 Encouragement {uuid.uuid4().hex[:8]}"
    unique_message = "אנחנו איתך! בוא/י נקבע פגישת תגבור קצרה השבוע."
    send_resp = requests.post(
        f"{SERVICES['core']}/notifications/encouragement",
        json={
            "student_id": student_id,
            "title": unique_title,
            "message": unique_message,
            "course_id": "course-1",
        },
        headers={"Authorization": f"Bearer {lecturer_token}"},
        timeout=10,
    )
    assert send_resp.status_code == 201
    created = send_resp.json()
    assert created["user_id"] == student_id
    assert created["title"] == unique_title
    assert created["message"] == unique_message
    assert created["is_read"] is False
    assert created["link"] == "/courses/course-1"

    # 5. Student retrieves notifications and verifies the encouragement notification appears
    inbox_resp = requests.get(
        f"{SERVICES['core']}/notifications/",
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=10,
    )
    assert inbox_resp.status_code == 200
    notifications = inbox_resp.json()
    assert any(
        item.get("id") == created["id"]
        and item.get("user_id") == student_id
        and item.get("title") == unique_title
        and item.get("message") == unique_message
        and item.get("is_read") is False
        for item in notifications
    )


# ==========================================
# Team 4: At-Risk Students Analytics (Story #7)
# ==========================================

def test_at_risk_students_e2e():
    """Story #7 E2E: Verify 401 without token, 403 for student, and 200 JSON list for lecturer/admin."""
    # 1. Unauthenticated request must return 401
    unauth_resp = requests.get(f"{SERVICES['core']}/analytics/at-risk", timeout=10)
    assert unauth_resp.status_code == 401

    # 2. Authenticate and obtain both a student token (403) and a lecturer/admin token (200)
    student_email = os.environ.get("TEST_STUDENT_EMAIL", "user@example.com")
    student_password = os.environ.get("TEST_STUDENT_PASSWORD", "Password123!")
    student_login = requests.post(
        f"{SERVICES['core']}/login",
        json={"email": student_email, "password": student_password},
        timeout=10,
    )

    student_token = None
    lecturer_token = None

    if student_login.status_code == 200:
        login_json = student_login.json()
        login_role = (login_json.get("user", {}).get("role") or "").lower()
        if login_role == "student":
            student_token = login_json["access_token"]
        elif login_role in {"lecturer", "admin"}:
            lecturer_token = login_json["access_token"]

    if not student_token:
        jwt_secret = _get_jwt_secret()
        if jwt_secret:
            import jwt as pyjwt

            student_token = pyjwt.encode(
                {
                    "sub": str(uuid.uuid4()),
                    "email": "student.e2e@example.com",
                    "role": "student",
                },
                jwt_secret,
                algorithm="HS256",
            )

    if not student_token:
        pytest.skip("Student credentials or JWT_SECRET required to verify 403 response for Story #7 E2E")

    forbidden_resp = requests.get(
        f"{SERVICES['core']}/analytics/at-risk",
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=10,
    )
    assert forbidden_resp.status_code == 403

    # 3. Lecturer/Admin token must receive 200 with a JSON list
    if not lecturer_token:
        lecturer_email = os.environ.get("TEST_LECTURER_EMAIL", "lecturer@example.com")
        lecturer_password = os.environ.get("TEST_LECTURER_PASSWORD", "Password123!")
        lecturer_login = requests.post(
            f"{SERVICES['core']}/login",
            json={"email": lecturer_email, "password": lecturer_password},
            timeout=10,
        )
        if lecturer_login.status_code == 200:
            lecturer_user = lecturer_login.json().get("user", {})
            if (lecturer_user.get("role") or "").lower() in {"lecturer", "admin"}:
                lecturer_token = lecturer_login.json()["access_token"]

    if not lecturer_token:
        jwt_secret = _get_jwt_secret()
        if jwt_secret:
            import jwt as pyjwt

            lecturer_token = pyjwt.encode(
                {
                    "sub": str(uuid.uuid4()),
                    "email": os.environ.get("TEST_LECTURER_EMAIL", "lecturer@example.com"),
                    "role": "lecturer",
                },
                jwt_secret,
                algorithm="HS256",
            )

    if not lecturer_token:
        pytest.skip("Lecturer credentials or JWT_SECRET required to verify 200 response for Story #7 E2E")

    ok_resp = requests.get(
        f"{SERVICES['core']}/analytics/at-risk",
        headers={"Authorization": f"Bearer {lecturer_token}"},
        timeout=10,
    )
    assert ok_resp.status_code == 200
    data = ok_resp.json()
    assert isinstance(data, list)
    for item in data:
        assert "student_id" in item
        assert "full_name" in item
        assert "email" in item
        assert "missed_assignments_count" in item
        assert "risk_reasons" in item
