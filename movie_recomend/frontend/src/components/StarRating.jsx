import { useState, useEffect } from "react";
import { Star, Check, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { submitRating, deleteRating, fetchMovieUserRating } from "../services/api";

const RATING_LABELS = {
  0.5: "Unwatchable",
  1.0: "Terrible",
  1.5: "Bad",
  2.0: "Poor",
  2.5: "Mediocre",
  3.0: "Decent",
  3.5: "Good",
  4.0: "Really Good",
  4.5: "Loved It",
  5.0: "Masterpiece",
};

export default function StarRating({
  movieId,
  movieTitle = "",
  initialRating = null,
  onRatingChange = null,
  compact = false,
  showTitle = true,
}) {
  const { user } = useAuth();
  const [savedRating, setSavedRating] = useState(initialRating);
  const [selectedRating, setSelectedRating] = useState(initialRating || 0);
  const [hoverRating, setHoverRating] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(initialRating === null && !!user);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync initialRating if provided from parent
  useEffect(() => {
    if (initialRating !== null && initialRating !== undefined) {
      setSavedRating(initialRating);
      setSelectedRating(initialRating);
      setFetching(false);
    }
  }, [initialRating]);

  // If no initialRating was passed, fetch the user's existing rating for this movie
  useEffect(() => {
    if (!movieId || !user || initialRating !== null) return;
    let stale = false;
    setFetching(true);
    fetchMovieUserRating(movieId)
      .then((res) => {
        if (stale) return;
        if (res?.rated) {
          setSavedRating(res.rating);
          setSelectedRating(res.rating);
        } else {
          setSavedRating(null);
          setSelectedRating(0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!stale) setFetching(false);
      });
    return () => {
      stale = true;
    };
  }, [movieId, user, initialRating]);

  // Clear messages after 3.5 seconds
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [message]);

  const activeValue = hoverRating !== null ? hoverRating : selectedRating;

  // Handle clicking left half (x.5) or right half (x.0) of a star
  const handleStarClick = (starIndex, event) => {
    if (!user) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    const value = starIndex - (isLeftHalf ? 0.5 : 0.0);
    setSelectedRating(value);
    setError(null);
  };

  // Handle hovering over left/right half
  const handleStarMouseMove = (starIndex, event) => {
    if (!user) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    const value = starIndex - (isLeftHalf ? 0.5 : 0.0);
    setHoverRating(value);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!selectedRating || selectedRating < 0.5) {
      setError("Please pick a star rating between 0.5 and 5.0.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await submitRating(movieId, selectedRating);
      setSavedRating(selectedRating);
      setMessage(res.action === "updated" ? "Rating updated!" : "Rating saved!");
      if (onRatingChange) onRatingChange(selectedRating, res.action || "saved");

      // Broadcast event so other pages (Profile, Catalog) update without page reload
      window.dispatchEvent(
        new CustomEvent("moviemind:rating-updated", {
          detail: { movieId, rating: selectedRating, action: res.action || "saved" },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save rating. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await deleteRating(movieId);
      setSavedRating(null);
      setSelectedRating(0);
      setHoverRating(null);
      setConfirmDelete(false);
      setMessage("Rating removed.");
      if (onRatingChange) onRatingChange(null, "deleted");

      window.dispatchEvent(
        new CustomEvent("moviemind:rating-updated", {
          detail: { movieId, rating: null, action: "deleted" },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to remove rating.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={`star-control-box ${compact ? "star-control-box--compact" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "2px", opacity: 0.5 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={compact ? 16 : 20} className="muted" />
            ))}
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>
            <Link to="/login" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "underline" }}>
              Sign in
            </Link>{" "}
            to rate
          </span>
        </div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className={`star-control-box ${compact ? "star-control-box--compact" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-3)", fontSize: "0.82rem" }}>
          <Loader2 size={15} className="spinner-icon" />
          <span>Loading rating...</span>
        </div>
      </div>
    );
  }

  const isDirty = selectedRating > 0 && selectedRating !== savedRating;

  return (
    <div className={`star-control-box ${compact ? "star-control-box--compact" : ""}`} role="region" aria-label="Movie rating control">
      {/* Header / Current Status */}
      {!compact && showTitle && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>
            {savedRating !== null ? "Your Rating" : "Rate This Movie"}
          </span>
          {savedRating !== null && (
            <span
              style={{
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#f59e0b",
                background: "var(--star-soft)",
                padding: "2px 8px",
                borderRadius: "100px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Check size={12} /> Saved: {savedRating.toFixed(1)} ★
            </span>
          )}
        </div>
      )}

      {/* Interactive Stars Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div
          className="star-picker"
          onMouseLeave={() => setHoverRating(null)}
          role="radiogroup"
          aria-label="Star rating out of 5"
          style={{ display: "flex", gap: "3px", alignItems: "center" }}
        >
          {[1, 2, 3, 4, 5].map((starIdx) => {
            const fillLevel = Math.max(0, Math.min(1, activeValue - (starIdx - 1)));
            const isFull = fillLevel >= 1.0;
            const isHalf = fillLevel >= 0.5 && fillLevel < 1.0;

            return (
              <button
                key={starIdx}
                type="button"
                className={`star-btn ${isFull ? "is-full" : isHalf ? "is-half" : ""}`}
                onClick={(e) => handleStarClick(starIdx, e)}
                onMouseMove={(e) => handleStarMouseMove(starIdx, e)}
                disabled={loading}
                aria-label={`${starIdx} stars`}
                style={{
                  position: "relative",
                  background: "transparent",
                  border: "none",
                  padding: "2px",
                  cursor: loading ? "not-allowed" : "pointer",
                  color: isFull || isHalf ? "#f59e0b" : "var(--line)",
                  transition: "transform 0.1s ease",
                }}
              >
                {/* Background Empty Star */}
                <Star
                  size={compact ? 18 : 24}
                  strokeWidth={1.5}
                  stroke={isFull || isHalf ? "#f59e0b" : "#cbd5e1"}
                  fill={isFull ? "#f59e0b" : isHalf ? "url(#halfStarGrad)" : "none"}
                />
              </button>
            );
          })}

          {/* SVG Gradient definition for half stars */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <linearGradient id="halfStarGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="transparent" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Selected Rating Readout & Text Label */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <strong style={{ fontSize: compact ? "0.85rem" : "0.95rem", color: "var(--ink)", minWidth: "48px" }}>
            {activeValue > 0 ? `${activeValue.toFixed(1)} ★` : "—"}
          </strong>
          {activeValue > 0 && RATING_LABELS[activeValue] && !compact && (
            <span style={{ fontSize: "0.8rem", color: "var(--ink-2)", fontWeight: 500 }}>
              ({RATING_LABELS[activeValue]})
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Explicit Save & Delete Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "10px",
          flexWrap: "wrap",
        }}
      >
        {/* Save / Update Button */}
        {(isDirty || (savedRating === null && selectedRating > 0)) && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSave}
            disabled={loading || selectedRating === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            {loading ? <Loader2 size={13} className="spinner-icon" /> : <Check size={13} />}
            <span>{savedRating !== null ? "Update Rating" : "Save Rating"}</span>
          </button>
        )}

        {/* Remove Rating Control (With confirmation step) */}
        {savedRating !== null && !confirmDelete && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirmDelete(true)}
            disabled={loading}
            style={{ color: "var(--ink-3)", fontSize: "0.8rem" }}
            title="Remove your rating"
          >
            <Trash2 size={13} />
            <span>Remove</span>
          </button>
        )}

        {/* Confirmation Buttons for Removal */}
        {confirmDelete && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 8px",
              borderRadius: "var(--r-sm)",
              background: "var(--brand-soft)",
              border: "1px solid var(--brand)",
            }}
          >
            <span style={{ fontSize: "0.78rem", color: "var(--brand)", fontWeight: 600 }}>
              Confirm delete?
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: "2px 8px",
                fontSize: "0.75rem",
                background: "var(--brand)",
                color: "#fff",
              }}
            >
              Yes, delete
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirmDelete(false)}
              disabled={loading}
              style={{ padding: "2px 6px", fontSize: "0.75rem" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {message && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "8px",
            fontSize: "0.8rem",
            color: "#059669",
            fontWeight: 600,
          }}
        >
          <Check size={14} />
          <span>{message}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "8px",
            fontSize: "0.8rem",
            color: "var(--brand)",
            fontWeight: 600,
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
