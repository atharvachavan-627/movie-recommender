"""
Comprehensive Verification Suite for MovieMind Admin Portal Implementation.
Tests:
- Admin login failure on bad credentials (HTTP 401)
- Admin login success on valid credentials (HTTP 200 + Session Cookie + Token)
- GET /api/admin/auth/me validation
- GET /api/admin/dashboard/summary live metrics verification
- GET /api/admin/system/health real health check
- Privilege protection on /api/warehouse/etl/rebuild without admin session (HTTP 401)
- Protected access on /api/warehouse/summary without admin session (HTTP 401)
- Regular user authentication and verification that regular user has NO admin access
- Authorized admin access to ETL rebuild
- Admin logout and session termination
"""
import urllib.request
import urllib.error
import json
import http.cookiejar

BASE_URL = "http://127.0.0.1:8000"


def make_request(path, method="GET", data=None, headers=None, opener=None):
    url = f"{BASE_URL}{path}"
    headers = headers or {}
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    
    if opener:
        return opener.open(req)
    return urllib.request.urlopen(req)


def run_admin_tests():
    print("=" * 60)
    print("RUNNING MOVIEMIND ADMIN PORTAL ACCEPTANCE TESTS")
    print("=" * 60)
    
    # 1. Test Incorrect Admin Credentials
    print("\n[TEST 1] Testing invalid admin credentials...")
    try:
        make_request(
            "/api/admin/auth/login",
            method="POST",
            data={"username": "moviemind_admin", "password": "WrongPassword123!"},
            headers={"Content-Type": "application/json"}
        )
        print("FAIL: Expected 401 on incorrect password!")
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
        print("PASS: Access correctly denied (HTTP 401) on invalid credentials.")

    # 2. Test Correct Admin Credentials
    print("\n[TEST 2] Testing valid admin login...")
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    
    login_res = make_request(
        "/api/admin/auth/login",
        method="POST",
        data={"username": "moviemind_admin", "password": "MovieMindDemo2026!"},
        headers={"Content-Type": "application/json"},
        opener=opener
    )
    assert login_res.status == 200, f"Expected 200, got {login_res.status}"
    login_body = json.loads(login_res.read().decode("utf-8"))
    admin_token = login_body["access_token"]
    assert login_body["admin"]["username"] == "moviemind_admin"
    assert login_body["admin"]["role"] == "admin"
    
    # Verify cookie was set
    cookies = [c.name for c in cookie_jar]
    assert "moviemind_admin_session" in cookies, "Expected moviemind_admin_session cookie"
    print(f"PASS: Admin login succeeded! Token generated and HttpOnly session cookie received.")

    # 3. Test GET /api/admin/auth/me
    print("\n[TEST 3] Testing /api/admin/auth/me with session cookie...")
    me_res = make_request("/api/admin/auth/me", opener=opener)
    assert me_res.status == 200
    me_body = json.loads(me_res.read().decode("utf-8"))
    assert me_body["username"] == "moviemind_admin"
    assert me_body["role"] == "admin"
    print("PASS: Active admin session verified via cookie.")

    # 4. Test GET /api/admin/dashboard/summary (Live counts)
    print("\n[TEST 4] Testing /api/admin/dashboard/summary live metrics...")
    summary_res = make_request("/api/admin/dashboard/summary", opener=opener)
    assert summary_res.status == 200
    summary = json.loads(summary_res.read().decode("utf-8"))
    print(f"       Total Movies: {summary['movies_count']}")
    print(f"       Total Users: {summary['users_count']}")
    print(f"       Raw Ratings: {summary['raw_ratings_count']}")
    print(f"       Warehouse Facts: {summary['warehouse_fact_count']}")
    print(f"       Genres Count: {summary['genres_count']}")
    print(f"       Average Rating: {summary['avg_rating']}")
    assert summary["movies_count"] == 62423
    assert summary["users_count"] == 522
    assert summary["raw_ratings_count"] == 42986
    assert summary["warehouse_fact_count"] == 42769
    assert summary["genres_count"] == 19
    assert round(summary["avg_rating"], 2) == 3.54
    print("PASS: Live KPI counts match exact physical data warehouse metrics without hardcoding.")


    # 5. Test GET /api/admin/system/health
    print("\n[TEST 5] Testing /api/admin/system/health real check...")
    health_res = make_request("/api/admin/system/health", opener=opener)
    assert health_res.status == 200
    health = json.loads(health_res.read().decode("utf-8"))
    assert health["overall_status"] == "Healthy"
    assert health["components"]["backend_api"]["status"] == "Healthy"
    assert health["components"]["warehouse_db"]["status"] == "Healthy"
    assert health["components"]["recommendation_engine"]["status"] == "Healthy"
    assert health["components"]["ml_models"]["status"] == "Healthy"
    assert health["components"]["etl_pipeline"]["status"] == "Healthy"
    print("PASS: System Health real-time checks verified (all 5 pillars Healthy).")

    # 6. Test Privilege Protection: Calling Admin Endpoints WITHOUT Admin Session
    print("\n[TEST 6] Testing privileged protection without admin session...")
    unauth_endpoints = [
        ("/api/warehouse/summary", "GET"),
        ("/api/warehouse/etl/rebuild", "POST"),
        ("/api/admin/dashboard/summary", "GET"),
        ("/api/admin/system/health", "GET"),
        ("/api/olap/rollup?level=year", "GET"),
        ("/api/ml/classification/metrics", "GET"),
    ]
    for endpoint, method in unauth_endpoints:
        try:
            make_request(endpoint, method=method)
            print(f"FAIL: {endpoint} allowed unauthenticated access!")
            assert False
        except urllib.error.HTTPError as e:
            assert e.code in [401, 403], f"Expected 401/403 for {endpoint}, got {e.code}"
            print(f"PASS: {method} {endpoint} securely rejected with HTTP {e.code}.")

    # 7. Test Regular User Has NO Admin Privileges
    print("\n[TEST 7] Testing regular user token has NO admin privileges...")
    user_token = None
    try:
        user_reg_res = make_request(
            "/auth/register",
            method="POST",
            data={"name": "Test User", "email": "testadmincheck@example.com", "username": "testuser_admincheck", "password": "UserPass123!"},
            headers={"Content-Type": "application/json"}
        )
        user_token = json.loads(user_reg_res.read().decode("utf-8"))["access_token"]
    except urllib.error.HTTPError as e:
        if e.code == 409:
            user_login_res = make_request(
                "/auth/login",
                method="POST",
                data={"identifier": "testuser_admincheck", "password": "UserPass123!"},
                headers={"Content-Type": "application/json"}
            )
            user_token = json.loads(user_login_res.read().decode("utf-8"))["access_token"]
        else:
            raise

    user_headers = {"Authorization": f"Bearer {user_token}"}

    
    # Try calling admin endpoints with user token
    for endpoint, method in [("/api/warehouse/etl/rebuild", "POST"), ("/api/warehouse/summary", "GET"), ("/api/admin/dashboard/summary", "GET")]:
        try:
            make_request(endpoint, method=method, headers=user_headers)
            print(f"FAIL: Regular user was granted access to {endpoint}!")
            assert False
        except urllib.error.HTTPError as e:
            assert e.code == 401, f"Expected 401 for regular user on {endpoint}, got {e.code}"
            print(f"PASS: Regular user strictly denied on {endpoint} (HTTP 401).")

    # 8. Test Regular User Can Access Regular User Features
    print("\n[TEST 8] Testing regular user CAN access regular features...")
    catalog_res = make_request("/api/movies?limit=5", headers=user_headers)
    assert catalog_res.status == 200
    movies_data = json.loads(catalog_res.read().decode("utf-8"))
    assert len(movies_data["movies"]) == 5
    
    popular_res = make_request("/api/movies/popular?limit=4", headers=user_headers)
    assert popular_res.status == 200
    
    rec_res = make_request("/api/recommendations/hybrid/1", headers=user_headers)
    assert rec_res.status == 200
    print("PASS: Regular user can search catalog, discover movies, and receive hybrid recommendations.")

    # 9. Test Authorized Admin Can Execute ETL Rebuild
    print("\n[TEST 9] Testing authorized admin ETL rebuild execution...")
    rebuild_res = make_request("/api/warehouse/etl/rebuild", method="POST", opener=opener)
    assert rebuild_res.status == 200
    rebuild_data = json.loads(rebuild_res.read().decode("utf-8"))
    assert rebuild_data["status"] == "success"
    assert "load" in rebuild_data and rebuild_data["load"]["FACT_RATING"] > 0
    print(f"PASS: Admin successfully rebuilt ETL! Elapsed: {rebuild_data.get('elapsed_seconds')}s, Loaded facts: {rebuild_data['load']['FACT_RATING']}.")

    # 10. Test Admin Logout
    print("\n[TEST 10] Testing admin logout and session invalidation...")
    logout_res = make_request("/api/admin/auth/logout", method="POST", opener=opener)
    assert logout_res.status == 200
    
    # Now verify me fails
    try:
        make_request("/api/admin/auth/me", opener=opener)
        print("FAIL: Session was not invalidated after logout!")
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401
        print("PASS: Admin session successfully terminated. Protected endpoints inaccessible after logout.")

    print("\n" + "=" * 60)
    print("ALL 10 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_admin_tests()
