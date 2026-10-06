import numpy as np
import logging
from typing import List, Dict, Any
from app.config import CONTENT_WEIGHT, COLLABORATIVE_WEIGHT
from app.data_loader import data_loader
from app.recommender.content_based import ContentBasedRecommender
from app.recommender.collaborative import CollaborativeRecommender

logger = logging.getLogger("MovieMind.Hybrid")

class HybridRecommender:
    """
    Academically Explainable Data Warehousing & Mining (DWM) Hybrid Recommendation Engine.
    
    Formula:
        HybridScore = CONTENT_WEIGHT * normalized_content_score + COLLABORATIVE_WEIGHT * normalized_collaborative_score
        
    Where:
        CONTENT_WEIGHT = 0.4 (Initial Baseline Configuration)
        COLLABORATIVE_WEIGHT = 0.6 (Initial Baseline Configuration)
        
    Note: The 0.4 / 0.6 weighting is an empirical baseline configuration for balancing content similarity
    and collaborative filtering signals, and is not claimed to be a globally optimal constant.
    """
    def __init__(self, content_engine: ContentBasedRecommender, collab_engine: CollaborativeRecommender):
        self.content_engine = content_engine
        self.collab_engine = collab_engine
        self.content_weight = CONTENT_WEIGHT
        self.collab_weight = COLLABORATIVE_WEIGHT

    def get_recommendations(
        self,
        movie_id: int,
        top_n: int = 10,
        content_w: float = None,
        collab_w: float = None
    ) -> List[Dict[str, Any]]:
        w_content = content_w if content_w is not None else self.content_weight
        w_collab = collab_w if collab_w is not None else self.collab_weight
        
        # Normalize weights so w_content + w_collab = 1.0
        total_w = w_content + w_collab
        if total_w > 0:
            w_content = w_content / total_w
            w_collab = w_collab / total_w
        else:
            w_content, w_collab = CONTENT_WEIGHT, COLLABORATIVE_WEIGHT

        # 1. Fetch top candidate recommendations from Content-Based & Collaborative engines
        content_candidates = self.content_engine.get_recommendations(movie_id, top_n=50)
        collab_candidates = self.collab_engine.get_recommendations(movie_id, top_n=50)

        # Build candidate pool (excluding query movie itself)
        candidate_ids = set()
        for r in content_candidates:
            candidate_ids.add(r['movieId'])
        for r in collab_candidates:
            candidate_ids.add(r['movieId'])

        if movie_id in candidate_ids:
            candidate_ids.remove(movie_id)

        if not candidate_ids:
            return []

        # 2. Extract raw pairwise similarity scores for all candidate movies
        raw_candidates = []
        for cid in candidate_ids:
            raw_c = self.content_engine.get_similarity(movie_id, cid)
            raw_cb = self.collab_engine.get_similarity(movie_id, cid)
            raw_candidates.append({
                "movieId": cid,
                "raw_c": raw_c,
                "raw_cb": raw_cb
            })

        # Find maximum component scores in candidate set for min-max / max normalization
        max_c = max([item['raw_c'] for item in raw_candidates], default=1.0) or 1.0
        max_cb = max([item['raw_cb'] for item in raw_candidates], default=1.0) or 1.0

        hybrid_results = []
        for item in raw_candidates:
            cid = item['movieId']
            movie_info = data_loader.get_movie(cid)
            if not movie_info:
                continue

            # 3. Normalize component scores onto comparable [0, 1] scales
            normalized_content_score = float(np.clip(item['raw_c'] / max_c if max_c > 0 else 0.0, 0.0, 1.0))
            normalized_collaborative_score = float(np.clip(item['raw_cb'] / max_cb if max_cb > 0 else 0.0, 0.0, 1.0))

            # 4. Compute weighted Hybrid Score (strictly bounded in [0, 1])
            hybrid_score = (w_content * normalized_content_score) + (w_collab * normalized_collaborative_score)
            hybrid_score = float(np.clip(hybrid_score, 0.0, 1.0))

            # Round output scores to 4 decimals for clean API response
            final_c_score = float(round(normalized_content_score, 4))
            final_cb_score = float(round(normalized_collaborative_score, 4))
            final_hybrid_score = float(round(hybrid_score, 4))

            # 5. Generate academic explanation field
            if final_c_score > 0 and final_cb_score > 0:
                explanation = "Recommended because it is similar in genre and matches rating patterns from similar users."
            elif final_c_score > 0:
                explanation = "Recommended because it is similar in genre."
            else:
                explanation = "Recommended because it matches rating patterns from similar users."

            hybrid_results.append({
                "movieId": movie_info["movieId"],
                "title": movie_info["title"],
                "genres": movie_info["genres"],
                "genres_list": movie_info.get("genres_list", []),
                "year": movie_info.get("year"),
                "avg_rating": movie_info.get("avg_rating", 0.0),
                "rating_count": movie_info.get("rating_count", 0),
                "content_score": final_c_score,
                "collaborative_score": final_cb_score,
                "hybrid_score": final_hybrid_score,
                "explanation": explanation
            })

        # 6. Sort recommendations by hybrid_score descending
        hybrid_results.sort(key=lambda x: x['hybrid_score'], reverse=True)
        return hybrid_results[:top_n]

