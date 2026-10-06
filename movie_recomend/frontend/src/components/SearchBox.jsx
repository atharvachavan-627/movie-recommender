import { useEffect, useRef, useState } from "react";
import { Search, X, Star } from "lucide-react";
import { searchMovies } from "../services/api";
import { cleanTitle } from "../utils/movies";

export default function SearchBox({ onSelect, genre = "All", placeholder = "Search a movie title, e.g. Toy Story", size = "md", autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchMovies(query, 8, genre);
        if (!stale) { setResults(res.results || []); setActive(-1); }
      } catch (e) {
        console.error("Search error:", e);
        if (!stale) setResults([]);
      } finally {
        if (!stale) setLoading(false);
      }
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [query, genre]);

  useEffect(() => {
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (m) => { onSelect(m); setQuery(""); setOpen(false); };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && results.length) { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const show = open && query.trim().length > 0;

  return (
    <div className={`search search--${size}`} ref={wrap}>
      <div className="search__field">
        <Search size={size === "lg" ? 22 : 18} className="search__icon" />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="Search movies"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {query && (
          <button className="search__clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>
        )}
      </div>

      {show && (
        <div className="search__menu" role="listbox">
          {loading ? (
            <div className="search__note">Searching the dataset...</div>
          ) : results.length ? (
            results.map((m, i) => (
              <button
                key={m.movieId}
                role="option"
                aria-selected={i === active}
                className={`search__item ${i === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
              >
                <span className="search__text">
                  <span className="search__title">{cleanTitle(m.title)}{m.year ? <span className="muted"> ({m.year})</span> : null}</span>
                  <span className="search__genres">{(m.genres || "").split("|").join(", ")}</span>
                </span>
                <span className="rating"><Star size={13} fill="currentColor" /> {m.avg_rating ? Number(m.avg_rating).toFixed(1) : "N/A"}</span>
              </button>
            ))
          ) : (
            <div className="search__note">No movies match "{query}". Try another title.</div>
          )}
        </div>
      )}
    </div>
  );
}
