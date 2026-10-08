"""
Multi-Dimensional OLAP Engine for MovieMind Star Schema Data Warehouse.
Implements: Roll-up, Drill-down, Slice, Dice, and Pivot over DIM_DATE, DIM_GENRE, DIM_MOVIE, and FACT_RATING.
"""
import sqlite3
import logging
from typing import Dict, Any, List, Optional
from app.warehouse.warehouse import get_warehouse_connection

logger = logging.getLogger("MovieMind.OLAP")


class OLAPEngine:
    """
    OLAP Operations Handler executing direct multi-dimensional SQL aggregation on physical Star Schema.
    """

    # -------------------------------------------------------------
    # 1. ROLL-UP OPERATION (Day -> Month -> Quarter -> Year -> Decade)
    # -------------------------------------------------------------
    def rollup(self, level: str = "year") -> Dict[str, Any]:
        """
        Aggregates measures along the date dimension hierarchy.
        Supported levels: 'day', 'month', 'quarter', 'year', 'decade'.
        """
        valid_levels = {
            "day": ("d.full_date", "Day", "d.full_date"),
            "month": ("d.year || '-' || printf('%02d', d.month)", "Month", "d.year, d.month"),
            "quarter": ("d.year || ' Q' || d.quarter", "Quarter", "d.year, d.quarter"),
            "year": ("CAST(d.year AS TEXT)", "Year", "d.year"),
            "decade": ("d.decade || 's'", "Decade", "d.decade")
        }

        level_lower = level.lower().strip()
        if level_lower not in valid_levels:
            level_lower = "year"

        group_expr, label_name, order_expr = valid_levels[level_lower]

        sql = f"""
            SELECT 
                {group_expr} AS time_bucket,
                COUNT(f.rating_key) AS rating_count,
                ROUND(AVG(f.rating), 2) AS average_rating,
                COUNT(DISTINCT f.movie_key) AS unique_movies_rated,
                COUNT(DISTINCT f.user_key) AS active_users
            FROM FACT_RATING f
            JOIN DIM_DATE d ON f.date_key = d.date_key
            GROUP BY {group_expr}
            ORDER BY {order_expr} ASC;
        """

        with get_warehouse_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            rows = cursor.fetchall()

        results = [
            {
                "time_bucket": row["time_bucket"],
                "rating_count": int(row["rating_count"]),
                "average_rating": float(row["average_rating"]) if row["average_rating"] is not None else 0.0,
                "unique_movies": int(row["unique_movies_rated"]),
                "active_users": int(row["active_users"])
            }
            for row in rows
        ]

        hierarchy = ["Day", "Month", "Quarter", "Year", "Decade"]
        current_idx = list(valid_levels.keys()).index(level_lower)

        return {
            "operation": "ROLL-UP",
            "dimension": "Date Hierarchy",
            "current_level": level_lower.capitalize(),
            "hierarchy_path": " -> ".join(hierarchy),
            "next_rollup_level": hierarchy[current_idx + 1] if current_idx < len(hierarchy) - 1 else None,
            "count": len(results),
            "data": results
        }

    # -------------------------------------------------------------
    # 2. DRILL-DOWN OPERATION (Decade -> Year -> Quarter -> Month -> Day)
    # -------------------------------------------------------------
    def drilldown(
        self,
        target_year: Optional[int] = None,
        target_quarter: Optional[int] = None,
        target_month: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Traverses down the date hierarchy:
        - If no parameters: returns Year level breakdown
        - If target_year: returns Quarter level breakdown for that year
        - If target_year + target_quarter: returns Month level breakdown for that quarter
        - If target_year + target_month: returns Day level breakdown for that month
        """
        with get_warehouse_connection() as conn:
            cursor = conn.cursor()

            if target_year is not None and target_month is not None:
                # Drill down to Days in Month
                sql = """
                    SELECT 
                        d.full_date AS label,
                        d.day AS sub_key,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS average_rating
                    FROM FACT_RATING f
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    WHERE d.year = ? AND d.month = ?
                    GROUP BY d.full_date, d.day
                    ORDER BY d.day ASC;
                """
                cursor.execute(sql, (target_year, target_month))
                level_name = f"Days in {target_year}-{target_month:02d}"
                next_level = None
                breadcrumb = f"All Years > {target_year} > Month {target_month:02d} > Days"

            elif target_year is not None and target_quarter is not None:
                # Drill down to Months in Quarter
                sql = """
                    SELECT 
                        d.month_name AS label,
                        d.month AS sub_key,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS average_rating
                    FROM FACT_RATING f
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    WHERE d.year = ? AND d.quarter = ?
                    GROUP BY d.month_name, d.month
                    ORDER BY d.month ASC;
                """
                cursor.execute(sql, (target_year, target_quarter))
                level_name = f"Months in {target_year} Q{target_quarter}"
                next_level = "Day"
                breadcrumb = f"All Years > {target_year} > Q{target_quarter} > Months"

            elif target_year is not None:
                # Drill down to Quarters in Year
                sql = """
                    SELECT 
                        'Q' || d.quarter AS label,
                        d.quarter AS sub_key,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS average_rating
                    FROM FACT_RATING f
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    WHERE d.year = ?
                    GROUP BY d.quarter
                    ORDER BY d.quarter ASC;
                """
                cursor.execute(sql, (target_year,))
                level_name = f"Quarters in Year {target_year}"
                next_level = "Month"
                breadcrumb = f"All Years > {target_year} > Quarters"

            else:
                # Top level: Years
                sql = """
                    SELECT 
                        CAST(d.year AS TEXT) AS label,
                        d.year AS sub_key,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS average_rating
                    FROM FACT_RATING f
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    GROUP BY d.year
                    ORDER BY d.year ASC;
                """
                cursor.execute(sql)
                level_name = "Years"
                next_level = "Quarter"
                breadcrumb = "All Years"

            rows = cursor.fetchall()

        results = [
            {
                "label": row["label"],
                "sub_key": row["sub_key"],
                "rating_count": int(row["rating_count"]),
                "average_rating": float(row["average_rating"]) if row["average_rating"] is not None else 0.0
            }
            for row in rows
        ]

        return {
            "operation": "DRILL-DOWN",
            "current_view": level_name,
            "breadcrumb": breadcrumb,
            "next_drilldown_level": next_level,
            "target_year": target_year,
            "target_quarter": target_quarter,
            "target_month": target_month,
            "count": len(results),
            "data": results
        }

    # -------------------------------------------------------------
    # 3. SLICE OPERATION (Filter Single Dimension e.g. Genre = 'Sci-Fi')
    # -------------------------------------------------------------
    def slice(
        self,
        dimension: str = "genre",
        value: str = "Action"
    ) -> Dict[str, Any]:
        """
        Extracts a single sub-cube slice by holding one dimension constant.
        Example: Genre = 'Sci-Fi' or Year = 2020.
        """
        with get_warehouse_connection() as conn:
            cursor = conn.cursor()

            if dimension.lower() == "genre":
                sql = """
                    SELECT 
                        m.title,
                        m.release_year,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS avg_rating
                    FROM FACT_RATING f
                    JOIN DIM_MOVIE m ON f.movie_key = m.movie_key
                    JOIN DIM_GENRE g ON f.genre_key = g.genre_key
                    WHERE g.genre_name = ? OR m.genres LIKE ?
                    GROUP BY m.movie_key, m.title, m.release_year
                    ORDER BY rating_count DESC, avg_rating DESC
                    LIMIT 20;
                """
                cursor.execute(sql, (value, f"%{value}%"))
                rows = cursor.fetchall()

                stats_sql = """
                    SELECT 
                        COUNT(f.rating_key) AS total_ratings,
                        ROUND(AVG(f.rating), 2) AS overall_avg,
                        COUNT(DISTINCT f.movie_key) AS movie_count,
                        COUNT(DISTINCT f.user_key) AS user_count
                    FROM FACT_RATING f
                    JOIN DIM_MOVIE m ON f.movie_key = m.movie_key
                    WHERE m.genres LIKE ?;
                """
                cursor.execute(stats_sql, (f"%{value}%",))
                stats_row = cursor.fetchone()

            elif dimension.lower() == "year":
                sql = """
                    SELECT 
                        m.title,
                        m.genres,
                        COUNT(f.rating_key) AS rating_count,
                        ROUND(AVG(f.rating), 2) AS avg_rating
                    FROM FACT_RATING f
                    JOIN DIM_MOVIE m ON f.movie_key = m.movie_key
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    WHERE d.year = ?
                    GROUP BY m.movie_key, m.title, m.genres
                    ORDER BY rating_count DESC
                    LIMIT 20;
                """
                cursor.execute(sql, (int(value),))
                rows = cursor.fetchall()

                stats_sql = """
                    SELECT 
                        COUNT(f.rating_key) AS total_ratings,
                        ROUND(AVG(f.rating), 2) AS overall_avg,
                        COUNT(DISTINCT f.movie_key) AS movie_count,
                        COUNT(DISTINCT f.user_key) AS user_count
                    FROM FACT_RATING f
                    JOIN DIM_DATE d ON f.date_key = d.date_key
                    WHERE d.year = ?;
                """
                cursor.execute(stats_sql, (int(value),))
                stats_row = cursor.fetchone()
            else:
                return {"error": f"Unsupported slice dimension: {dimension}"}

        items = [
            {
                "title": row["title"],
                "secondary": row["release_year"] if "release_year" in row.keys() else row["genres"],
                "rating_count": int(row["rating_count"]),
                "avg_rating": float(row["avg_rating"])
            }
            for row in rows
        ]

        return {
            "operation": "SLICE",
            "dimension": dimension.capitalize(),
            "slice_value": value,
            "slice_summary": {
                "total_ratings": int(stats_row["total_ratings"]) if stats_row else 0,
                "overall_avg_rating": float(stats_row["overall_avg"]) if stats_row and stats_row["overall_avg"] else 0.0,
                "unique_movies": int(stats_row["movie_count"]) if stats_row else 0,
                "unique_users": int(stats_row["user_count"]) if stats_row else 0
            },
            "top_movies": items
        }

    # -------------------------------------------------------------
    # 4. DICE OPERATION (Multi-Dimensional Filtering)
    # -------------------------------------------------------------
    def dice(
        self,
        genre: Optional[str] = "Action",
        year_min: Optional[int] = 2015,
        year_max: Optional[int] = 2024,
        rating_min: Optional[float] = 3.5,
        limit: int = 25
    ) -> Dict[str, Any]:
        """
        Extracts a sub-cube by specifying bounds across multiple dimensions simultaneously.
        Condition: Genre = X AND Year BETWEEN Y1 AND Y2 AND Rating >= R.
        """
        conditions = ["1=1"]
        params = []

        if genre and genre != "All":
            conditions.append("m.genres LIKE ?")
            params.append(f"%{genre}%")

        if year_min is not None:
            conditions.append("d.year >= ?")
            params.append(year_min)

        if year_max is not None:
            conditions.append("d.year <= ?")
            params.append(year_max)

        if rating_min is not None:
            conditions.append("f.rating >= ?")
            params.append(rating_min)

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT 
                m.title,
                m.release_year,
                m.genres,
                d.year AS rating_year,
                COUNT(f.rating_key) AS rating_count,
                ROUND(AVG(f.rating), 2) AS avg_rating
            FROM FACT_RATING f
            JOIN DIM_MOVIE m ON f.movie_key = m.movie_key
            JOIN DIM_DATE d ON f.date_key = d.date_key
            WHERE {where_clause}
            GROUP BY m.movie_key, m.title, m.release_year, m.genres, d.year
            ORDER BY rating_count DESC, avg_rating DESC
            LIMIT ?;
        """
        params.append(limit)

        with get_warehouse_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()

        results = [
            {
                "title": row["title"],
                "release_year": row["release_year"],
                "genres": row["genres"],
                "rating_year": row["rating_year"],
                "rating_count": int(row["rating_count"]),
                "avg_rating": float(row["avg_rating"])
            }
            for row in rows
        ]

        return {
            "operation": "DICE",
            "criteria": {
                "genre": genre,
                "year_range": f"{year_min} – {year_max}",
                "rating_min": f">= {rating_min} ★"
            },
            "count": len(results),
            "data": results
        }

    # -------------------------------------------------------------
    # 5. PIVOT OPERATION (Cross-Tabulation Matrix)
    # -------------------------------------------------------------
    def pivot(
        self,
        row_dim: str = "genre",
        col_dim: str = "decade",
        measure: str = "avg_rating"
    ) -> Dict[str, Any]:
        """
        Calculates a 2D cross-tabulation table.
        Example: Rows = Genre, Columns = Decade / Year, Value = Average Rating or Rating Count.
        """
        with get_warehouse_connection() as conn:
            cursor = conn.cursor()

            # Query facts aggregated by Genre x Decade
            sql = """
                SELECT 
                    g.genre_name,
                    d.decade,
                    COUNT(f.rating_key) AS rating_count,
                    ROUND(AVG(f.rating), 2) AS avg_rating
                FROM FACT_RATING f
                JOIN DIM_GENRE g ON f.genre_key = g.genre_key
                JOIN DIM_DATE d ON f.date_key = d.date_key
                WHERE g.genre_name NOT IN ('Unknown', '(no genres listed)')
                GROUP BY g.genre_name, d.decade
                ORDER BY g.genre_name ASC, d.decade ASC;
            """
            cursor.execute(sql)
            rows = cursor.fetchall()

        # Build pivot structure
        genres_set = set()
        decades_set = set()
        data_map = {}

        for row in rows:
            g = row["genre_name"]
            dec = f"{row['decade']}s"
            val = float(row["avg_rating"]) if measure == "avg_rating" else int(row["rating_count"])
            genres_set.add(g)
            decades_set.add(dec)
            data_map[(g, dec)] = val

        columns = sorted(list(decades_set))
        sorted_genres = sorted(list(genres_set))

        matrix = []
        for g in sorted_genres:
            row_dict = {"genre": g}
            for dec in columns:
                row_dict[dec] = data_map.get((g, dec), 0.0 if measure == "avg_rating" else 0)
            matrix.append(row_dict)

        return {
            "operation": "PIVOT",
            "row_dimension": "Genre",
            "column_dimension": "Decade",
            "measure": measure,
            "columns": columns,
            "matrix": matrix
        }


olap_engine = OLAPEngine()
