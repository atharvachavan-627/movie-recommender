import { useEffect } from "react";
import { X, Film, Star } from "lucide-react";
import StarRating from "./StarRating";
import { cleanTitle, posterStyle, initials } from "../utils/movies";

export default function RatingModal({
  movie,
  initialRating = null,
  isOpen,
  onClose,
  onRatingSaved,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !movie) return null;

  const ps = posterStyle(movie.title);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(18, 20, 43, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="card modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "var(--surface)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--sh-2)",
          padding: "24px",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="btn btn--ghost btn--sm"
          aria-label="Close rating dialog"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            padding: "6px",
            borderRadius: "50%",
          }}
        >
          <X size={18} />
        </button>

        {/* Movie Header */}
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "18px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--r-md)",
              background: ps.background,
              color: ps.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.1rem",
              flexShrink: 0,
            }}
          >
            {initials(movie.title)}
          </div>
          <div style={{ paddingRight: "28px" }}>
            <h2 id="rating-modal-title" style={{ fontSize: "1.15rem", margin: 0, color: "var(--ink)" }}>
              {cleanTitle(movie.title)}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", fontSize: "0.8rem", color: "var(--ink-3)" }}>
              {movie.year && <span>{movie.year}</span>}
              {movie.genres && <span>• {movie.genres}</span>}
            </div>
            {movie.avg_rating > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.8rem", color: "var(--star)" }}>
                <Star size={13} fill="currentColor" />
                <span>Catalog Mean: {movie.avg_rating.toFixed(1)} / 5</span>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Star Control */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <StarRating
            movieId={movie.movieId}
            movieTitle={movie.title}
            initialRating={initialRating}
            onRatingChange={(newRating, action) => {
              if (onRatingSaved) onRatingSaved(newRating, action);
            }}
            showTitle={true}
          />
        </div>
      </div>
    </div>
  );
}
