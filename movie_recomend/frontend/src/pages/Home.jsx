import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowRight, 
  Layers, 
  Users, 
  Shuffle, 
  Search, 
  Sparkles, 
  Database, 
  Cpu, 
  GitBranch, 
  BarChart3, 
  ShieldCheck, 
  CheckCircle2, 
  ExternalLink,
  Table,
  Zap
} from "lucide-react";
import SearchBox from "../components/SearchBox";
import MovieCard from "../components/MovieCard";
import { fetchAnalyticsOverview, fetchPopularMovies, fetchWarehouseSummary } from "../services/api";

const PIPELINE_STAGES = [
  {
    id: "raw",
    step: "01",
    title: "Raw Data",
    tech: "MovieLens 25M CSVs",
    desc: "Extraction of 62,423 movies and 42,986 ratings with timestamp temporal metadata.",
    input: "movies.csv, ratings.csv",
    output: "Cleaned Pandas DataFrames",
    link: "/warehouse"
  },
  {
    id: "etl",
    step: "02",
    title: "ETL & Quality",
    tech: "Python ETL Engine",
    desc: "Deduplication, genre normalization, release year parsing, and surrogate key derivation.",
    input: "Raw CSV Records",
    output: "Surrogate Keys & Clean Dims",
    link: "/warehouse"
  },
  {
    id: "warehouse",
    step: "03",
    title: "Star Schema DW",
    tech: "Physical SQLite DW",
    desc: "Normalized dimensional model: FACT_RATING (42,769 facts) + 4 conformed dimensions.",
    input: "Transformed records",
    output: "Physical Analytical Database",
    link: "/warehouse"
  },
  {
    id: "olap",
    step: "04",
    title: "OLAP Cube",
    tech: "Direct SQL Aggregations",
    desc: "Multi-dimensional Roll-Up, Drill-Down, Slicing, Dicing, and 2D Pivot Cross-Tabulation.",
    input: "FACT_RATING + DIM_*",
    output: "Sub-cube aggregations",
    link: "/olap"
  },
  {
    id: "mining",
    step: "05",
    title: "Data Mining",
    tech: "Apriori & K-Means",
    desc: "9,666 frequent co-viewing rules (X → Y) and 23-feature user segmentation with PCA.",
    input: "Rating Transactions",
    output: "Association Rules & Clusters",
    link: "/ml-insights"
  },
  {
    id: "ml",
    step: "06",
    title: "Machine Learning",
    tech: "Scikit-Learn Classifiers & Regressors",
    desc: "Decision Tree (68.2% acc), Naive Bayes, Random Forest, and HistGradientBoosting regression.",
    input: "Feature Vectors (80/20 split)",
    output: "Trained Predictive Models",
    link: "/ml-insights"
  },
  {
    id: "recommender",
    step: "07",
    title: "Hybrid Recommender",
    tech: "TF-IDF + Sparse CSR Matrix",
    desc: "Fuses Content-Based cosine similarity and Item-Item Collaborative Filtering with explainability.",
    input: "Candidate item vectors",
    output: "Ranked Recommendations",
    link: "/recommend"
  }
];

export default function Home({ status }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const [popular, setPopular] = useState([]);
  const [activeStage, setActiveStage] = useState(PIPELINE_STAGES[2]);

  useEffect(() => {
    fetchAnalyticsOverview().then(setOverview).catch(() => {});
    fetchWarehouseSummary().then(setWarehouse).catch(() => {});
    fetchPopularMovies(4).then((p) => setPopular((p || []).slice(0, 4))).catch(() => {});
  }, [status]);

  const open = (m) => navigate(`/recommend/${m.movieId}`);

  return (
    <div className="home-page">
      {/* Command Center Hero */}
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <div className="pill" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} color="var(--brand)" />
              <span>Movie Intelligence & Recommendation Platform</span>
            </div>
            <h1>From raw movie data to intelligent, explainable recommendations.</h1>
            <p className="hero__lead">
              A unified analytical architecture integrating a <strong>Physical Star Schema Data Warehouse</strong>, 
              <strong> Multi-Dimensional OLAP</strong>, <strong> Apriori Association Mining</strong>, 
              <strong> Machine Learning Classifiers</strong>, and an <strong> Explainable Hybrid Recommender</strong>.
            </p>
            
            <div className="hero__search">
              <SearchBox size="lg" onSelect={open} placeholder="Search 62,423 movies (e.g. Inception, Toy Story, Matrix)..." />
            </div>

            <div className="hero__actions" style={{ marginTop: "1.5rem", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link to="/recommend" className="btn btn--primary btn--lg">
                <Sparkles size={18} /> Get Recommendations
              </Link>
              <Link to="/warehouse" className="btn btn--secondary btn--lg">
                <Database size={18} /> Explore Data Warehouse
              </Link>
              <Link to="/how-it-works" className="btn btn--ghost btn--lg">
                How It Works
              </Link>
            </div>
          </div>

          {/* Interactive Hybrid Signal Card */}
          <aside className="ticket" aria-label="How hybrid recommendations are synthesized">
            <div className="ticket__head">
              <span className="ticket__label">Hybrid Intelligence Stack</span>
              <span className="ticket__note">Verified Live on MovieLens 25M</span>
            </div>
            
            <div className="ticket__rows">
              <div className="ticket__row">
                <div className="ticket__name"><Layers size={16} className="tone-content" /> Content-Based (TF-IDF)</div>
                <div className="ticket__bar"><span className="fill-content" style={{ width: "40%" }} /></div>
                <strong>40%</strong>
              </div>
              <div className="ticket__row">
                <div className="ticket__name"><Users size={16} className="tone-collab" /> Collaborative (CSR Matrix)</div>
                <div className="ticket__bar"><span className="fill-collab" style={{ width: "60%" }} /></div>
                <strong>60%</strong>
              </div>
              <div className="ticket__row" style={{ paddingTop: "6px", borderTop: "1px dashed var(--line)" }}>
                <div className="ticket__name" style={{ fontSize: "0.82rem" }}><Cpu size={14} color="#f59e0b" /> ML Decision Tree</div>
                <strong style={{ color: "#10b981", fontSize: "0.82rem" }}>68.2% Accuracy</strong>
              </div>
              <div className="ticket__row">
                <div className="ticket__name" style={{ fontSize: "0.82rem" }}><GitBranch size={14} color="#8b5cf6" /> Apriori Association</div>
                <strong style={{ color: "#8b5cf6", fontSize: "0.82rem" }}>9,666 Rules Mined</strong>
              </div>
            </div>

            <div className="ticket__foot" style={{ background: "var(--bg)", borderTop: "1px solid var(--line)", padding: "12px 16px" }}>
              <code className="weights__formula" style={{ fontSize: "0.78rem", display: "block", marginBottom: "4px" }}>
                Score = 0.40 × Content + 0.60 × Collaborative + ML Signal
              </code>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Zero data leakage with chronological 80/20 train/test partition.
              </p>
            </div>
          </aside>
        </div>

        {/* Live System KPIs */}
        <div className="container" style={{ marginTop: "2rem" }}>
          <dl className="stats">
            <div>
              <dt>Total Conformed Movies</dt>
              <dd>{warehouse?.tables?.DIM_MOVIE ? warehouse.tables.DIM_MOVIE.toLocaleString() : "62,423"}</dd>
            </div>
            <div>
              <dt>Warehouse Fact Ratings</dt>
              <dd>{warehouse?.tables?.FACT_RATING ? warehouse.tables.FACT_RATING.toLocaleString() : "42,769"}</dd>
            </div>
            <div>
              <dt>Active User Dimensions</dt>
              <dd>{warehouse?.tables?.DIM_USER ? warehouse.tables.DIM_USER.toLocaleString() : "522"}</dd>
            </div>
            <div>
              <dt>Calendar Date Keys</dt>
              <dd>{warehouse?.tables?.DIM_DATE ? warehouse.tables.DIM_DATE.toLocaleString() : "3,439"}</dd>
            </div>
            <div>
              <dt>Average Star Rating</dt>
              <dd style={{ color: "#f59e0b" }}>{warehouse?.fact_metrics?.average_rating ? `${warehouse.fact_metrics.average_rating} / 5` : "3.54 / 5"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* End-to-End Intelligence Pipeline Section */}
      <section className="section" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="container">
          <header className="section__head">
            <span className="eyebrow"><Zap size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Architectural Data Flow</span>
            <h2>The End-to-End MovieMind Pipeline</h2>
            <p>From raw CSV transactions to interactive OLAP cubes, data mining, and explainable recommendations.</p>
          </header>

          {/* Interactive Pipeline Steps */}
          <div className="pipeline-stepper" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
            gap: "8px",
            marginBottom: "1.5rem"
          }}>
            {PIPELINE_STAGES.map((s) => {
              const isActive = activeStage.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStage(s)}
                  className={`pipeline-step-btn ${isActive ? "is-active" : ""}`}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    background: isActive ? "var(--ink)" : "var(--surface)",
                    color: isActive ? "#fff" : "var(--ink)",
                    border: isActive ? "1px solid var(--ink)" : "1px solid var(--line)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "0.72rem", opacity: 0.7, display: "block" }}>STAGE {s.step}</span>
                  <strong style={{ fontSize: "0.85rem", display: "block", marginTop: "2px" }}>{s.title}</strong>
                </button>
              );
            })}
          </div>

          {/* Active Stage Detail Showcase */}
          {activeStage && (
            <div className="card stage-detail-card" style={{
              padding: "1.5rem 1.75rem",
              background: "var(--surface)",
              borderLeft: "4px solid var(--brand)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
              alignItems: "center"
            }}>
              <div>
                <span className="badge badge--brand" style={{ marginBottom: "0.4rem" }}>Stage {activeStage.step}: {activeStage.tech}</span>
                <h3 style={{ fontSize: "1.3rem", margin: "0.2rem 0 0.5rem" }}>{activeStage.title}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", margin: 0, lineHeight: 1.5 }}>
                  {activeStage.desc}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ fontSize: "0.82rem", background: "var(--bg)", padding: "8px 12px", borderRadius: "6px" }}>
                  <strong className="muted">INPUT:</strong> <code>{activeStage.input}</code>
                </div>
                <div style={{ fontSize: "0.82rem", background: "var(--bg)", padding: "8px 12px", borderRadius: "6px" }}>
                  <strong className="muted">OUTPUT:</strong> <code>{activeStage.output}</code>
                </div>
                <Link to={activeStage.link} className="btn btn--secondary" style={{ alignSelf: "flex-start", marginTop: "4px", fontSize: "0.85rem" }}>
                  Explore {activeStage.title} Live <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section className="section section--tint">
        <div className="container">
          <header className="section__head">
            <h2>Four Core Pillars of the MovieMind Stack</h2>
            <p>Designed for academic rigor and verifiable production quality.</p>
          </header>

          <div className="grid-4">
            <article className="card feature" style={{ padding: "1.5rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(229, 9, 20, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", marginBottom: "1rem" }}>
                <Database size={20} />
              </div>
              <h3 style={{ fontSize: "1.05rem", marginBottom: "0.4rem" }}>Star Schema Warehouse</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                Physical fact and dimension tables in SQLite with auto-increment surrogate keys and 100% referential integrity.
              </p>
              <Link to="/warehouse" className="link-arrow" style={{ marginTop: "1rem", fontSize: "0.82rem" }}>
                Inspect Schema <ArrowRight size={14} />
              </Link>
            </article>

            <article className="card feature" style={{ padding: "1.5rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", marginBottom: "1rem" }}>
                <BarChart3 size={20} />
              </div>
              <h3 style={{ fontSize: "1.05rem", marginBottom: "0.4rem" }}>Multi-Dim OLAP Cube</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                Interactive Roll-Up, Drill-Down along 5-level time hierarchy, Slicing, Dicing, and 2D cross-tabulation matrix.
              </p>
              <Link to="/olap" className="link-arrow" style={{ marginTop: "1rem", fontSize: "0.82rem" }}>
                Launch OLAP <ArrowRight size={14} />
              </Link>
            </article>

            <article className="card feature" style={{ padding: "1.5rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: "1rem" }}>
                <Cpu size={20} />
              </div>
              <h3 style={{ fontSize: "1.05rem", marginBottom: "0.4rem" }}>ML & Mining Suite</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                Decision Tree, Naive Bayes, Random Forest regression, K-Means elbow/silhouette analysis, and 9,666 Apriori rules.
              </p>
              <Link to="/ml-insights" className="link-arrow" style={{ marginTop: "1rem", fontSize: "0.82rem" }}>
                Explore ML Lab <ArrowRight size={14} />
              </Link>
            </article>

            <article className="card feature" style={{ padding: "1.5rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", marginBottom: "1rem" }}>
                <Shuffle size={20} />
              </div>
              <h3 style={{ fontSize: "1.05rem", marginBottom: "0.4rem" }}>Explainable Recommender</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                Weighted hybrid recommendation combining content and collaborative signals with "Why this movie?" mathematical decomposition.
              </p>
              <Link to="/recommend" className="link-arrow" style={{ marginTop: "1rem", fontSize: "0.82rem" }}>
                Get Recommendations <ArrowRight size={14} />
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Popular Movies Showcase */}
      {popular.length > 0 && (
        <section className="section">
          <div className="container">
            <header className="section__head section__head--row">
              <div>
                <h2>Most Rated Titles in Dataset</h2>
                <p>Click any title to generate instant hybrid recommendations with explainable scores.</p>
              </div>
              <Link to="/explore" className="link-arrow">Browse all 62,423 movies <ArrowRight size={16} /></Link>
            </header>

            <div className="movies-grid">
              {popular.map((m) => (
                <MovieCard key={m.movieId} movie={m} onSelect={open} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
