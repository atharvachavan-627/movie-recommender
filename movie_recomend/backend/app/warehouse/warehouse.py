"""
Warehouse database helper and connection management.
"""
import sqlite3
from contextlib import contextmanager
from typing import Iterator, Dict, Any
from app.config import WAREHOUSE_DB_PATH


@contextmanager
def get_warehouse_connection() -> Iterator[sqlite3.Connection]:
    """Provides connection to the analytical data warehouse."""
    conn = sqlite3.connect(WAREHOUSE_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_table_details(table_name: str) -> Dict[str, Any]:
    """Fetches schema column metadata, foreign keys, row count, and sample records for a table."""
    valid_tables = {"FACT_RATING", "DIM_MOVIE", "DIM_USER", "DIM_DATE", "DIM_GENRE"}
    tbl = table_name.upper().strip()
    if tbl not in valid_tables:
        return {"error": f"Table '{table_name}' is not part of the Star Schema. Valid tables: {list(valid_tables)}"}
    
    with get_warehouse_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Column info
        cursor.execute(f"PRAGMA table_info({tbl});")
        columns_raw = cursor.fetchall()
        columns = [
            {
                "cid": row["cid"],
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "default_value": row["dflt_value"],
                "pk": bool(row["pk"])
            }
            for row in columns_raw
        ]
        
        # 2. Foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({tbl});")
        fks = [
            {
                "id": row["id"],
                "seq": row["seq"],
                "table": row["table"],
                "from": row["from"],
                "to": row["to"],
                "on_update": row["on_update"],
                "on_delete": row["on_delete"]
            }
            for row in cursor.fetchall()
        ]
        
        # 3. Row count
        cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
        row_count = cursor.fetchone()[0]
        
        # 4. Sample records (10 rows)
        cursor.execute(f"SELECT * FROM {tbl} LIMIT 10;")
        rows = [dict(row) for row in cursor.fetchall()]
        
        # Metadata descriptions
        table_descriptions = {
            "FACT_RATING": {
                "type": "Fact Table",
                "grain": "One row represents one user's rating of one movie on a specific date (User × Movie × Date).",
                "primary_key": "rating_key (Surrogate Key, Auto-increment Integer)",
                "foreign_keys": ["user_key -> DIM_USER(user_key)", "movie_key -> DIM_MOVIE(movie_key)", "date_key -> DIM_DATE(date_key)", "genre_key -> DIM_GENRE(genre_key)"],
                "measure": "rating (Numeric REAL rating score 0.5 - 5.0 stars)"
            },
            "DIM_MOVIE": {
                "type": "Dimension Table (Conformed Dimension)",
                "grain": "One row represents a unique movie title with metadata.",
                "primary_key": "movie_key (Surrogate Key, Integer)",
                "natural_key": "movie_id (MovieLens Natural Business Identifier)",
                "attributes": ["title", "release_year", "genres"]
            },
            "DIM_USER": {
                "type": "Dimension Table",
                "grain": "One row represents a unique user profile in the analytical warehouse.",
                "primary_key": "user_key (Surrogate Key, Integer)",
                "natural_key": "user_id (MovieLens User Identifier)",
                "attributes": ["user_id"]
            },
            "DIM_DATE": {
                "type": "Hierarchical Time Dimension",
                "grain": "One row represents a unique calendar day with drill-down hierarchy.",
                "primary_key": "date_key (Smart Key / Integer YYYYMMDD)",
                "hierarchy": "Day -> Month -> Quarter -> Year -> Decade",
                "attributes": ["full_date", "day", "month", "month_name", "quarter", "year", "decade"]
            },
            "DIM_GENRE": {
                "type": "Dimension Table",
                "grain": "One row represents a distinct cinematic genre category.",
                "primary_key": "genre_key (Surrogate Key, Integer)",
                "attributes": ["genre_name"]
            }
        }

        return {
            "table_name": tbl,
            "metadata": table_descriptions.get(tbl, {}),
            "row_count": row_count,
            "columns": columns,
            "foreign_keys": fks,
            "sample_records": rows
        }


def get_warehouse_summary() -> Dict[str, Any]:
    """Fetches high-level Star Schema table counts and validation stats."""
    if not WAREHOUSE_DB_PATH.exists():
        return {
            "status": "not_initialized",
            "message": "Data Warehouse has not been built yet."
        }
    
    with get_warehouse_connection() as conn:
        cursor = conn.cursor()
        
        # Verify tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row["name"] for row in cursor.fetchall()]
        
        if "FACT_RATING" not in tables:
            return {
                "status": "not_initialized",
                "message": "Data Warehouse schema missing."
            }
            
        dim_movie_count = cursor.execute("SELECT COUNT(*) FROM DIM_MOVIE").fetchone()[0]
        dim_user_count = cursor.execute("SELECT COUNT(*) FROM DIM_USER").fetchone()[0]
        dim_date_count = cursor.execute("SELECT COUNT(*) FROM DIM_DATE").fetchone()[0]
        dim_genre_count = cursor.execute("SELECT COUNT(*) FROM DIM_GENRE").fetchone()[0]
        fact_rating_count = cursor.execute("SELECT COUNT(*) FROM FACT_RATING").fetchone()[0]
        
        avg_rating_row = cursor.execute("SELECT AVG(rating), MIN(rating), MAX(rating) FROM FACT_RATING").fetchone()
        avg_rating = round(avg_rating_row[0], 2) if avg_rating_row and avg_rating_row[0] is not None else 0.0
        min_rating = avg_rating_row[1] if avg_rating_row and avg_rating_row[1] is not None else 0.0
        max_rating = avg_rating_row[2] if avg_rating_row and avg_rating_row[2] is not None else 0.0

        return {
            "status": "online",
            "schema_type": "Physical Star Schema (SQLite DW)",
            "database_file": str(WAREHOUSE_DB_PATH.name),
            "grain": "One row in FACT_RATING represents one user's rating of one movie at one point in time.",
            "tables": {
                "DIM_MOVIE": dim_movie_count,
                "DIM_USER": dim_user_count,
                "DIM_DATE": dim_date_count,
                "DIM_GENRE": dim_genre_count,
                "FACT_RATING": fact_rating_count
            },
            "fact_metrics": {
                "total_ratings": fact_rating_count,
                "average_rating": avg_rating,
                "min_rating": min_rating,
                "max_rating": max_rating
            },
            "dimensions_hierarchy": {
                "time": "Day -> Month -> Quarter -> Year -> Decade",
                "content": "Genre -> Movie"
            }
        }

