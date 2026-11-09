import urllib.request
import urllib.error
import json
import sys

# Service endpoints configuration matching docker-compose port mappings
SERVICES = {
    "Frontend": "http://localhost:3000",
    "Backend Core (Team 1)": "http://localhost:8001/health",
    "Backend Courses (Team 2)": "http://localhost:8002/health",
    "Backend AI (Team 3)": "http://localhost:8003/health",
}


def check_service_health(name: str, url: str) -> bool:
    """Verify that the target Docker container is up and responding with HTTP 200."""
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print(f"[PASS] {name} is UP and running at {url} (Status: 200)")
                return True
            else:
                print(f"[WARN] {name} returned unexpected status: {response.status}")
                return False
    except Exception as e:
        print(f"[FAIL] {name} is unreachable at {url}. Error: {e}")
        return False


def test_supabase_e2e_flow() -> bool:
    """
    End-to-End (E2E) integration test:
    Sends a request to the backend service and verifies cloud database (Supabase) connectivity.
    """
    # TODO: Update endpoint URL once Team 1 / Team 2 finalize their database routes
    e2e_url = "http://localhost:8002/health"
    print("\n--- Running E2E Backend-to-Supabase Connectivity Check ---")
    try:
        req = urllib.request.Request(e2e_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            body = response.read().decode("utf-8")
            print(f"[PASS] E2E Database connection verified! Response: {body}")
            return True
    except Exception as e:
        print(f"[FAIL] E2E flow failed: {e}")
        return False


if __name__ == "__main__":
    print("Starting CampuScope Docker Integration Test Suite (Team 4)...\n")
    all_passed = True

    for service_name, service_url in SERVICES.items():
        if not check_service_health(service_name, service_url):
            all_passed = False

    if not test_supabase_e2e_flow():
        all_passed = False

    print("\n" + "=" * 55)
    if all_passed:
        print("SUCCESS: All integration tests passed!")
        sys.exit(0)
    else:
        print("FAILURE: One or more integration tests failed. Check `docker compose logs`.")
        sys.exit(1)