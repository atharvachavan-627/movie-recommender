import numpy as np
import pandas as pd
import logging
from typing import List, Dict, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("MovieMind.ContentBased")

class ContentBasedRecommender:
    """
    Data Mining Content-Based Filtering Engine using Genre TF-IDF & Cosine Similarity.
    Pipeline: Movie Genres -> Text Preprocessing -> TF-IDF Representation -> Cosine Similarity.
    """
    def __init__(self):
        self.vectorizer = TfidfVectorizer(token_pattern=r'(?u)\b[\w-]+\b')
        self.tfidf_matrix = None
        self.movie_id_to_idx: Dict[int, int] = {}
        self.idx_to_movie_id: Dict[int, int] = {}
        self.movies_df: pd.DataFrame = pd.DataFrame()
        self.is_fitted = False

    def fit(self, movies_df: pd.DataFrame):
        logger.info("Fitting Content-Based Recommendation Model (TF-IDF Vectorizer on Genres)...")
        self.movies_df = movies_df.copy()
        
        # Build mapping between movieId and row index
        for idx, movie_id in enumerate(self.movies_df['movieId']):
            self.movie_id_to_idx[movie_id] = idx
            self.idx_to_movie_id[idx] = movie_id

        # Compute TF-IDF Matrix on cleaned genre strings
        genre_texts = self.movies_df['genres_clean'].values
        self.tfidf_matrix = self.vectorizer.fit_transform(genre_texts)
        self.is_fitted = True
        logger.info(f"Content-Based model fitted successfully! Matrix shape: {self.tfidf_matrix.shape}")

    def get_recommendations(self, movie_id: int, top_n: int = 10) -> List[Dict[str, Any]]:
        if not self.is_fitted or movie_id not in self.movie_id_to_idx:
            return []

        target_idx = self.movie_id_to_idx[movie_id]
        target_vector = self.tfidf_matrix[target_idx]

        # Calculate Cosine Similarity between target movie vector and all movie vectors
        # Shape: (1, total_movies)
        sim_scores = cosine_similarity(target_vector, self.tfidf_matrix).flatten()

        # Get top indices (excluding self)
        # Sort indices by similarity descending
        top_indices = np.argsort(sim_scores)[::-1]
        
        recommendations = []
        target_genres = set(self.movies_df.iloc[target_idx]['genres_list'])

        for idx in top_indices:
            rec_id = self.idx_to_movie_id[idx]
            if rec_id == movie_id:
                continue

            score = float(sim_scores[idx])
            if score <= 0.0:
                continue

            rec_genres = set(self.movies_df.iloc[idx]['genres_list'])
            overlap = target_genres.intersection(rec_genres)
            overlap_str = ", ".join(list(overlap)) if overlap else "genre similarity"

            recommendations.append({
                "movieId": int(rec_id),
                "score": float(round(score, 4)),
                "explanation": f"Shares genre attributes ({overlap_str}) with high TF-IDF similarity of {round(score * 100, 1)}%."
            })

            if len(recommendations) >= top_n:
                break

        return recommendations

    def get_similarity(self, movie_id_1: int, movie_id_2: int) -> float:
        """
        Calculate TF-IDF Genre Cosine Similarity between two movies.
        Returns float score bounded in [0, 1].
        """
        if not self.is_fitted or movie_id_1 not in self.movie_id_to_idx or movie_id_2 not in self.movie_id_to_idx:
            return 0.0

        idx1 = self.movie_id_to_idx[movie_id_1]
        idx2 = self.movie_id_to_idx[movie_id_2]
        
        target_vector = self.tfidf_matrix[idx1]
        candidate_vector = self.tfidf_matrix[idx2]
        
        sim = float(cosine_similarity(target_vector, candidate_vector)[0][0])
        return float(np.clip(sim, 0.0, 1.0))

