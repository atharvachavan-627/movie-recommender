"""
Physical Star Schema DDL for MovieMind Analytical Data Warehouse.
Stores Fact and Dimension tables in SQLite (moviemind_dw.db).
"""
import sqlite3
import logging
from app.config import WAREHOUSE_DB_PATH, WAREHOUSE_DIR

logger = logging.getLogger("MovieMind.WarehouseSchema")

DDL_STATEMENTS = [
    # 1. Dimension: Movie
    """
    CREATE TABLE IF NOT EXISTS DIM_MOVIE (
        movie_key INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        release_year INTEGER,
        genres TEXT
    );
    """,
    # 2. Dimension: User
    """
    CREATE TABLE IF NOT EXISTS DIM_USER (
        user_key INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL
    );
    """,
    # 3. Dimension: Date (Hierarchical: Day -> Month -> Quarter -> Year -> Decade)
    """
    CREATE TABLE IF NOT EXISTS DIM_DATE (
        date_key INTEGER PRIMARY KEY,
        full_date TEXT NOT NULL,
        day INTEGER NOT NULL,
        month INTEGER NOT NULL,
        month_name TEXT NOT NULL,
        quarter INTEGER NOT NULL,
        year INTEGER NOT NULL,
        decade INTEGER NOT NULL
    );
    """,
    # 4. Dimension: Genre
    """
    CREATE TABLE IF NOT EXISTS DIM_GENRE (
        genre_key INTEGER PRIMARY KEY AUTOINCREMENT,
        genre_name TEXT UNIQUE NOT NULL
    );
    """,
    # 5. Fact Table: Rating
    """
    CREATE TABLE IF NOT EXISTS FACT_RATING (
        rating_key INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key INTEGER NOT NULL,
        movie_key INTEGER NOT NULL,
        date_key INTEGER NOT NULL,
        genre_key INTEGER,
        rating REAL NOT NULL,
        FOREIGN KEY (user_key) REFERENCES DIM_USER(user_key),
        FOREIGN KEY (movie_key) REFERENCES DIM_MOVIE(movie_key),
        FOREIGN KEY (date_key) REFERENCES DIM_DATE(date_key),
        FOREIGN KEY (genre_key) REFERENCES DIM_GENRE(genre_key)
    );
    """,
    # Indexes for OLAP query performance
    "CREATE INDEX IF NOT EXISTS idx_fact_movie ON FACT_RATING(movie_key);",
    "CREATE INDEX IF NOT EXISTS idx_fact_user ON FACT_RATING(user_key);",
    "CREATE INDEX IF NOT EXISTS idx_fact_date ON FACT_RATING(date_key);",
    "CREATE INDEX IF NOT EXISTS idx_fact_genre ON FACT_RATING(genre_key);",
    "CREATE INDEX IF NOT EXISTS idx_fact_rating_val ON FACT_RATING(rating);",
    "CREATE INDEX IF NOT EXISTS idx_dim_movie_id ON DIM_MOVIE(movie_id);",
    "CREATE INDEX IF NOT EXISTS idx_dim_user_id ON DIM_USER(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_dim_date_year ON DIM_DATE(year);",
    "CREATE INDEX IF NOT EXISTS idx_dim_date_month ON DIM_DATE(month);"
]


def init_warehouse_schema(db_path=None):
    """Creates Star Schema physical tables and indexes."""
    target_path = db_path or WAREHOUSE_DB_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Initializing Star Schema on {target_path}...")
    conn = sqlite3.connect(target_path)
    cursor = conn.cursor()
    
    for statement in DDL_STATEMENTS:
        cursor.execute(statement)
        
    conn.commit()
    conn.close()
    logger.info("Star Schema initialization complete!")
