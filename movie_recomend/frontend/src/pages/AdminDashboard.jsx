import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchAdminSummary, fetchAdminSystemHealth } from "../services/adminApi";
import {
  Database,
  Users,
  Film,
  Layers,
  Tag,
  Star,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  Boxes,
  Cpu,
  BarChart3,
  BookOpen,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Server,
  Workflow,
  Info
} from "lucide-react";

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    try {
      const [sumRes, healthRes] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminSystemHealth()
      ]);
      setSummary(sumRes);
      setHealth(healthRes);
      setError(null);
    } catch (err) {
      console.error("Dashboard data load error:", err);
      setError("Unable to retrieve live administrator metrics. Please ensure backend is active.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "healthy":
        return (
          <span className="health-badge health-badge--healthy">
            <CheckCircle2 size={14} /> Healthy
          </span>
        );
      case "degraded":
        return (
          <span className="health-badge health-badge--degraded">
            <AlertTriangle size={14} /> Degraded
          </span>
        );
      case "unavailable":
        return (
          <span className="health-badge health-badge--unavailable">
            <XCircle size={14} /> Unavailable
          </span>
        );
      default:
        return (
          <span className="health-badge health-badge--unknown">
            <HelpCircle size={14} /> Unknown
          </span>
        );
    }
  };

  return (
    <div className="admin-page-container">
      {/* Header with Title & Live Refresh */}
      <div className="admin-hero-banner">
        <div className="admin-hero-text">
          <h2>MovieMind Administration</h2>
          <p>Data Warehouse, Machine Learning, and Recommendation Intelligence Control Center.</p>
        </div>
        <div className="admin-hero-actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm admin-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RotateCw size={15} className={refreshing ? "spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh Live Metrics"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-banner" role="alert">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="admin-section" aria-labelledby="kpi-heading">
        <div className="admin-section-header">
          <h3 id="kpi-heading">Core System Operational KPIs</h3>
          <span className="admin-section-sub">Real-time counts queried directly from operational and analytical databases</span>
        </div>

        {loading ? (
          <div className="admin-kpi-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="admin-kpi-card skeleton skeleton--kpi" />
            ))}
          </div>
        ) : (
          <div className="admin-kpi-grid">
            {/* Total Movies */}
            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">TOTAL MOVIES</span>
                <span className="admin-kpi-icon"><Film size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.movies_count?.toLocaleString() || "—"}</div>
              <div className="admin-kpi-caption">Indexed across full MovieLens corpus</div>
            </div>

            {/* Total Users */}
            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">TOTAL USERS</span>
                <span className="admin-kpi-icon"><Users size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.users_count?.toLocaleString() || "—"}</div>
              <div className="admin-kpi-caption">Unique raters in active collaborative matrix</div>
            </div>

            {/* Total Ratings */}
            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">TOTAL RATINGS (RAW)</span>
                <span className="admin-kpi-icon"><Activity size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.raw_ratings_count?.toLocaleString() || "—"}</div>
              <div className="admin-kpi-caption">Raw operational ratings from CSV source</div>
            </div>

            {/* Warehouse Fact Records */}
            <div className="admin-kpi-card admin-kpi-card--highlight">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">WAREHOUSE FACT RECORDS</span>
                <span className="admin-kpi-icon"><Layers size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.warehouse_fact_count?.toLocaleString() || "—"}</div>
              <div className="admin-kpi-caption">Deduplicated Star Schema FACT_RATING rows</div>
            </div>

            {/* Genres */}
            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">GENRES</span>
                <span className="admin-kpi-icon"><Tag size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.genres_count || "—"}</div>
              <div className="admin-kpi-caption">Normalized DIM_GENRE categories</div>
            </div>

            {/* Average Rating */}
            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <span className="admin-kpi-label">AVERAGE RATING</span>
                <span className="admin-kpi-icon"><Star size={18} /></span>
              </div>
              <div className="admin-kpi-val">{summary?.avg_rating ? `${summary.avg_rating} ★` : "—"}</div>
              <div className="admin-kpi-caption">Dataset-wide mean rating score</div>
            </div>
          </div>
        )}

        {/* Data Lineage & Distinction Note */}
        <div className="admin-info-note">
          <Info size={18} className="admin-info-icon" />
          <div className="admin-info-text">
            <strong>DWM Fact Table Distinction:</strong> The raw dataset contains{" "}
            <strong>{summary?.raw_ratings_count?.toLocaleString() || "42,986"}</strong> interactions. During Star Schema ETL,
            transactions are deduplicated to adhere strictly to the atomic grain of{" "}
            <em>(1 User × 1 Movie × 1 Date)</em>, yielding{" "}
            <strong>{summary?.warehouse_fact_count?.toLocaleString() || "42,769"}</strong> verified fact rows with 100% surrogate-key referential integrity.
          </div>
        </div>
      </section>

      {/* System Health Section (Section 18) */}
      <section className="admin-section" aria-labelledby="health-heading">
        <div className="admin-section-header">
          <h3 id="health-heading">System Architectural Health Status</h3>
          <span className="admin-section-sub">Live active status inspection of SQLite warehouse, ML engines, and API services</span>
        </div>

        <div className="admin-health-panel">
          <div className="admin-health-overall">
            <span className="admin-health-overall-label">Overall System State</span>
            <div className="admin-health-overall-status">
              {getStatusBadge(health?.overall_status || "Unknown")}
            </div>
          </div>

          <div className="admin-health-grid">
            {/* Backend API */}
            <div className="admin-health-item">
              <div className="admin-health-item-top">
                <div className="admin-health-item-title">
                  <Server size={17} />
                  <strong>Backend API Runtime</strong>
                </div>
                {getStatusBadge(health?.components?.backend_api?.status || "Unknown")}
              </div>
              <p className="admin-health-desc">
                {health?.components?.backend_api?.message || "FastAPI runtime monitoring"}
              </p>
            </div>

            {/* SQLite Data Warehouse */}
            <div className="admin-health-item">
              <div className="admin-health-item-top">
                <div className="admin-health-item-title">
                  <Database size={17} />
                  <strong>SQLite Data Warehouse</strong>
                </div>
                {getStatusBadge(health?.components?.warehouse_db?.status || "Unknown")}
              </div>
              <p className="admin-health-desc">
                {health?.components?.warehouse_db?.message || "Star Schema relational storage"}
              </p>
            </div>

            {/* Recommendation Engine */}
            <div className="admin-health-item">
              <div className="admin-health-item-top">
                <div className="admin-health-item-title">
                  <Sparkles size={17} />
                  <strong>Recommendation Engine</strong>
                </div>
                {getStatusBadge(health?.components?.recommendation_engine?.status || "Unknown")}
              </div>
              <p className="admin-health-desc">
                {health?.components?.recommendation_engine?.message || "TF-IDF & CSR Sparse Cosine models"}
              </p>
            </div>

            {/* ML Models */}
            <div className="admin-health-item">
              <div className="admin-health-item-top">
                <div className="admin-health-item-title">
                  <Cpu size={17} />
                  <strong>Machine Learning Models</strong>
                </div>
                {getStatusBadge(health?.components?.ml_models?.status || "Unknown")}
              </div>
              <p className="admin-health-desc">
                {health?.components?.ml_models?.message || "Decision Tree, Naive Bayes & K-Means"}
              </p>
            </div>

            {/* ETL Pipeline */}
            <div className="admin-health-item">
              <div className="admin-health-item-top">
                <div className="admin-health-item-title">
                  <Workflow size={17} />
                  <strong>ETL Pipeline Integrity</strong>
                </div>
                {getStatusBadge(health?.components?.etl_pipeline?.status || "Unknown")}
              </div>
              <p className="admin-health-desc">
                {health?.components?.etl_pipeline?.message || "Dimensional modeling & surrogate keys"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Module Navigation Cards (Section 11) */}
      <section className="admin-section" aria-labelledby="modules-heading">
        <div className="admin-section-header">
          <h3 id="modules-heading">Administrative Intelligence Modules</h3>
          <span className="admin-section-sub">Direct access to technical data engineering, mining, and evaluation suites</span>
        </div>

        <div className="admin-modules-grid">
          {/* 1. Data Warehouse & ETL */}
          <div className="admin-module-card">
            <div className="admin-module-header">
              <div className="admin-module-icon bg-star">
                <Database size={22} />
              </div>
              <h4>Data Warehouse & ETL</h4>
            </div>
            <p className="admin-module-desc">
              Inspect the physical star schema, fact tables, dimensions, ETL execution, and referential integrity.
            </p>
            <div className="admin-module-footer">
              <Link to="/admin/warehouse" className="btn btn--primary btn--sm admin-module-btn">
                <span>Open Warehouse</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 2. OLAP Analytics */}
          <div className="admin-module-card">
            <div className="admin-module-header">
              <div className="admin-module-icon bg-content">
                <Boxes size={22} />
              </div>
              <h4>OLAP Analytics</h4>
            </div>
            <p className="admin-module-desc">
              Perform Roll-Up, Drill-Down, Slice, Dice, Pivot, and Apriori association rule analysis.
            </p>
            <div className="admin-module-footer">
              <Link to="/admin/olap" className="btn btn--primary btn--sm admin-module-btn">
                <span>Open OLAP Cube</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 3. Machine Learning & Mining */}
          <div className="admin-module-card">
            <div className="admin-module-header">
              <div className="admin-module-icon bg-collab">
                <Cpu size={22} />
              </div>
              <h4>Machine Learning & Mining</h4>
            </div>
            <p className="admin-module-desc">
              Explore classification, regression, clustering, continuous prediction, and recommendation evaluation.
            </p>
            <div className="admin-module-footer">
              <Link to="/admin/ml-insights" className="btn btn--primary btn--sm admin-module-btn">
                <span>Open ML Insights</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 4. Analytics */}
          <div className="admin-module-card">
            <div className="admin-module-header">
              <div className="admin-module-icon bg-brand">
                <BarChart3 size={22} />
              </div>
              <h4>Analytics</h4>
            </div>
            <p className="admin-module-desc">
              Explore dataset distributions, rating trends, genre insights, and analytical findings.
            </p>
            <div className="admin-module-footer">
              <Link to="/admin/analytics" className="btn btn--primary btn--sm admin-module-btn">
                <span>Open Analytics</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* 5. Technical Documentation */}
          <div className="admin-module-card admin-module-card--wide">
            <div className="admin-module-header">
              <div className="admin-module-icon bg-dark">
                <BookOpen size={22} />
              </div>
              <h4>Technical Documentation</h4>
            </div>
            <p className="admin-module-desc">
              Understand algorithms, architecture, formulas, and implementation details across all system pillars.
            </p>
            <div className="admin-module-footer">
              <Link to="/admin/technical-guide" className="btn btn--secondary btn--sm admin-module-btn">
                <span>Open Technical Guide</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
