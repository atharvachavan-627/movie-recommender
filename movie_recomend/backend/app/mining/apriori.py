"""
Association Rule Mining Engine (Apriori / Frequent Itemsets) for MovieMind.
Extracts co-liked movie patterns from empirical viewer baskets with Support, Confidence, Lift, and Combined Score metrics.
"""
from collections import defaultdict
from itertools import combinations
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd

from app.config import BASE_DIR, RATINGS_CSV, MOVIES_CSV
from app.data_loader import data_loader

logger = logging.getLogger("MovieMind.Apriori")
RULES_FILE = BASE_DIR / "models" / "association_rules.joblib"


class AssociationRuleMiner:
    def __init__(self):
        self.rules: List[Dict[str, Any]] = []
        self.frequent_itemsets: List[Dict[str, Any]] = []
        self.movie_rules_index: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        self.is_fitted = False
        self.stats: Dict[str, Any] = {}
        self.histograms: Dict[str, Any] = {}
        self.scatter_sample: List[Dict[str, Any]] = []

    def fit(
        self,
        ratings_df: Optional[pd.DataFrame] = None,
        min_rating_threshold: float = 4.0,
        min_support: float = 0.005,
        min_confidence: float = 0.25,
        min_lift: float = 1.2,
        max_baskets: int = 2000
    ):
        """
        Extracts frequent itemsets and association rules:
        Basket definition: Movies with positive ratings (>= 4.0★) per user transaction basket.
        """
        logger.info("Starting Apriori Association Rule Mining...")

        if ratings_df is None:
            ratings_df = pd.read_csv(RATINGS_CSV)

        # Ensure movie lookup dictionary is available
        movies_lookup = {}
        if data_loader.is_loaded:
            movies_lookup = {mid: m["title"] for mid, m in data_loader.movie_map.items()}
        elif MOVIES_CSV.exists():
            m_df = pd.read_csv(MOVIES_CSV)
            movies_lookup = dict(zip(m_df["movieId"], m_df["title"]))

        # 1. Filter positive interactions (liked movies)
        liked_df = ratings_df[ratings_df["rating"] >= min_rating_threshold].copy()
        
        # 2. Construct User Baskets
        baskets_by_user = defaultdict(set)
        for _, row in liked_df.iterrows():
            baskets_by_user[int(row["userId"])].add(int(row["movieId"]))

        # Filter out baskets with < 2 items
        valid_baskets = [b for b in baskets_by_user.values() if len(b) >= 2]
        if len(valid_baskets) > max_baskets:
            valid_baskets = sorted(valid_baskets, key=len, reverse=True)[:max_baskets]

        total_baskets = len(valid_baskets)
        total_users_in_dataset = int(ratings_df["userId"].nunique()) if "userId" in ratings_df.columns else total_baskets
        
        if total_baskets == 0:
            logger.warning("No valid baskets found for Apriori mining.")
            return

        basket_sizes = [len(b) for b in valid_baskets]
        avg_basket_size = round(float(np.mean(basket_sizes)), 1)
        median_basket_size = float(np.median(basket_sizes))

        logger.info(f"Mining association rules across {total_baskets} user baskets (avg size: {avg_basket_size})...")

        # 3. Step 1: 1-Itemset Frequencies (L1)
        item_counts = defaultdict(int)
        for basket in valid_baskets:
            for item in basket:
                item_counts[item] += 1

        min_count = max(2, int(min_support * total_baskets))
        frequent_1 = {item: cnt for item, cnt in item_counts.items() if cnt >= min_count}

        logger.info(f"Found {len(frequent_1)} frequent 1-itemsets (min count >= {min_count}).")

        # 4. Step 2: 2-Itemset Frequencies (L2)
        pair_counts = defaultdict(int)
        for basket in valid_baskets:
            frequent_in_basket = [item for item in basket if item in frequent_1]
            for pair in combinations(sorted(frequent_in_basket), 2):
                pair_counts[pair] += 1

        frequent_2 = {pair: cnt for pair, cnt in pair_counts.items() if cnt >= min_count}
        logger.info(f"Found {len(frequent_2)} frequent 2-itemsets.")

        # 5. Generate Association Rules: A -> B and B -> A
        rules_list = []
        movie_rules_map = defaultdict(list)

        for (item_a, item_b), pair_cnt in frequent_2.items():
            supp_ab = pair_cnt / total_baskets
            supp_a = frequent_1[item_a] / total_baskets
            supp_b = frequent_1[item_b] / total_baskets

            title_a = movies_lookup.get(item_a, f"Movie {item_a}")
            title_b = movies_lookup.get(item_b, f"Movie {item_b}")

            def classify_rule(lift_val):
                if lift_val >= 25.0:
                    return "Exceptional Association"
                elif lift_val >= 10.0:
                    return "High Co-occurrence Multiplier"
                elif lift_val >= 3.0:
                    return "Strong Positive Association"
                return "Moderate Positive Association"

            # Rule 1: A => B
            conf_a_to_b = supp_ab / supp_a if supp_a > 0 else 0
            lift_a_to_b = conf_a_to_b / supp_b if supp_b > 0 else 0

            if conf_a_to_b >= min_confidence and lift_a_to_b >= min_lift:
                comb_score = round(lift_a_to_b * conf_a_to_b * np.sqrt(supp_ab * 100), 2)
                rule_obj = {
                    "rule_id": f"{item_a}->{item_b}",
                    "antecedent_id": item_a,
                    "antecedent_title": title_a,
                    "consequent_id": item_b,
                    "consequent_title": title_b,
                    "support": float(round(supp_ab, 4)),
                    "supporting_baskets": int(pair_cnt),
                    "total_baskets": int(total_baskets),
                    "confidence": float(round(conf_a_to_b, 4)),
                    "lift": float(round(lift_a_to_b, 4)),
                    "combined_score": float(comb_score),
                    "quality_band": classify_rule(lift_a_to_b),
                    "rule_text": f"Viewers who liked '{title_a}' are {round(lift_a_to_b, 1)}x more likely to like '{title_b}' (Confidence: {round(conf_a_to_b * 100, 1)}%, Support: {round(supp_ab * 100, 2)}%)."
                }
                rules_list.append(rule_obj)
                movie_rules_map[item_a].append(rule_obj)
                movie_rules_map[item_b].append(rule_obj)

            # Rule 2: B => A
            conf_b_to_a = supp_ab / supp_b if supp_b > 0 else 0
            lift_b_to_a = conf_b_to_a / supp_a if supp_a > 0 else 0

            if conf_b_to_a >= min_confidence and lift_b_to_a >= min_lift:
                comb_score_rev = round(lift_b_to_a * conf_b_to_a * np.sqrt(supp_ab * 100), 2)
                rule_obj_rev = {
                    "rule_id": f"{item_b}->{item_a}",
                    "antecedent_id": item_b,
                    "antecedent_title": title_b,
                    "consequent_id": item_a,
                    "consequent_title": title_a,
                    "support": float(round(supp_ab, 4)),
                    "supporting_baskets": int(pair_cnt),
                    "total_baskets": int(total_baskets),
                    "confidence": float(round(conf_b_to_a, 4)),
                    "lift": float(round(lift_b_to_a, 4)),
                    "combined_score": float(comb_score_rev),
                    "quality_band": classify_rule(lift_b_to_a),
                    "rule_text": f"Viewers who liked '{title_b}' are {round(lift_b_to_a, 1)}x more likely to like '{title_a}' (Confidence: {round(conf_b_to_a * 100, 1)}%, Support: {round(supp_ab * 100, 2)}%)."
                }
                rules_list.append(rule_obj_rev)
                movie_rules_map[item_b].append(rule_obj_rev)
                movie_rules_map[item_a].append(rule_obj_rev)

        rules_list.sort(key=lambda r: (r["lift"], r["confidence"]), reverse=True)

        self.rules = rules_list
        self.movie_rules_index = movie_rules_map
        self._compute_distribution_stats(total_baskets, total_users_in_dataset, avg_basket_size, median_basket_size, min_support, min_confidence, min_lift)
        self.is_fitted = True

        logger.info(f"Apriori rule generation complete! Generated {len(rules_list)} high-lift rules.")
        
        RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"rules": self.rules, "stats": self.stats}, RULES_FILE)

    def _compute_distribution_stats(
        self,
        total_baskets: int,
        total_users: int,
        avg_basket_size: float,
        median_basket_size: float,
        min_support: float = 0.005,
        min_confidence: float = 0.25,
        min_lift: float = 1.2
    ):
        if not self.rules:
            self.stats = {}
            return

        confs = [r["confidence"] for r in self.rules]
        lifts = [r["lift"] for r in self.rules]
        supps = [r["support"] for r in self.rules]

        self.stats = {
            "total_rules": len(self.rules),
            "total_baskets": total_baskets,
            "total_users": total_users,
            "positive_rating_threshold": 4.0,
            "avg_basket_size": avg_basket_size,
            "median_basket_size": median_basket_size,
            "min_support_used": min_support,
            "min_confidence_used": min_confidence,
            "min_lift_used": min_lift,
            "confidence_summary": {
                "min": float(np.min(confs)),
                "max": float(np.max(confs)),
                "mean": float(round(np.mean(confs), 3)),
                "median": float(round(np.median(confs), 3)),
                "p25": float(round(np.percentile(confs, 25), 3)),
                "p50": float(round(np.percentile(confs, 50), 3)),
                "p75": float(round(np.percentile(confs, 75), 3)),
                "p90": float(round(np.percentile(confs, 90), 3))
            },
            "lift_summary": {
                "min": float(round(np.min(lifts), 2)),
                "max": float(round(np.max(lifts), 2)),
                "mean": float(round(np.mean(lifts), 2)),
                "median": float(round(np.median(lifts), 2)),
                "p25": float(round(np.percentile(lifts, 25), 2)),
                "p50": float(round(np.percentile(lifts, 50), 2)),
                "p75": float(round(np.percentile(lifts, 75), 2)),
                "p90": float(round(np.percentile(lifts, 90), 2)),
                "p95": float(round(np.percentile(lifts, 95), 2))
            },
            "support_summary": {
                "min": float(round(np.min(supps), 4)),
                "max": float(round(np.max(supps), 4)),
                "mean": float(round(np.mean(supps), 4))
            },
            "recommended_threshold": {
                "confidence": 0.30,
                "lift": 5.0,
                "label": "Balanced Exploratory Mining (Confidence ≥ 30%, Lift ≥ 5.0×)"
            }
        }

        # Compute Histograms
        # Confidence bins
        conf_bins = [
            {"range": "25%–30%", "min": 0.25, "max": 0.30, "count": 0},
            {"range": "30%–40%", "min": 0.30, "max": 0.40, "count": 0},
            {"range": "40%–50%", "min": 0.40, "max": 0.50, "count": 0},
            {"range": "50%–60%", "min": 0.50, "max": 0.60, "count": 0},
            {"range": "60%–70%", "min": 0.60, "max": 0.70, "count": 0},
            {"range": "70%–80%", "min": 0.70, "max": 0.80, "count": 0},
            {"range": "80%–100%", "min": 0.80, "max": 1.01, "count": 0},
        ]
        for c in confs:
            for b in conf_bins:
                if b["min"] <= c < b["max"]:
                    b["count"] += 1
                    break

        # Lift bins
        lift_bins = [
            {"range": "3.5×–5×", "min": 3.5, "max": 5.0, "count": 0},
            {"range": "5×–10×", "min": 5.0, "max": 10.0, "count": 0},
            {"range": "10×–20×", "min": 10.0, "max": 20.0, "count": 0},
            {"range": "20×–50×", "min": 20.0, "max": 50.0, "count": 0},
            {"range": "50×+", "min": 50.0, "max": 999999.0, "count": 0},
        ]
        for l in lifts:
            for b in lift_bins:
                if b["min"] <= l < b["max"]:
                    b["count"] += 1
                    break

        self.histograms = {
            "confidence": conf_bins,
            "lift": lift_bins
        }

        # Representative 80-item scatter sample across all tiers
        step = max(1, len(self.rules) // 80)
        self.scatter_sample = [
            {
                "antecedent": r["antecedent_title"],
                "consequent": r["consequent_title"],
                "confidence": round(r["confidence"] * 100, 1),
                "lift": r["lift"],
                "support": round(r["support"] * 100, 2)
            }
            for r in self.rules[::step][:80]
        ]

    def load_rules(self):
        if RULES_FILE.exists():
            data = joblib.load(RULES_FILE)
            self.rules = data.get("rules", [])
            cached_stats = data.get("stats", {})
            self.movie_rules_index = defaultdict(list)
            
            # Reconstruct title map & index if needed
            for r in self.rules:
                # Add supporting_baskets if missing
                if "total_baskets" not in r:
                    r["total_baskets"] = 511
                if "supporting_baskets" not in r:
                    r["supporting_baskets"] = max(2, int(r["support"] * r.get("total_baskets", 511)))
                if "combined_score" not in r:
                    r["combined_score"] = round(r["lift"] * r["confidence"] * np.sqrt(r["support"] * 100), 2)
                if "quality_band" not in r:
                    l = r["lift"]
                    r["quality_band"] = "Exceptional Association" if l >= 25.0 else "High Multiplier" if l >= 10.0 else "Strong Association"

                self.movie_rules_index[r["antecedent_id"]].append(r)
                self.movie_rules_index[r["consequent_id"]].append(r)

            self._compute_distribution_stats(
                total_baskets=cached_stats.get("total_baskets", 511),
                total_users=522,
                avg_basket_size=cached_stats.get("avg_basket_size", 42.8),
                median_basket_size=cached_stats.get("median_basket_size", 28.0),
                min_support=cached_stats.get("min_support_used", 0.005),
                min_confidence=cached_stats.get("min_confidence_used", 0.25),
                min_lift=cached_stats.get("min_lift_used", 1.2)
            )
            self.is_fitted = True
            logger.info(f"Loaded {len(self.rules)} Apriori rules from disk.")
        else:
            self.fit()

    def get_rules(
        self,
        min_support: Optional[float] = None,
        min_confidence: Optional[float] = None,
        min_lift: Optional[float] = None,
        sort_by: str = "lift",
        search: Optional[str] = None,
        limit: int = 50,
        page: int = 1
    ) -> Dict[str, Any]:
        if not self.is_fitted:
            self.load_rules()

        filtered = self.rules

        # 1. Filter by Support
        if min_support is not None:
            filtered = [r for r in filtered if r["support"] >= min_support]

        # 2. Filter by Confidence
        if min_confidence is not None:
            filtered = [r for r in filtered if r["confidence"] >= min_confidence]

        # 3. Filter by Lift
        if min_lift is not None:
            filtered = [r for r in filtered if r["lift"] >= min_lift]

        # 4. Search filter (Antecedent or Consequent title)
        if search and search.strip():
            q = search.strip().lower()
            filtered = [
                r for r in filtered
                if q in r["antecedent_title"].lower() or q in r["consequent_title"].lower()
            ]

        # 5. Sort rules
        sort_keys = {
            "lift": lambda r: (r["lift"], r["confidence"]),
            "confidence": lambda r: (r["confidence"], r["lift"]),
            "support": lambda r: (r["support"], r["lift"]),
            "combined": lambda r: (r["combined_score"], r["lift"])
        }
        sort_fn = sort_keys.get(sort_by, sort_keys["lift"])
        sorted_filtered = sorted(filtered, key=sort_fn, reverse=True)

        total_matches = len(sorted_filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_rules = sorted_filtered[start_idx:end_idx]

        # Top 10 available rules overall for fallback preview
        top_available = self.rules[:10]

        return {
            "status": "success",
            "algorithm": "Apriori Association Rule Mining",
            "thresholds": {
                "min_support": min_support or self.stats.get("min_support_used", 0.005),
                "min_confidence": min_confidence or self.stats.get("min_confidence_used", 0.25),
                "min_lift": min_lift or self.stats.get("min_lift_used", 1.2),
                "sort_by": sort_by
            },
            "total_rules": total_matches,
            "total_mined_rules": len(self.rules),
            "page": page,
            "limit": limit,
            "rules": paginated_rules,
            "top_available": top_available,
            "stats": self.stats,
            "histograms": self.histograms,
            "scatter_sample": self.scatter_sample
        }

    def get_rules_for_movie(self, movie_id: int, limit: int = 15) -> Dict[str, Any]:
        if not self.is_fitted:
            self.load_rules()

        movie = data_loader.get_movie(movie_id)
        rules = self.movie_rules_index.get(movie_id, [])
        seen = set()
        unique_rules = []
        for r in rules:
            if r["rule_id"] not in seen:
                seen.add(r["rule_id"])
                unique_rules.append(r)

        unique_rules.sort(key=lambda x: (x["lift"], x["confidence"]), reverse=True)

        return {
            "movie": movie,
            "movie_id": movie_id,
            "count": len(unique_rules[:limit]),
            "rules": unique_rules[:limit]
        }


apriori_miner = AssociationRuleMiner()
