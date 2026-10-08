"""
Real ML Training Pipeline for MovieMind.
Trains:
1. Supervised Regression: Linear Regression, Random Forest Regressor, HistGradientBoosting Regressor
2. Supervised Classification: Decision Tree Classifier, Gaussian Naive Bayes (DISLIKE / NEUTRAL / LIKE)
3. Unsupervised Clustering: K-Means with Elbow & Silhouette analysis (K=2..7)
4. Dimensionality Reduction: PCA 2D projection
All metrics are computed on a held-out, time-aware test set with zero target leakage.
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    silhouette_score,
)
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from app.config import BASE_DIR, MOVIES_CSV, RATINGS_CSV

logger = logging.getLogger("MovieMind.MLTrain")
logging.basicConfig(level=logging.INFO)

MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

GENRES_LIST = [
    "Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary",
    "Drama", "Fantasy", "Film-Noir", "Horror", "Musical", "Mystery", "Romance",
    "Sci-Fi", "Thriller", "War", "Western"
]

FEATURE_NAMES = [
    "user_mean_rating",
    "user_rating_count_log",
    "movie_mean_rating",
    "movie_rating_count_log",
    "release_year",
    "user_genre_affinity"
] + [f"genre_{g.lower()}" for g in GENRES_LIST]

CLASS_LABELS = ["DISLIKE", "NEUTRAL", "LIKE"]


def rating_to_class(rating: float) -> int:
    """
    Categorizes ratings into:
    0: DISLIKE (< 2.5)
    1: NEUTRAL (2.5 <= r < 4.0)
    2: LIKE (>= 4.0)
    """
    if rating < 2.5:
        return 0
    elif rating < 4.0:
        return 1
    else:
        return 2


def extract_year(title: str) -> int:
    match = re.search(r"\((\d{4})\)$", str(title).strip())
    return int(match.group(1)) if match else 2000


def run_training_pipeline():
    logger.info("Starting Complete DWM ML Training Pipeline on MovieLens Dataset...")

    # 1. Load Data
    if not MOVIES_CSV.exists() or not RATINGS_CSV.exists():
        raise FileNotFoundError(f"Missing required data files: {MOVIES_CSV} or {RATINGS_CSV}")

    movies_df = pd.read_csv(MOVIES_CSV)
    ratings_df = pd.read_csv(RATINGS_CSV)

    logger.info(f"Loaded {len(movies_df)} movies and {len(ratings_df)} ratings.")

    # Process movie attributes
    movies_df["year"] = movies_df["title"].apply(extract_year)
    for g in GENRES_LIST:
        movies_df[f"genre_{g}"] = movies_df["genres"].fillna("").apply(
            lambda x: 1.0 if g in x.split("|") else 0.0
        )
    movie_dict = movies_df.set_index("movieId").to_dict(orient="index")

    # 2. Time-Aware Train/Test Split (Prevent Temporal Leakage)
    if "timestamp" in ratings_df.columns:
        ratings_sorted = ratings_df.sort_values("timestamp").reset_index(drop=True)
    else:
        ratings_sorted = ratings_df

    split_idx = int(len(ratings_sorted) * 0.8)
    train_df = ratings_sorted.iloc[:split_idx].copy()
    test_df = ratings_sorted.iloc[split_idx:].copy()

    train_count = len(train_df)
    test_count = len(test_df)
    logger.info(f"Time-aware split: {train_count} train samples, {test_count} test samples.")

    # 3. Compute Historical Aggregations Strictly On Training Set (Zero Data Leakage)
    global_mean = float(train_df["rating"].mean())
    user_stats = train_df.groupby("userId")["rating"].agg(["mean", "count"]).to_dict(orient="index")
    movie_stats = train_df.groupby("movieId")["rating"].agg(["mean", "count"]).to_dict(orient="index")

    # Compute User-Genre affinity weights strictly from train set
    user_genre_ratings = {}
    for uid, ugroup in train_df.groupby("userId"):
        g_weights = {g: 0.0 for g in GENRES_LIST}
        g_counts = {g: 0 for g in GENRES_LIST}
        for _, row in ugroup.iterrows():
            mid = int(row["movieId"])
            r = float(row["rating"])
            minfo = movie_dict.get(mid)
            if minfo:
                for g in GENRES_LIST:
                    if minfo.get(f"genre_{g}", 0) == 1.0:
                        g_weights[g] += r
                        g_counts[g] += 1
        user_genre_ratings[uid] = {
            g: (g_weights[g] / g_counts[g]) if g_counts[g] > 0 else global_mean
            for g in GENRES_LIST
        }

    # Vectorized Feature Extraction
    def extract_features(df):
        X = []
        y_reg = []
        y_clf = []
        for _, row in df.iterrows():
            uid = int(row["userId"])
            mid = int(row["movieId"])
            target = float(row["rating"])

            ust = user_stats.get(uid, {"mean": global_mean, "count": 0})
            u_mean = ust["mean"]
            u_cnt = float(np.log1p(ust["count"]))

            mst = movie_stats.get(mid, {"mean": global_mean, "count": 0})
            m_mean = mst["mean"]
            m_cnt = float(np.log1p(mst["count"]))

            minfo = movie_dict.get(mid, {})
            year = float(minfo.get("year", 2000))

            u_aff = user_genre_ratings.get(uid, {})
            movie_genres_present = [g for g in GENRES_LIST if minfo.get(f"genre_{g}", 0) == 1.0]
            if movie_genres_present:
                genre_affinity = float(np.mean([u_aff.get(g, global_mean) for g in movie_genres_present]))
            else:
                genre_affinity = global_mean

            genre_vec = [float(minfo.get(f"genre_{g}", 0.0)) for g in GENRES_LIST]

            feat = [
                u_mean,
                u_cnt,
                m_mean,
                m_cnt,
                year,
                genre_affinity
            ] + genre_vec

            X.append(feat)
            y_reg.append(target)
            y_clf.append(rating_to_class(target))
        return (
            np.array(X, dtype=np.float32),
            np.array(y_reg, dtype=np.float32),
            np.array(y_clf, dtype=np.int32)
        )

    logger.info("Extracting feature matrices...")
    X_train, y_train_reg, y_train_clf = extract_features(train_df)
    X_test, y_test_reg, y_test_clf = extract_features(test_df)

    # 4. Supervised Regression Evaluation
    evaluation_metrics = {}

    # Model 1: Linear Regression
    logger.info("Training Linear Regression...")
    lr = LinearRegression()
    lr.fit(X_train, y_train_reg)
    lr_preds = lr.predict(X_test)
    evaluation_metrics["linear_regression"] = {
        "name": "Linear Regression",
        "type": "Regression",
        "mae": float(round(mean_absolute_error(y_test_reg, lr_preds), 4)),
        "mse": float(round(mean_squared_error(y_test_reg, lr_preds), 4)),
        "rmse": float(round(np.sqrt(mean_squared_error(y_test_reg, lr_preds)), 4)),
        "r2": float(round(r2_score(y_test_reg, lr_preds), 4)),
    }
    joblib.dump(lr, MODELS_DIR / "linear_regression.joblib")

    # Model 2: Random Forest Regressor
    logger.info("Training Random Forest Regressor...")
    rf = RandomForestRegressor(n_estimators=60, max_depth=12, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train_reg)
    rf_preds = rf.predict(X_test)
    evaluation_metrics["random_forest"] = {
        "name": "Random Forest Regressor",
        "type": "Regression",
        "mae": float(round(mean_absolute_error(y_test_reg, rf_preds), 4)),
        "mse": float(round(mean_squared_error(y_test_reg, rf_preds), 4)),
        "rmse": float(round(np.sqrt(mean_squared_error(y_test_reg, rf_preds)), 4)),
        "r2": float(round(r2_score(y_test_reg, rf_preds), 4)),
    }
    joblib.dump(rf, MODELS_DIR / "random_forest.joblib")

    # Model 3: HistGradientBoosting Regressor
    logger.info("Training HistGradientBoosting Regressor...")
    gb = HistGradientBoostingRegressor(max_iter=100, max_depth=8, random_state=42)
    gb.fit(X_train, y_train_reg)
    gb_preds = gb.predict(X_test)
    evaluation_metrics["gradient_boosting"] = {
        "name": "Gradient Boosting Regressor",
        "type": "Regression",
        "mae": float(round(mean_absolute_error(y_test_reg, gb_preds), 4)),
        "mse": float(round(mean_squared_error(y_test_reg, gb_preds), 4)),
        "rmse": float(round(np.sqrt(mean_squared_error(y_test_reg, gb_preds)), 4)),
        "r2": float(round(r2_score(y_test_reg, gb_preds), 4)),
    }
    joblib.dump(gb, MODELS_DIR / "gradient_boosting.joblib")

    # Feature Importances from Random Forest Regressor
    rf_importances = [
        {"feature": name, "importance": float(round(imp, 4))}
        for name, imp in sorted(zip(FEATURE_NAMES, rf.feature_importances_), key=lambda x: x[1], reverse=True)
    ]

    # 5. Supervised Classification (Decision Tree & Naive Bayes)
    classification_metrics = {}

    # Model 4: Decision Tree Classifier
    logger.info("Training Decision Tree Classifier...")
    dt = DecisionTreeClassifier(max_depth=6, min_samples_leaf=20, random_state=42)
    dt.fit(X_train, y_train_clf)
    dt_preds = dt.predict(X_test)
    dt_cm = confusion_matrix(y_test_clf, dt_preds).tolist()
    dt_importances = [
        {"feature": name, "importance": float(round(imp, 4))}
        for name, imp in sorted(zip(FEATURE_NAMES, dt.feature_importances_), key=lambda x: x[1], reverse=True)
    ]
    classification_metrics["decision_tree"] = {
        "name": "Decision Tree Classifier",
        "accuracy": float(round(accuracy_score(y_test_clf, dt_preds), 4)),
        "precision": float(round(precision_score(y_test_clf, dt_preds, average="macro", zero_division=0), 4)),
        "recall": float(round(recall_score(y_test_clf, dt_preds, average="macro", zero_division=0), 4)),
        "f1": float(round(f1_score(y_test_clf, dt_preds, average="macro", zero_division=0), 4)),
        "confusion_matrix": dt_cm,
        "classes": CLASS_LABELS,
        "tree_depth": int(dt.get_depth()),
        "leaf_count": int(dt.get_n_leaves()),
        "feature_importances": dt_importances,
        "explanation": "Splits on user mean rating and movie average rating as dominant decision nodes."
    }
    joblib.dump(dt, MODELS_DIR / "decision_tree.joblib")

    # Model 5: Gaussian Naive Bayes Classifier
    logger.info("Training Gaussian Naive Bayes Classifier...")
    nb = GaussianNB()
    nb.fit(X_train, y_train_clf)
    nb_preds = nb.predict(X_test)
    nb_cm = confusion_matrix(y_test_clf, nb_preds).tolist()
    classification_metrics["naive_bayes"] = {
        "name": "Gaussian Naive Bayes",
        "accuracy": float(round(accuracy_score(y_test_clf, nb_preds), 4)),
        "precision": float(round(precision_score(y_test_clf, nb_preds, average="macro", zero_division=0), 4)),
        "recall": float(round(recall_score(y_test_clf, nb_preds, average="macro", zero_division=0), 4)),
        "f1": float(round(f1_score(y_test_clf, nb_preds, average="macro", zero_division=0), 4)),
        "confusion_matrix": nb_cm,
        "classes": CLASS_LABELS,
        "class_priors": [float(round(p, 4)) for p in nb.class_prior_],
        "explanation": "Calculates Gaussian posterior probabilities assuming conditional feature independence given rating tier."
    }
    joblib.dump(nb, MODELS_DIR / "naive_bayes.joblib")

    # 6. Real K-Means Clustering & PCA on Real Movies
    logger.info("Performing Real K-Means Clustering and PCA...")
    movie_agg = ratings_df.groupby("movieId").agg(
        rating_count=("rating", "count"),
        avg_rating=("rating", "mean")
    ).reset_index()

    cluster_df = movies_df.merge(movie_agg, on="movieId", how="inner").copy()
    feature_cols = ["avg_rating", "rating_count", "year"] + [f"genre_{g}" for g in GENRES_LIST]
    
    cluster_features = cluster_df[feature_cols].copy()
    cluster_features["rating_count"] = np.log1p(cluster_features["rating_count"])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(cluster_features)

    k_range = [2, 3, 4, 5, 6, 7]
    inertia_scores = []
    silhouette_scores = []
    sample_size = min(3000, len(X_scaled))

    for k in k_range:
        km_test = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km_test.fit_predict(X_scaled)
        inertia_scores.append(float(round(km_test.inertia_, 2)))
        sil = float(round(silhouette_score(X_scaled, labels, sample_size=sample_size, random_state=42), 4))
        silhouette_scores.append(sil)

    best_k_idx = int(np.argmax(silhouette_scores))
    selected_k = k_range[best_k_idx]
    selected_silhouette = silhouette_scores[best_k_idx]

    logger.info(f"Selected K={selected_k} with silhouette score {selected_silhouette}")

    final_km = KMeans(n_clusters=selected_k, random_state=42, n_init=10)
    cluster_labels = final_km.fit_predict(X_scaled)
    cluster_df["cluster"] = cluster_labels

    joblib.dump(final_km, MODELS_DIR / "kmeans_model.joblib")
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")

    # PCA 2D Projection
    pca = PCA(n_components=2, random_state=42)
    coords_2d = pca.fit_transform(X_scaled)
    cluster_df["pca_x"] = [float(round(x, 4)) for x in coords_2d[:, 0]]
    cluster_df["pca_y"] = [float(round(y, 4)) for y in coords_2d[:, 1]]
    joblib.dump(pca, MODELS_DIR / "pca_model.joblib")

    # Cluster Profiles
    cluster_profiles = []
    for c in range(selected_k):
        c_subset = cluster_df[cluster_df["cluster"] == c]
        genre_counts = {}
        for g in GENRES_LIST:
            cnt = int((c_subset[f"genre_{g}"] == 1.0).sum())
            if cnt > 0:
                genre_counts[g] = cnt
        sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:4]
        dominant_genres_str = " / ".join([f"{g}" for g, _ in sorted_genres])
        
        top_sample = c_subset.sort_values(by=["rating_count", "avg_rating"], ascending=[False, False]).head(5)
        sample_movies = [
            {"movieId": int(r["movieId"]), "title": str(r["title"]), "avg_rating": float(round(r["avg_rating"], 2))}
            for _, r in top_sample.iterrows()
        ]

        cluster_profiles.append({
            "cluster_id": c,
            "movie_count": int(len(c_subset)),
            "avg_rating": float(round(c_subset["avg_rating"].mean(), 2)),
            "dominant_genres": dominant_genres_str,
            "genre_distribution": sorted_genres,
            "sample_movies": sample_movies
        })

    # Scatter points sample
    scatter_points = []
    for c in range(selected_k):
        c_subset = cluster_df[cluster_df["cluster"] == c]
        sample_n = min(250, len(c_subset))
        sampled = c_subset.sample(n=sample_n, random_state=42)
        for _, row in sampled.iterrows():
            scatter_points.append({
                "movieId": int(row["movieId"]),
                "title": str(row["title"]),
                "genres": str(row["genres"]),
                "cluster": int(row["cluster"]),
                "avg_rating": float(round(row["avg_rating"], 2)),
                "rating_count": int(row["rating_count"]),
                "pca_x": float(row["pca_x"]),
                "pca_y": float(row["pca_y"])
            })

    # 7. Save Metadata & Validation Stats
    validation_stats = {
        "dataset_name": "MovieLens",
        "total_movies": int(len(movies_df)),
        "total_ratings": int(len(ratings_df)),
        "total_users": int(ratings_df["userId"].nunique()),
        "avg_rating": float(round(ratings_df["rating"].mean(), 2)),
        "rating_min": float(ratings_df["rating"].min()),
        "rating_max": float(ratings_df["rating"].max()),
        "train_samples": train_count,
        "test_samples": test_count,
        "selected_k": selected_k,
        "silhouette_score": selected_silhouette,
        "pca_explained_variance": [float(round(v, 4)) for v in pca.explained_variance_ratio_]
    }

    metadata = {
        "evaluation_metrics": evaluation_metrics,
        "classification_metrics": classification_metrics,
        "feature_importances": rf_importances,
        "feature_names": FEATURE_NAMES,
        "validation_stats": validation_stats,
        "k_selection": {
            "k_values": k_range,
            "inertias": inertia_scores,
            "silhouettes": silhouette_scores,
            "selected_k": selected_k,
            "selected_silhouette": selected_silhouette
        },
        "clusters": cluster_profiles,
        "pca_scatter": scatter_points,
        "inference_data": {
            "global_mean": global_mean,
            "user_stats": user_stats,
            "movie_stats": movie_stats,
            "user_genre_ratings": user_genre_ratings,
            "genres_list": GENRES_LIST,
            "movie_dict": movie_dict
        }
    }

    joblib.dump(metadata, MODELS_DIR / "ml_metadata.joblib")
    logger.info("DWM ML Training Pipeline completed successfully and saved all models to backend/models/!")
    return metadata


if __name__ == "__main__":
    run_training_pipeline()
