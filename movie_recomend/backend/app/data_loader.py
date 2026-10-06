import pandas as pd
import numpy as np
import logging
import re
from typing import Dict, List, Any, Optional
from app.config import MOVIES_CSV, RATINGS_CSV

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MovieMind.DataLoader")

class DataLoader:
    def __init__(self):
        self.movies_df: pd.DataFrame = pd.DataFrame()
        self.ratings_df: pd.DataFrame = pd.DataFrame()
        self.movie_map: Dict[int, Dict[str, Any]] = {}
        self.all_genres: List[str] = []
        self.stats: Dict[str, Any] = {}
        self.is_loaded = False

    def load_data(self):
        logger.info("Starting Data Warehousing & Mining (DWM) Preprocessing Pipeline...")
        
        # 1. Inspect & Load movies.csv
        logger.info(f"Loading movies from {MOVIES_CSV}...")
        movies_df = pd.read_csv(MOVIES_CSV)
        
        # Preprocessing: Handle missing values & Clean genres
        movies_df['genres'] = movies_df['genres'].fillna('').replace('(no genres listed)', '')
        movies_df['genres_clean'] = movies_df['genres'].apply(lambda g: ' '.join(g.split('|')) if g else 'Unknown')
        movies_df['genres_list'] = movies_df['genres'].apply(lambda g: [x.strip() for x in g.split('|') if x.strip()] if g else ['Unknown'])
        
        # Extract year from title if present e.g. "Toy Story (1995)" -> 1995
        def extract_year(title):
            match = re.search(r'\((\d{4})\)$', str(title).strip())
            return int(match.group(1)) if match else None

        movies_df['year'] = movies_df['title'].apply(extract_year)
        
        # Drop duplicates based on movieId
        movies_df = movies_df.drop_duplicates(subset=['movieId']).reset_index(drop=True)
        
        # 2. Inspect & Load ratings.csv efficiently
        logger.info(f"Loading ratings from {RATINGS_CSV}...")
        # Use memory-efficient data types (int32, float32)
        dtypes = {'userId': 'int32', 'movieId': 'int32', 'rating': 'float32'}
        ratings_df = pd.read_csv(RATINGS_CSV, usecols=['userId', 'movieId', 'rating'], dtype=dtypes)
        
        # Validate rating ranges [0.5, 5.0]
        ratings_df = ratings_df[(ratings_df['rating'] >= 0.5) & (ratings_df['rating'] <= 5.0)]
        
        # 3. Compute Aggregated Rating Metrics per Movie
        logger.info("Aggregating rating metrics (mean rating, total ratings count)...")
        movie_stats = ratings_df.groupby('movieId')['rating'].agg(
            rating_count='count',
            avg_rating='mean'
        ).reset_index()
        movie_stats['avg_rating'] = movie_stats['avg_rating'].round(2)
        
        # Merge aggregated rating metrics into movies_df
        movies_df = movies_df.merge(movie_stats, on='movieId', how='left')
        movies_df['rating_count'] = movies_df['rating_count'].fillna(0).astype(int)
        movies_df['avg_rating'] = movies_df['avg_rating'].fillna(0.0)
        
        # Extract unique genres set
        unique_genres = set()
        for genres in movies_df['genres_list']:
            unique_genres.update(genres)
        self.all_genres = sorted([g for g in unique_genres if g and g != 'Unknown'])
        
        # Calculate overall dataset analytics
        total_movies = int(len(movies_df))
        total_users = int(ratings_df['userId'].nunique())
        total_ratings = int(len(ratings_df))
        global_avg_rating = float(round(ratings_df['rating'].mean(), 2))
        
        self.stats = {
            "total_movies": total_movies,
            "total_users": total_users,
            "total_ratings": total_ratings,
            "avg_rating": global_avg_rating,
            "unique_genres_count": len(self.all_genres)
        }
        
        self.movies_df = movies_df
        self.ratings_df = ratings_df
        
        # Build fast O(1) dictionary map for movie lookup
        self.movie_map = {
            row['movieId']: {
                "movieId": int(row['movieId']),
                "title": str(row['title']),
                "genres": str(row['genres']),
                "genres_list": row['genres_list'],
                "year": row['year'],
                "avg_rating": float(row['avg_rating']),
                "rating_count": int(row['rating_count'])
            }
            for _, row in movies_df.iterrows()
        }
        
        self.is_loaded = True
        logger.info(f"Data loading complete! {total_movies} movies, {total_ratings} ratings, {total_users} users.")

    def get_movie(self, movie_id: int) -> Optional[Dict[str, Any]]:
        return self.movie_map.get(movie_id)

    def search_movies(self, query: str, limit: int = 20, genre: Optional[str] = None) -> List[Dict[str, Any]]:
        df = self.movies_df
        if genre and genre != 'All':
            df = df[df['genres_list'].apply(lambda gl: genre in gl)]
        
        if query:
            q = query.lower()
            df = df[df['title'].str.lower().str.contains(q, na=False)]
            
        # Order by rating_count descending to show relevant popular movies first
        df_sorted = df.sort_values(by=['rating_count', 'avg_rating'], ascending=[False, False]).head(limit)
        
        results = []
        for _, row in df_sorted.iterrows():
            results.append(self.movie_map[row['movieId']])
        return results

# Singleton instance
data_loader = DataLoader()
