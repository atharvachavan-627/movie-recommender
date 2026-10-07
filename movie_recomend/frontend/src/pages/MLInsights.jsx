import { useEffect, useState } from "react";
import {
  Brain,
  CheckCircle2,
  Database,
  Film,
  Layers,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import SearchBox from "../components/SearchBox";
import {
  fetchMLValidation,
  fetchMLEvaluation,
  fetchMLFeatureImportance,
  fetchMLClusters,
  fetchMLDemoUsers,
  fetchMLUserProfile,
  linkMovieLensUser,
  rateMovie,
  predictRating
} from "../services/api";

const CLUSTER_COLORS = ["#6D4AFF", "#0E7C86", "#E5383B", "#F59E0B", "#0EA5E9", "#10B981", "#8B5CF6"];
const STARTER_MOVIES = [
  { movieId: 1, title: "Toy Story (1995)" },
  { movieId: 2571, title: "Matrix, The (1999)" },
  { movieId: 58559, title: "Dark Knight, The (2008)" },
  { movieId: 79132, title: "Inception (2010)" },
  { movieId: 109487, title: "Interstellar (2014)" },
];

export default function MLInsights() {
  const [validation, setValidation] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [importance, setImportance] = useState([]);
  const [clustering, setClustering] = useState(null);
  const [demoUsers, setDemoUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Prediction State
  const [selectedMovie, setSelectedMovie] = useState(STARTER_MOVIES[1]); // The Matrix by default
  const [selectedModel, setSelectedModel] = useState("random_forest");
  const [predictionResult, setPredictionResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState("");

  const refreshProfile = () => {
    fetchMLUserProfile().then(setUserProfile).catch(console.error);
  };

  useEffect(() => {
    Promise.all([
      fetchMLValidation(),
      fetchMLEvaluation(),
      fetchMLFeatureImportance(),
      fetchMLClusters(),
      fetchMLDemoUsers(),
      fetchMLUserProfile(),
    ])
      .then(([v, e, fi, cl, du, up]) => {
        setValidation(v);
        setEvaluation(e);
        setImportance(fi);
        setClustering(cl);
        setDemoUsers(du);
        setUserProfile(up);
      })
      .catch((err) => {
        console.error("Failed to load ML insights:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePredict = async () => {
    if (!selectedMovie) return;
    setPredicting(true);
    setPredictionResult(null);
    try {
      const res = await predictRating(selectedMovie.movieId, selectedModel);
      setPredictionResult(res);
    } catch (err) {
      console.error(err);
      setPredictionResult({ status: "error", message: err.message || "Failed to compute prediction" });
    } finally {
      setPredicting(false);
    }
  };

  const handleRateMovie = async (movieId, stars) => {
    try {
      await rateMovie(movieId, stars);
      setRatingSuccessMsg(`Rated ${stars} ★ successfully! Preference updated.`);
      setTimeout(() => setRatingSuccessMsg(""), 3000);
      refreshProfile();
      // Re-run prediction if selected
      if (selectedMovie && selectedMovie.movieId === movieId) {
        handlePredict();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkUser = async (uid) => {
    try {
      await linkMovieLensUser(uid);
      refreshProfile();
      setRatingSuccessMsg(`Linked to MovieLens User #${uid}. Full historical rating profile active.`);
      setTimeout(() => setRatingSuccessMsg(""), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="container page">
        <div className="skeleton skeleton--hero" style={{ height: "400px" }} />
      </div>
    );
  }

  // Inertia and Silhouette data for Recharts
  const kData = clustering?.k_selection
    ? clustering.k_selection.k_values.map((k, idx) => ({
        k: `K=${k}`,
        inertia: clustering.k_selection.inertias[idx],
        silhouette: clustering.k_selection.silhouettes[idx],
      }))
    : [];

  const isColdStart =
    !userProfile?.linked_movielens_user_id && (!userProfile?.custom_ratings || userProfile.custom_ratings.length === 0);

  return (
    <div className="container page">
      <header className="page__head">
        <div className="pill"><Brain size={14} /> Real Machine Learning Pipeline</div>
        <h1>Machine Learning & Movie Clusters</h1>
        <p>
          Trained rating prediction models, test set benchmarks, feature importances, and K-Means clustering derived
          strictly from the MovieLens dataset.
        </p>
      </header>

      {/* 1. Real Data Validation Section */}
      <section className="card panel">
        <h3 className="panel__title">
          <Database size={18} /> Dataset Validation & Training Partition
        </h3>
        <p className="muted" style={{ marginBottom: "16px", fontSize: "0.9rem" }}>
          Metrics computed on loaded MovieLens files with time-aware train/test separation (80% train, 20% test).
        </p>
        <div className="stats-grid">
          <div className="card stat">
            <span className="stat__icon bg-hybrid"><Film size={20} /></span>
            <div>
              <div className="stat__label">Total Movies</div>
              <div className="stat__value">{(validation?.total_movies || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="card stat">
            <span className="stat__icon bg-content"><Database size={20} /></span>
            <div>
              <div className="stat__label">Total Ratings</div>
              <div className="stat__value">{(validation?.total_ratings || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="card stat">
            <span className="stat__icon bg-collab"><Users size={20} /></span>
            <div>
              <div className="stat__label">Total Users</div>
              <div className="stat__value">{(validation?.total_users || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="card stat">
            <span className="stat__icon bg-star"><Star size={20} /></span>
            <div>
              <div className="stat__label">Global Average</div>
              <div className="stat__value">{validation?.avg_rating || 3.5} ★</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px", fontSize: "0.9rem" }}>
          <div className="card" style={{ padding: "12px 16px" }}>
            <span className="muted">Training Samples:</span> <strong>{validation?.train_samples?.toLocaleString()}</strong>
          </div>
          <div className="card" style={{ padding: "12px 16px" }}>
            <span className="muted">Test Samples (Held-out):</span> <strong>{validation?.test_samples?.toLocaleString()}</strong>
          </div>
          <div className="card" style={{ padding: "12px 16px" }}>
            <span className="muted">Selected Clusters (K):</span> <strong>{validation?.selected_k}</strong>
          </div>
          <div className="card" style={{ padding: "12px 16px" }}>
            <span className="muted">Silhouette Score:</span> <strong>{validation?.silhouette_score}</strong>
          </div>
          <div className="card" style={{ padding: "12px 16px" }}>
            <span className="muted">Rating Scale:</span> <strong>{validation?.rating_min} – {validation?.rating_max} ★</strong>
          </div>
        </div>
      </section>

      {/* 2. Interactive Rating Prediction & User Onboarding / Cold Start */}
      <section className="card panel ml-section">
        <h3 className="panel__title">
          <Sparkles size={18} /> Real-Time Rating Prediction
        </h3>
        <p className="muted" style={{ marginBottom: "16px", fontSize: "0.92rem" }}>
          Predicts how much a user will like a movie based on their historical preferences and trained models.
        </p>

        {ratingSuccessMsg && (
          <div style={{ background: "#e8f7ef", color: "#0b7a4b", padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
            <CheckCircle2 size={18} /> {ratingSuccessMsg}
          </div>
        )}

        {/* User Context & Profile Status */}
        <div style={{ background: "var(--tint)", padding: "16px 20px", borderRadius: "12px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Active User Context:</span>
              <div style={{ fontWeight: "700", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                <UserCheck size={18} color="var(--brand)" />
                {userProfile?.linked_movielens_user_id ? (
                  <span>Linked MovieLens User #{userProfile.linked_movielens_user_id}</span>
                ) : userProfile?.custom_ratings_count > 0 ? (
                  <span>MovieMind User Profile ({userProfile.custom_ratings_count} rated movies)</span>
                ) : (
                  <span style={{ color: "var(--brand)" }}>Cold Start (New Account – 0 ratings)</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Switch Demo Profile:</span>
              <select
                className="chip"
                style={{ cursor: "pointer", background: "#fff", borderColor: "var(--line)" }}
                value={userProfile?.linked_movielens_user_id || ""}
                onChange={(e) => {
                  if (e.target.value) handleLinkUser(parseInt(e.target.value));
                }}
              >
                <option value="">-- Custom Profile --</option>
                {demoUsers.map((u) => (
                  <option key={u.movielens_user_id} value={u.movielens_user_id}>
                    MovieLens User #{u.movielens_user_id} ({u.rating_count} ratings, {u.avg_rating}★)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cold Start Guidance & Star Rating */}
          {isColdStart && (
            <div className="coldstart-box" style={{ marginTop: "16px" }}>
              <h4><AlertCircle size={18} /> Insufficient Rating History for Personalized ML Prediction</h4>
              <p style={{ fontSize: "0.9rem", color: "#613c00" }}>
                Newly registered accounts have 0 ratings. To prevent fake predictions, rate real movies from the dataset below
                to build your preference profile, or select a MovieLens user above for demonstration.
              </p>
              <div className="coldstart-grid">
                {STARTER_MOVIES.map((m) => (
                  <div key={m.movieId} className="coldstart-item">
                    <div className="movie-name">{m.title}</div>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRateMovie(m.movieId, star)}
                          title={`Rate ${star} stars`}
                        >
                          <Star size={18} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prediction Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "12px", alignItems: "center" }}>
          <div>
            <label className="muted" style={{ fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>Target Movie to Predict:</label>
            <SearchBox size="md" onSelect={(m) => setSelectedMovie(m)} placeholder="Search real movie title..." />
          </div>

          <div>
            <label className="muted" style={{ fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>ML Regressor:</label>
            <select
              className="btn btn--secondary"
              style={{ padding: "10px 14px", height: "42px" }}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="random_forest">Random Forest Regressor</option>
              <option value="gradient_boosting">Gradient Boosting Regressor</option>
              <option value="linear_regression">Linear Regression</option>
            </select>
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <button className="btn btn--primary" style={{ height: "42px" }} onClick={handlePredict} disabled={predicting}>
              {predicting ? "Predicting..." : "Predict Rating"}
            </button>
          </div>
        </div>

        {selectedMovie && (
          <div style={{ marginTop: "12px", fontSize: "0.9rem" }}>
            Selected: <strong>{selectedMovie.title}</strong>
          </div>
        )}

        {/* Prediction Output Card */}
        {predictionResult && (
          <div style={{ marginTop: "20px" }}>
            {predictionResult.status === "insufficient_history" ? (
              <div className="empty empty--box" style={{ padding: "20px" }}>
                <AlertCircle size={24} color="var(--brand)" />
                <h4>Insufficient History</h4>
                <p>{predictionResult.message}</p>
              </div>
            ) : predictionResult.status === "error" ? (
              <div className="empty empty--box" style={{ padding: "20px" }}>
                <p>{predictionResult.message}</p>
              </div>
            ) : (
              <div className="card" style={{ padding: "20px", background: "linear-gradient(135deg, rgba(109,74,255,0.06), rgba(229,56,59,0.06))", borderColor: "rgba(109,74,255,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <span className="ml-badge ml-badge--rf">{predictionResult.model}</span>
                    <h3 style={{ marginTop: "8px", fontSize: "1.3rem" }}>{predictionResult.movie_title}</h3>
                    <p className="muted" style={{ fontSize: "0.88rem" }}>User: {predictionResult.user_id}</p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", fontWeight: "600" }}>MODEL PREDICTED RATING</div>
                    <div style={{ fontSize: "2.4rem", fontWeight: "800", color: "var(--brand)", lineHeight: "1.1" }}>
                      {predictionResult.predicted_rating} <span style={{ fontSize: "1.2rem", color: "var(--star)" }}>★</span>
                    </div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>Scale: 0.5 – 5.0</div>
                  </div>
                </div>

                {predictionResult.features_used && (
                  <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", fontSize: "0.85rem" }}>
                    <div><span className="muted">User Historical Mean:</span> <strong>{predictionResult.features_used.user_mean_rating} ★</strong></div>
                    <div><span className="muted">User Ratings Count:</span> <strong>{predictionResult.features_used.user_rating_count}</strong></div>
                    <div><span className="muted">Movie Global Mean:</span> <strong>{predictionResult.features_used.movie_mean_rating} ★</strong></div>
                    <div><span className="muted">Movie Rating Count:</span> <strong>{predictionResult.features_used.movie_rating_count}</strong></div>
                    <div><span className="muted">Release Year:</span> <strong>{predictionResult.features_used.release_year}</strong></div>
                    <div><span className="muted">User Genre Affinity:</span> <strong>{predictionResult.features_used.user_genre_affinity} ★</strong></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. ML Model Evaluation Benchmark Table */}
      <section className="card panel ml-section">
        <h3 className="panel__title">
          <TrendingUp size={18} /> Model Evaluation Benchmark (Held-Out Test Set)
        </h3>
        <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "16px" }}>
          Metrics computed on <strong>{validation?.test_samples?.toLocaleString()}</strong> real held-out ratings from the MovieLens dataset.
        </p>

        <div className="ml-table-wrapper">
          <table className="ml-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>MAE (Mean Absolute Error)</th>
                <th>MSE (Mean Squared Error)</th>
                <th>RMSE (Root Mean Squared Error)</th>
                <th>R² Score</th>
              </tr>
            </thead>
            <tbody>
              {evaluation &&
                Object.entries(evaluation).map(([key, m]) => (
                  <tr key={key}>
                    <td>
                      <span className={`ml-badge ml-badge--${key === "random_forest" ? "rf" : key === "linear_regression" ? "lr" : "gb"}`}>
                        {m.name}
                      </span>
                    </td>
                    <td className={key === "gradient_boosting" ? "highlight" : ""}>{m.mae.toFixed(4)}</td>
                    <td>{m.mse.toFixed(4)}</td>
                    <td>{m.rmse.toFixed(4)}</td>
                    <td className={key === "linear_regression" ? "highlight" : ""}>{m.r2.toFixed(4)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Feature Importance & K Selection */}
      <div className="grid-2 ml-section">
        <section className="card panel">
          <h3 className="panel__title">
            <Layers size={18} /> Random Forest Feature Importance
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "12px" }}>
            Extracted directly from <code>model.feature_importances_</code> on trained estimators.
          </p>
          <div className="chart" style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={importance.slice(0, 7)}
                margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" horizontal={false} />
                <XAxis type="number" stroke="#7B8099" fontSize={12} tickLine={false} />
                <YAxis type="category" dataKey="feature" stroke="#7B8099" fontSize={11} width={130} tickLine={false} />
                <Tooltip
                  formatter={(val) => [`${(Number(val) * 100).toFixed(2)}%`, "Importance"]}
                  contentStyle={{ background: "#fff", border: "1px solid #E4E6F0", borderRadius: 8 }}
                />
                <Bar dataKey="importance" fill="#6D4AFF" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card panel">
          <h3 className="panel__title">
            <TrendingUp size={18} /> K-Means: Inertia & Silhouette Selection
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "12px" }}>
            Evaluated on real movie vectors across K=2 to 7. Selected <strong>K={clustering?.k_selection?.selected_k}</strong> (Silhouette = {clustering?.k_selection?.selected_silhouette}).
          </p>
          <div className="chart" style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" vertical={false} />
                <XAxis dataKey="k" stroke="#7B8099" fontSize={12} />
                <YAxis yAxisId="left" stroke="#6D4AFF" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#0E7C86" fontSize={11} domain={[0.1, 0.25]} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E4E6F0", borderRadius: 8 }} />
                <Line yAxisId="left" type="monotone" dataKey="inertia" stroke="#6D4AFF" strokeWidth={2} name="Inertia" />
                <Line yAxisId="right" type="monotone" dataKey="silhouette" stroke="#0E7C86" strokeWidth={2.5} name="Silhouette Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* 5. Real 2D PCA & Cluster Visualization */}
      <section className="card panel ml-section">
        <h3 className="panel__title">
          <Film size={18} /> Movie Feature Space (2D PCA Projection)
        </h3>
        <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "16px" }}>
          Principal Component Analysis (PCA) projected onto 2 dimensions from real genre, rating, and year features.
          Explained variance: PC1 = {(validation?.pca_explained_variance?.[0] * 100 || 10.3).toFixed(1)}%, PC2 = {(validation?.pca_explained_variance?.[1] * 100 || 9.8).toFixed(1)}%.
        </p>

        <div className="chart" style={{ height: "360px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" />
              <XAxis type="number" dataKey="pca_x" name="PC1" stroke="#7B8099" fontSize={12} tickLine={false} />
              <YAxis type="number" dataKey="pca_y" name="PC2" stroke="#7B8099" fontSize={12} tickLine={false} />
              <ZAxis range={[30, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #E4E6F0", padding: "10px 14px", borderRadius: 8, fontSize: "0.85rem", boxShadow: "0 6px 18px rgba(0,0,0,0.1)" }}>
                      <div style={{ fontWeight: "700" }}>{d.title}</div>
                      <div className="muted">{d.genres}</div>
                      <div style={{ marginTop: "4px" }}>
                        Cluster {d.cluster} • {d.avg_rating} ★ ({(d.rating_count || 0).toLocaleString()} ratings)
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter name="Movies" data={clustering?.pca_scatter || []}>
                {(clustering?.pca_scatter || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CLUSTER_COLORS[entry.cluster % CLUSTER_COLORS.length]} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Dynamic Cluster Details */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "24px" }}>
          {clustering?.clusters?.map((c) => (
            <div key={c.cluster_id} className="cluster-card">
              <div className="cluster-card__head">
                <span className="cluster-tag" style={{ background: CLUSTER_COLORS[c.cluster_id % CLUSTER_COLORS.length] + "20", color: CLUSTER_COLORS[c.cluster_id % CLUSTER_COLORS.length] }}>
                  Cluster {c.cluster_id}
                </span>
                <span className="muted" style={{ fontSize: "0.85rem" }}>{c.movie_count.toLocaleString()} movies</span>
              </div>
              <div>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Dominant Genre Attributes:</span>
                <div style={{ fontWeight: "700", marginTop: "2px" }}>{c.dominant_genres}</div>
              </div>
              <div>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Average Cluster Rating:</span> <strong>{c.avg_rating} ★</strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginBottom: "6px" }}>Sample Popular Titles:</span>
                <div className="chips">
                  {c.sample_movies?.map((sm) => (
                    <span key={sm.movieId} className="chip" style={{ fontSize: "0.78rem" }}>
                      {sm.title.replace(/\s*\(\d{4}\)$/, "")} ({sm.avg_rating}★)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
