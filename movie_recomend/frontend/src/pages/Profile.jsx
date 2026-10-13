import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchUserRatings,
  fetchProfileStats,
  deleteRating,
  fetchPersonalizedRecommendations,
} from "../services/api";
import {
  User,
  Mail,
  Calendar,
  Star,
  Film,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Clock,
  Trash2,
  Edit3,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Heart,
  ChevronDown,
} from "lucide-react";
import { cleanTitle, posterStyle, initials } from "../utils/movies";
import RatingModal from "../components/RatingModal";

const SORT_OPTIONS = [
  { id: "recent", label: "Most Recent" },
  { id: "highest", label: "Highest Rating" },
  { id: "lowest", label: "Lowest Rating" },
  { id: "title", label: "Title (A-Z)" },
];

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [stats, setStats] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [totalRatings, setTotalRatings] = useState(0);
  const [sortBy, setSortBy] = useState("recent");
  const [searchFilter, setSearchFilter] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [personalizedRecs, setPersonalizedRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Edit/Delete Modal State
  const [editingMovie, setEditingMovie] = useState(null);
  const [deletingMovieId, setDeletingMovieId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const PAGE_SIZE = 12;

  // Load real profile statistics
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchProfileStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load profile stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load user's ratings with sorting
  const loadRatings = useCallback(async (reset = true) => {
    if (reset) {
      setLoadingRatings(true);
      setPageOffset(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const offset = reset ? 0 : pageOffset + PAGE_SIZE;
      const res = await fetchUserRatings({
        sortBy,
        limit: PAGE_SIZE,
        offset,
      });
      if (reset) {
        setRatings(res.ratings || []);
      } else {
        setRatings((prev) => [...prev, ...(res.ratings || [])]);
        setPageOffset(offset);
      }
      setTotalRatings(res.total || 0);
    } catch (err) {
      console.error("Failed to load user ratings:", err);
    } finally {
      setLoadingRatings(false);
      setLoadingMore(false);
    }
  }, [sortBy, pageOffset]);

  // Load personalized recommendations
  const loadRecommendations = useCallback(async () => {
    setLoadingRecs(true);
    try {
      const res = await fetchPersonalizedRecommendations(6);
      setPersonalizedRecs(res.recommendations || []);
    } catch (err) {
      console.error("Failed to load personalized recommendations:", err);
    } finally {
      setLoadingRecs(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStats();
    loadRatings(true);
    loadRecommendations();
  }, [loadStats, sortBy]);

  // Listen for live rating updates anywhere across the app (catalog, details, etc.)
  useEffect(() => {
    const handleRatingUpdated = () => {
      loadStats();
      loadRatings(true);
      loadRecommendations();
    };
    window.addEventListener("moviemind:rating-updated", handleRatingUpdated);
    return () => {
      window.removeEventListener("moviemind:rating-updated", handleRatingUpdated);
    };
  }, [loadStats, loadRatings, loadRecommendations]);

  // Auto-clear action alerts
  useEffect(() => {
    if (actionSuccess) {
      const t = setTimeout(() => setActionSuccess(null), 3500);
      return () => clearTimeout(t);
    }
  }, [actionSuccess]);

  // Handle direct deletion from profile list
  const confirmDeleteRating = async (movieId) => {
    try {
      await deleteRating(movieId);
      setDeletingMovieId(null);
      setActionSuccess("Rating removed successfully.");
      // Refresh local list and stats
      loadStats();
      loadRatings(true);
      loadRecommendations();
      window.dispatchEvent(
        new CustomEvent("moviemind:rating-updated", {
          detail: { movieId, rating: null, action: "deleted" },
        })
      );
    } catch (err) {
      setActionError(err.message || "Failed to remove rating.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Filter ratings by search term locally
  const filteredRatings = ratings.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.genres?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container page" style={{ paddingBottom: "60px" }}>
      {/* 1. Profile Header */}
      <header className="page__head" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--brand-soft)", color: "var(--brand)", padding: "3px 10px", borderRadius: "100px", fontSize: "0.78rem", fontWeight: 700, marginBottom: "8px" }}>
              <Heart size={13} /> Personal Taste Dashboard
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: "2rem" }}>Your Profile & Movie Activity</h1>
            <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "0.95rem" }}>
              Track your rated films, inspect genre preferences, and discover personalized recommendations powered by your taste profile.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/explore" className="btn btn--secondary btn--sm">
              <Film size={14} /> Browse Catalog
            </Link>
            <Link to="/recommend" className="btn btn--primary btn--sm">
              <Sparkles size={14} /> Recommendations
            </Link>
          </div>
        </div>
      </header>

      {/* Action Notification Toasts */}
      {actionSuccess && (
        <div role="status" style={{ padding: "10px 16px", borderRadius: "var(--r-md)", background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", fontWeight: 600, fontSize: "0.88rem", marginBottom: "20px" }}>
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div role="alert" style={{ padding: "10px 16px", borderRadius: "var(--r-md)", background: "var(--brand-soft)", border: "1px solid var(--brand)", color: "var(--brand)", fontWeight: 600, fontSize: "0.88rem", marginBottom: "20px" }}>
          {actionError}
        </div>
      )}

      {/* 2. User Credentials & Membership Card */}
      <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand) 0%, #b91c1c 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.6rem",
              boxShadow: "0 4px 12px rgba(229, 56, 59, 0.25)",
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "1.45rem", margin: 0, fontWeight: 800 }}>{user?.name || "MovieMind Viewer"}</h2>
              <span className="badge badge--brand" style={{ fontSize: "0.72rem" }}>Active Viewer</span>
            </div>
            <span className="muted" style={{ fontSize: "0.92rem", display: "block", marginTop: "2px" }}>
              @{user?.username || "user"}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", borderTop: "1px solid var(--line)", marginTop: "20px", paddingTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Mail size={18} className="muted" />
            <div>
              <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>EMAIL ADDRESS</span>
              <strong style={{ fontSize: "0.9rem" }}>{user?.email || "—"}</strong>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Calendar size={18} className="muted" />
            <div>
              <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>MEMBER SINCE</span>
              <strong style={{ fontSize: "0.9rem" }}>{formatDate(user?.created_at)}</strong>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Star size={18} fill="#f59e0b" color="#f59e0b" />
            <div>
              <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>MOVIES RATED</span>
              <strong style={{ fontSize: "0.9rem" }}>{stats?.total_ratings || 0} movies</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Real Statistics Cards (Pillars of Taste Profile) */}
      <section style={{ marginBottom: "28px" }} aria-label="Personal Rating Metrics">
        <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendingUp size={16} color="var(--brand)" />
          <span>Real Rating Analytics & Metrics</span>
        </h3>

        <div className="kpi-strip" style={{ marginBottom: "16px" }}>
          {/* KPI 1: Total Ratings */}
          <div className="kpi-card">
            <span className="kpi-card__label"><Film size={13} /> Total Rated</span>
            <div className="kpi-card__value" style={{ color: "var(--brand)" }}>
              {loadingStats ? "—" : (stats?.total_ratings || 0).toLocaleString()}
            </div>
            <span className="kpi-card__sub">Catalog movies rated</span>
          </div>

          {/* KPI 2: Personal Mean Rating */}
          <div className="kpi-card">
            <span className="kpi-card__label"><Star size={13} /> Average Rating</span>
            <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
              {loadingStats ? "—" : stats?.avg_rating ? `${stats.avg_rating.toFixed(2)} ★` : "—"}
            </div>
            <span className="kpi-card__sub">On 0.5 to 5.0 scale</span>
          </div>

          {/* KPI 3: Favorite Genre */}
          <div className="kpi-card">
            <span className="kpi-card__label"><Heart size={13} /> Favorite Genre</span>
            <div className="kpi-card__value" style={{ color: "var(--content)", fontSize: "1.25rem" }}>
              {loadingStats ? "—" : stats?.favorite_genre || "None yet"}
            </div>
            <span className="kpi-card__sub">From rating history</span>
          </div>

          {/* KPI 4: Latest Activity */}
          <div className="kpi-card">
            <span className="kpi-card__label"><Clock size={13} /> Recent Activity</span>
            <div className="kpi-card__value" style={{ fontSize: "1.1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={stats?.recently_rated?.title}>
              {loadingStats ? "—" : stats?.recently_rated ? cleanTitle(stats.recently_rated.title) : "No activity"}
            </div>
            <span className="kpi-card__sub">
              {stats?.recently_rated ? `${stats.recently_rated.rating} ★ (${formatDate(stats.recently_rated.created_at)})` : "Rate a movie to start"}
            </span>
          </div>
        </div>

        {/* Detailed Insights Row: Rating Distribution & Top Genres */}
        {stats && stats.total_ratings > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {/* Rating Distribution Bar Chart */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <h4 style={{ fontSize: "0.95rem", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <BarChart3 size={15} color="var(--brand)" /> Rating Score Distribution
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5].map((star) => {
                  const count = stats.rating_distribution?.[`${star.toFixed(1)}`] || 0;
                  const pct = stats.total_ratings > 0 ? (count / stats.total_ratings) * 100 : 0;
                  return (
                    <div key={star} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem" }}>
                      <span style={{ width: "38px", color: "var(--ink-2)", fontWeight: 600 }}>{star.toFixed(1)} ★</span>
                      <div style={{ flex: 1, height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: star >= 4.0 ? "#10b981" : star >= 3.0 ? "#f59e0b" : "var(--brand)", borderRadius: "4px" }} />
                      </div>
                      <span style={{ width: "24px", textAlign: "right", color: "var(--ink-3)" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Favorite Genres Affinity Table */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <h4 style={{ fontSize: "0.95rem", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers size={15} color="var(--content)" /> Top Rated Genres
              </h4>
              {stats.top_genres?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {stats.top_genres.map((g, idx) => (
                    <div key={g.genre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "6px", background: "var(--tint)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-3)", width: "16px" }}>#{idx + 1}</span>
                        <strong style={{ fontSize: "0.88rem" }}>{g.genre}</strong>
                        <span className="muted" style={{ fontSize: "0.78rem" }}>({g.count} {g.count === 1 ? "film" : "films"})</span>
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Star size={12} fill="currentColor" /> {g.avg_rating.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: "0.85rem" }}>Rate more movies to unlock genre breakdowns.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4. Your Rated Movies Section */}
      <section style={{ marginBottom: "36px" }} aria-label="Your Rated Movies Catalog">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", margin: 0 }}>Your Rated Movies</h3>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {totalRatings} {totalRatings === 1 ? "movie" : "movies"} rated in your history
            </span>
          </div>

          {/* Sort Controls & Search Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Search Box */}
            <div style={{ position: "relative", width: "180px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
              <input
                type="text"
                placeholder="Search rated..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 30px",
                  fontSize: "0.82rem",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                }}
              />
            </div>

            {/* Sort Dropdown Tabs */}
            <div className="segmented" role="tablist" aria-label="Sort rated movies">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={sortBy === opt.id}
                  className={sortBy === opt.id ? "is-active" : ""}
                  onClick={() => setSortBy(opt.id)}
                  style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loadingRatings ? (
          <div className="movies-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton--card" style={{ height: "180px" }} />
            ))}
          </div>
        ) : filteredRatings.length > 0 ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "14px",
              }}
            >
              {filteredRatings.map((r) => {
                const ps = posterStyle(r.title);
                const isDeleting = deletingMovieId === r.movie_id;

                return (
                  <div
                    key={r.movie_id}
                    className="card"
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-md)",
                      background: "var(--surface)",
                      position: "relative",
                    }}
                  >
                    <div>
                      {/* Top Header: Poster + Title + Rating Badge */}
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "var(--r-sm)",
                            background: ps.background,
                            color: ps.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            flexShrink: 0,
                          }}
                        >
                          {initials(r.title)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              fontSize: "0.98rem",
                              margin: "0 0 3px",
                              lineHeight: 1.25,
                              color: "var(--ink)",
                            }}
                            title={r.title}
                          >
                            {cleanTitle(r.title)}
                          </h4>
                          <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                            {r.year ? `${r.year} · ` : ""}{r.genres || "General"}
                          </span>
                        </div>
                      </div>

                      {/* Saved Rating Banner */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderRadius: "var(--r-sm)",
                          background: "var(--star-soft)",
                          marginBottom: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Star size={15} fill="#f59e0b" color="#f59e0b" />
                          <strong style={{ fontSize: "1rem", color: "#b45309" }}>{r.rating.toFixed(1)} ★</strong>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 500 }}>
                          {formatDate(r.updated_at || r.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Edit, Delete, Similar */}
                    {isDeleting ? (
                      <div
                        style={{
                          padding: "10px",
                          borderRadius: "var(--r-sm)",
                          background: "var(--brand-soft)",
                          border: "1px solid var(--brand)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", color: "var(--brand)", fontWeight: 700 }}>
                          Remove your {r.rating}★ rating?
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => confirmDeleteRating(r.movie_id)}
                            style={{ flex: 1, background: "var(--brand)", color: "#fff", fontSize: "0.76rem" }}
                          >
                            Yes, remove
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setDeletingMovieId(null)}
                            style={{ flex: 1, fontSize: "0.76rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--line-2)", paddingTop: "10px" }}>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => setEditingMovie({ movieId: r.movie_id, title: r.title, rating: r.rating, avg_rating: r.avg_rating, year: r.year, genres: r.genres })}
                          style={{ flex: 1, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setDeletingMovieId(r.movie_id)}
                          style={{ padding: "6px 10px", color: "var(--ink-3)" }}
                          title="Delete rating"
                        >
                          <Trash2 size={13} />
                        </button>
                        <Link
                          to={`/recommend/${r.movie_id}`}
                          className="btn btn--ghost btn--sm"
                          style={{ flex: 1, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                          title="Discover similar recommendations"
                        >
                          <span>Similar</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load More Pagination */}
            {ratings.length < totalRatings && !searchFilter && (
              <div className="center">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => loadRatings(false)}
                  disabled={loadingMore}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {loadingMore ? <RefreshCw size={14} className="spinner-icon" /> : null}
                  <span>{loadingMore ? "Loading more..." : `Load more (${totalRatings - ratings.length} remaining)`}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="empty empty--box" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "var(--tint)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-3)",
                marginBottom: "16px",
              }}
            >
              <Film size={28} />
            </div>
            <h3 style={{ fontSize: "1.25rem", margin: "0 0 6px" }}>No ratings submitted yet</h3>
            <p style={{ maxWidth: "480px", margin: "0 auto 18px", color: "var(--ink-2)", fontSize: "0.92rem" }}>
              Explore our library of 62,423 movies and rate titles you've watched. Your ratings train the hybrid recommendation engine to match your taste.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <Link to="/explore" className="btn btn--primary">
                <Film size={15} />
                <span>Browse Movies</span>
              </Link>
              <Link to="/recommend" className="btn btn--secondary">
                <Sparkles size={15} />
                <span>Explore Recommendations</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 5. Recommended For You (Personalized Recommendations Section) */}
      {personalizedRecs.length > 0 && (
        <section aria-label="Personalized Recommendations for Profile">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--brand)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
                <Sparkles size={13} /> Tailored Discovery
              </div>
              <h3 style={{ fontSize: "1.25rem", margin: "2px 0 0" }}>Recommended Based on Your Ratings</h3>
            </div>
            <Link to="/recommend" className="link-arrow" style={{ fontSize: "0.85rem" }}>
              See all recommendations <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {personalizedRecs.map((rec) => {
              const ps = posterStyle(rec.title);
              return (
                <article
                  key={rec.movieId}
                  className="card"
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "6px",
                          background: ps.background,
                          color: ps.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                        }}
                      >
                        {initials(rec.title)}
                      </div>
                      <span className="rating" style={{ fontSize: "0.82rem" }}>
                        <Star size={13} fill="currentColor" /> {rec.predicted_rating ? rec.predicted_rating.toFixed(1) : "3.5"}
                      </span>
                    </div>

                    <strong style={{ fontSize: "0.92rem", display: "block", color: "var(--ink)", marginBottom: "4px" }}>
                      {cleanTitle(rec.title)}
                    </strong>
                    <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                      {rec.genres}
                    </span>

                    {rec.explanation && (
                      <p style={{ margin: "8px 0 0", fontSize: "0.76rem", color: "var(--ink-3)", lineHeight: 1.35 }}>
                        {rec.explanation}
                      </p>
                    )}
                  </div>

                  <div style={{ marginTop: "14px", borderTop: "1px solid var(--line-2)", paddingTop: "10px" }}>
                    <Link
                      to={`/recommend/${rec.movieId}`}
                      className="btn btn--primary btn--sm btn--block"
                      style={{ fontSize: "0.8rem", textAlign: "center" }}
                    >
                      <span>Explore Film</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Edit Rating Modal */}
      {editingMovie && (
        <RatingModal
          movie={editingMovie}
          initialRating={editingMovie.rating}
          isOpen={!!editingMovie}
          onClose={() => setEditingMovie(null)}
          onRatingSaved={() => {
            setEditingMovie(null);
            setActionSuccess("Rating updated successfully!");
            loadStats();
            loadRatings(true);
            loadRecommendations();
          }}
        />
      )}
    </div>
  );
}
