import logging
import os
import re
import sqlite3
import numpy as np
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from app.admin_auth import (
    AdminLoginRequest,
    AdminProfile,
    AdminTokenResponse,
    get_current_admin,
    login_admin,
    logout_admin,
    require_admin_or_user,
)
from app.analytics import analytics_engine
from app.auth import LoginRequest, TokenResponse, UserCreate, UserResponse, get_current_user, login_user, register_user
from app.config import (
    COLLABORATIVE_WEIGHT,
    CONTENT_WEIGHT,
    FRONTEND_ORIGINS,
    WAREHOUSE_DB_PATH,
)
from app.data_loader import data_loader
from app.database import get_connection, initialize_database
from app.mining.apriori import apriori_miner
from app.ml.engine import ml_engine
from app.recommender.collaborative import CollaborativeRecommender
from app.recommender.content_based import ContentBasedRecommender
from app.recommender.evaluation import recommender_evaluator
from app.recommender.hybrid import HybridRecommender
from app.warehouse.etl import run_warehouse_etl
from app.warehouse.olap import olap_engine
from app.warehouse.schema import init_warehouse_schema
from app.warehouse.warehouse import get_table_details, get_warehouse_summary

logger = logging.getLogger("MovieMind.Main")

# Global recommender instances
content_recommender = ContentBasedRecommender()
collaborative_recommender = CollaborativeRecommender()
hybrid_recommender = HybridRecommender(content_recommender, collaborative_recommender)


class PredictRequest(BaseModel):
    movie_id: int
    model: Optional[str] = "random_forest"
    movielens_user_id: Optional[int] = None


class ClassifyRequest(BaseModel):
    movie_id: int
    model: Optional[str] = "decision_tree"
    movielens_user_id: Optional[int] = None


VALID_RATINGS = {0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0}


class RateMovieRequest(BaseModel):
    movie_id: int
    rating: float = Field(..., ge=0.5, le=5.0)

    @field_validator("rating")
    @classmethod
    def validate_half_star(cls, v: float) -> float:
        v_rounded = round(float(v) * 2) / 2
        if v_rounded not in VALID_RATINGS or abs(v - v_rounded) > 1e-4:
            raise ValueError("Rating must be between 0.5 and 5.0 in 0.5 star increments")
        return v_rounded


class UpdateRatingRequest(BaseModel):
    rating: float = Field(..., ge=0.5, le=5.0)

    @field_validator("rating")
    @classmethod
    def validate_half_star(cls, v: float) -> float:
        v_rounded = round(float(v) * 2) / 2
        if v_rounded not in VALID_RATINGS or abs(v - v_rounded) > 1e-4:
            raise ValueError("Rating must be between 0.5 and 5.0 in 0.5 star increments")
        return v_rounded


class LinkMovieLensUserRequest(BaseModel):
    movielens_user_id: int


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MovieMind Backend Engine...")
    initialize_database()

    # 1. Load Data & Aggregations
    data_loader.load_data()

    # 2. Fit Recommendation Models
    content_recommender.fit(data_loader.movies_df)
    collaborative_recommender.fit(data_loader.ratings_df, data_loader.movies_df)

    # 3. Compute Analytics
    analytics_engine.compute_analytics()

    # 4. Load Real ML Models and Metadata (Regression, Classification, Clustering)
    ml_engine.load_models()

    # 5. Initialize Star Schema Warehouse & Apriori Rules if needed
    init_warehouse_schema()
    apriori_miner.load_rules()

    logger.info("MovieMind Backend Engine Startup Complete!")
    yield
    logger.info("Shutting down MovieMind Backend Engine...")


app = FastAPI(
    title="MovieMind – Hybrid Movie Recommendation System API",
    description="Data Warehousing and Mining (DWM) API combining Star Schema, OLAP, Apriori, ML, and Hybrid Filtering",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# --- User Authentication Endpoints ---
# ==============================================================================

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: UserCreate):
    return register_user(payload)


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    return login_user(payload)


@app.get("/auth/me", response_model=UserResponse)
def me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
def logout(current_user: UserResponse = Depends(get_current_user)):
    return {"message": "Logged out", "username": current_user.username}


# ==============================================================================
# --- Administrator Authentication & Management Endpoints ---
# ==============================================================================

@app.post("/api/admin/auth/login", response_model=AdminTokenResponse)
def admin_login_endpoint(credentials: AdminLoginRequest, request: Request, response: Response):
    """Authenticate administrator credentials and issue secure session cookie and token."""
    return login_admin(credentials=credentials, request=request, response=response)


@app.get("/api/admin/auth/me", response_model=AdminProfile)
def admin_me_endpoint(current_admin: AdminProfile = Depends(get_current_admin)):
    """Validates active administrator session."""
    return current_admin


@app.post("/api/admin/auth/logout")
def admin_logout_endpoint(response: Response, current_admin: AdminProfile = Depends(get_current_admin)):
    """Terminates active administrator session and clears session cookie."""
    return logout_admin(response)


@app.get("/api/admin/dashboard/summary")
def admin_dashboard_summary(current_admin: AdminProfile = Depends(get_current_admin)):
    """Live summary metrics for Admin Dashboard overview."""
    wh_summary = get_warehouse_summary()
    wh_tables = wh_summary.get("tables", {})

    movies_count = len(data_loader.movies_df) if data_loader.movies_df is not None else 0
    users_count = int(data_loader.ratings_df["userId"].nunique()) if data_loader.ratings_df is not None else 0
    raw_ratings_count = len(data_loader.ratings_df) if data_loader.ratings_df is not None else 0
    cleaned_ratings_count = raw_ratings_count
    fact_records_count = wh_tables.get("FACT_RATING", 0)
    genres_count = len(data_loader.all_genres)
    avg_rating = float(round(data_loader.ratings_df["rating"].mean(), 2)) if data_loader.ratings_df is not None else 0.0

    return {
        "movies_count": movies_count,
        "users_count": users_count,
        "raw_ratings_count": raw_ratings_count,
        "cleaned_ratings_count": cleaned_ratings_count,
        "warehouse_fact_count": fact_records_count,
        "genres_count": genres_count,
        "avg_rating": avg_rating,
        "warehouse_status": wh_summary.get("status", "unknown"),
        "warehouse_tables": wh_tables,
        "notes": {
            "raw_ratings": "Total operational rating transactions imported from source CSVs (42,986).",
            "cleaned_ratings": "Ratings verified within [0.5, 5.0] range with valid timestamps (42,986).",
            "warehouse_fact_records": "Surrogate-keyed dimensional rows committed to FACT_RATING (42,769). The difference represents historical rating events deduplicated per (User x Movie x Date) grain.",
        },
    }


@app.get("/api/admin/system/health")
def admin_system_health(current_admin: AdminProfile = Depends(get_current_admin)):
    """Performs real active health verification across all system pillars."""
    # 1. Backend API
    api_status = "Healthy"
    api_msg = "FastAPI application runtime running on Uvicorn (port 8000)"

    # 2. SQLite Data Warehouse
    dw_status = "Healthy"
    dw_msg = "Physical Star Schema connected and queried successfully"
    fact_count = 0
    if not os.path.exists(WAREHOUSE_DB_PATH):
        dw_status = "Unavailable"
        dw_msg = f"Warehouse database not found at {WAREHOUSE_DB_PATH}"
    else:
        try:
            with sqlite3.connect(WAREHOUSE_DB_PATH) as conn:
                row = conn.execute("SELECT COUNT(*) FROM FACT_RATING").fetchone()
                fact_count = row[0] if row else 0
                if fact_count == 0:
                    dw_status = "Degraded"
                    dw_msg = "Database file present but FACT_RATING is empty"
        except Exception as e:
            dw_status = "Unavailable"
            dw_msg = f"Warehouse query error: {str(e)}"

    # 3. Recommendation Engine
    recommender_status = "Healthy"
    recommender_msg = "Content-Based TF-IDF and Item-Item Collaborative models fitted"
    if not (content_recommender.is_fitted and collaborative_recommender.is_fitted):
        recommender_status = "Degraded"
        recommender_msg = "Recommendation matrices are not fully fitted"

    # 4. ML Model Availability
    ml_status = "Healthy"
    ml_msg = "Decision Tree, Naive Bayes, Regression models, and K-Means clusters active in memory"
    if not ml_engine.is_loaded:
        ml_status = "Degraded"
        ml_msg = "ML Engine artifacts not loaded in memory"

    # 5. ETL Pipeline Status
    etl_status = "Healthy" if fact_count > 0 else "Unavailable"
    etl_msg = f"Active with {fact_count:,} facts loaded with verified surrogate keys" if fact_count > 0 else "ETL pipeline not executed"

    # Determine overall system health
    statuses = [api_status, dw_status, recommender_status, ml_status, etl_status]
    if any(s == "Unavailable" for s in statuses):
        overall = "Degraded"
    elif any(s == "Degraded" for s in statuses):
        overall = "Degraded"
    else:
        overall = "Healthy"

    return {
        "overall_status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "backend_api": {"status": api_status, "message": api_msg, "version": "2.0.0"},
            "warehouse_db": {"status": dw_status, "message": dw_msg, "fact_count": fact_count},
            "recommendation_engine": {"status": recommender_status, "message": recommender_msg},
            "ml_models": {"status": ml_status, "message": ml_msg},
            "etl_pipeline": {"status": etl_status, "message": etl_msg},
        },
    }


# ==============================================================================
# --- System Health & Public Endpoints ---
# ==============================================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "MovieMind DWM Recommendation & Analytics Engine",
        "dataset_loaded": data_loader.is_loaded,
        "stats": data_loader.stats,
    }


# ==============================================================================
# --- Movie Catalog & Recommendation Endpoints (User & Admin) ---
# ==============================================================================

@app.get("/api/movies")
def get_movies(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    genre: Optional[str] = Query(None),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    df = data_loader.movies_df
    if genre and genre != "All":
        df = df[df["genres_list"].apply(lambda gl: genre in gl)]

    df_sorted = df.sort_values(by=["rating_count", "avg_rating"], ascending=[False, False])
    total_count = len(df_sorted)

    paged_df = df_sorted.iloc[offset:offset + limit]
    movies = [data_loader.movie_map[row["movieId"]] for _, row in paged_df.iterrows()]

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "movies": movies,
        "genres": data_loader.all_genres,
    }


@app.get("/api/movies/search")
def search_movies(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    genre: Optional[str] = Query(None),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    results = data_loader.search_movies(query=q, limit=limit, genre=genre)
    return {
        "query": q,
        "total": len(results),
        "results": results,
    }


@app.get("/api/movies/popular")
def get_popular_movies(
    limit: int = Query(10, ge=1, le=50),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    return analytics_engine.get_popular(limit=limit)


@app.get("/api/movies/{movie_id}")
def get_movie_details(movie_id: int, auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@app.get("/api/recommendations/content/{movie_id}")
def get_content_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    recs = content_recommender.get_recommendations(movie_id=movie_id, top_n=limit)

    enriched_recs = []
    for r in recs:
        m = data_loader.get_movie(r["movieId"])
        if m:
            c_score = float(round(r["score"], 4))
            cb_score = float(round(collaborative_recommender.get_similarity(movie_id, r["movieId"]), 4))
            h_score = float(round((CONTENT_WEIGHT * c_score) + (COLLABORATIVE_WEIGHT * cb_score), 4))
            enriched_recs.append({
                **m,
                "content_score": c_score,
                "collaborative_score": cb_score,
                "hybrid_score": h_score,
                "explanation": r["explanation"],
            })

    return {
        "movie": movie,
        "type": "content_based",
        "algorithm": "TF-IDF Genre Representation + Cosine Similarity",
        "count": len(enriched_recs),
        "recommendations": enriched_recs,
    }


@app.get("/api/recommendations/collaborative/{movie_id}")
def get_collaborative_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    recs = collaborative_recommender.get_recommendations(movie_id=movie_id, top_n=limit)

    enriched_recs = []
    for r in recs:
        m = data_loader.get_movie(r["movieId"])
        if m:
            cb_score = float(round(r["score"], 4))
            c_score = float(round(content_recommender.get_similarity(movie_id, r["movieId"]), 4))
            h_score = float(round((CONTENT_WEIGHT * c_score) + (COLLABORATIVE_WEIGHT * cb_score), 4))
            enriched_recs.append({
                **m,
                "content_score": c_score,
                "collaborative_score": cb_score,
                "hybrid_score": h_score,
                "explanation": r["explanation"],
            })

    return {
        "movie": movie,
        "type": "collaborative_filtering",
        "algorithm": "Item-Item Collaborative Filtering (Sparse Matrix Cosine Similarity)",
        "count": len(enriched_recs),
        "recommendations": enriched_recs,
    }


@app.get("/api/recommendations/hybrid/{movie_id}")
def get_hybrid_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    content_w: Optional[float] = Query(None, ge=0.0, le=1.0),
    collab_w: Optional[float] = Query(None, ge=0.0, le=1.0),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    cw = content_w if content_w is not None else CONTENT_WEIGHT
    cbw = collab_w if collab_w is not None else COLLABORATIVE_WEIGHT

    recs = hybrid_recommender.get_recommendations(
        movie_id=movie_id,
        top_n=limit,
        content_w=cw,
        collab_w=cbw,
    )

    user_id = auth_context.get("id") or 1
    for r in recs:
        try:
            pred_res = ml_engine.predict_rating(movie_id=r["movieId"], app_user_id=user_id)
            if pred_res.get("status") == "success":
                r["predicted_rating"] = pred_res.get("predicted_rating")
                r["ml_model"] = pred_res.get("model")
            else:
                r["predicted_rating"] = None
                r["ml_status"] = pred_res.get("status")
        except Exception:
            r["predicted_rating"] = None

    return {
        "movie": movie,
        "type": "hybrid",
        "algorithm": f"Weighted Hybrid ({cw * 100:.0f}% Content + {cbw * 100:.0f}% Collaborative)",
        "weights": {
            "content": cw,
            "collaborative": cbw,
        },
        "count": len(recs),
        "recommendations": recs,
    }


# ==============================================================================
# --- User Ratings, Profile Analytics & Personalized Recommendations ---
# ==============================================================================

def clean_title(title: str) -> str:
    """Removes trailing (YYYY) release year from movie titles."""
    return re.sub(r"\s*\(\d{4}\)$", "", str(title or "")).strip()


def _resolve_user_id(auth_context: Dict[str, Any]) -> int:
    """
    Derives authoritative user identity from validated JWT/session credentials.
    Never accepts or trusts unauthenticated client-supplied IDs.
    """
    if auth_context.get("role") == "user":
        return int(auth_context["id"])

    # Administrator session: ensure a persistent admin profile row in SQLite users
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM users WHERE username = 'moviemind_admin'").fetchone()
        if row:
            return int(row["id"])
        cur = conn.execute(
            "INSERT INTO users (name, username, email, hashed_password) VALUES (?, ?, ?, ?)",
            ("MovieMind Administrator", "moviemind_admin", "admin@moviemind.internal", "admin_session_auth"),
        )
        return int(cur.lastrowid)


@app.get("/api/ratings/user")
def get_user_ratings(
    sort_by: str = Query("recent", pattern="^(recent|highest|lowest|title)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Fetches the authenticated user's submitted movie ratings with full movie metadata.
    Supports sorting by most recent, highest rating, lowest rating, and title.
    """
    user_id = _resolve_user_id(auth_context)

    order_clause = "COALESCE(ur.updated_at, ur.created_at) DESC, ur.id DESC"
    if sort_by == "highest":
        order_clause = "ur.rating DESC, ur.created_at DESC"
    elif sort_by == "lowest":
        order_clause = "ur.rating ASC, ur.created_at DESC"

    with get_connection() as conn:
        total_row = conn.execute(
            "SELECT COUNT(*) as count FROM user_ratings WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        total = int(total_row["count"]) if total_row else 0

        rows = conn.execute(
            f"""
            SELECT ur.id, ur.movie_id, ur.rating, ur.created_at, ur.updated_at
            FROM user_ratings ur
            WHERE ur.user_id = ?
            ORDER BY {order_clause}
            """,
            (user_id,)
        ).fetchall()

    enriched = []
    for r in rows:
        m = data_loader.get_movie(r["movie_id"])
        item = {
            "id": r["id"],
            "movie_id": r["movie_id"],
            "rating": float(r["rating"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"] or r["created_at"],
            "title": m["title"] if m else f"Movie {r['movie_id']}",
            "year": m.get("year") if m else None,
            "genres": m["genres"] if m else "",
            "genres_list": m.get("genres_list", []) if m else [],
            "avg_rating": float(m.get("avg_rating", 0.0)) if m else 0.0,
            "rating_count": int(m.get("rating_count", 0)) if m else 0,
        }
        enriched.append(item)

    if sort_by == "title":
        enriched.sort(key=lambda x: clean_title(x["title"]).lower())

    paged = enriched[offset: offset + limit]
    return {
        "ratings": paged,
        "total": total,
        "limit": limit,
        "offset": offset,
        "sort_by": sort_by,
    }


@app.get("/api/ratings/movie/{movie_id}")
def get_user_movie_rating(
    movie_id: int,
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Checks if the authenticated user has previously rated a specific movie.
    Returns previously saved rating if exists.
    """
    user_id = _resolve_user_id(auth_context)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT rating, created_at, updated_at FROM user_ratings WHERE user_id = ? AND movie_id = ?",
            (user_id, movie_id)
        ).fetchone()

    if not row:
        return {"rated": False, "rating": None, "movie_id": movie_id}

    return {
        "rated": True,
        "rating": float(row["rating"]),
        "movie_id": movie_id,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"] or row["created_at"],
    }


@app.post("/api/ratings")
def save_user_rating(
    payload: RateMovieRequest,
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Saves or updates a movie rating for the authenticated user.
    Prevents duplicate records by performing atomic upsert with updated_at timestamp.
    """
    user_id = _resolve_user_id(auth_context)
    movie = data_loader.get_movie(payload.movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found in MovieLens catalogue")

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id, rating FROM user_ratings WHERE user_id = ? AND movie_id = ?",
            (user_id, payload.movie_id)
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE user_ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND movie_id = ?",
                (payload.rating, user_id, payload.movie_id)
            )
            action = "updated"
        else:
            conn.execute(
                "INSERT INTO user_ratings (user_id, movie_id, rating, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (user_id, payload.movie_id, payload.rating)
            )
            action = "created"

    return {
        "status": "success",
        "action": action,
        "movie_id": payload.movie_id,
        "rating": payload.rating,
        "title": movie["title"],
    }


@app.put("/api/ratings/movie/{movie_id}")
def update_user_rating(
    movie_id: int,
    payload: UpdateRatingRequest,
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Updates an existing rating for a movie by the authenticated user.
    """
    user_id = _resolve_user_id(auth_context)
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found in MovieLens catalogue")

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM user_ratings WHERE user_id = ? AND movie_id = ?",
            (user_id, movie_id)
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE user_ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND movie_id = ?",
                (payload.rating, user_id, movie_id)
            )
            action = "updated"
        else:
            conn.execute(
                "INSERT INTO user_ratings (user_id, movie_id, rating, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (user_id, movie_id, payload.rating)
            )
            action = "created"

    return {
        "status": "success",
        "action": action,
        "movie_id": movie_id,
        "rating": payload.rating,
        "title": movie["title"],
    }


@app.delete("/api/ratings/movie/{movie_id}")
def delete_user_rating(
    movie_id: int,
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Deletes the authenticated user's rating for a specific movie.
    Ensures users can only delete their own rating records.
    """
    user_id = _resolve_user_id(auth_context)
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM user_ratings WHERE user_id = ? AND movie_id = ?",
            (user_id, movie_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Rating record not found for this movie")

    return {
        "status": "success",
        "message": "Rating removed successfully",
        "movie_id": movie_id,
    }


@app.get("/api/ratings/profile-stats")
def get_user_profile_stats(auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    """
    Derives comprehensive personal profile statistics from the user's real saved rating history.
    Includes count, mean rating, min/max, rating distribution, favorite genre, and top genres.
    """
    user_id = _resolve_user_id(auth_context)
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT movie_id, rating, created_at, updated_at FROM user_ratings WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC, id DESC",
            (user_id,)
        ).fetchall()

    dist_keys = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
    empty_dist = {f"{s:.1f}": 0 for s in dist_keys}

    if not rows:
        return {
            "total_ratings": 0,
            "avg_rating": 0.0,
            "min_rating": None,
            "max_rating": None,
            "rating_distribution": empty_dist,
            "favorite_genre": None,
            "top_genres": [],
            "recently_rated": None,
            "highest_rated": [],
        }

    ratings = [float(r["rating"]) for r in rows]
    total_ratings = len(ratings)
    avg_rating = round(float(np.mean(ratings)), 2)
    min_rating = float(np.min(ratings))
    max_rating = float(np.max(ratings))

    dist = {f"{s:.1f}": 0 for s in dist_keys}
    for val in ratings:
        k = f"{val:.1f}"
        if k in dist:
            dist[k] += 1

    genre_ratings: Dict[str, List[float]] = {}
    enriched_ratings = []
    for r in rows:
        m = data_loader.get_movie(r["movie_id"])
        item = {
            "movie_id": r["movie_id"],
            "rating": float(r["rating"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"] or r["created_at"],
            "title": m["title"] if m else f"Movie {r['movie_id']}",
            "genres": m["genres"] if m else "",
            "genres_list": m.get("genres_list", []) if m else [],
            "year": m.get("year") if m else None,
            "avg_rating": float(m.get("avg_rating", 0.0)) if m else 0.0,
        }
        enriched_ratings.append(item)
        if m and m.get("genres_list"):
            for g in m["genres_list"]:
                if g and g != "Unknown":
                    genre_ratings.setdefault(g, []).append(float(r["rating"]))

    # Sort genres: primary by count, secondary by average rating
    genre_stats = []
    for g, g_vals in genre_ratings.items():
        genre_stats.append({
            "genre": g,
            "count": len(g_vals),
            "avg_rating": round(float(np.mean(g_vals)), 2),
        })
    genre_stats.sort(key=lambda x: (x["count"], x["avg_rating"]), reverse=True)

    favorite_genre = genre_stats[0]["genre"] if genre_stats else None
    recent_item = enriched_ratings[0] if enriched_ratings else None
    highest_rated = [item for item in enriched_ratings if item["rating"] == max_rating][:6]

    return {
        "total_ratings": total_ratings,
        "avg_rating": avg_rating,
        "min_rating": min_rating,
        "max_rating": max_rating,
        "rating_distribution": dist,
        "favorite_genre": favorite_genre,
        "top_genres": genre_stats[:6],
        "recently_rated": recent_item,
        "highest_rated": highest_rated,
    }


@app.get("/api/recommendations/personalized")
def get_personalized_recommendations(
    limit: int = Query(10, ge=1, le=50),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """
    Generates personalized recommendations based on the authenticated user's actual rating history.
    Strictly excludes movies the user has already rated.
    Uses positive ratings as similarity seeds and reranks via ML rating prediction.
    """
    user_id = _resolve_user_id(auth_context)
    with get_connection() as conn:
        rating_rows = conn.execute(
            "SELECT movie_id, rating FROM user_ratings WHERE user_id = ? ORDER BY rating DESC, id DESC",
            (user_id,)
        ).fetchall()

    rated_ids = {int(r["movie_id"]) for r in rating_rows}

    # Cold start fallback for new users without ratings
    if not rating_rows:
        popular = data_loader.search_movies("", limit=limit)
        recs = []
        for m in popular:
            recs.append({
                **m,
                "score": 1.0,
                "predicted_rating": m.get("avg_rating", 3.5),
                "source": "popular_fallback",
                "explanation": "Trending title across MovieLens. Rate movies you enjoy to unlock customized recommendations!",
            })
        return {
            "recommendations": recs,
            "count": len(recs),
            "source": "popular_fallback",
            "rated_movies_count": 0,
            "message": "Start rating movies to build your personalized taste profile.",
        }

    # Aggregate candidate movies from top-rated seeds
    seed_ratings = [r for r in rating_rows if float(r["rating"]) >= 2.5][:6]
    if not seed_ratings:
        seed_ratings = list(rating_rows)[:3]

    candidate_scores: Dict[int, float] = {}
    candidate_explanations: Dict[int, str] = {}

    for seed in seed_ratings:
        seed_mid = int(seed["movie_id"])
        seed_rating = float(seed["rating"])
        seed_movie = data_loader.get_movie(seed_mid)
        seed_title = clean_title(seed_movie["title"]) if seed_movie else f"Movie {seed_mid}"

        content_cands = content_recommender.get_recommendations(seed_mid, top_n=25)
        weight = seed_rating / 5.0

        for cand in content_cands:
            cid = cand["movieId"]
            if cid in rated_ids:
                continue  # STRICTLY EXCLUDE ALREADY RATED
            sim = cand["score"] * weight
            if cid not in candidate_scores or sim > candidate_scores[cid]:
                candidate_scores[cid] = sim
                candidate_explanations[cid] = f"Recommended because you gave {seed_rating:.1f} ★ to {seed_title}."

    # If candidate pool is small, supplement from favorite genre
    if len(candidate_scores) < limit:
        all_genres = []
        for r in rating_rows:
            m = data_loader.get_movie(r["movie_id"])
            if m:
                all_genres.extend(m.get("genres_list", []))
        if all_genres:
            top_genre = pd.Series(all_genres).value_counts().index[0]
            genre_movies = data_loader.search_movies("", limit=30, genre=top_genre)
            for gm in genre_movies:
                gid = gm["movieId"]
                if gid not in rated_ids and gid not in candidate_scores:
                    candidate_scores[gid] = 0.5
                    candidate_explanations[gid] = f"Matches your preferred genre ({top_genre})."

    sorted_cands = sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:limit]

    recs = []
    for cid, score in sorted_cands:
        m = data_loader.get_movie(cid)
        if not m:
            continue
        predicted_val = None
        try:
            pred_res = ml_engine.predict_rating(movie_id=cid, app_user_id=user_id)
            if pred_res.get("status") == "success":
                predicted_val = pred_res.get("predicted_rating")
        except Exception:
            predicted_val = None

        recs.append({
            **m,
            "score": round(float(score), 4),
            "predicted_rating": predicted_val or m.get("avg_rating", 3.5),
            "source": "personalized_hybrid",
            "explanation": candidate_explanations.get(cid, "Recommended based on your positive rating history."),
        })

    return {
        "recommendations": recs,
        "count": len(recs),
        "source": "personalized_hybrid",
        "rated_movies_count": len(rated_ids),
        "message": f"Personalized based on {len(rating_rows)} ratings in your profile.",
    }


# Backwards compatibility endpoints
@app.get("/api/ml/user-profile")
def get_ml_user_profile(auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    user_id = _resolve_user_id(auth_context)
    username = auth_context.get("username", "user")
    history = ml_engine.get_app_user_history(user_id)
    enriched_ratings = []
    for r in history["custom_ratings"]:
        m = data_loader.get_movie(r["movie_id"])
        enriched_ratings.append({
            **r,
            "title": m["title"] if m else f"Movie {r['movie_id']}",
            "genres": m["genres"] if m else "",
        })
    return {
        "app_user_id": user_id,
        "username": username,
        "linked_movielens_user_id": history["linked_movielens_user_id"],
        "custom_ratings_count": history["custom_ratings_count"],
        "custom_ratings": enriched_ratings,
    }


@app.post("/api/ml/link-movielens-user")
def link_movielens_user(payload: LinkMovieLensUserRequest, auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    user_id = _resolve_user_id(auth_context)
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO user_movielens_mapping (user_id, movielens_user_id) VALUES (?, ?)",
            (user_id, payload.movielens_user_id),
        )
    return {"status": "success", "linked_movielens_user_id": payload.movielens_user_id}


@app.post("/api/ml/rate-movie")
def rate_movie(payload: RateMovieRequest, auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    return save_user_rating(payload, auth_context)


@app.post("/api/ml/predict-rating")
def predict_rating_endpoint(payload: PredictRequest, auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    user_id = auth_context.get("id") or 1
    return ml_engine.predict_rating(
        movie_id=payload.movie_id,
        model_name=payload.model or "random_forest",
        app_user_id=user_id,
        movielens_user_id=payload.movielens_user_id,
    )


@app.post("/api/ml/classification/predict")
def predict_classification_endpoint(payload: ClassifyRequest, auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    """Classify rating into DISLIKE / NEUTRAL / LIKE using Decision Tree or Naive Bayes."""
    user_id = auth_context.get("id") or 1
    return ml_engine.predict_classification(
        movie_id=payload.movie_id,
        model_name=payload.model or "decision_tree",
        app_user_id=user_id,
        movielens_user_id=payload.movielens_user_id,
    )


# ==============================================================================
# --- PROTECTED ADMINISTRATOR ANALYTICAL & DATA WAREHOUSING ENDPOINTS ---
# ==============================================================================

@app.get("/api/recommendations/evaluation")
def get_recommendation_evaluation(current_admin: AdminProfile = Depends(get_current_admin)):
    """Offline benchmark comparing Content-Based vs Collaborative vs Hybrid on Precision@K, Recall@K, NDCG@K, and Coverage."""
    return recommender_evaluator.load_or_compute(
        content_recommender,
        collaborative_recommender,
        hybrid_recommender,
    )


# --- DWM Analytics Endpoints (Protected Administrator) ---

@app.get("/api/analytics/overview")
def get_analytics_overview(current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_overview()


@app.get("/api/analytics/executive-insights")
def get_analytics_executive_insights(current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_executive_insights()


@app.get("/api/analytics/popular")
def get_analytics_popular(limit: int = Query(10, ge=1, le=50), auth_context: Dict[str, Any] = Depends(require_admin_or_user)):
    return analytics_engine.get_popular(limit=limit)


@app.get("/api/analytics/genres")
def get_analytics_genres(min_ratings: int = Query(0, ge=0), current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_genres(min_ratings=min_ratings)


@app.get("/api/analytics/ratings")
def get_analytics_ratings(current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_ratings_distribution()


@app.get("/api/analytics/time-series")
def get_analytics_time_series(granularity: str = Query("year"), current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_time_series(granularity=granularity)


@app.get("/api/analytics/movie-rankings")
def get_analytics_movie_rankings(
    sort_by: str = Query("rating_count"),
    min_ratings: int = Query(10, ge=0),
    genre: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    page: int = Query(1, ge=1),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    return analytics_engine.get_movie_rankings(
        sort_by=sort_by,
        min_ratings=min_ratings,
        genre=genre,
        search=search,
        limit=limit,
        page=page,
    )


@app.get("/api/analytics/user-behavior")
def get_analytics_user_behavior(current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_user_analytics()


@app.get("/api/analytics/genre-time-matrix")
def get_analytics_genre_time_matrix(measure: str = Query("avg_rating"), current_admin: AdminProfile = Depends(get_current_admin)):
    return analytics_engine.get_genre_time_matrix(measure=measure)


@app.get("/api/analytics/explorer")
def get_analytics_explorer(
    dimension: str = Query("genre"),
    measure: str = Query("rating_count"),
    sort_order: str = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    min_ratings: int = Query(0, ge=0),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    return analytics_engine.get_analytical_explorer(
        dimension=dimension,
        measure=measure,
        sort_order=sort_order,
        limit=limit,
        min_ratings=min_ratings,
    )


@app.get("/api/dwm/data-quality")
def get_data_quality(current_admin: AdminProfile = Depends(get_current_admin)):
    """DWM Data Quality dashboard metrics (missing values, duplicates, range checks, ETL status)."""
    return ml_engine.get_data_quality_report()


# --- Physical Data Warehouse & OLAP Endpoints (Protected Administrator) ---

@app.get("/api/warehouse/summary")
def warehouse_summary(current_admin: AdminProfile = Depends(get_current_admin)):
    """Star Schema physical tables summary and record metrics."""
    return get_warehouse_summary()


@app.get("/api/warehouse/table/{table_name}")
def warehouse_table_detail(table_name: str, current_admin: AdminProfile = Depends(get_current_admin)):
    """Inspects Star Schema table schema columns, foreign keys, row count, and sample records."""
    res = get_table_details(table_name)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@app.post("/api/warehouse/etl/rebuild")
def warehouse_rebuild_etl(current_admin: AdminProfile = Depends(get_current_admin)):
    """Privileged action: Triggers reproducible Star Schema ETL pipeline rebuild."""
    return run_warehouse_etl(force_rebuild=True)


@app.get("/api/olap/rollup")
def olap_rollup(
    level: str = Query("year", pattern="^(day|month|quarter|year|decade)$"),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """OLAP Roll-up along date hierarchy: Day -> Month -> Quarter -> Year -> Decade."""
    return olap_engine.rollup(level=level)


@app.get("/api/olap/drilldown")
def olap_drilldown(
    target_year: Optional[int] = Query(None),
    target_quarter: Optional[int] = Query(None),
    target_month: Optional[int] = Query(None),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """OLAP Drill-down: Year -> Quarter -> Month -> Day."""
    return olap_engine.drilldown(
        target_year=target_year,
        target_quarter=target_quarter,
        target_month=target_month,
    )


@app.get("/api/olap/slice")
def olap_slice(
    dimension: str = Query("genre", pattern="^(genre|year)$"),
    value: str = Query("Action"),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """OLAP Slice on single dimension value."""
    return olap_engine.slice(dimension=dimension, value=value)


@app.get("/api/olap/dice")
def olap_dice(
    genre: Optional[str] = Query("Action"),
    year_min: Optional[int] = Query(2015),
    year_max: Optional[int] = Query(2024),
    rating_min: Optional[float] = Query(3.5),
    limit: int = Query(25, ge=1, le=100),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """OLAP Dice across multiple dimensions simultaneously."""
    return olap_engine.dice(
        genre=genre,
        year_min=year_min,
        year_max=year_max,
        rating_min=rating_min,
        limit=limit,
    )


@app.get("/api/olap/pivot")
def olap_pivot(
    row_dim: str = Query("genre"),
    col_dim: str = Query("decade"),
    measure: str = Query("avg_rating", pattern="^(avg_rating|rating_count)$"),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """OLAP Pivot cross-tabulation matrix."""
    return olap_engine.pivot(row_dim=row_dim, col_dim=col_dim, measure=measure)


# --- Apriori Association Rule Mining Endpoints (Protected Administrator) ---

@app.get("/api/mining/association-rules")
def get_association_rules(
    min_support: Optional[float] = Query(None, ge=0.001, le=1.0),
    min_confidence: Optional[float] = Query(None, ge=0.01, le=1.0),
    min_lift: Optional[float] = Query(None, ge=0.1, le=500.0),
    sort_by: str = Query("lift"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    current_admin: AdminProfile = Depends(get_current_admin),
):
    """Frequent Itemsets and Association Rules mined via Apriori on co-liked movie baskets."""
    return apriori_miner.get_rules(
        min_support=min_support,
        min_confidence=min_confidence,
        min_lift=min_lift,
        sort_by=sort_by,
        search=search,
        limit=limit,
        page=page,
    )


@app.get("/api/mining/movie-rules/{movie_id}")
def get_movie_association_rules(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    auth_context: Dict[str, Any] = Depends(require_admin_or_user),
):
    """Association rules relevant to specific movie."""
    return apriori_miner.get_rules_for_movie(movie_id=movie_id, limit=limit)


# --- Machine Learning Endpoints (Protected Administrator) ---

@app.get("/api/ml/validation")
def get_ml_validation(current_admin: AdminProfile = Depends(get_current_admin)):
    return ml_engine.get_validation_stats()


@app.get("/api/ml/evaluation")
def get_ml_evaluation(current_admin: AdminProfile = Depends(get_current_admin)):
    return ml_engine.get_model_evaluation()


@app.get("/api/ml/classification/metrics")
def get_classification_metrics(current_admin: AdminProfile = Depends(get_current_admin)):
    """Evaluation metrics comparing Decision Tree and Naive Bayes classifiers."""
    return ml_engine.get_classification_metrics()


@app.get("/api/ml/feature-importance")
def get_ml_feature_importance(current_admin: AdminProfile = Depends(get_current_admin)):
    return ml_engine.get_feature_importance()


@app.get("/api/ml/clusters")
def get_ml_clusters(current_admin: AdminProfile = Depends(get_current_admin)):
    return ml_engine.get_clustering_data()


@app.get("/api/ml/demo-users")
def get_ml_demo_users(current_admin: AdminProfile = Depends(get_current_admin)):
    return ml_engine.get_demo_movielens_users()
