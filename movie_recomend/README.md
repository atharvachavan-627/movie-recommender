# MovieMind – Hybrid Movie Recommendation System

**MovieMind** is a full-stack Data Warehousing & Mining (DWM) academic mini-project that builds a hybrid movie recommendation system by combining **Content-Based Filtering** (TF-IDF genre vectors + Cosine Similarity) and **Item-Item Collaborative Filtering** (sparse user-item interaction matrices) on the Kaggle MovieLens 25M dataset.

---

## 🌟 Key Features

1. **Content-Based Recommendation Engine**
   - Extracts movie genre text signals.
   - Constructs TF-IDF feature vectors (`sklearn.feature_extraction.text.TfidfVectorizer`).
   - Mines document similarity using Cosine Similarity.

2. **Collaborative Filtering Engine**
   - Ingests 25 Million user rating entries.
   - Builds sparse SciPy CSR interaction matrices (`scipy.sparse.csr_matrix`).
   - Calculates L2-normalized item-item cosine similarity scores.

3. **Hybrid Recommendation Engine**
   - Combines normalized Content ($S_{\text{content}}$) and Collaborative ($S_{\text{collab}}$) scores onto comparable $[0, 1]$ scales.
   - Mathematically explainable hybrid formulation:  
     $$\text{HybridScore} = w_{\text{content}} \times \text{normalized\_content\_score} + w_{\text{collab}} \times \text{normalized\_collaborative\_score}$$
   - Default initial baseline configuration:
     $$\text{CONTENT\_WEIGHT} = 0.4, \quad \text{COLLABORATIVE\_WEIGHT} = 0.6$$
     *(Note: The $0.4 / 0.6$ weighting serves as an initial empirical baseline configuration for balancing item attributes and user interaction signals, rather than a globally optimal constant.)*
   - Each recommendation result explicitly exposes `content_score`, `collaborative_score`, `hybrid_score`, and natural language explanations.


4. **Analytics Dashboard**
   - Displays dataset aggregations: Total Movies (62,423), Total Users (162,541), Total Ratings (25M), Global Average Rating (3.53 ★).
   - Recharts visual graphs: Genre Volume Distribution, Rating Value Histogram, and Top Rated Popular Movies.

5. **Modern Dark Cinematic UI**
   - High-end dark theme (`#080b11`), glassmorphism, responsive grid layout, live autocomplete search, genre filter chips, and interactive algorithm weight sliders.

---

## 🏗️ Technology Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pandas, NumPy, scikit-learn, SciPy
- **Frontend:** React 19, Vite, Recharts, Lucide React, Custom Modern CSS
- **Dataset:** Kaggle MovieLens 25M (`movies.csv`, `ratings.csv`)

---

## 🚀 Quick Start Guide

### 1. Start Backend Server
```bash
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*Backend API will run at:* `http://127.0.0.1:8000`  
*Swagger API Docs:* `http://127.0.0.1:8000/docs`

### 2. Start Frontend Application
```bash
cd frontend
npm run dev
```
*Frontend Web Application will run at:* `http://localhost:5173/`

### 3. Authentication Configuration

MovieMind uses a local SQLite user database (`backend/moviemind.db` by default), bcrypt password hashes, and short-lived JWT access tokens. The database and `users` table are created automatically when the FastAPI application starts. Registration validates the name, email, username, and password, rejects duplicate accounts, hashes the password, and signs the new session. Login accepts either username or email and returns a bearer token plus the public user profile. The React `AuthContext` restores the session, attaches the token to MovieMind API requests, redirects logged-out users to `/login`, and clears the session after a 401 or logout.

Set a secret before starting the backend. Do not commit it:

```powershell
$env:MOVIMIND_JWT_SECRET = "replace-with-a-long-random-secret"
$env:MOVIMIND_JWT_ALGORITHM = "HS256"
$env:MOVIMIND_ACCESS_TOKEN_EXPIRE_MINUTES = "60"
$env:MOVIMIND_DATABASE_URL = "sqlite:///moviemind.db"
$env:MOVIMIND_FRONTEND_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173"
```

Authentication endpoints are `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`. `/api/health` remains public for the connection indicator; movie, recommendation, and analytics endpoints require `Authorization: Bearer <access_token>`. No demo account is created automatically. Use the Sign Up screen to create one.

---

## 📡 API Endpoints Summary

- `GET /api/health` — System status & dataset stats
- `GET /api/movies` — Paginated list of movies with genre filter
- `GET /api/movies/search` — Search movies by title keyword
- `GET /api/movies/{movie_id}` — Get single movie details
- `GET /api/recommendations/content/{movie_id}` — Content-Based TF-IDF recommendations
- `GET /api/recommendations/collaborative/{movie_id}` — Item-Item Collaborative Filtering recommendations
- `GET /api/recommendations/hybrid/{movie_id}` — Hybrid weighted recommendations
- `GET /api/analytics/overview` — Dataset summary metrics
- `GET /api/analytics/popular` — Top popular movies by rating volume
- `GET /api/analytics/genres` — Movie count & average rating per genre
- `GET /api/analytics/ratings` — Rating frequency distribution
