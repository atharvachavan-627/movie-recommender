# MovieMind – Complete Data Warehousing, Mining, Machine Learning & Hybrid Recommendation System

**MovieMind** is an enterprise-grade academic Data Warehousing & Data Mining (DWM) project integrating a **Physical Star Schema Data Warehouse**, **Multi-Dimensional OLAP Engine**, **Supervised Classification & Regression**, **Unsupervised K-Means & PCA**, **Apriori Association Rule Mining**, and an **Explainable Hybrid Recommendation Engine** built on the MovieLens dataset.

---

## 🌟 Core System Pillars

### 1. 🏛️ Physical Star Schema & Data Warehouse Layer
- **Relational Data Warehouse:** Dedicated SQLite warehouse (`backend/datawarehouse/moviemind_dw.db`) fully decoupled from operational application tables.
- **Dimensional Modeling:**
  - `DIM_MOVIE` (`movie_key`, `movie_id`, `title`, `release_year`, `genres`)
  - `DIM_USER` (`user_key`, `user_id`)
  - `DIM_DATE` (`date_key`, `full_date`, `day`, `month`, `month_name`, `quarter`, `year`, `decade`)
  - `DIM_GENRE` (`genre_key`, `genre_name`)
  - `FACT_RATING` (`rating_key`, `user_key`, `movie_key`, `date_key`, `genre_key`, `rating`)
- **Reproducible Star Schema ETL Pipeline:** Automated Python script (`python -m app.warehouse.etl`) with surrogate key derivation, foreign-key integrity validation, and duplicate fact checking.

### 2. 🧊 Multi-Dimensional OLAP Engine
Direct SQL analytical cube executing the 5 core OLAP operations:
1. **Roll-Up:** Navigates up the time hierarchy ($\text{Day} \rightarrow \text{Month} \rightarrow \text{Quarter} \rightarrow \text{Year} \rightarrow \text{Decade}$).
2. **Drill-Down:** Navigates down the time hierarchy ($\text{Year} \rightarrow \text{Quarter} \rightarrow \text{Month} \rightarrow \text{Day}$).
3. **Slice:** Extracts a 2D cross-section by fixing a single dimension (e.g., $\text{Genre} = \text{'Action'}$).
4. **Dice:** Extracts a sub-cube by specifying bounding conditions across multiple dimensions simultaneously ($\text{Genre} \times \text{Year Range} \times \text{Rating Min}$).
5. **Pivot:** Computes a 2D cross-tabulation matrix ($\text{Rows} = \text{Genre}, \text{Columns} = \text{Decade}, \text{Measure} = \text{Average Rating / Rating Count}$).

### 3. 🧠 Machine Learning & Classification Suite
- **Supervised Classification:**
  - **Decision Tree Classifier:** Classifies movie rating tiers into $\text{DISLIKE} (< 2.5\star)$, $\text{NEUTRAL} (2.5 - 4.0\star)$, and $\text{LIKE} (\ge 4.0\star)$ with $68.2\%$ test accuracy, tree depth, leaf count, and feature importances.
  - **Gaussian Naive Bayes:** Computes conditional posterior probabilities across rating classes.
  - **Zero Data Leakage:** Time-aware chronological 80/20 train/test split.
- **Supervised Regression:**
  - Evaluates **Linear Regression**, **Random Forest Regressor**, and **HistGradientBoosting Regressor** on test interactions (MAE, MSE, RMSE, $R^2$).
- **Unsupervised Clustering & PCA:**
  - **K-Means Clustering:** Evaluated over $K \in [2, 7]$ with Elbow Method (Inertia) and Silhouette score curves.
  - **PCA 2D Projection:** Principal Component Analysis for 2D visual cluster scatter projection.

### 4. 🛒 Apriori Association Rule Mining
- **Frequent Pattern Mining:** Mined across positive user baskets (ratings $\ge 4.0\star$).
- **Rule Metrics:** Computes $\text{Support}$, $\text{Confidence}$, and $\text{Lift}$ ($X \Rightarrow Y$).
- **Natural Language Explanations:** "If users liked *Movie A*, they are $N\times$ more likely to like *Movie B* (Confidence: $X\%$, Lift: $Y$)".

### 5. 🎯 Hybrid Recommendation Engine & Offline Evaluation
- **Content-Based:** TF-IDF Genre vectorization + Cosine Similarity.
- **Collaborative:** Compressed Sparse Row (`csr_matrix`) item-item cosine similarity.
- **Weighted Hybrid Formula:**  
  $$\text{HybridScore} = w_{\text{content}} \times \text{normalized\_content\_score} + w_{\text{collab}} \times \text{normalized\_collaborative\_score}$$
- **Offline Evaluation Suite:** Quantitatively proves hybrid performance on held-out test interactions using **Precision@K**, **Recall@K**, **NDCG@K**, and **Catalog Coverage**.

---

## 🏗️ Technology Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pandas, NumPy, Scikit-Learn, SciPy, SQLite3, Joblib
- **Frontend:** React 19, Vite, Recharts, Lucide React, Custom Responsive CSS
- **Dataset:** Kaggle MovieLens Dataset (`movies.csv`, `ratings.csv`, `tags.csv`, `links.csv`)

---

## 🚀 Quick Start Guide

### 1. Run Backend Server & Initialize Data Warehouse
```bash
cd backend
# Rebuild Star Schema ETL & train all ML models (if not already built)
.\venv\Scripts\python.exe -m app.warehouse.etl
.\venv\Scripts\python.exe -m app.ml.train

# Start FastAPI API server
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*Backend API:* `http://127.0.0.1:8000`  
*Swagger Interactive Docs:* `http://127.0.0.1:8000/docs`

### 2. Start Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
*Frontend Web Application:* `http://localhost:5173/`

### 3. Run Automated DWM & ML Test Suite
```bash
cd backend
.\venv\Scripts\python.exe tests/run_tests.py
```

---

## 📡 Complete API Reference

### Data Warehouse & OLAP
- `GET /api/warehouse/summary` — Physical Star Schema table counts & statistics
- `POST /api/warehouse/etl/rebuild` — Triggers idempotent ETL pipeline rebuild
- `GET /api/olap/rollup?level=year|month|quarter|day|decade` — Date hierarchy roll-up
- `GET /api/olap/drilldown?target_year=...&target_quarter=...` — Hierarchical drill-down
- `GET /api/olap/slice?dimension=genre|year&value=Action` — Single dimension slice
- `GET /api/olap/dice?genre=Action&year_min=2015&year_max=2024&rating_min=3.5` — Multi-dimensional dice
- `GET /api/olap/pivot?row_dim=genre&col_dim=decade&measure=avg_rating` — 2D pivot matrix

### Association Rule Mining & Apriori
- `GET /api/mining/association-rules?min_support=0.005&min_confidence=0.25&min_lift=1.2` — Frequent movie rules
- `GET /api/mining/movie-rules/{movie_id}` — Rules relevant to specific movie

### Machine Learning & Classification
- `GET /api/ml/classification/metrics` — Decision Tree vs. Naive Bayes comparison & Confusion Matrices
- `POST /api/ml/classification/predict` — Classify rating into DISLIKE / NEUTRAL / LIKE
- `GET /api/ml/validation` — Chronological split & validation parameters
- `GET /api/ml/evaluation` — Regression metrics (MAE, MSE, RMSE, $R^2$)
- `GET /api/ml/feature-importance` — Random Forest feature importances
- `GET /api/ml/clusters` — K-Means profiles, Elbow/Silhouette curves & 2D PCA points
- `POST /api/ml/predict-rating` — Continuous rating prediction

### Recommendations & Offline Benchmark
- `GET /api/recommendations/content/{movie_id}` — Content-Based TF-IDF recommendations
- `GET /api/recommendations/collaborative/{movie_id}` — Item-Item Sparse Collaborative recommendations
- `GET /api/recommendations/hybrid/{movie_id}` — Weighted Hybrid recommendations
- `GET /api/recommendations/evaluation` — Offline evaluation benchmark (NDCG@K, Precision@K, Recall@K)
- `GET /api/dwm/data-quality` — DWM Data Quality & ETL verification metrics
