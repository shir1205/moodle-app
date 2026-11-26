"""
בדיקות קצה עבור מנגנון ניהול תפקידים והרשאות RBAC (Story #87 - Task #186)
מוודא אכיפת 403 Forbidden עבור תפקידים לא מורשים (student / lecturer / admin).
"""
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app, create_access_token

client = TestClient(app)


def _auth_header(role: str) -> dict:
    token = create_access_token(
        user_id="00000000-0000-0000-0000-000000000001",
        email=f"{role}@campuscope.ac.il",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def test_student_blocked_from_lecturer_endpoint_with_403():
    res = client.get("/rbac/lecturer-only", headers=_auth_header("student"))
    assert res.status_code == 403


def test_lecturer_allowed_on_lecturer_endpoint():
    res = client.get("/rbac/lecturer-only", headers=_auth_header("lecturer"))
    assert res.status_code == 200
    assert res.json()["allowed"] is True
    assert res.json()["role"] == "lecturer"


def test_admin_allowed_on_lecturer_endpoint():
    res = client.get("/rbac/lecturer-only", headers=_auth_header("admin"))
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_student_and_lecturer_blocked_from_admin_role_update_with_403():
    for forbidden_role in ("student", "lecturer"):
        res = client.patch(
            "/users/00000000-0000-0000-0000-000000000002/role",
            json={"role": "lecturer"},
            headers=_auth_header(forbidden_role),
        )
        assert res.status_code == 403


def test_require_student_blocks_lecturer():
    from fastapi import Depends
    from main import app
    from rbac import require_student

    @app.get("/_test_student_only", dependencies=[Depends(require_student)])
    def _student_only():
        return {"ok": True}

    res = client.get("/_test_student_only", headers=_auth_header("lecturer"))
    assert res.status_code == 403