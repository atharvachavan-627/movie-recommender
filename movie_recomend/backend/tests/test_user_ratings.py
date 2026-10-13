"""
Comprehensive Acceptance & Unit Test Suite for MovieMind User Ratings,
Profile Analytics, and Personalized Recommendations.
"""
import json
import urllib.request
import urllib.error
import time

BASE_URL = "http://127.0.0.1:8000"


def make_request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.getcode()


def run_tests():
    print("=" * 65)
    print("RUNNING MOVIEMIND USER RATINGS & PROFILE ACCEPTANCE TESTS")
    print("=" * 65)

    timestamp = int(time.time())
    user_a_email = f"user_a_{timestamp}@example.com"
    user_a_username = f"usera_{timestamp}"
    user_b_email = f"user_b_{timestamp}@example.com"
    user_b_username = f"userb_{timestamp}"

    # 1. Register User A and User B
    print("\n[TEST 1] Registering test users...")
    reg_a, code_a = make_request("/auth/register", method="POST", data={
        "name": "User Alpha",
        "username": user_a_username,
        "email": user_a_email,
        "password": "Password123!",
    })
    token_a = reg_a["access_token"]
    user_a_id = reg_a["user"]["id"]
    print(f"PASS: User A registered (ID: {user_a_id}).")

    reg_b, code_b = make_request("/auth/register", method="POST", data={
        "name": "User Beta",
        "username": user_b_username,
        "email": user_b_email,
        "password": "Password123!",
    })
    token_b = reg_b["access_token"]
    user_b_id = reg_b["user"]["id"]
    print(f"PASS: User B registered (ID: {user_b_id}).")

    # 2. Test Empty State & Cold Start Recommendations
    print("\n[TEST 2] Testing empty profile statistics & cold start recommendations...")
    stats_empty, _ = make_request("/api/ratings/profile-stats", token=token_a)
    assert stats_empty["total_ratings"] == 0
    assert stats_empty["avg_rating"] == 0.0
    assert stats_empty["favorite_genre"] is None
    print("PASS: Empty profile stats correctly reflect 0 ratings without fabrication.")

    cold_recs, _ = make_request("/api/recommendations/personalized?limit=5", token=token_a)
    assert cold_recs["source"] == "popular_fallback"
    assert len(cold_recs["recommendations"]) == 5
    print("PASS: Cold start returns popular fallback with descriptive explanation.")

    # 3. Test Unauthenticated Rating Rejection
    print("\n[TEST 3] Testing unauthenticated rating rejection (HTTP 401)...")
    try:
        make_request("/api/ratings", method="POST", data={"movie_id": 1, "rating": 4.5})
        assert False, "Should have been rejected"
    except urllib.error.HTTPError as e:
        assert e.code == 401
        print("PASS: Unauthenticated rating request strictly rejected with HTTP 401.")

    # 4. Test Rating Validation: Reject Invalid Scale Steps (e.g., 0.0, 5.5, 3.7)
    print("\n[TEST 4] Testing backend rating validation (HTTP 422)...")
    invalid_ratings = [0.0, 5.5, 3.7, -1.0, 6.0]
    for inv in invalid_ratings:
        try:
            make_request("/api/ratings", method="POST", data={"movie_id": 1, "rating": inv}, token=token_a)
            assert False, f"Invalid rating {inv} should have failed validation"
        except urllib.error.HTTPError as e:
            assert e.code == 422
    print("PASS: All invalid rating values outside [0.5-5.0 step 0.5] rejected with HTTP 422.")

    # 5. Test Non-existent Movie Rejection (HTTP 404)
    print("\n[TEST 5] Testing non-existent movie rejection (HTTP 404)...")
    try:
        make_request("/api/ratings", method="POST", data={"movie_id": 999999999, "rating": 4.0}, token=token_a)
        assert False, "Non-existent movie should fail"
    except urllib.error.HTTPError as e:
        assert e.code == 404
        print("PASS: Rating non-existent movie rejected with HTTP 404.")

    # 6. Submit Valid Ratings (Toy Story = 1, Jumanji = 2, Heat = 6, GoldenEye = 10)
    print("\n[TEST 6] Submitting valid ratings for User A...")
    # Toy Story (1): 4.5 ★ (Animation, Adventure, Comedy)
    rate_res, _ = make_request("/api/ratings", method="POST", data={"movie_id": 1, "rating": 4.5}, token=token_a)
    assert rate_res["status"] == "success"
    assert rate_res["action"] == "created"
    assert rate_res["rating"] == 4.5

    # Jumanji (2): 4.0 ★ (Adventure, Children, Fantasy)
    rate_res2, _ = make_request("/api/ratings", method="POST", data={"movie_id": 2, "rating": 4.0}, token=token_a)
    assert rate_res2["action"] == "created"

    # Heat (6): 5.0 ★ (Action, Crime, Thriller)
    rate_res3, _ = make_request("/api/ratings", method="POST", data={"movie_id": 6, "rating": 5.0}, token=token_a)
    assert rate_res3["action"] == "created"
    print("PASS: User A successfully rated 3 movies (Toy Story 4.5*, Jumanji 4.0*, Heat 5.0*).")

    # 7. Test Duplicate Prevention & Idempotent Update
    print("\n[TEST 7] Testing duplicate prevention when rating the same movie again...")
    # Update Toy Story (1) from 4.5 to 5.0
    update_res, _ = make_request("/api/ratings", method="POST", data={"movie_id": 1, "rating": 5.0}, token=token_a)
    assert update_res["action"] == "updated"
    assert update_res["rating"] == 5.0

    ratings_list, _ = make_request("/api/ratings/user", token=token_a)
    assert ratings_list["total"] == 3, f"Expected 3 ratings, got {ratings_list['total']} (duplicates created!)"
    print("PASS: Duplicate prevention verified (updating movie 1 kept total count at 3).")

    # 8. Test Fetch User Rating For Specific Movie
    print("\n[TEST 8] Testing GET /api/ratings/movie/{movie_id}...")
    movie_1_check, _ = make_request("/api/ratings/movie/1", token=token_a)
    assert movie_1_check["rated"] is True
    assert movie_1_check["rating"] == 5.0

    movie_unrated_check, _ = make_request("/api/ratings/movie/500", token=token_a)
    assert movie_unrated_check["rated"] is False
    assert movie_unrated_check["rating"] is None
    print("PASS: Specific movie rating inspection accurately reflects user status.")

    # 9. Test User Isolation (User B cannot see or delete User A's ratings)
    print("\n[TEST 9] Testing strict user isolation...")
    user_b_list, _ = make_request("/api/ratings/user", token=token_b)
    assert user_b_list["total"] == 0, "User B should have 0 ratings"

    # User B attempting to delete movie 1 (which User A rated, but User B did not)
    try:
        make_request("/api/ratings/movie/1", method="DELETE", token=token_b)
        assert False, "User B should not be able to delete User A's rating"
    except urllib.error.HTTPError as e:
        assert e.code == 404
    print("PASS: User B strictly prevented from deleting or accessing User A's rating records.")

    # 10. Test Real Profile Statistics Derived from Real DB Records
    print("\n[TEST 10] Testing real profile statistics derivation...")
    stats, _ = make_request("/api/ratings/profile-stats", token=token_a)
    assert stats["total_ratings"] == 3
    # Ratings: 5.0, 4.0, 5.0 -> avg = 4.67
    assert stats["avg_rating"] == 4.67
    assert stats["max_rating"] == 5.0
    assert stats["min_rating"] == 4.0
    assert stats["rating_distribution"]["5.0"] == 2
    assert stats["rating_distribution"]["4.0"] == 1
    assert stats["favorite_genre"] in ["Adventure", "Animation", "Action", "Comedy", "Crime", "Thriller"]
    assert stats["recently_rated"]["movie_id"] in [1, 2, 6]
    print(f"PASS: Profile statistics accurate: total={stats['total_ratings']}, avg={stats['avg_rating']}*, fav_genre={stats['favorite_genre']}.")

    # 11. Test Personalized Recommendations & Exclusion of Already Rated Movies
    print("\n[TEST 11] Testing personalized recommendations & rated movie exclusion...")
    recs_res, _ = make_request("/api/recommendations/personalized?limit=10", token=token_a)
    assert recs_res["source"] == "personalized_hybrid"
    assert recs_res["rated_movies_count"] == 3
    rec_ids = [r["movieId"] for r in recs_res["recommendations"]]
    # NONE of the rated movies (1, 2, 6) should appear in recommendations!
    for rated_id in [1, 2, 6]:
        assert rated_id not in rec_ids, f"Movie {rated_id} was rated but appears in recommendations!"
    print(f"PASS: Recommendations generated ({len(rec_ids)} movies). Rated movies [1, 2, 6] strictly excluded.")

    # 12. Test Rating Deletion & Confirmation
    print("\n[TEST 12] Testing user rating deletion...")
    del_res, _ = make_request("/api/ratings/movie/2", method="DELETE", token=token_a)
    assert del_res["status"] == "success"

    # Verify movie 2 is no longer rated
    movie_2_check, _ = make_request("/api/ratings/movie/2", token=token_a)
    assert movie_2_check["rated"] is False

    stats_after_del, _ = make_request("/api/ratings/profile-stats", token=token_a)
    assert stats_after_del["total_ratings"] == 2
    print("PASS: Rating deleted successfully. Profile statistics updated to 2 movies.")

    print("\n" + "=" * 65)
    print("ALL 12 USER RATING & PROFILE TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()
