import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Cpu, Info, RefreshCw, Star, SlidersHorizontal } from "lucide-react";
import SearchBox from "../components/SearchBox";
import ScoreBar from "../components/ScoreBar";
import {
  fetchMovieDetails,
  fetchPopularMovies,
  fetchHybridRecommendations,
  fetchContentRecommendations,
  fetchCollaborativeRecommendations,
} from "../services/api";
import { genresOf, posterStyle, initials, cleanTitle } from "../utils/movies";

const MODES = [
  { id: "hybrid", label: "Hybrid" },
  { id: "content", label: "Content-based" },
  { id: "collaborative", label: "Collaborative" },
];

function Picker({ onSelect }) {
  const [popular, setPopular] = useState([]);
  useEffect(() => { fetchPopularMovies(6).then(setPopular).catch(() => {}); }, []);
  return (
    <div className="container page picker">
      <header className="page__head page__head--center">
        <h1>Get movie recommendations</h1>
        <p>Search for a movie you like and MovieMind will suggest similar ones.</p>
      </header>
      <SearchBox size="lg" autoFocus onSelect={onSelect} />
      {popular.length > 0 && (
        <div className="picker__suggest">
          <span className="muted">Or start from a popular title</span>
          <div className="chips chips--center">
            {popular.map((m) => (
              <button key={m.movieId} className="chip chip--button" onClick={() => onSelect(m)}>{cleanTitle(m.title)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Recommendations() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const open = (m) => navigate(`/recommend/${m.movieId}`);

  const [movie, setMovie] = useState(null);
  const [movieError, setMovieError] = useState(null);
  const [mode, setMode] = useState("hybrid");
  const [contentW, setContentW] = useState(0.4);
  const [recs, setRecs] = useState([]);
  const [algo, setAlgo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const collabW = parseFloat((1 - contentW).toFixed(2));

  // Load the selected movie from the URL
  useEffect(() => {
    if (!movieId) { setMovie(null); return; }
    let stale = false;
    setMovie(null);
    setMovieError(null);
    fetchMovieDetails(movieId)
      .then((m) => !stale && setMovie(m))
      .catch(() => !stale && setMovieError("We could not find that movie. Search for another title."));
    return () => { stale = true; };
  }, [movieId]);

  // Load recommendations (weights are debounced so the slider stays smooth)
  useEffect(() => {
    if (!movie) return;
    let stale = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        let res;
        if (mode === "hybrid") res = await fetchHybridRecommendations(movie.movieId, 10, contentW, collabW);
        else if (mode === "content") res = await fetchContentRecommendations(movie.movieId, 10);
        else res = await fetchCollaborativeRecommendations(movie.movieId, 10);
        if (stale) return;
        setRecs(res.recommendations || []);
        setAlgo(res.algorithm || "");
      } catch (e) {
        console.error(e);
        if (!stale) setError("Failed to load recommendations. Check the backend and try again.");
      } finally {
        if (!stale) setLoading(false);
      }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [movie, mode, contentW, collabW]);

  if (!movieId) return <Picker onSelect={open} />;

  if (movieError) {
    return (
      <div className="container page empty">
        <h1>Movie not found</h1>
        <p>{movieError}</p>
        <Link to="/recommend" className="btn btn--primary">Search movies</Link>
      </div>
    );
  }

  if (!movie) {
    return <div className="container page"><div className="skeleton skeleton--hero" /></div>;
  }

  const ps = posterStyle(movie.title);
  const genres = genresOf(movie);

  return (
    <div className="container page">
      <Link to="/explore" className="back"><ArrowLeft size={16} /> Back to explore</Link>

      <section className="card selected">
        <div className="selected__main">
          <div className="selected__poster" style={{ background: ps.background, color: ps.color }}>{initials(movie.title)}</div>
          <div>
            <p className="eyebrow">Recommendations for</p>
            <h1 className="selected__title">{cleanTitle(movie.title)}</h1>
            <div className="movie__meta movie__meta--lg">
              {movie.year && <span>{movie.year}</span>}
              <span className="rating"><Star size={15} fill="currentColor" /> {movie.avg_rating > 0 ? movie.avg_rating.toFixed(2) : "N/A"} / 5</span>
              <span className="muted">{(movie.rating_count || 0).toLocaleString()} ratings</span>
            </div>
            <div className="chips">{genres.map((g) => <span key={g} className="chip">{g}</span>)}</div>
          </div>
        </div>

        <div className={`weights ${mode !== "hybrid" ? "is-off" : ""}`}>
          <div className="weights__title"><SlidersHorizontal size={16} /> Hybrid weights</div>
          <div className="weights__labels">
            <span className="tone-content">Content {Math.round(contentW * 100)}%</span>
            <span className="tone-collab">Collaborative {Math.round(collabW * 100)}%</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.05" value={contentW}
            disabled={mode !== "hybrid"}
            aria-label="Balance between content and collaborative scores"
            onChange={(e) => setContentW(parseFloat(e.target.value))}
          />
          <code className="weights__formula">Hybrid = {contentW.toFixed(2)} x Content + {collabW.toFixed(2)} x Collaborative</code>
          {mode !== "hybrid" && <p className="weights__note">Weights apply to the Hybrid view only.</p>}
        </div>
      </section>

      <div className="rec-bar">
        <div className="segmented" role="tablist" aria-label="Recommendation method">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? "is-active" : ""} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="muted">{loading ? "Loading..." : `Top ${recs.length} matches`}</span>
      </div>

      {algo && !error && (
        <p className="pipeline"><Cpu size={16} /> <span><strong>Active pipeline:</strong> {algo}</span></p>
      )}

      {error ? (
        <div className="empty empty--box"><h3>Something went wrong</h3><p>{error}</p></div>
      ) : loading ? (
        <div className="movies-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton skeleton--rec" />)}</div>
      ) : recs.length === 0 ? (
        <div className="empty empty--box">
          <Info size={28} />
          <h3>No recommendations found</h3>
          <p>Try another movie or a different method.</p>
        </div>
      ) : (
        <div className="movies-grid">
          {recs.map((r, i) => (
            <article key={r.movieId} className="card rec">
              <div className="rec__top">
                <span className="rec__rank">#{i + 1}</span>
                <span className="rating"><Star size={14} fill="currentColor" /> {r.avg_rating ? r.avg_rating.toFixed(1) : "N/A"}</span>
              </div>
              <h3 className="rec__title">{cleanTitle(r.title)}{r.year ? <span className="muted"> ({r.year})</span> : null}</h3>
              <div className="chips">{genresOf(r).slice(0, 3).map((g) => <span key={g} className="chip">{g}</span>)}</div>

              <div className="rec__scores">
                <ScoreBar label="Hybrid" value={r.hybrid_score} tone="hybrid" strong />
                <ScoreBar label="Content" value={r.content_score} tone="content" />
                <ScoreBar label="Collaborative" value={r.collaborative_score} tone="collab" />
              </div>

              {r.explanation && <p className="rec__why"><strong>Why recommended:</strong> {r.explanation}</p>}

              <button className="btn btn--secondary btn--block" onClick={() => open(r)}>
                <RefreshCw size={15} /> Recommend similar
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
