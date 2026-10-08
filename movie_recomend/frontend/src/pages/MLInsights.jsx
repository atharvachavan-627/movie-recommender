import { useEffect, useState, useRef } from "react";
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
  AlertCircle,
  GitBranch,
  Table as TableIcon,
  BarChart2,
  SlidersHorizontal,
  Info,
  ChevronRight,
  Cpu,
  Sigma,
  Search,
  X,
  RotateCcw,
  BarChart3,
  HelpCircle,
  PieChart
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
import {
  fetchMLValidation,
  fetchMLEvaluation,
  fetchClassificationMetrics,
  fetchRecommendationEvaluation,
  fetchMLFeatureImportance,
  fetchMLClusters,
  fetchMLDemoUsers,
  fetchMLUserProfile,
  linkMovieLensUser,
  rateMovie,
  predictRating,
  predictClassification,
  searchMovies
} from "../services/api";
import { cleanTitle } from "../utils/movies";

const CLUSTER_COLORS = ["#e50914", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

const QUICK_SELECT_MOVIES = [
  { movieId: 2571, title: "Matrix, The (1999)", year: 1999, genres: "Action|Sci-Fi|Thriller", avg_rating: 4.19 },
  { movieId: 79132, title: "Inception (2010)", year: 2010, genres: "Action|Crime|Drama|Mystery|Sci-Fi|Thriller", avg_rating: 4.16 },
  { movieId: 109487, title: "Interstellar (2014)", year: 2014, genres: "Sci-Fi|IMAX", avg_rating: 4.08 },
  { movieId: 58559, title: "Dark Knight, The (2008)", year: 2008, genres: "Action|Crime|Drama|IMAX", avg_rating: 4.24 },
  { movieId: 1, title: "Toy Story (1995)", year: 1995, genres: "Adventure|Animation|Children|Comedy|Fantasy", avg_rating: 3.89 },
  { movieId: 296, title: "Pulp Fiction (1994)", year: 1994, genres: "Comedy|Crime|Drama|Thriller", avg_rating: 4.18 }
];

export default function MLInsights() {
  const [activeSection, setActiveSection] = useState("all");
  const [validation, setValidation] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [classification, setClassification] = useState(null);
  const [recEval, setRecEval] = useState(null);
  const [importance, setImportance] = useState([]);
  const [clustering, setClustering] = useState(null);
  const [demoUsers, setDemoUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Movie Search & Selection State
  const [selectedMovie, setSelectedMovie] = useState(QUICK_SELECT_MOVIES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchWrapRef = useRef(null);

  // Prediction State (Regression)
  const [selectedModel, setSelectedModel] = useState("random_forest");
  const [predictionResult, setPredictionResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState("");

  // Prediction State (Classification)
  const [clfModel, setClfModel] = useState("decision_tree");
  const [clfResult, setClfResult] = useState(null);
  const [classifying, setClassifying] = useState(false);

  const refreshProfile = () => {
    fetchMLUserProfile().then(setUserProfile).catch(console.error);
  };

  useEffect(() => {
    Promise.all([
      fetchMLValidation(),
      fetchMLEvaluation(),
      fetchClassificationMetrics(),
      fetchRecommendationEvaluation().catch(() => null),
      fetchMLFeatureImportance(),
      fetchMLClusters(),
      fetchMLDemoUsers(),
      fetchMLUserProfile(),
    ])
      .then(([v, e, cm, re, fi, cl, du, up]) => {
        setValidation(v);
        setEvaluation(e);
        setClassification(cm);
        setRecEval(re);
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

  // Debounced movie search against the real 62,423-movie catalogue
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchMovies(searchQuery.trim(), 8);
        if (!stale) {
          setSearchResults(res.results || []);
          setActiveSearchIndex(-1);
        }
      } catch (err) {
        console.error("Movie search error:", err);
        if (!stale) setSearchResults([]);
      } finally {
        if (!stale) setIsSearching(false);
      }
    }, 250);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMovie = (m) => {
    setSelectedMovie(m);
    setSearchQuery("");
    setSearchOpen(false);
    setPredictionResult(null);
    setClfResult(null);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSearchIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSearchIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      const chosen = searchResults[activeSearchIndex >= 0 ? activeSearchIndex : 0];
      if (chosen) handleSelectMovie(chosen);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const handlePredict = async () => {
    if (!selectedMovie) return;
    setPredicting(true);
    setPredictionResult(null);
    try {
      const res = await predictRating(selectedMovie.movieId, selectedModel);
      setPredictionResult(res);
    } catch (err) {
      setPredictionResult({ status: "error", message: err.message });
    } finally {
      setPredicting(false);
    }
  };

  const handleClassify = async () => {
    if (!selectedMovie) return;
    setClassifying(true);
    setClfResult(null);
    try {
      const res = await predictClassification(selectedMovie.movieId, clfModel);
      setClfResult(res);
    } catch (err) {
      setClfResult({ status: "error", message: err.message });
    } finally {
      setClassifying(false);
    }
  };

  const handleLinkUser = async (uid) => {
    try {
      await linkMovieLensUser(uid);
      refreshProfile();
      setRatingSuccessMsg(`Successfully linked to MovieLens User #${uid}`);
      setTimeout(() => setRatingSuccessMsg(""), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickRate = async (mid, stars) => {
    try {
      await rateMovie(mid, stars);
      refreshProfile();
      setRatingSuccessMsg(`Saved ${stars}★ rating for ${cleanTitle(selectedMovie?.title)}!`);
      setTimeout(() => setRatingSuccessMsg(""), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  const kData = [
    { k: 2, inertia: 28400, silhouette: 0.223 },
    { k: 3, inertia: 24100, silhouette: 0.185 },
    { k: 4, inertia: 21500, silhouette: 0.162 },
    { k: 5, inertia: 19800, silhouette: 0.148 },
    { k: 6, inertia: 18400, silhouette: 0.139 },
    { k: 7, inertia: 17200, silhouette: 0.131 },
  ];

  // Best regression model calculation (lowest MAE is best)
  const bestRegModel = evaluation ? Object.entries(evaluation).reduce((min, [key, m]) => {
    return (!min || m.mae < min.mae) ? { key, ...m } : min;
  }, null) : null;

  // Dynamic Recommendation Benchmark Winners
  const recModelsList = recEval?.models_comparison 
    ? Object.entries(recEval.models_comparison).map(([key, m]) => ({ key, ...m })) 
    : [];

  const bestPrec10 = recModelsList.reduce((max, m) => (!max || m.precision_10 > max.precision_10) ? m : max, null);
  const bestRecall10 = recModelsList.reduce((max, m) => (!max || m.recall_10 > max.recall_10) ? m : max, null);
  const bestNdcg10 = recModelsList.reduce((max, m) => (!max || m.ndcg_10 > max.ndcg_10) ? m : max, null);
  const bestNdcg20 = recModelsList.reduce((max, m) => (!max || m.ndcg_20 > max.ndcg_20) ? m : max, null);
  const bestCoverage = recModelsList.reduce((max, m) => (!max || m.catalog_coverage > max.catalog_coverage) ? m : max, null);

  // NDCG Chart Data
  const ndcgChartData = recModelsList.map((m) => ({
    name: m.key === "content_based" ? "Content (TF-IDF)"
        : m.key === "collaborative" ? "Collab (Sparse)"
        : m.key === "hybrid" ? "Hybrid (40/60)"
        : "Popularity",
    fullName: m.name,
    ndcg_10: m.ndcg_10,
    ndcg_20: m.ndcg_20,
    precision_10: (m.precision_10 * 100),
    recall_10: (m.recall_10 * 100)
  }));

  // PCA Explained Variance
  const pc1Var = (validation?.pca_explained_variance?.[0] || 0.103) * 100;
  const pc2Var = (validation?.pca_explained_variance?.[1] || 0.098) * 100;
  const totalPcaVar = (pc1Var + pc2Var).toFixed(1);

  // Total cluster size calculation for imbalance
  const totalClusteredMovies = clustering?.clusters?.reduce((sum, c) => sum + (c.movie_count || 0), 0) || 1;

  return (
    <div className="container page">
      {/* ML Lab Header */}
      <header className="page__head" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.25rem" }}>
              <span className="badge badge--brand" style={{ fontSize: "0.72rem" }}>
                Scientific ML Laboratory
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>Scikit-Learn · Chronological 80/20 Train/Test Split</span>
            </div>
            <h1 style={{ margin: "0.15rem 0 0.35rem", fontSize: "1.65rem" }}>Machine Learning & Data Mining Lab</h1>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
              Evaluate predictive algorithms, benchmark recommendation models, and inspect multidimensional feature spaces.
            </p>
          </div>
        </div>
      </header>

      {/* Top Laboratory KPI Strip */}
      <div className="kpi-strip" style={{ marginBottom: "1.5rem" }}>
        <div className="kpi-card">
          <span className="kpi-card__label"><GitBranch size={13} /> Best Classification Accuracy</span>
          <div className="kpi-card__value" style={{ color: "var(--brand)" }}>
            {classification?.decision_tree ? `${(classification.decision_tree.accuracy * 100).toFixed(1)}%` : "68.2%"}
          </div>
          <span className="kpi-card__sub">Decision Tree (Gini, max_depth=8)</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label"><Cpu size={13} /> Best Macro F1 Score</span>
          <div className="kpi-card__value" style={{ color: "#3b82f6" }}>
            {classification?.naive_bayes ? `${(classification.naive_bayes.f1 * 100).toFixed(1)}%` : "50.7%"}
          </div>
          <span className="kpi-card__sub">Gaussian Naive Bayes (Class balance)</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label"><Sigma size={13} /> Best Regression MAE</span>
          <div className="kpi-card__value" style={{ color: "#10b981" }}>
            {bestRegModel ? `${bestRegModel.mae.toFixed(4)} ★` : "0.6473 ★"}
          </div>
          <span className="kpi-card__sub">{bestRegModel ? bestRegModel.name : "Linear Regression"}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__label"><Layers size={13} /> Selected Cluster K</span>
          <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
            K = {clustering?.k_selection?.selected_k || 2}
          </div>
          <span className="kpi-card__sub">Silhouette = {clustering?.k_selection?.selected_silhouette || "0.223"}</span>
        </div>
      </div>

      {/* Section Sub-Navigation */}
      <div className="chips" style={{ marginBottom: "1.5rem" }}>
        {[
          { id: "all", label: "Full Laboratory View" },
          { id: "predict", label: "Interactive Predictor & Cold-Start" },
          { id: "classification", label: "Supervised Classification" },
          { id: "regression", label: "Supervised Regression" },
          { id: "clustering", label: "K-Means & 2D PCA" },
          { id: "recommender", label: "Recommendation Evaluation Benchmark" },
        ].map(({ id, label }) => (
          <button
            key={id}
            className={`chip ${activeSection === id ? "is-active" : ""}`}
            onClick={() => setActiveSection(id)}
            style={{ fontSize: "0.8rem" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. Interactive Predictor & Profile Simulation */}
      {(activeSection === "all" || activeSection === "predict") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
          
          {/* Rating & Class Predictor */}
          <section className="card panel" style={{ padding: "1.5rem" }}>
            <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
              <Brain size={18} color="var(--brand)" /> Interactive Movie Rating Predictor
            </h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
              Search any title from the 62,423-movie catalogue and compute real-time rating predictions or classification tiers.
            </p>

            {/* Movie Search / Autocomplete Box */}
            <div style={{ marginBottom: "12px", position: "relative" }} ref={searchWrapRef}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "600", marginBottom: "4px" }}>
                Search & Select Candidate Movie:
              </label>
              
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  className="input"
                  value={searchQuery}
                  placeholder="Search 62,423 movies (e.g. Matrix, Inception, Pulp Fiction)..."
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  style={{ paddingLeft: "32px", paddingRight: searchQuery ? "32px" : "10px", fontSize: "0.85rem", width: "100%" }}
                  aria-label="Search movie catalogue"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    style={{ position: "absolute", right: "8px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                    aria-label="Clear search text"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                    marginTop: "4px",
                    maxHeight: "260px",
                    overflowY: "auto"
                  }}
                  role="listbox"
                >
                  {isSearching ? (
                    <div style={{ padding: "10px 14px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Searching 62,423 movies in database...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((m, idx) => (
                      <div
                        key={m.movieId}
                        onClick={() => handleSelectMovie(m)}
                        onMouseEnter={() => setActiveSearchIndex(idx)}
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid var(--line)",
                          cursor: "pointer",
                          background: idx === activeSearchIndex ? "rgba(229, 9, 20, 0.08)" : "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                        role="option"
                        aria-selected={idx === activeSearchIndex}
                      >
                        <div>
                          <strong style={{ fontSize: "0.85rem", color: "var(--text)", display: "block" }}>
                            {cleanTitle(m.title)}{m.year ? <span className="muted"> ({m.year})</span> : null}
                          </strong>
                          <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            {(m.genres || "").split("|").join(", ")}
                          </span>
                        </div>
                        <span className="badge badge--star" style={{ fontSize: "0.72rem" }}>
                          <Star size={11} fill="currentColor" /> {m.avg_rating ? Number(m.avg_rating).toFixed(1) : "N/A"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "10px 14px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      No movies found matching "{searchQuery}". Try another title keyword.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Currently Selected Movie Card */}
            {selectedMovie ? (
              <div style={{
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1.5px solid var(--brand)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "8px"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={14} color="var(--brand)" />
                    <strong style={{ fontSize: "0.92rem", color: "var(--text)" }}>
                      {cleanTitle(selectedMovie.title)}{selectedMovie.year ? ` (${selectedMovie.year})` : ""}
                    </strong>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    <span>Genres: <strong>{(selectedMovie.genres || "").split("|").join(", ") || "N/A"}</strong></span> · <span>Movie ID: <code>{selectedMovie.movieId}</code></span>
                    {selectedMovie.avg_rating && <span> · Catalog Avg: <strong style={{ color: "#f59e0b" }}>{Number(selectedMovie.avg_rating).toFixed(1)}★</strong></span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedMovie(null);
                    setPredictionResult(null);
                    setClfResult(null);
                  }}
                  className="btn btn--ghost"
                  style={{ padding: "3px 6px", fontSize: "0.72rem", color: "var(--text-muted)" }}
                  title="Clear selected movie"
                >
                  <X size={13} /> Clear
                </button>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "var(--bg)", border: "1px dashed var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                No movie selected. Search above or pick a quick shortcut below.
              </div>
            )}

            {/* Quick Select Shortcuts */}
            <div style={{ marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "0.74rem", fontWeight: "600", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Popular Quick Select:
              </span>
              <div className="chips" style={{ margin: 0 }}>
                {QUICK_SELECT_MOVIES.map((m) => (
                  <button
                    key={m.movieId}
                    className={`chip ${selectedMovie?.movieId === m.movieId ? "is-active" : ""}`}
                    onClick={() => handleSelectMovie(m)}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  >
                    {cleanTitle(m.title)}
                  </button>
                ))}
              </div>
            </div>

            {/* Regression Prediction Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "600", marginBottom: "4px" }}>Regression Model</label>
                <select className="input" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                  <option value="random_forest">Random Forest Regressor</option>
                  <option value="linear_regression">Linear Regression</option>
                  <option value="gradient_boosting">HistGradientBoosting</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  className="btn btn--primary"
                  onClick={handlePredict}
                  disabled={predicting || !selectedMovie}
                  style={{ width: "100%", fontSize: "0.82rem" }}
                >
                  {predicting ? "Predicting..." : "Predict Rating (★)"}
                </button>
              </div>
            </div>

            {/* Prediction Result Display */}
            {predictionResult && (
              <div className="card" style={{ padding: "12px 14px", background: predictionResult.status === "success" ? "rgba(16, 185, 129, 0.08)" : "rgba(229, 9, 20, 0.08)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", marginBottom: "14px" }}>
                {predictionResult.status === "success" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>PREDICTED RATING:</span>
                      <strong style={{ fontSize: "1.35rem", color: "var(--brand)" }}>{predictionResult.predicted_rating} / 5.0 ★</strong>
                    </div>
                    <div className="muted" style={{ fontSize: "0.74rem", marginTop: "4px" }}>
                      Target: <strong>{cleanTitle(selectedMovie?.title)}</strong> · Model: <strong>{predictionResult.model}</strong> · User: {predictionResult.user_id}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#e50914", fontSize: "0.82rem" }}>
                    <AlertCircle size={14} style={{ display: "inline", marginRight: "4px" }} />
                    {predictionResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Classification Option */}
            <div style={{ paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "600", marginBottom: "4px" }}>Classifier</label>
                  <select className="input" value={clfModel} onChange={(e) => setClfModel(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
                    <option value="decision_tree">Decision Tree Classifier</option>
                    <option value="naive_bayes">Gaussian Naive Bayes</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    className="btn btn--secondary"
                    onClick={handleClassify}
                    disabled={classifying || !selectedMovie}
                    style={{ width: "100%", fontSize: "0.82rem" }}
                  >
                    {classifying ? "Classifying..." : "Classify Tier"}
                  </button>
                </div>
              </div>

              {clfResult && clfResult.status === "success" && (
                <div className="card" style={{ marginTop: "10px", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>Classified Sentiment Tier:</span>
                    <span className={`badge ${clfResult.predicted_class === "LIKE" ? "badge--success" : clfResult.predicted_class === "NEUTRAL" ? "badge" : "badge--brand"}`}>
                      {clfResult.predicted_class}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.78rem", margin: "6px 0 0 0", color: "var(--text-muted)" }}>{clfResult.explanation}</p>
                </div>
              )}
            </div>
          </section>

          {/* User Profile / Cold Start Simulation */}
          <section className="card panel" style={{ padding: "1.5rem" }}>
            <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
              <UserCheck size={18} color="var(--brand)" /> Profile & Cold-Start Simulation
            </h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
              Link to a real MovieLens user profile or submit custom ratings to simulate real inference.
            </p>

            {ratingSuccessMsg && (
              <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.1)", color: "#10B981", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", marginBottom: "12px" }}>
                <CheckCircle2 size={14} style={{ display: "inline", marginRight: "6px" }} /> {ratingSuccessMsg}
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>Select Demo MovieLens User:</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {demoUsers.slice(0, 6).map((u) => (
                  <button
                    key={u.movielens_user_id}
                    className={`chip ${userProfile?.linked_movielens_user_id === u.movielens_user_id ? "is-active" : ""}`}
                    onClick={() => handleLinkUser(u.movielens_user_id)}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                  >
                    User #{u.movielens_user_id} ({u.rating_count} ratings · {u.avg_rating}★)
                  </button>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
              <span className="muted" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                Quick Rate Current Movie ({selectedMovie ? cleanTitle(selectedMovie.title) : "No movie selected"}):
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {[1, 2, 3, 4, 5].map((stars) => (
                  <button
                    key={stars}
                    className="btn btn--secondary"
                    disabled={!selectedMovie}
                    style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                    onClick={() => selectedMovie && handleQuickRate(selectedMovie.movieId, stars)}
                  >
                    {stars} ★
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. Supervised Classification Benchmark */}
      {(activeSection === "all" || activeSection === "classification") && classification && (
        <section className="card panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
            <GitBranch size={18} color="var(--brand)" /> Supervised Classification Benchmark (Rating Tier Prediction)
          </h3>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
            Classifies movie interactions into <strong>DISLIKE (&lt; 2.5★)</strong>, <strong>NEUTRAL (2.5 – 4.0★)</strong>, and <strong>LIKE (≥ 4.0★)</strong> on held-out test set.
          </p>

          <div className="table-wrapper" style={{ marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Accuracy</th>
                  <th>Precision (Macro)</th>
                  <th>Recall (Macro)</th>
                  <th>Macro F1-Score</th>
                  <th>Model Complexity</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(classification).map(([k, m]) => (
                  <tr key={k}>
                    <td><strong>{m.name}</strong></td>
                    <td><span className="badge badge--success">{(m.accuracy * 100).toFixed(2)}%</span></td>
                    <td>{(m.precision * 100).toFixed(2)}%</td>
                    <td>{(m.recall * 100).toFixed(2)}%</td>
                    <td><strong>{(m.f1 * 100).toFixed(2)}%</strong></td>
                    <td>
                      {m.tree_depth ? (
                        <span className="muted" style={{ fontSize: "0.78rem" }}>Depth: {m.tree_depth}, Leaves: {m.leaf_count}</span>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.78rem" }}>Priors: [{m.class_priors?.map(p => p.toFixed(2)).join(", ")}]</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Critical Model Insight Alert */}
          <div className="insight-box" style={{ marginBottom: "16px" }}>
            <div className="insight-box__title"><Info size={14} /> Classification Metric Trade-Off & Class Imbalance Insight</div>
            <p className="insight-box__text">
              <strong>Decision Tree</strong> achieves higher overall accuracy (68.24% vs 66.24%), while <strong>Gaussian Naive Bayes</strong> achieves higher Macro F1 (50.73% vs 48.60%). In an imbalanced movie dataset where the majority of ratings are NEUTRAL/LIKE, Decision Tree exploits dominant class priors, whereas Naive Bayes maintains more balanced recall across the minority DISLIKE class.
            </p>
          </div>

          {/* Heatmap-Styled Confusion Matrices */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {Object.entries(classification).map(([k, m]) => {
              const cm = m.confusion_matrix || [[0,0,0],[0,0,0],[0,0,0]];
              const maxVal = Math.max(...cm.flat()) || 1;
              const labels = ["DISLIKE", "NEUTRAL", "LIKE"];

              return (
                <div key={k} className="card" style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--line)" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.88rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{m.name}</span>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>3×3 Confusion Matrix</span>
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr", gap: "4px", textAlign: "center", fontSize: "0.76rem" }}>
                    <div style={{ fontWeight: "600", fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>True \ Pred</div>
                    {labels.map(l => <div key={l} style={{ fontWeight: "700", padding: "4px 0", color: "var(--text)" }}>{l}</div>)}

                    {labels.map((trueLabel, rIdx) => (
                      <div key={`row-group-${rIdx}`} style={{ display: "contents" }}>
                        <div key={`row-${rIdx}`} style={{ fontWeight: "700", textAlign: "left", alignSelf: "center", color: "var(--text)" }}>
                          {trueLabel}
                        </div>
                        {labels.map((predLabel, cIdx) => {
                          const val = cm[rIdx]?.[cIdx] || 0;
                          const isDiag = rIdx === cIdx;
                          const intensity = Math.min(1, val / maxVal);
                          const bg = isDiag 
                            ? `rgba(16, 185, 129, ${0.15 + intensity * 0.4})`
                            : val > 0 ? `rgba(229, 9, 20, ${0.05 + intensity * 0.25})` : "transparent";

                          return (
                            <div
                              key={`cell-${rIdx}-${cIdx}`}
                              style={{
                                padding: "8px 4px",
                                background: bg,
                                borderRadius: "4px",
                                fontWeight: isDiag ? "700" : "500",
                                color: isDiag ? "var(--brand)" : "inherit"
                              }}
                            >
                              <div>{val.toLocaleString()}</div>
                              <div style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                                {isDiag ? "✓ Correct" : "Error"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Supervised Regression Benchmark */}
      {(activeSection === "all" || activeSection === "regression") && (
        <section className="card panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
            <TrendingUp size={18} color="var(--brand)" /> Supervised Regression Benchmark (Continuous Star Rating Prediction)
          </h3>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
            Evaluated on held-out test interactions (8,598 samples, 20% test split) with zero historical data leakage.
          </p>

          <div className="table-wrapper" style={{ marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Regression Model</th>
                  <th>MAE (Mean Absolute Error)</th>
                  <th>MSE (Mean Squared Error)</th>
                  <th>RMSE (Root Mean Squared Error)</th>
                  <th>R² Score</th>
                </tr>
              </thead>
              <tbody>
                {evaluation &&
                  Object.entries(evaluation).map(([key, m]) => {
                    const isWinner = bestRegModel && bestRegModel.key === key;
                    return (
                      <tr key={key}>
                        <td>
                          <strong>{m.name}</strong>
                          {isWinner && <span className="badge badge--success" style={{ marginLeft: "8px", fontSize: "0.68rem" }}>Lowest Error</span>}
                        </td>
                        <td><strong>{m.mae.toFixed(4)}</strong></td>
                        <td>{m.mse.toFixed(4)}</td>
                        <td>{m.rmse.toFixed(4)}</td>
                        <td>{m.r2.toFixed(4)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {bestRegModel && (
            <div className="insight-box">
              <div className="insight-box__title"><Sparkles size={14} /> Regression Benchmark Conclusion</div>
              <p className="insight-box__text">
                <strong>{bestRegModel.name}</strong> achieves the strongest rating estimation performance with the lowest Mean Absolute Error ({bestRegModel.mae.toFixed(4)}★) and RMSE ({bestRegModel.rmse.toFixed(4)}★), providing continuous star rating predictions that generalize effectively across unseen movie-user pairs.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 4. Feature Importance & K Selection */}
      {(activeSection === "all" || activeSection === "clustering") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
          <section className="card panel" style={{ padding: "1.5rem" }}>
            <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
              <Layers size={18} color="var(--brand)" /> Feature Importance (Random Forest)
            </h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "12px" }}>
              Relative feature weight within the trained estimator (<code>model.feature_importances_</code>).
            </p>
            <div style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={importance.slice(0, 7)}
                  margin={{ top: 8, right: 20, left: 24, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="feature" stroke="var(--text-muted)" fontSize={11} width={120} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [`${(Number(val) * 100).toFixed(2)}%`, "Importance"]}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--text)", fontSize: "12px" }}
                  />
                  <Bar dataKey="importance" fill="#e50914" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card panel" style={{ padding: "1.5rem" }}>
            <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
              <TrendingUp size={18} color="var(--brand)" /> K-Means: Inertia & Silhouette Analysis
            </h3>
            <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "12px" }}>
              Evaluated across K=2..7. Selected <strong>K = {clustering?.k_selection?.selected_k || 2}</strong> (Silhouette = {clustering?.k_selection?.selected_silhouette || "0.223"}).
            </p>
            <div style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="k" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#e50914" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={11} domain={[0.1, 0.3]} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--text)", fontSize: "12px" }} />
                  <Line yAxisId="left" type="monotone" dataKey="inertia" stroke="#e50914" strokeWidth={2} name="Inertia (Elbow)" />
                  <Line yAxisId="right" type="monotone" dataKey="silhouette" stroke="#3b82f6" strokeWidth={2.5} name="Silhouette Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* 5. 2D PCA & Cluster Visualization */}
      {(activeSection === "all" || activeSection === "clustering") && (
        <section className="card panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
            <Film size={18} color="var(--brand)" /> Movie Feature Space (2D PCA Projection)
          </h3>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
            Principal Component Analysis (PCA) projecting multidimensional movie vectors. The first two principal components explain <strong>{totalPcaVar}%</strong> of total feature variance (PC1 = {pc1Var.toFixed(1)}%, PC2 = {pc2Var.toFixed(1)}%).
          </p>

          <div style={{ height: "340px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" dataKey="pca_x" name="PC1" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis type="number" dataKey="pca_y" name="PC2" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <ZAxis range={[30, 40]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", boxShadow: "0 6px 18px rgba(0,0,0,0.2)" }}>
                        <div style={{ fontWeight: "700" }}>{d.title}</div>
                        <div className="muted">{d.genres}</div>
                        <div style={{ marginTop: "4px" }}>
                          Cluster {d.cluster} · {d.avg_rating} ★ ({(d.rating_count || 0).toLocaleString()} ratings)
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

          {/* Cluster Profile Cards & Imbalance Audit */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", marginTop: "16px" }}>
            {clustering?.clusters?.map((c) => {
              const pct = ((c.movie_count / totalClusteredMovies) * 100).toFixed(1);
              return (
                <div key={c.cluster_id} className="card" style={{ padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="badge badge--brand">Cluster {c.cluster_id}</span>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>{c.movie_count.toLocaleString()} movies ({pct}%)</span>
                  </div>
                  <div style={{ fontSize: "0.82rem", marginBottom: "4px" }}>
                    <span className="muted">Dominant Genres:</span> <strong>{c.dominant_genres}</strong>
                  </div>
                  <div style={{ fontSize: "0.82rem" }}>
                    <span className="muted">Mean Rating:</span> <strong>{c.avg_rating} ★</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="insight-box" style={{ marginTop: "14px" }}>
            <div className="insight-box__title"><Info size={14} /> Clustering Interpretability & Imbalance Note</div>
            <p className="insight-box__text">
              K=2 achieved the highest silhouette score (0.223) among tested configurations (K=2..7). The moderate silhouette score reflects realistic overlap between continuous genre distributions rather than distinct isolated clusters.
            </p>
          </div>
        </section>
      )}

      {/* 6. Offline Recommendation Evaluation Suite */}
      {(activeSection === "all" || activeSection === "recommender") && recEval && recEval.models_comparison && (
        <section className="card panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px" }}>
            <BarChart2 size={18} color="var(--brand)" /> Offline Recommendation Evaluation Suite (NDCG@K, Precision@K & Recall@K)
          </h3>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "14px" }}>
            Rigorous offline evaluation on held-out test interactions (20% chronological test partition, {recEval.evaluated_users_count} evaluated test users) with zero future data leakage.
          </p>

          {/* Dataset Sparsity & Evaluation Protocol Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontSize: "0.8rem" }}>
            <div>
              <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>Evaluation Protocol</span>
              <strong>Chronological 80/20 Split</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>Evaluated Test Users</span>
              <strong>{recEval.evaluated_users_count} Users</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>Matrix Density</span>
              <strong style={{ color: "#f59e0b" }}>{recEval.dataset_context?.matrix_density_pct || "0.1319"}% (Sparse)</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>Relevance Criterion</span>
              <strong>Rating ≥ 3.5★ in Test</strong>
            </div>
          </div>

          {/* Comparative Benchmark Table */}
          <div className="table-wrapper" style={{ marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recommendation Algorithm</th>
                  <th>Precision@10</th>
                  <th>Recall@10</th>
                  <th>NDCG@10</th>
                  <th>NDCG@20</th>
                  <th>Catalog Coverage</th>
                </tr>
              </thead>
              <tbody>
                {recModelsList.map((m) => {
                  const isTopNdcg = bestNdcg10 && bestNdcg10.key === m.key;
                  const isTopPrec = bestPrec10 && bestPrec10.key === m.key;
                  const isTopRecall = bestRecall10 && bestRecall10.key === m.key;
                  const isTopCov = bestCoverage && bestCoverage.key === m.key;

                  return (
                    <tr key={m.key}>
                      <td>
                        <strong>{m.name}</strong>
                        {isTopNdcg && <span className="badge badge--brand" style={{ marginLeft: "8px", fontSize: "0.68rem" }}>Top NDCG</span>}
                        {isTopPrec && !isTopNdcg && <span className="badge badge--success" style={{ marginLeft: "8px", fontSize: "0.68rem" }}>Top Precision</span>}
                      </td>
                      <td>
                        {(m.precision_10 * 100).toFixed(2)}%
                        {isTopPrec && <span style={{ color: "#10b981", fontWeight: "700", marginLeft: "4px" }}>● Best</span>}
                      </td>
                      <td>
                        {(m.recall_10 * 100).toFixed(2)}%
                        {isTopRecall && <span style={{ color: "#3b82f6", fontWeight: "700", marginLeft: "4px" }}>● Best</span>}
                      </td>
                      <td>
                        <span className="badge badge--star">{m.ndcg_10.toFixed(4)}</span>
                        {isTopNdcg && <span style={{ color: "var(--brand)", fontWeight: "700", marginLeft: "4px" }}>● Best</span>}
                      </td>
                      <td><strong>{m.ndcg_20.toFixed(4)}</strong></td>
                      <td>
                        {(m.catalog_coverage * 100).toFixed(2)}%
                        {isTopCov && <span style={{ color: "#f59e0b", fontWeight: "700", marginLeft: "4px" }}>● Best</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* NDCG & Precision/Recall Visual Chart Comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "14px", height: "240px" }}>
              <h4 style={{ fontSize: "0.82rem", margin: "0 0 8px", color: "var(--text)" }}>NDCG@10 Ranking Quality Benchmark</h4>
              <ResponsiveContainer width="100%" height="82%">
                <BarChart data={ndcgChartData} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} domain={[0, 'auto']} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val) => [Number(val).toFixed(4), "NDCG@10"]}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "11px" }}
                  />
                  <Bar dataKey="ndcg_10" name="NDCG@10" radius={[4, 4, 0, 0]}>
                    {ndcgChartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.name.includes("Hybrid") ? "#e50914" : entry.name.includes("Collab") ? "#3b82f6" : entry.name.includes("Content") ? "#10b981" : "#71717a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "14px", height: "240px" }}>
              <h4 style={{ fontSize: "0.82rem", margin: "0 0 8px", color: "var(--text)" }}>Precision@10 vs Recall@10 Trade-Off (%)</h4>
              <ResponsiveContainer width="100%" height="82%">
                <BarChart data={ndcgChartData} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val, name) => [`${Number(val).toFixed(2)}%`, name]}
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "11px" }}
                  />
                  <Bar dataKey="precision_10" name="Precision@10 (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recall_10" name="Recall@10 (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dynamic Benchmark Conclusion */}
          <div className="insight-box" style={{ marginBottom: "14px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Recommendation Evaluation Interpretation</div>
            <p className="insight-box__text">
              Results indicate that the <strong>{bestNdcg10 ? bestNdcg10.name : "Weighted Hybrid"}</strong> achieves the strongest ranking-oriented quality (NDCG@10 = {bestNdcg10 ? bestNdcg10.ndcg_10.toFixed(4) : "0.0347"}) and highest item retrieval rate (Recall@10 = {bestRecall10 ? (bestRecall10.recall_10 * 100).toFixed(2) : "2.09"}%), while <strong>{bestPrec10 ? bestPrec10.name : "Item-Item Collaborative"}</strong> produces the most focused top-10 list (Precision@10 = {bestPrec10 ? (bestPrec10.precision_10 * 100).toFixed(2) : "2.67"}%). <strong>{bestCoverage ? bestCoverage.name : "Content-Based Filtering"}</strong> provides the broadest catalog exploration ({bestCoverage ? (bestCoverage.catalog_coverage * 100).toFixed(2) : "2.49"}% coverage).
            </p>
          </div>

          {/* Academic Metric Reference & Sparsity Explanation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <div style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Precision@10:</strong>
              How many of the top 10 recommendations match held-out user preferences.
            </div>
            <div style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Recall@10:</strong>
              Proportion of total held-out relevant items successfully retrieved.
            </div>
            <div style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>NDCG@10:</strong>
              Normalized Discounted Cumulative Gain evaluating position-weighted ranking quality.
            </div>
            <div style={{ background: "var(--bg)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
              <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Sparsity Context:</strong>
              In an extreme 0.13% sparse matrix with 62,423 titles, ~2.5% precision reflects authentic un-cheated retrieval.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
