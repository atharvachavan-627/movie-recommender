import { useState } from "react";
import { Star, ArrowRight, Bookmark } from "lucide-react";
import { genresOf, posterStyle, initials, cleanTitle } from "../utils/movies";
import RatingModal from "./RatingModal";

export default function MovieCard({ movie, onSelect, userRating = null, onRatingSaved = null }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentUserRating, setCurrentUserRating] = useState(userRating);
  const genres = genresOf(movie);
  const ps = posterStyle(movie.title);
  const rated = movie.avg_rating > 0;

  const handleRatingSaved = (newRating, action) => {
    setCurrentUserRating(newRating);
    if (onRatingSaved) onRatingSaved(movie.movieId, newRating, action);
  };

  return (
    <>
      <article className="card movie">
        <div className="movie__poster" style={{ background: ps.background, color: ps.color }}>
          <span className="movie__initials">{initials(movie.title)}</span>
          {movie.year && <span className="movie__year">{movie.year}</span>}
          {currentUserRating !== null && (
            <span
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "#f59e0b",
                color: "#12142b",
                fontWeight: 800,
                fontSize: "0.74rem",
                padding: "2px 7px",
                borderRadius: "100px",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              }}
            >
              <Star size={11} fill="currentColor" /> {currentUserRating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="movie__body">
          <h3 className="movie__title" title={movie.title}>{cleanTitle(movie.title)}</h3>
          <div className="movie__meta">
            <span className="rating"><Star size={14} fill="currentColor" /> {rated ? movie.avg_rating.toFixed(1) : "N/A"}</span>
            <span className="muted">
              {movie.rating_count > 0 ? `${movie.rating_count.toLocaleString()} ratings` : "No ratings"}
            </span>
          </div>
          <div className="chips">
            {genres.slice(0, 3).map((g) => <span key={g} className="chip">{g}</span>)}
            {genres.length > 3 && <span className="chip chip--more">+{genres.length - 3}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", padding: "0 16px 14px 16px" }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
          >
            <Star size={13} fill={currentUserRating !== null ? "#f59e0b" : "none"} color={currentUserRating !== null ? "#f59e0b" : "currentColor"} />
            <span>{currentUserRating !== null ? `${currentUserRating.toFixed(1)} ★` : "Rate"}</span>
          </button>
          <button
            type="button"
            className="movie__action"
            onClick={() => onSelect(movie)}
            style={{ flex: 2, margin: 0, padding: "8px 12px" }}
          >
            <span>Similar</span> <ArrowRight size={14} />
          </button>
        </div>
      </article>

      <RatingModal
        movie={movie}
        initialRating={currentUserRating}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRatingSaved={handleRatingSaved}
      />
    </>
  );
}
