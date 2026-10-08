"""
Offline Recommendation System Evaluation Suite for MovieMind.
Calculates Precision@K, Recall@K, NDCG@K, and Catalog Coverage on held-out test interactions.
"""
from collections import defaultdict
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
import pandas as pd

from app.config import BASE_DIR, RATINGS_CSV
from app.data_loader import data_loader
from app.recommender.collaborative import CollaborativeRecommender
from app.recommender.content_based import ContentBasedRecommender
from app.recommender.hybrid import HybridRecommender

logger = logging.getLogger("MovieMind.Evaluation")
EVAL_FILE = BASE_DIR / "models" / "recommender_evaluation.joblib"


def calculate_dcg(hits: List[int], k: int) -> float:
    dcg = 0.0
    for i in range(min(k, len(hits))):
        if hits[i] == 1:
            dcg += 1.0 / math.log2(i + 2)
    return dcg


def calculate_idcg(num_relevant: int, k: int) -> float:
    idcg = 0.0
    for i in range(min(k, num_relevant)):
        idcg += 1.0 / math.log2(i + 2)
    return idcg if idcg > 0 else 1.0


class RecommenderEvaluator:
    def __init__(self):
        self.results: Dict[str, Any] = {}
        self.is_computed = False

    def evaluate(
        self,
        content_engine: ContentBasedRecommender,
        collab_engine: CollaborativeRecommender,
        hybrid_engine: HybridRecommender,
        sample_users_count: int = 150
    ) -> Dict[str, Any]:
        """
        Runs rigorous offline evaluation on a time-aware train/test split.
        """
        logger.info("Starting Offline Recommendation Engine Benchmark Evaluation...")
        
        ratings_df = pd.read_csv(RATINGS_CSV)
        if "timestamp" in ratings_df.columns:
            ratings_sorted = ratings_df.sort_values("timestamp").reset_index(drop=True)
        else:
            ratings_sorted = ratings_df

        split_idx = int(len(ratings_sorted) * 0.8)
        train_df = ratings_sorted.iloc[:split_idx]
        test_df = ratings_sorted.iloc[split_idx:]

        # Extract relevant items in test set per user (rating >= 3.5)
        test_relevant = defaultdict(set)
        for _, row in test_df[test_df["rating"] >= 3.5].iterrows():
            test_relevant[int(row["userId"])].add(int(row["movieId"]))

        # Extract seed items from train set
        train_liked = defaultdict(list)
        for _, row in train_df[train_df["rating"] >= 4.0].iterrows():
            train_liked[int(row["userId"])].append(int(row["movieId"]))

        eval_users = [u for u in test_relevant.keys() if u in train_liked and len(test_relevant[u]) >= 2]
        if len(eval_users) > sample_users_count:
            np.random.seed(42)
            eval_users = list(np.random.choice(eval_users, size=sample_users_count, replace=False))

        total_eval_users = len(eval_users)
        logger.info(f"Evaluating algorithms across {total_eval_users} test users...")

        # Extract top popular movies from training set for Popularity baseline
        train_popular = (
            train_df[train_df["rating"] >= 3.5]
            .groupby("movieId")
            .agg(count=("rating", "count"), avg=("rating", "mean"))
            .sort_values(by=["count", "avg"], ascending=False)
            .head(30)
            .index.tolist()
        )

        k_values = [5, 10, 20]
        models = {
            "popularity": {"name": "Popularity Baseline (Top-Rated in Train)", "type": "baseline"},
            "content_based": {"name": "Content-Based Filtering (TF-IDF)", "engine": content_engine, "type": "content"},
            "collaborative": {"name": "Item-Item Collaborative (Sparse CSR)", "engine": collab_engine, "type": "collab"},
            "hybrid": {"name": "Weighted Hybrid (40% Content + 60% Collab)", "engine": hybrid_engine, "type": "hybrid"}
        }

        metrics_by_model = {}
        all_movies_count = len(data_loader.movies_df)

        for m_key, m_info in models.items():
            precision_acc = {k: [] for k in k_values}
            recall_acc = {k: [] for k in k_values}
            ndcg_acc = {k: [] for k in k_values}
            all_recommended_items = set()

            for uid in eval_users:
                seeds = train_liked[uid]
                ground_truth = test_relevant[uid]
                if not seeds or not ground_truth:
                    continue

                if m_key == "popularity":
                    # Recommends most popular items not already rated in train by user
                    user_train_seen = set(train_df[train_df["userId"] == uid]["movieId"])
                    rec_ids = [m for m in train_popular if m not in user_train_seen][:20]
                else:
                    seed_id = seeds[0]
                    recs = m_info["engine"].get_recommendations(movie_id=seed_id, top_n=20)
                    rec_ids = [r["movieId"] for r in recs]

                all_recommended_items.update(rec_ids)
                hits = [1 if r_id in ground_truth else 0 for r_id in rec_ids]

                for k in k_values:
                    top_k_hits = hits[:k]
                    num_hits = sum(top_k_hits)
                    
                    p_k = num_hits / k
                    r_k = num_hits / len(ground_truth) if len(ground_truth) > 0 else 0.0
                    
                    dcg = calculate_dcg(top_k_hits, k)
                    idcg = calculate_idcg(len(ground_truth), k)
                    ndcg_k = dcg / idcg

                    precision_acc[k].append(p_k)
                    recall_acc[k].append(r_k)
                    ndcg_acc[k].append(ndcg_k)

            coverage = round(len(all_recommended_items) / all_movies_count, 4) if all_movies_count > 0 else 0.0

            metrics_by_model[m_key] = {
                "name": m_info["name"],
                "precision_5": float(round(np.mean(precision_acc[5]) if precision_acc[5] else 0.0, 4)),
                "precision_10": float(round(np.mean(precision_acc[10]) if precision_acc[10] else 0.0, 4)),
                "precision_20": float(round(np.mean(precision_acc[20]) if precision_acc[20] else 0.0, 4)),
                "recall_5": float(round(np.mean(recall_acc[5]) if recall_acc[5] else 0.0, 4)),
                "recall_10": float(round(np.mean(recall_acc[10]) if recall_acc[10] else 0.0, 4)),
                "recall_20": float(round(np.mean(recall_acc[20]) if recall_acc[20] else 0.0, 4)),
                "ndcg_5": float(round(np.mean(ndcg_acc[5]) if ndcg_acc[5] else 0.0, 4)),
                "ndcg_10": float(round(np.mean(ndcg_acc[10]) if ndcg_acc[10] else 0.0, 4)),
                "ndcg_20": float(round(np.mean(ndcg_acc[20]) if ndcg_acc[20] else 0.0, 4)),
                "catalog_coverage": coverage
            }

        total_ratings = len(ratings_sorted)
        total_users = ratings_sorted["userId"].nunique()
        total_movies = all_movies_count
        density = round(total_ratings / (total_users * total_movies), 6) if (total_users * total_movies) > 0 else 0.0

        self.results = {
            "status": "success",
            "evaluated_users_count": total_eval_users,
            "test_split_ratio": 0.20,
            "dataset_context": {
                "total_ratings": total_ratings,
                "train_ratings": len(train_df),
                "test_ratings": len(test_df),
                "total_users": total_users,
                "total_movies": total_movies,
                "matrix_density_pct": round(density * 100, 4),
                "relevance_threshold": "Rating >= 3.5 stars in held-out test split"
            },
            "models_comparison": metrics_by_model,
            "k_values": k_values
        }
        self.is_computed = True

        EVAL_FILE.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.results, EVAL_FILE)
        logger.info("Recommendation evaluation complete!")
        return self.results

    def load_or_compute(
        self,
        content_engine: ContentBasedRecommender,
        collab_engine: CollaborativeRecommender,
        hybrid_engine: HybridRecommender
    ) -> Dict[str, Any]:
        if EVAL_FILE.exists():
            self.results = joblib.load(EVAL_FILE)
            self.is_computed = True
            return self.results
        return self.evaluate(content_engine, collab_engine, hybrid_engine)


recommender_evaluator = RecommenderEvaluator()
