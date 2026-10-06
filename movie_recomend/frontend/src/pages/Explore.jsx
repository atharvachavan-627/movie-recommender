import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMovies } from "../services/api";
import MovieCard from "../components/MovieCard";
import SearchBox from "../components/SearchBox";

const PAGE = 24;

export default function Explore() {
  const navigate = useNavigate();
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState("All");
  const [movies, setMovies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    fetchMovies(PAGE, 0, genre)
      .then((res) => {
        if (stale) return;
        setMovies(res.movies || []);
        setTotal(res.total || 0);
        if (res.genres?.length) setGenres(res.genres);
      })
      .catch(() => !stale && setError("Could not load movies. Check that the backend is running on port 8000."))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [genre]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchMovies(PAGE, movies.length, genre);
      setMovies((prev) => [...prev, ...(res.movies || [])]);
    } catch {
      setError("Could not load more movies.");
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (m) => navigate(`/recommend/${m.movieId}`);

  return (
    <div className="container page">
      <header className="page__head">
        <h1>Explore movies</h1>
        <p>Search the catalog or filter by genre, then pick a movie to see its recommendations.</p>
      </header>

      <div className="toolbar">
        <SearchBox genre={genre} onSelect={open} />
      </div>

      <div className="genres" role="group" aria-label="Filter by genre">
        {["All", ...genres].map((g) => (
          <button key={g} className={`tab ${genre === g ? "is-active" : ""}`} onClick={() => setGenre(g)} aria-pressed={genre === g}>
            {g === "All" ? "All genres" : g}
          </button>
        ))}
      </div>

      <div className="results-line">
        {!loading && !error && (
          <span>{total.toLocaleString()} {genre === "All" ? "movies" : `${genre} movies`}, most rated first</span>
        )}
      </div>

      {error ? (
        <div className="empty empty--box"><h3>Something went wrong</h3><p>{error}</p></div>
      ) : loading ? (
        <div className="movies-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton skeleton--card" />)}</div>
      ) : movies.length === 0 ? (
        <div className="empty empty--box"><h3>No movies found</h3><p>Try a different genre.</p></div>
      ) : (
        <>
          <div className="movies-grid">
            {movies.map((m) => <MovieCard key={m.movieId} movie={m} onSelect={open} />)}
          </div>
          {movies.length < total && (
            <div className="center">
              <button className="btn btn--secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more movies"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
