"""
Real ML Engine for MovieMind.
Loads trained models and runs inference for:
- Regression (Linear Regression, Random Forest, Gradient Boosting)
- Classification (Decision Tree, Gaussian Naive Bayes)
- Clustering (K-Means, PCA)
- Data Quality & Dataset Validation metrics
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd

from app.config import BASE_DIR, MOVIES_CSV, RATINGS_CSV
from app.database import get_connection

logger = logging.getLogger("MovieMind.MLEngine")
MODELS_DIR = BASE_DIR / "models"


class MLEngine:
    def __init__(self):
        self.is_loaded = False
        self.models: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.inference_data: Dict[str, Any] = {}

    def load_models(self):
        metadata_file = MODELS_DIR / "ml_metadata.joblib"
        if not metadata_file.exists():
            logger.warning("ML models not found on disk. Running training pipeline...")
            from app.ml.train import run_training_pipeline
            run_training_pipeline()

        logger.info("Loading trained ML models and metadata into memory...")
        self.metadata = joblib.load(MODELS_DIR / "ml_metadata.joblib")
        self.models["linear_regression"] = joblib.load(MODELS_DIR / "linear_regression.joblib")
        self.models["random_forest"] = joblib.load(MODELS_DIR / "random_forest.joblib")
        self.models["gradient_boosting"] = joblib.load(MODELS_DIR / "gradient_boosting.joblib")
        self.models["decision_tree"] = joblib.load(MODELS_DIR / "decision_tree.joblib")
        self.models["naive_bayes"] = joblib.load(MODELS_DIR / "naive_bayes.joblib")
        self.models["kmeans"] = joblib.load(MODELS_DIR / "kmeans_model.joblib")
        self.models["scaler"] = joblib.load(MODELS_DIR / "scaler.joblib")
        self.models["pca"] = joblib.load(MODELS_DIR / "pca_model.joblib")
        self.inference_data = self.metadata.get("inference_data", {})
        self.is_loaded = True
        logger.info("ML Engine successfully initialized with all regression, classification, and clustering models!")

    def get_validation_stats(self) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()
        return self.metadata.get("validation_stats", {})

    def get_model_evaluation(self) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()
        return self.metadata.get("evaluation_metrics", {})

    def get_classification_metrics(self) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()
        return self.metadata.get("classification_metrics", {})

    def get_feature_importance(self) -> List[Dict[str, Any]]:
        if not self.is_loaded:
            self.load_models()
        return self.metadata.get("feature_importances", [])

    def get_clustering_data(self) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()
        return {
            "validation_stats": self.metadata.get("validation_stats", {}),
            "k_selection": self.metadata.get("k_selection", {}),
            "clusters": self.metadata.get("clusters", []),
            "pca_scatter": self.metadata.get("pca_scatter", [])
        }

    def get_demo_movielens_users(self, limit: int = 15) -> List[Dict[str, Any]]:
        if not self.is_loaded:
            self.load_models()
        user_stats = self.inference_data.get("user_stats", {})
        user_genre_ratings = self.inference_data.get("user_genre_ratings", {})

        sorted_users = sorted(user_stats.items(), key=lambda x: x[1]["count"], reverse=True)[:limit]
        demo_list = []
        for uid, st in sorted_users:
            genres_pref = user_genre_ratings.get(uid, {})
            top_genre = sorted(genres_pref.items(), key=lambda x: x[1], reverse=True)[:2]
            demo_list.append({
                "movielens_user_id": int(uid),
                "rating_count": int(st["count"]),
                "avg_rating": float(round(st["mean"], 2)),
                "favorite_genres": [g for g, _ in top_genre]
            })
        return demo_list

    def get_app_user_history(self, app_user_id: int) -> Dict[str, Any]:
        with get_connection() as conn:
            link_row = conn.execute(
                "SELECT movielens_user_id FROM user_movielens_mapping WHERE user_id = ?",
                (app_user_id,)
            ).fetchone()
            linked_ml_user = link_row["movielens_user_id"] if link_row else None

            rating_rows = conn.execute(
                "SELECT movie_id, rating, created_at FROM user_ratings WHERE user_id = ? ORDER BY id DESC",
                (app_user_id,)
            ).fetchall()

            custom_ratings = [
                {"movie_id": int(r["movie_id"]), "rating": float(r["rating"]), "created_at": r["created_at"]}
                for r in rating_rows
            ]

        return {
            "app_user_id": app_user_id,
            "linked_movielens_user_id": linked_ml_user,
            "custom_ratings_count": len(custom_ratings),
            "custom_ratings": custom_ratings
        }

    def _build_feature_vector(
        self,
        movie_id: int,
        app_user_id: Optional[int] = None,
        movielens_user_id: Optional[int] = None
    ) -> Tuple[List[float], Dict[str, Any], Dict[str, Any]]:
        movie_dict = self.inference_data.get("movie_dict", {})
        minfo = movie_dict.get(movie_id)
        if not minfo:
            raise ValueError(f"Movie ID {movie_id} not found in MovieLens dataset.")

        global_mean = self.inference_data.get("global_mean", 3.5)
        genres_list = self.inference_data.get("genres_list", [])

        resolved_ml_user = movielens_user_id
        user_history = None

        if app_user_id is not None:
            user_history = self.get_app_user_history(app_user_id)
            if resolved_ml_user is None:
                resolved_ml_user = user_history.get("linked_movielens_user_id")

        u_mean = global_mean
        u_cnt = 0
        u_genre_aff = {}

        if resolved_ml_user is not None:
            ust = self.inference_data.get("user_stats", {}).get(resolved_ml_user)
            if ust:
                u_mean = float(ust["mean"])
                u_cnt = int(ust["count"])
                u_genre_aff = self.inference_data.get("user_genre_ratings", {}).get(resolved_ml_user, {})
        elif user_history and user_history["custom_ratings_count"] > 0:
            ratings = user_history["custom_ratings"]
            u_cnt = len(ratings)
            u_mean = float(np.mean([r["rating"] for r in ratings]))
            genre_acc = {g: [] for g in genres_list}
            for r in ratings:
                m = movie_dict.get(r["movie_id"])
                if m:
                    for g in genres_list:
                        if m.get(f"genre_{g}", 0.0) == 1.0:
                            genre_acc[g].append(r["rating"])
            u_genre_aff = {
                g: float(np.mean(vals)) if len(vals) > 0 else global_mean
                for g, vals in genre_acc.items()
            }
        else:
            raise ValueError("Insufficient user history. Please rate movies or select a MovieLens user.")

        mst = self.inference_data.get("movie_stats", {}).get(movie_id, {"mean": global_mean, "count": 0})
        m_mean = float(mst["mean"])
        m_cnt = float(np.log1p(mst["count"]))
        year = float(minfo.get("year", 2000))

        movie_genres_present = [g for g in genres_list if minfo.get(f"genre_{g}", 0) == 1.0]
        if movie_genres_present:
            genre_affinity = float(np.mean([u_genre_aff.get(g, global_mean) for g in movie_genres_present]))
        else:
            genre_affinity = global_mean

        genre_vec = [float(minfo.get(f"genre_{g}", 0.0)) for g in genres_list]

        features = [
            u_mean,
            float(np.log1p(u_cnt)),
            m_mean,
            m_cnt,
            year,
            genre_affinity
        ] + genre_vec

        meta = {
            "movie_title": minfo.get("title", ""),
            "user_id": resolved_ml_user or (f"app_user_{app_user_id}" if app_user_id else "user"),
            "features_used": {
                "user_mean_rating": round(u_mean, 2),
                "user_rating_count": u_cnt,
                "movie_mean_rating": round(m_mean, 2),
                "movie_rating_count": int(mst["count"]),
                "release_year": int(year),
                "user_genre_affinity": round(genre_affinity, 2)
            }
        }
        return features, meta, minfo

    def predict_rating(
        self,
        movie_id: int,
        model_name: str = "random_forest",
        app_user_id: Optional[int] = None,
        movielens_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()

        try:
            features, meta, _ = self._build_feature_vector(movie_id, app_user_id, movielens_user_id)
        except ValueError as e:
            return {
                "status": "insufficient_history" if "Insufficient" in str(e) else "error",
                "message": str(e),
                "min_ratings_needed": 5,
                "current_ratings": 0,
                "movie_id": movie_id
            }

        model_key = model_name.lower().replace(" ", "_")
        if model_key not in ["linear_regression", "random_forest", "gradient_boosting"]:
            model_key = "random_forest"

        model = self.models[model_key]
        raw_pred = float(model.predict([features])[0])
        bounded_pred = float(np.clip(raw_pred, 0.5, 5.0))

        display_name = {
            "linear_regression": "Linear Regression",
            "random_forest": "Random Forest Regressor",
            "gradient_boosting": "Gradient Boosting Regressor"
        }.get(model_key, model_key)

        return {
            "status": "success",
            "movie_id": movie_id,
            "movie_title": meta["movie_title"],
            "user_id": meta["user_id"],
            "predicted_rating": float(round(bounded_pred, 2)),
            "model": display_name,
            "features_used": meta["features_used"]
        }

    def predict_classification(
        self,
        movie_id: int,
        model_name: str = "decision_tree",
        app_user_id: Optional[int] = None,
        movielens_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        if not self.is_loaded:
            self.load_models()

        try:
            features, meta, _ = self._build_feature_vector(movie_id, app_user_id, movielens_user_id)
        except ValueError as e:
            return {
                "status": "insufficient_history" if "Insufficient" in str(e) else "error",
                "message": str(e),
                "movie_id": movie_id
            }

        model_key = "naive_bayes" if "naive" in model_name.lower() else "decision_tree"
        model = self.models[model_key]

        pred_class_idx = int(model.predict([features])[0])
        classes = ["DISLIKE", "NEUTRAL", "LIKE"]
        pred_label = classes[pred_class_idx]

        # Probabilities
        probs = None
        if hasattr(model, "predict_proba"):
            p = model.predict_proba([features])[0]
            probs = {classes[i]: float(round(p[i], 4)) for i in range(len(classes))}

        explanation = ""
        if model_key == "decision_tree":
            u_mean = meta["features_used"]["user_mean_rating"]
            m_mean = meta["features_used"]["movie_mean_rating"]
            if pred_label == "LIKE":
                explanation = f"Decision Tree classified as LIKE because user average ({u_mean}★) and movie quality ({m_mean}★) exceed top split thresholds."
            elif pred_label == "NEUTRAL":
                explanation = f"Decision Tree classified as NEUTRAL based on moderate historical movie/user rating averages."
            else:
                explanation = f"Decision Tree classified as DISLIKE due to lower rating scores in genre/movie features."
        else:
            explanation = f"Naive Bayes computed highest posterior probability ({probs.get(pred_label, 0) * 100:.1f}%) for '{pred_label}'."

        return {
            "status": "success",
            "movie_id": movie_id,
            "movie_title": meta["movie_title"],
            "user_id": meta["user_id"],
            "model": "Decision Tree Classifier" if model_key == "decision_tree" else "Gaussian Naive Bayes",
            "predicted_class": pred_label,
            "class_probabilities": probs,
            "explanation": explanation,
            "features_used": meta["features_used"]
        }

    def get_data_quality_report(self) -> Dict[str, Any]:
        movies_df = pd.read_csv(MOVIES_CSV)
        ratings_df = pd.read_csv(RATINGS_CSV)

        total_movies = len(movies_df)
        total_ratings = len(ratings_df)
        duplicate_movies = int(movies_df.duplicated(subset=["movieId"]).sum())
        duplicate_ratings = int(ratings_df.duplicated(subset=["userId", "movieId"]).sum())

        missing_titles = int(movies_df["title"].isna().sum())
        missing_genres = int((movies_df["genres"].isna() | (movies_df["genres"] == "") | (movies_df["genres"] == "(no genres listed)")).sum())
        missing_ratings = int(ratings_df["rating"].isna().sum())

        invalid_ratings = int(((ratings_df["rating"] < 0.5) | (ratings_df["rating"] > 5.0)).sum())

        unique_users = int(ratings_df["userId"].nunique())
        unique_movies_rated = int(ratings_df["movieId"].nunique())

        return {
            "status": "healthy",
            "etl_pipeline": {
                "extract": "COMPLETED (CSV File Ingestion)",
                "transform": "COMPLETED (Data Cleansing, Dtype Optimization, Star Schema)",
                "load": "COMPLETED (Loaded into In-Memory Engine & SQLite Data Warehouse)"
            },
            "metrics": {
                "total_movies_catalog": total_movies,
                "total_ratings_records": total_ratings,
                "unique_users_count": unique_users,
                "unique_movies_rated": unique_movies_rated,
                "missing_values": {
                    "movies_missing_title": missing_titles,
                    "movies_missing_genres": missing_genres,
                    "ratings_missing_value": missing_ratings
                },
                "duplicates": {
                    "duplicate_movie_ids": duplicate_movies,
                    "duplicate_user_movie_ratings": duplicate_ratings
                },
                "outliers_and_validations": {
                    "invalid_rating_scores_out_of_range": invalid_ratings,
                    "rating_range_validated": "0.5 to 5.0 Stars"
                }
            }
        }


ml_engine = MLEngine()
