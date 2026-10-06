import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Layers, Users, Shuffle, Search, SlidersHorizontal, Lightbulb, BarChart3, Eraser, Combine } from "lucide-react";
import SearchBox from "../components/SearchBox";
import MovieCard from "../components/MovieCard";
import { fetchAnalyticsOverview, fetchPopularMovies } from "../services/api";

const num = (v) => (v || v === 0 ? Number(v).toLocaleString() : "-");
const compact = (v) => (v ? `${(v / 1e6).toFixed(1)}M` : "-");

export default function Home({ status }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    fetchAnalyticsOverview().then(setOverview).catch(() => {});
    fetchPopularMovies(4).then((p) => setPopular((p || []).slice(0, 4))).catch(() => {});
  }, [status]);

  const open = (m) => navigate(`/recommend/${m.movieId}`);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="pill">Hybrid recommendation engine</p>
            <h1>Find the movie you will actually want to watch</h1>
            <p className="hero__lead">
              Pick a movie you like. MovieMind compares its genres with thousands of titles and checks
              what viewers with similar taste rated highly, then blends both signals into one ranked list.
            </p>
            <div className="hero__search">
              <SearchBox size="lg" onSelect={open} placeholder="Search a movie you like, e.g. Toy Story" />
            </div>
            <div className="hero__actions">
              <Link to="/explore" className="btn btn--primary btn--lg">Browse movies <ArrowRight size={18} /></Link>
              <Link to="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
            </div>
          </div>

          <aside className="ticket" aria-label="How a hybrid score is built">
            <div className="ticket__head">
              <span className="ticket__label">Hybrid score</span>
              <span className="ticket__note">Default blend, adjustable per search</span>
            </div>
            <div className="ticket__rows">
              <div className="ticket__row">
                <div className="ticket__name"><Layers size={16} className="tone-content" /> Content similarity</div>
                <div className="ticket__bar"><span className="fill-content" style={{ width: "40%" }} /></div>
                <strong>40%</strong>
              </div>
              <div className="ticket__row">
                <div className="ticket__name"><Users size={16} className="tone-collab" /> Collaborative signal</div>
                <div className="ticket__bar"><span className="fill-collab" style={{ width: "60%" }} /></div>
                <strong>60%</strong>
              </div>
            </div>
            <div className="ticket__perf" aria-hidden="true" />
            <div className="ticket__foot">
              <code>Hybrid = 0.4 x Content + 0.6 x Collaborative</code>
              <p>Both scores are normalized to the same 0 to 1 scale before they are combined.</p>
            </div>
          </aside>
        </div>

        <div className="container">
          <dl className="stats">
            <div><dt>Movies</dt><dd>{num(overview?.total_movies)}</dd></div>
            <div><dt>Users</dt><dd>{num(overview?.total_users)}</dd></div>
            <div><dt>Ratings</dt><dd>{compact(overview?.total_ratings)}</dd></div>
            <div><dt>Average rating</dt><dd>{overview?.avg_rating !== undefined ? `${Number(overview.avg_rating).toFixed(2)} / 5` : "-"}</dd></div>
          </dl>
        </div>
      </section>

      {/* Methods */}
      <section className="section" id="methods">
        <div className="container">
          <header className="section__head">
            <h2>Two ways to understand taste, combined</h2>
            <p>Each method has blind spots. Blending them gives more balanced suggestions than either one alone.</p>
          </header>
          <div className="grid-3">
            <article className="card method method--content">
              <span className="method__icon"><Layers size={22} /></span>
              <h3>Content-based</h3>
              <p>Looks at what a movie is about. Genres become TF-IDF vectors, and cosine similarity finds titles with a similar profile.</p>
              <ul className="flow"><li>Genres</li><li>TF-IDF</li><li>Cosine similarity</li></ul>
            </article>
            <article className="card method method--collab">
              <span className="method__icon"><Users size={22} /></span>
              <h3>Collaborative</h3>
              <p>Looks at how people behave. Movies that many users rate alike are treated as related, using an item-item similarity matrix.</p>
              <ul className="flow"><li>User ratings</li><li>Item matrix</li><li>Item similarity</li></ul>
            </article>
            <article className="card method method--hybrid">
              <span className="method__icon"><Shuffle size={22} /></span>
              <h3>Hybrid</h3>
              <p>Normalizes both scores, then applies adjustable weights. Every result shows its content, collaborative and hybrid score.</p>
              <ul className="flow"><li>Normalize</li><li>Weight</li><li>Rank top N</li></ul>
            </article>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section--tint">
        <div className="container">
          <header className="section__head">
            <h2>Built to be explored, not just queried</h2>
          </header>
          <div className="grid-4">
            <article className="feature"><Search size={20} /><h3>Live search</h3><p>Find any title in the dataset as you type, with genre filters on the catalog.</p></article>
            <article className="feature"><SlidersHorizontal size={20} /><h3>Adjustable weights</h3><p>Shift the balance between content and collaborative scores and watch the ranking change.</p></article>
            <article className="feature"><Lightbulb size={20} /><h3>Explained results</h3><p>Each recommendation says why it was suggested and shows its score breakdown.</p></article>
            <article className="feature"><BarChart3 size={20} /><h3>Data insights</h3><p>Dashboards for rating spread, genre volume and the most rated movies.</p></article>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="section">
        <div className="container">
          <header className="section__head">
            <h2>From raw ratings to a ranked list</h2>
            <p>The pipeline behind every recommendation, in four steps.</p>
          </header>
          <ol className="steps">
            <li><span className="steps__n">1</span><Eraser size={20} /><h3>Clean and transform</h3><p>Load movies.csv and ratings.csv, tidy genres, extract release years and use compact data types.</p></li>
            <li><span className="steps__n">2</span><Layers size={20} /><h3>Build genre features</h3><p>Turn genres into TF-IDF vectors and compare them with cosine similarity.</p></li>
            <li><span className="steps__n">3</span><Users size={20} /><h3>Learn from ratings</h3><p>Build a sparse user-movie matrix and compute item-item similarity from it.</p></li>
            <li><span className="steps__n">4</span><Combine size={20} /><h3>Blend and rank</h3><p>Normalize both scores, apply the weights and return the top matches.</p></li>
          </ol>
        </div>
      </section>

      {/* Popular */}
      {popular.length > 0 && (
        <section className="section section--tint">
          <div className="container">
            <header className="section__head section__head--row">
              <div>
                <h2>Most rated movies</h2>
                <p>Pick any card to see what MovieMind recommends next.</p>
              </div>
              <Link to="/explore" className="link-arrow">Browse all movies <ArrowRight size={16} /></Link>
            </header>
            <div className="movies-grid">
              {popular.map((m) => <MovieCard key={m.movieId} movie={m} onSelect={open} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="cta">
            <div>
              <h2>Start with one movie you love</h2>
              <p>Search for a title and get your first hybrid recommendations in seconds.</p>
            </div>
            <Link to="/recommend" className="btn btn--light btn--lg">Get recommendations <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
