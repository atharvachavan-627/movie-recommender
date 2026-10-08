"""
Reproducible Star Schema ETL Pipeline for MovieMind.
Extracts raw MovieLens CSVs, cleans/transforms dimensional data, and loads into SQLite Data Warehouse.
"""
import datetime
import logging
import re
import sqlite3
import time
from typing import Dict, Any, List

import pandas as pd
import numpy as np

from app.config import MOVIES_CSV, RATINGS_CSV, WAREHOUSE_DB_PATH
from app.warehouse.schema import init_warehouse_schema

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MovieMind.WarehouseETL")


def extract_year(title: str) -> int:
    match = re.search(r"\((\d{4})\)$", str(title).strip())
    return int(match.group(1)) if match else 2000


def run_warehouse_etl(force_rebuild: bool = False) -> Dict[str, Any]:
    """
    Executes the full Star Schema ETL Pipeline.
    Idempotent: Rebuilds Star Schema and populates dimensions and fact table.
    """
    start_time = time.time()
    logger.info("=== Starting Star Schema Data Warehouse ETL Pipeline ===")

    # 1. Initialize / Recreate Schema
    init_warehouse_schema()
    
    conn = sqlite3.connect(WAREHOUSE_DB_PATH)
    cursor = conn.cursor()

    if force_rebuild:
        logger.info("Truncating existing warehouse tables for clean rebuild...")
        cursor.execute("DELETE FROM FACT_RATING;")
        cursor.execute("DELETE FROM DIM_MOVIE;")
        cursor.execute("DELETE FROM DIM_USER;")
        cursor.execute("DELETE FROM DIM_DATE;")
        cursor.execute("DELETE FROM DIM_GENRE;")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('DIM_MOVIE', 'DIM_USER', 'DIM_GENRE', 'FACT_RATING');")
        conn.commit()

    # 2. EXTRACT
    logger.info(f"Extracting movies from {MOVIES_CSV}...")
    movies_df = pd.read_csv(MOVIES_CSV)
    
    logger.info(f"Extracting ratings from {RATINGS_CSV}...")
    ratings_df = pd.read_csv(RATINGS_CSV)
    if "timestamp" not in ratings_df.columns:
        # Fallback timestamp generation if missing
        ratings_df["timestamp"] = int(time.time())

    extract_summary = {
        "raw_movies_count": len(movies_df),
        "raw_ratings_count": len(ratings_df)
    }

    # 3. TRANSFORM & LOAD DIMENSIONS

    # --- A. DIM_GENRE ---
    logger.info("Transforming & Loading DIM_GENRE...")
    unique_genres = set()
    for g_str in movies_df["genres"].dropna():
        for g in str(g_str).split("|"):
            g_clean = g.strip()
            if g_clean and g_clean != "(no genres listed)":
                unique_genres.add(g_clean)
    
    genre_records = [(g,) for g in sorted(unique_genres)]
    cursor.executemany("INSERT OR IGNORE INTO DIM_GENRE (genre_name) VALUES (?);", genre_records)
    conn.commit()

    # Build genre_name -> genre_key map
    cursor.execute("SELECT genre_name, genre_key FROM DIM_GENRE;")
    genre_map = {row[0]: row[1] for row in cursor.fetchall()}

    # --- B. DIM_MOVIE ---
    logger.info("Transforming & Loading DIM_MOVIE...")
    movies_df["year"] = movies_df["title"].apply(extract_year)
    movies_df["genres_clean"] = movies_df["genres"].fillna("Unknown")
    movies_dedup = movies_df.drop_duplicates(subset=["movieId"]).copy()

    movie_records = [
        (int(row["movieId"]), str(row["title"]), int(row["year"]), str(row["genres_clean"]))
        for _, row in movies_dedup.iterrows()
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO DIM_MOVIE (movie_id, title, release_year, genres) VALUES (?, ?, ?, ?);",
        movie_records
    )
    conn.commit()

    cursor.execute("SELECT movie_id, movie_key, genres FROM DIM_MOVIE;")
    movie_meta = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

    # --- C. DIM_USER ---
    logger.info("Transforming & Loading DIM_USER...")
    unique_users = sorted(ratings_df["userId"].unique())
    user_records = [(int(u),) for u in unique_users]
    cursor.executemany("INSERT OR IGNORE INTO DIM_USER (user_id) VALUES (?);", user_records)
    conn.commit()

    cursor.execute("SELECT user_id, user_key FROM DIM_USER;")
    user_map = {row[0]: row[1] for row in cursor.fetchall()}

    # --- D. DIM_DATE ---
    logger.info("Transforming & Loading DIM_DATE...")
    date_records_dict = {}
    
    # Process unique dates from timestamps
    for ts in ratings_df["timestamp"].dropna().unique():
        dt = datetime.datetime.fromtimestamp(int(ts), tz=datetime.timezone.utc)
        date_key = int(dt.strftime("%Y%m%d"))
        if date_key not in date_records_dict:
            full_date = dt.strftime("%Y-%m-%d")
            day = dt.day
            month = dt.month
            month_name = dt.strftime("%B")
            quarter = (dt.month - 1) // 3 + 1
            year = dt.year
            decade = (year // 10) * 10
            date_records_dict[date_key] = (date_key, full_date, day, month, month_name, quarter, year, decade)

    date_records = list(date_records_dict.values())
    cursor.executemany(
        "INSERT OR IGNORE INTO DIM_DATE (date_key, full_date, day, month, month_name, quarter, year, decade) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        date_records
    )
    conn.commit()

    # --- 4. TRANSFORM & LOAD FACT_RATING ---
    logger.info("Transforming & Loading FACT_RATING...")
    fact_records = []
    skipped_records = 0

    for _, row in ratings_df.iterrows():
        u_id = int(row["userId"])
        m_id = int(row["movieId"])
        rating_val = float(row["rating"])
        ts = int(row["timestamp"])

        u_key = user_map.get(u_id)
        m_info = movie_meta.get(m_id)
        if not u_key or not m_info:
            skipped_records += 1
            continue

        m_key, m_genres = m_info
        dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
        d_key = int(dt.strftime("%Y%m%d"))
        
        # Determine primary genre key
        first_genre = m_genres.split("|")[0].strip() if m_genres else "Unknown"
        g_key = genre_map.get(first_genre)

        fact_records.append((u_key, m_key, d_key, g_key, rating_val))

    # Fast batch insert
    cursor.executemany(
        "INSERT INTO FACT_RATING (user_key, movie_key, date_key, genre_key, rating) VALUES (?, ?, ?, ?, ?);",
        fact_records
    )
    conn.commit()

    # 5. DATA QUALITY & INTEGRITY VALIDATION
    logger.info("Running Data Warehouse Integrity Validation checks...")
    
    cursor.execute("SELECT COUNT(*) FROM FACT_RATING;")
    total_facts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM DIM_MOVIE;")
    total_dim_movies = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM DIM_USER;")
    total_dim_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM DIM_DATE;")
    total_dim_dates = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM DIM_GENRE;")
    total_dim_genres = cursor.fetchone()[0]

    # Orphaned foreign key checks
    cursor.execute("""
        SELECT COUNT(*) FROM FACT_RATING f 
        LEFT JOIN DIM_MOVIE m ON f.movie_key = m.movie_key 
        WHERE m.movie_key IS NULL;
    """)
    orphaned_movies = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM FACT_RATING f 
        LEFT JOIN DIM_USER u ON f.user_key = u.user_key 
        WHERE u.user_key IS NULL;
    """)
    orphaned_users = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM FACT_RATING f 
        LEFT JOIN DIM_DATE d ON f.date_key = d.date_key 
        WHERE d.date_key IS NULL;
    """)
    orphaned_dates = cursor.fetchone()[0]

    elapsed_time = round(time.time() - start_time, 2)
    conn.close()

    etl_summary = {
        "status": "success",
        "elapsed_seconds": elapsed_time,
        "extract": extract_summary,
        "load": {
            "DIM_MOVIE": total_dim_movies,
            "DIM_USER": total_dim_users,
            "DIM_DATE": total_dim_dates,
            "DIM_GENRE": total_dim_genres,
            "FACT_RATING": total_facts
        },
        "validation": {
            "orphaned_movie_fks": orphaned_movies,
            "orphaned_user_fks": orphaned_users,
            "orphaned_date_fks": orphaned_dates,
            "skipped_unmapped_rows": skipped_records,
            "integrity_passed": (orphaned_movies == 0 and orphaned_users == 0 and orphaned_dates == 0)
        }
    }

    logger.info(f"=== ETL Pipeline Finished in {elapsed_time}s! Facts Loaded: {total_facts} ===")
    return etl_summary


if __name__ == "__main__":
    run_warehouse_etl(force_rebuild=True)
