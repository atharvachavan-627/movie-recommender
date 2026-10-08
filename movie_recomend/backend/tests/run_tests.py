"""
Executable Python Test Runner for MovieMind DWM & ML Test Suite.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def run_all_tests():
    print("=== Starting MovieMind Automated DWM & ML Test Runner ===")
    
    from app.data_loader import data_loader
    from app.ml.engine import ml_engine
    from app.mining.apriori import apriori_miner
    from app.warehouse.schema import init_warehouse_schema
    from app.warehouse.etl import run_warehouse_etl
    from app.warehouse.warehouse import get_warehouse_summary
    from app.warehouse.olap import olap_engine
    from app.recommender.content_based import ContentBasedRecommender
    from app.recommender.collaborative import CollaborativeRecommender
    from app.recommender.hybrid import HybridRecommender
    from app.recommender.evaluation import recommender_evaluator

    # Ensure warehouse ETL is populated
    summary = get_warehouse_summary()
    if summary["status"] != "online" or summary["tables"].get("FACT_RATING", 0) == 0:
        print("Populating Star Schema Data Warehouse...")
        run_warehouse_etl(force_rebuild=True)

    ml_engine.load_models()
    apriori_miner.load_rules()

    tests = []

    # 1. Star Schema Test
    def test_star_schema():
        s = get_warehouse_summary()
        assert s["status"] == "online"
        assert s["tables"]["FACT_RATING"] > 0
        assert s["tables"]["DIM_MOVIE"] > 0
        assert s["tables"]["DIM_DATE"] > 0
        return f"Star Schema verified: {s['tables']['FACT_RATING']} facts, {s['tables']['DIM_MOVIE']} movies."
    tests.append(("Physical Star Schema", test_star_schema))

    # 2. OLAP Roll-up Test
    def test_rollup():
        r_year = olap_engine.rollup("year")
        assert r_year["operation"] == "ROLL-UP"
        assert len(r_year["data"]) > 0
        r_month = olap_engine.rollup("month")
        assert len(r_month["data"]) >= len(r_year["data"])
        return f"Roll-up verified: {len(r_year['data'])} years, {len(r_month['data'])} months."
    tests.append(("OLAP Roll-up (Day->Month->Quarter->Year)", test_rollup))

    # 3. OLAP Drill-down Test
    def test_drilldown():
        d_years = olap_engine.drilldown()
        assert d_years["operation"] == "DRILL-DOWN"
        first_year = d_years["data"][0]["sub_key"]
        d_q = olap_engine.drilldown(target_year=first_year)
        assert len(d_q["data"]) > 0
        return f"Drill-down verified: Year {first_year} -> {len(d_q['data'])} Quarters."
    tests.append(("OLAP Drill-down (Year->Quarter->Month->Day)", test_drilldown))

    # 4. OLAP Slice & Dice Test
    def test_slice_dice():
        s = olap_engine.slice("genre", "Action")
        assert s["operation"] == "SLICE"
        assert len(s["top_movies"]) > 0
        d = olap_engine.dice("Action", 2015, 2024, 3.5)
        assert d["operation"] == "DICE"
        return f"Slice & Dice verified: Slice ratings={s['slice_summary']['total_ratings']}, Dice results={d['count']}."
    tests.append(("OLAP Slice & Dice", test_slice_dice))

    # 5. OLAP Pivot Test
    def test_pivot():
        p = olap_engine.pivot("genre", "decade", "avg_rating")
        assert p["operation"] == "PIVOT"
        assert len(p["columns"]) > 0
        assert len(p["matrix"]) > 0
        return f"Pivot matrix verified: {len(p['matrix'])} rows x {len(p['columns'])} columns."
    tests.append(("OLAP Pivot (Cross-Tabulation)", test_pivot))

    # 6. Decision Tree & Naive Bayes Test
    def test_classification():
        m = ml_engine.get_classification_metrics()
        assert "decision_tree" in m and "naive_bayes" in m
        assert m["decision_tree"]["accuracy"] > 0.4
        assert len(m["decision_tree"]["confusion_matrix"]) == 3
        pred = ml_engine.predict_classification(1, "decision_tree", movielens_user_id=1)
        assert pred["status"] == "success"
        return f"Classification verified: DT Acc={m['decision_tree']['accuracy']*100:.1f}%, NB Acc={m['naive_bayes']['accuracy']*100:.1f}%, Pred={pred['predicted_class']}."
    tests.append(("Decision Tree & Naive Bayes Classification", test_classification))

    # 7. Apriori Association Rules Test
    def test_apriori():
        rules = apriori_miner.get_rules(limit=5)
        assert rules["status"] == "success"
        assert len(rules["rules"]) > 0
        r0 = rules["rules"][0]
        return f"Apriori verified: {rules['total_rules']} rules mined. Top lift: {r0['lift']}x ({r0['antecedent_title'][:15]} -> {r0['consequent_title'][:15]})."
    tests.append(("Apriori Association Rule Mining", test_apriori))

    # 8. Recommendation Offline Evaluation Test
    def test_evaluation():
        data_loader.load_data()
        cb = ContentBasedRecommender()
        cb.fit(data_loader.movies_df)
        cl = CollaborativeRecommender()
        cl.fit(data_loader.ratings_df, data_loader.movies_df)
        hy = HybridRecommender(cb, cl)
        res = recommender_evaluator.load_or_compute(cb, cl, hy)
        assert res["status"] == "success"
        ndcg_hy = res["models_comparison"]["hybrid"]["ndcg_10"]
        return f"Recommendation Evaluation verified: Hybrid NDCG@10 = {ndcg_hy:.4f} across {res['evaluated_users_count']} test users."
    tests.append(("Recommendation Offline Evaluation (NDCG@K, Precision@K)", test_evaluation))

    # Run tests
    passed = 0
    failed = 0
    for name, test_fn in tests:
        try:
            t0 = time.time()
            msg = test_fn()
            el = (time.time() - t0) * 1000
            print(f"  [PASS] {name} ({el:.1f}ms) -> {msg}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {name} -> Error: {e}")
            failed += 1

    print(f"\n=== Test Results: {passed} Passed, {failed} Failed ===")
    if failed > 0:
        sys.exit(1)
    else:
        print("All DWM and ML components PASSED verification successfully!")

if __name__ == "__main__":
    run_all_tests()
