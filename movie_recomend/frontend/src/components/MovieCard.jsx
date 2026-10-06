import { Star, ArrowRight } from "lucide-react";
import { genresOf, posterStyle, initials, cleanTitle } from "../utils/movies";

export default function MovieCard({ movie, onSelect }) {
  const genres = genresOf(movie);
  const ps = posterStyle(movie.title);
  const rated = movie.avg_rating > 0;

  return (
    <article className="card movie">
      <div className="movie__poster" style={{ background: ps.background, color: ps.color }}>
        <span className="movie__initials">{initials(movie.title)}</span>
        {movie.year && <span className="movie__year">{movie.year}</span>}
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
      <button className="movie__action" onClick={() => onSelect(movie)}>
        Get recommendations <ArrowRight size={16} />
      </button>
    </article>
  );
}
