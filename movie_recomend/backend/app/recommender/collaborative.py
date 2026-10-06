import numpy as np
import pandas as pd
import scipy.sparse as sp
import logging
from typing import List, Dict, Any
from sklearn.preprocessing import normalize
from app.config import MIN_MOVIE_RATINGS_FOR_COLLAB, MAX_USERS_FOR_COLLAB

logger = logging.getLogger("MovieMind.Collaborative")

class CollaborativeRecommender:
    """
    Data Mining Item-Item Collaborative Filtering Engine.
    Pipeline: User Ratings -> Sparse User-Item Matrix -> Sparse Item Cosine Similarity -> Collaborative Score.
    """
    def __init__(self):
        self.movie_id_to_idx: Dict[int, int] = {}
        self.idx_to_movie_id: Dict[int, int] = {}
        self.item_sim_matrix: Optional[sp.csr_matrix] = None
        self.top_neighbors: Dict[int, List[Dict[str, Any]]] = {}
        self.is_fitted = False

    def fit(self, ratings_df: pd.DataFrame, movies_df: pd.DataFrame):
        logger.info("Fitting Item-Item Collaborative Filtering Model...")
        
        # 1. Filter to movies with sufficient ratings for reliable similarity calculation
        movie_counts = ratings_df['movieId'].value_counts()
        eligible_movies = set(movie_counts[movie_counts >= MIN_MOVIE_RATINGS_FOR_COLLAB].index)
        
        logger.info(f"Filtering dataset: {len(eligible_movies)} movies have >= {MIN_MOVIE_RATINGS_FOR_COLLAB} ratings.")
        filtered_ratings = ratings_df[ratings_df['movieId'].isin(eligible_movies)].copy()
        
        # Sample top active users if dataset is massive to maintain instant startup
        user_counts = filtered_ratings['userId'].value_counts()
        if len(user_counts) > MAX_USERS_FOR_COLLAB:
            top_users = set(user_counts.head(MAX_USERS_FOR_COLLAB).index)
            filtered_ratings = filtered_ratings[filtered_ratings['userId'].isin(top_users)]
            logger.info(f"Sampled top {MAX_USERS_FOR_COLLAB} active users for matrix construction.")
            
        # Build index mappings
        unique_movies = filtered_ratings['movieId'].unique()
        unique_users = filtered_ratings['userId'].unique()
        
        movie_to_idx = {m: i for i, m in enumerate(unique_movies)}
        idx_to_movie = {i: m for i, m in enumerate(unique_movies)}
        user_to_idx = {u: i for i, u in enumerate(unique_users)}
        
        self.movie_id_to_idx = movie_to_idx
        self.idx_to_movie_id = idx_to_movie
        
        # Map dataframe to matrix indices
        row_indices = filtered_ratings['movieId'].map(movie_to_idx).values
        col_indices = filtered_ratings['userId'].map(user_to_idx).values
        ratings_val = filtered_ratings['rating'].values
        
        # Mean-center ratings per user for true collaborative preference signal
        # Or construct sparse rating matrix
        n_items = len(unique_movies)
        n_users = len(unique_users)
        
        item_user_matrix = sp.csr_matrix((ratings_val, (row_indices, col_indices)), shape=(n_items, n_users))
        
        # L2-normalize rows of item-user matrix to calculate cosine similarity
        norm_matrix = normalize(item_user_matrix, norm='l2', axis=1)
        
        # Efficient sparse item-item dot product: S = V * V^T
        logger.info("Computing Sparse Item-Item Cosine Similarity Matrix...")
        item_sim = norm_matrix.dot(norm_matrix.T)
        
        # Precompute top-50 neighbors per movie for lightning-fast retrieval
        logger.info("Indexing top item neighbors for API requests...")
        top_neighbors = {}
        
        # Convert item_sim to CSR format if needed
        item_sim_csr = item_sim.tocsr()
        indptr = item_sim_csr.indptr
        indices = item_sim_csr.indices
        data = item_sim_csr.data
        
        for idx in range(n_items):
            start = indptr[idx]
            end = indptr[idx + 1]
            if start == end:
                continue
                
            cols = indices[start:end]
            vals = data[start:end]
            
            # Filter out self-similarity (where cols == idx)
            mask = cols != idx
            cols = cols[mask]
            vals = vals[mask]
            
            if len(vals) == 0:
                continue
                
            # Get top 50 indices
            top_k = min(50, len(vals))
            partition_indices = np.argpartition(vals, -top_k)[-top_k:]
            sorted_top = partition_indices[np.argsort(vals[partition_indices])[::-1]]
            
            rec_list = []
            for k_idx in sorted_top:
                rec_movie_id = idx_to_movie[cols[k_idx]]
                score = float(round(vals[k_idx], 4))
                if score > 0.01:
                    rec_list.append({
                        "movieId": int(rec_movie_id),
                        "score": score,
                        "explanation": f"Users who enjoyed this movie also gave high ratings to this item (Collaborative correlation score: {round(score, 3)})."
                    })
            
            movie_id = idx_to_movie[idx]
            top_neighbors[movie_id] = rec_list

        self.top_neighbors = top_neighbors
        self.is_fitted = True
        logger.info(f"Collaborative model fitted for {len(top_neighbors)} movies!")

    def get_recommendations(self, movie_id: int, top_n: int = 10) -> List[Dict[str, Any]]:
        if not self.is_fitted:
            return []
        
        recs = self.top_neighbors.get(movie_id, [])
        return recs[:top_n]

    def get_similarity(self, movie_id_1: int, movie_id_2: int) -> float:
        """
        Lookup Item-Item Collaborative Filtering Similarity between two movies.
        Returns float score bounded in [0, 1].
        """
        if not self.is_fitted:
            return 0.0

        neighbors = self.top_neighbors.get(movie_id_1, [])
        for item in neighbors:
            if item['movieId'] == movie_id_2:
                return float(np.clip(item['score'], 0.0, 1.0))
        
        # Check reverse relationship
        rev_neighbors = self.top_neighbors.get(movie_id_2, [])
        for item in rev_neighbors:
            if item['movieId'] == movie_id_1:
                return float(np.clip(item['score'], 0.0, 1.0))

        return 0.0

