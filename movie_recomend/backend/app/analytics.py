import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any
from app.data_loader import data_loader

logger = logging.getLogger("MovieMind.Analytics")

class AnalyticsEngine:
    def __init__(self):
        self.popular_movies_cache: List[Dict[str, Any]] = []
        self.genre_analytics_cache: List[Dict[str, Any]] = []
        self.rating_distribution_cache: List[Dict[str, Any]] = []
        self.is_computed = False

    def compute_analytics(self):
        logger.info("Computing Data Mining Analytics & Aggregations...")
        movies_df = data_loader.movies_df
        ratings_df = data_loader.ratings_df

        # 1. Popular Movies (Top 20 by rating count & high avg rating)
        has_100 = (movies_df['rating_count'] >= 100).any()
        filter_mask = movies_df['rating_count'] >= 100 if has_100 else movies_df['rating_count'] > 0
        popular_df = movies_df[filter_mask].sort_values(
            by=['rating_count', 'avg_rating'], ascending=[False, False]
        ).head(20)

        self.popular_movies_cache = [
            data_loader.movie_map[row['movieId']] for _, row in popular_df.iterrows()
        ]

        # 2. Genre Distribution & Avg Rating per Genre
        # Explode genres list to calculate metrics per genre
        exploded = movies_df.explode('genres_list')
        exploded = exploded[exploded['genres_list'].isin(data_loader.all_genres)]
        
        genre_grouped = exploded.groupby('genres_list').agg(
            movie_count=('movieId', 'count'),
            avg_rating=('avg_rating', lambda x: round(x[x > 0].mean(), 2) if len(x[x > 0]) > 0 else 0.0)
        ).reset_index().rename(columns={'genres_list': 'genre'})

        genre_grouped = genre_grouped.sort_values(by='movie_count', ascending=False)
        self.genre_analytics_cache = genre_grouped.to_dict(orient='records')

        # 3. Rating Value Distribution
        rating_counts = ratings_df['rating'].value_counts().sort_index()
        self.rating_distribution_cache = [
            {"rating": float(rating), "count": int(count)}
            for rating, count in rating_counts.items()
        ]

        self.is_computed = True
        logger.info("Analytics computed successfully!")

    def get_overview(self) -> Dict[str, Any]:
        return data_loader.stats

    def get_popular(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.popular_movies_cache[:limit]

    def get_genres(self) -> List[Dict[str, Any]]:
        return self.genre_analytics_cache

    def get_ratings_distribution(self) -> List[Dict[str, Any]]:
        return self.rating_distribution_cache

analytics_engine = AnalyticsEngine()
