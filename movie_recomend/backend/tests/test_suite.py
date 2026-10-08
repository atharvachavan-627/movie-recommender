"""
Automated Test Suite for Star Schema, ETL, OLAP, Decision Tree, Naive Bayes, Apriori, and Recommendation Evaluation.
"""
import pytest
import sqlite3
from app.config import WAREHOUSE_DB_PATH
from app.warehouse.schema import init_warehouse_schema
from app.warehouse.etl import run_warehouse_etl
from app.warehouse.warehouse import get_warehouse_summary
from app.warehouse.olap import olap_engine
from app.mining.apriori import apriori_miner
from app.ml.engine import ml_engine
from app.recommender.content_based import ContentBasedRecommender
from app.recommender.collaborative import CollaborativeRecommender
from app.recommender.hybrid import HybridRecommender
from app.recommender.evaluation import recommender_evaluator
from app.data_loader import data_loader


@pytest.fixture(scope="session", autouse=True)
def setup_environment():
    data_loader.load_data()
    ml_engine.load_models()
    apriori_miner.load_rules()


def test_star_schema_tables_exist():
    summary = get_warehouse_summary()
    assert summary["status"] == "online"
    assert "DIM_MOVIE" in summary["tables"]
    assert "DIM_USER" in summary["tables"]
    assert "DIM_DATE" in summary["tables"]
    assert "DIM_GENRE" in summary["tables"]
    assert "FACT_RATING" in summary["tables"]
    assert summary["tables"]["FACT_RATING"] > 0


def test_olap_rollup():
    r_year = olap_engine.rollup("year")
    assert r_year["operation"] == "ROLL-UP"
    assert len(r_year["data"]) > 0
    assert "rating_count" in r_year["data"][0]
    assert "average_rating" in r_year["data"][0]

    r_month = olap_engine.rollup("month")
    assert len(r_month["data"]) > len(r_year["data"])


def test_olap_drilldown():
    d_years = olap_engine.drilldown()
    assert d_years["operation"] == "DRILL-DOWN"
    assert len(d_years["data"]) > 0

    first_year = d_years["data"][0]["sub_key"]
    d_quarters = olap_engine.drilldown(target_year=first_year)
    assert d_quarters["target_year"] == first_year
    assert len(d_quarters["data"]) > 0


def test_olap_slice_and_dice():
    # Slice
    s = olap_engine.slice("genre", "Action")
    assert s["operation"] == "SLICE"
    assert s["slice_summary"]["total_ratings"] > 0
    assert len(s["top_movies"]) > 0

    # Dice
    d = olap_engine.dice("Action", 2015, 2024, 3.5)
    assert d["operation"] == "DICE"
    assert len(d["data"]) > 0
    for row in d["data"]:
        assert row["avg_rating"] >= 3.5


def test_olap_pivot():
    p = olap_engine.pivot("genre", "decade", "avg_rating")
    assert p["operation"] == "PIVOT"
    assert len(p["columns"]) > 0
    assert len(p["matrix"]) > 0
    assert "genre" in p["matrix"][0]


def test_decision_tree_and_naive_bayes_classification():
    metrics = ml_engine.get_classification_metrics()
    assert "decision_tree" in metrics
    assert "naive_bayes" in metrics
    assert metrics["decision_tree"]["accuracy"] > 0.4
    assert metrics["decision_tree"]["tree_depth"] > 0
    assert len(metrics["decision_tree"]["confusion_matrix"]) == 3
    assert len(metrics["naive_bayes"]["confusion_matrix"]) == 3

    # Test Prediction
    pred_dt = ml_engine.predict_classification(movie_id=1, model_name="decision_tree", movielens_user_id=1)
    assert pred_dt["status"] == "success"
    assert pred_dt["predicted_class"] in ["DISLIKE", "NEUTRAL", "LIKE"]

    pred_nb = ml_engine.predict_classification(movie_id=1, model_name="naive_bayes", movielens_user_id=1)
    assert pred_nb["status"] == "success"
    assert pred_nb["predicted_class"] in ["DISLIKE", "NEUTRAL", "LIKE"]


def test_apriori_association_rules():
    rules_resp = apriori_miner.get_rules(min_support=0.001, min_confidence=0.1, min_lift=1.1, limit=10)
    assert rules_resp["status"] == "success"
    assert len(rules_resp["rules"]) > 0
    first_rule = rules_resp["rules"][0]
    assert "antecedent_title" in first_rule
    assert "consequent_title" in first_rule
    assert first_rule["lift"] >= 1.1


def test_recommendation_offline_evaluation():
    cb = ContentBasedRecommender()
    cb.fit(data_loader.movies_df)
    cl = CollaborativeRecommender()
    cl.fit(data_loader.ratings_df, data_loader.movies_df)
    hy = HybridRecommender(cb, cl)

    eval_res = recommender_evaluator.load_or_compute(cb, cl, hy)
    assert eval_res["status"] == "success"
    assert "content_based" in eval_res["models_comparison"]
    assert "collaborative" in eval_res["models_comparison"]
    assert "hybrid" in eval_res["models_comparison"]
    assert eval_res["models_comparison"]["hybrid"]["ndcg_10"] > 0.0


def test_data_quality_report():
    report = ml_engine.get_data_quality_report()
    assert report["status"] == "healthy"
    assert report["metrics"]["total_movies_catalog"] > 0
    assert report["metrics"]["total_ratings_records"] > 0
