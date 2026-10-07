from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import logging

from pydantic import BaseModel, Field

from app.auth import LoginRequest, TokenResponse, UserCreate, UserResponse, get_current_user, login_user, register_user
from app.config import CONTENT_WEIGHT, COLLABORATIVE_WEIGHT, FRONTEND_ORIGINS
from app.database import get_connection, initialize_database
from app.data_loader import data_loader
from app.recommender.content_based import ContentBasedRecommender
from app.recommender.collaborative import CollaborativeRecommender
from app.recommender.hybrid import HybridRecommender
from app.analytics import analytics_engine
from app.ml.engine import ml_engine

logger = logging.getLogger("MovieMind.Main")

# Global recommender instances
content_recommender = ContentBasedRecommender()
collaborative_recommender = CollaborativeRecommender()
hybrid_recommender = HybridRecommender(content_recommender, collaborative_recommender)

class PredictRequest(BaseModel):
    movie_id: int
    model: Optional[str] = "random_forest"
    movielens_user_id: Optional[int] = None

class RateMovieRequest(BaseModel):
    movie_id: int
    rating: float = Field(..., ge=0.5, le=5.0)

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
    
    # 4. Load Real ML Models and Metadata
    ml_engine.load_models()
    
    logger.info("MovieMind Backend Engine Startup Complete!")
    yield
    logger.info("Shutting down MovieMind Backend Engine...")

app = FastAPI(
    title="MovieMind – Hybrid Movie Recommendation System API",
    description="Data Warehousing and Mining (DWM) API combining Content-Based Filtering and Collaborative Filtering",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints ---

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

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "MovieMind Recommendation Engine",
        "dataset_loaded": data_loader.is_loaded,
        "stats": data_loader.stats
    }

@app.get("/api/movies")
def get_movies(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    genre: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    df = data_loader.movies_df
    if genre and genre != "All":
        df = df[df['genres_list'].apply(lambda gl: genre in gl)]
    
    # Order by popularity / rating_count
    df_sorted = df.sort_values(by=['rating_count', 'avg_rating'], ascending=[False, False])
    total_count = len(df_sorted)
    
    paged_df = df_sorted.iloc[offset:offset + limit]
    movies = [data_loader.movie_map[row['movieId']] for _, row in paged_df.iterrows()]
    
    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "movies": movies,
        "genres": data_loader.all_genres
    }

@app.get("/api/movies/search")
def search_movies(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    genre: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    results = data_loader.search_movies(query=q, limit=limit, genre=genre)
    return {
        "query": q,
        "total": len(results),
        "results": results
    }

@app.get("/api/movies/{movie_id}")
def get_movie_details(movie_id: int, current_user: UserResponse = Depends(get_current_user)):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie

@app.get("/api/recommendations/content/{movie_id}")
def get_content_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user: UserResponse = Depends(get_current_user),
):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    recs = content_recommender.get_recommendations(movie_id=movie_id, top_n=limit)
    
    # Enrich with full movie details and exposed component/hybrid scores
    enriched_recs = []
    for r in recs:
        m = data_loader.get_movie(r['movieId'])
        if m:
            c_score = float(round(r['score'], 4))
            cb_score = float(round(collaborative_recommender.get_similarity(movie_id, r['movieId']), 4))
            h_score = float(round((CONTENT_WEIGHT * c_score) + (COLLABORATIVE_WEIGHT * cb_score), 4))
            enriched_recs.append({
                **m,
                "content_score": c_score,
                "collaborative_score": cb_score,
                "hybrid_score": h_score,
                "explanation": r['explanation']
            })
            
    return {
        "movie": movie,
        "type": "content_based",
        "algorithm": "TF-IDF Genre Representation + Cosine Similarity",
        "count": len(enriched_recs),
        "recommendations": enriched_recs
    }

@app.get("/api/recommendations/collaborative/{movie_id}")
def get_collaborative_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user: UserResponse = Depends(get_current_user),
):
    movie = data_loader.get_movie(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    recs = collaborative_recommender.get_recommendations(movie_id=movie_id, top_n=limit)
    
    enriched_recs = []
    for r in recs:
        m = data_loader.get_movie(r['movieId'])
        if m:
            cb_score = float(round(r['score'], 4))
            c_score = float(round(content_recommender.get_similarity(movie_id, r['movieId']), 4))
            h_score = float(round((CONTENT_WEIGHT * c_score) + (COLLABORATIVE_WEIGHT * cb_score), 4))
            enriched_recs.append({
                **m,
                "content_score": c_score,
                "collaborative_score": cb_score,
                "hybrid_score": h_score,
                "explanation": r['explanation']
            })
            
    return {
        "movie": movie,
        "type": "collaborative_filtering",
        "algorithm": "Item-Item Collaborative Filtering (Sparse Matrix Cosine Similarity)",
        "count": len(enriched_recs),
        "recommendations": enriched_recs
    }


@app.get("/api/recommendations/hybrid/{movie_id}")
def get_hybrid_recommendations(
    movie_id: int,
    limit: int = Query(10, ge=1, le=50),
    content_w: Optional[float] = Query(None, ge=0.0, le=1.0),
    collab_w: Optional[float] = Query(None, ge=0.0, le=1.0),
    current_user: UserResponse = Depends(get_current_user),
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
        collab_w=cbw
    )
    
    # Enrich with dynamically calculated ML prediction for the user
    for r in recs:
        try:
            pred_res = ml_engine.predict_rating(movie_id=r["movieId"], app_user_id=current_user.id)
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
            "collaborative": cbw
        },
        "count": len(recs),
        "recommendations": recs
    }

@app.get("/api/analytics/overview")
def get_analytics_overview(current_user: UserResponse = Depends(get_current_user)):
    return analytics_engine.get_overview()

@app.get("/api/analytics/popular")
def get_analytics_popular(limit: int = Query(10, ge=1, le=20), current_user: UserResponse = Depends(get_current_user)):
    return analytics_engine.get_popular(limit=limit)

@app.get("/api/analytics/genres")
def get_analytics_genres(current_user: UserResponse = Depends(get_current_user)):
    return analytics_engine.get_genres()

@app.get("/api/analytics/ratings")
def get_analytics_ratings(current_user: UserResponse = Depends(get_current_user)):
    return analytics_engine.get_ratings_distribution()

# --- Real Machine Learning Endpoints ---

@app.get("/api/ml/validation")
def get_ml_validation(current_user: UserResponse = Depends(get_current_user)):
    """Returns dataset summary statistics and validation parameters."""
    return ml_engine.get_validation_stats()

@app.get("/api/ml/evaluation")
def get_ml_evaluation(current_user: UserResponse = Depends(get_current_user)):
    """Returns evaluation metrics (MAE, MSE, RMSE, R2) calculated on the held-out test set."""
    return ml_engine.get_model_evaluation()

@app.get("/api/ml/feature-importance")
def get_ml_feature_importance(current_user: UserResponse = Depends(get_current_user)):
    """Returns feature importances computed by the Random Forest model."""
    return ml_engine.get_feature_importance()

@app.get("/api/ml/clusters")
def get_ml_clusters(current_user: UserResponse = Depends(get_current_user)):
    """Returns K-Means cluster profiles, inertia/silhouette curves, and 2D PCA points."""
    return ml_engine.get_clustering_data()

@app.get("/api/ml/demo-users")
def get_ml_demo_users(current_user: UserResponse = Depends(get_current_user)):
    """Returns real MovieLens user profiles available for academic demonstration."""
    return ml_engine.get_demo_movielens_users()

@app.get("/api/ml/user-profile")
def get_ml_user_profile(current_user: UserResponse = Depends(get_current_user)):
    """Returns current user's rating history and MovieLens link status."""
    history = ml_engine.get_app_user_history(current_user.id)
    enriched_ratings = []
    for r in history["custom_ratings"]:
        m = data_loader.get_movie(r["movie_id"])
        enriched_ratings.append({
            **r,
            "title": m["title"] if m else f"Movie {r['movie_id']}",
            "genres": m["genres"] if m else ""
        })
    return {
        "app_user_id": current_user.id,
        "username": current_user.username,
        "linked_movielens_user_id": history["linked_movielens_user_id"],
        "custom_ratings_count": history["custom_ratings_count"],
        "custom_ratings": enriched_ratings
    }

@app.post("/api/ml/link-movielens-user")
def link_movielens_user(payload: LinkMovieLensUserRequest, current_user: UserResponse = Depends(get_current_user)):
    """Links the current MovieMind account to a real MovieLens user profile."""
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO user_movielens_mapping (user_id, movielens_user_id) VALUES (?, ?)",
            (current_user.id, payload.movielens_user_id)
        )
    return {"status": "success", "linked_movielens_user_id": payload.movielens_user_id}

@app.post("/api/ml/rate-movie")
def rate_movie(payload: RateMovieRequest, current_user: UserResponse = Depends(get_current_user)):
    """Saves a real rating from the user into SQLite to solve cold start."""
    movie = data_loader.get_movie(payload.movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found in MovieLens dataset")
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO user_ratings (user_id, movie_id, rating) VALUES (?, ?, ?)",
            (current_user.id, payload.movie_id, payload.rating)
        )
    return {"status": "success", "movie_id": payload.movie_id, "rating": payload.rating, "title": movie["title"]}

@app.post("/api/ml/predict-rating")
def predict_rating_endpoint(payload: PredictRequest, current_user: UserResponse = Depends(get_current_user)):
    """Generates real rating prediction for target movie using user history and trained model."""
    result = ml_engine.predict_rating(
        movie_id=payload.movie_id,
        model_name=payload.model or "random_forest",
        app_user_id=current_user.id,
        movielens_user_id=payload.movielens_user_id
    )
    return result

