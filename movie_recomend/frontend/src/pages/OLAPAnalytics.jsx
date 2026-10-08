import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  Layers,
  TrendingUp,
  Filter,
  SlidersHorizontal,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  BarChart2,
  BarChart3,
  Film,
  Users,
  Info,
  Calendar,
  RotateCcw,
  Search,
  ExternalLink,
  Award,
  Zap,
  Brain,
  Sliders,
  Eye
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import {
  fetchWarehouseSummary,
  rebuildWarehouseETL,
  fetchOLAPRollup,
  fetchOLAPDrilldown,
  fetchOLAPSlice,
  fetchOLAPDice,
  fetchOLAPPivot,
  fetchAssociationRules,
  fetchMovieAssociationRules,
  fetchPopularMovies
} from "../services/api";

const COLORS = ["#e50914", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];
const AXIS = { stroke: "var(--text-muted)", fontSize: 11 };
const TIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "8px",
    color: "var(--text)",
    fontSize: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
  },
  cursor: { fill: "rgba(229, 9, 20, 0.06)" }
};

const GENRES_LIST = [
  "Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary",
  "Drama", "Fantasy", "Film-Noir", "Horror", "Musical", "Mystery", "Romance",
  "Sci-Fi", "Thriller", "War", "Western"
];

export default function OLAPAnalytics() {
  const [activeTab, setActiveTab] = useState("rollup");
  const [warehouse, setWarehouse] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Rollup State
  const [rollupLevel, setRollupLevel] = useState("year");
  const [rollupData, setRollupData] = useState(null);

  // 2. Drilldown State
  const [drillYear, setDrillYear] = useState(null);
  const [drillQuarter, setDrillQuarter] = useState(null);
  const [drillMonth, setDrillMonth] = useState(null);
  const [drillData, setDrillData] = useState(null);

  // 3. Slice State
  const [sliceDim, setSliceDim] = useState("genre");
  const [sliceVal, setSliceVal] = useState("Action");
  const [sliceData, setSliceData] = useState(null);

  // 4. Dice State
  const [diceGenre, setDiceGenre] = useState("Action");
  const [diceYearMin, setDiceYearMin] = useState(2015);
  const [diceYearMax, setDiceYearMax] = useState(2024);
  const [diceRatingMin, setDiceRatingMin] = useState(3.5);
  const [diceData, setDiceData] = useState(null);

  // 5. Pivot State
  const [pivotMeasure, setPivotMeasure] = useState("avg_rating");
  const [pivotData, setPivotData] = useState(null);

  // 6. Apriori State
  const [aprioriMinLift, setAprioriMinLift] = useState(3.5);
  const [aprioriMinConf, setAprioriMinConf] = useState(0.3);
  const [aprioriMinSupp, setAprioriMinSupp] = useState(0.003);
  const [aprioriSortBy, setAprioriSortBy] = useState("lift");
  const [aprioriSearch, setAprioriSearch] = useState("");
  const [aprioriPage, setAprioriPage] = useState(1);
  const [aprioriData, setAprioriData] = useState(null);
  const [aprioriSelectedMovie, setAprioriSelectedMovie] = useState(null);
  const [aprioriMovieRules, setAprioriMovieRules] = useState([]);
  const [aprioriMovieLoading, setAprioriMovieLoading] = useState(false);
  const [popularMoviesList, setPopularMoviesList] = useState([]);

  // Initial Load
  useEffect(() => {
    fetchWarehouseSummary().then(setWarehouse).catch(console.error);
    loadRollup("year");
    loadDrilldown(null, null, null);
    loadSlice("genre", "Action");
    loadDice("Action", 2015, 2024, 3.5);
    loadPivot("avg_rating");
    loadApriori(0.3, 3.5, 0.003, "lift", "", 1);
    fetchPopularMovies(15).then(setPopularMoviesList).catch(console.error);
    setLoading(false);
  }, []);

  const handleRebuildETL = async () => {
    setRebuilding(true);
    try {
      await rebuildWarehouseETL();
      const w = await fetchWarehouseSummary();
      setWarehouse(w);
      loadRollup(rollupLevel);
    } catch (err) {
      console.error("ETL Rebuild failed:", err);
    } finally {
      setRebuilding(false);
    }
  };

  const loadRollup = (level) => {
    setRollupLevel(level);
    fetchOLAPRollup(level).then(setRollupData).catch(console.error);
  };

  const loadDrilldown = (year, quarter, month) => {
    setDrillYear(year);
    setDrillQuarter(quarter);
    setDrillMonth(month);
    fetchOLAPDrilldown(year, quarter, month).then(setDrillData).catch(console.error);
  };

  const loadSlice = (dim, val) => {
    setSliceDim(dim);
    setSliceVal(val);
    fetchOLAPSlice(dim, val).then(setSliceData).catch(console.error);
  };

  const loadDice = (genre, yMin, yMax, rMin) => {
    fetchOLAPDice(genre, yMin, yMax, rMin).then(setDiceData).catch(console.error);
  };

  const loadPivot = (measure) => {
    setPivotMeasure(measure);
    fetchOLAPPivot("genre", "decade", measure).then(setPivotData).catch(console.error);
  };

  const loadApriori = (conf = aprioriMinConf, lift = aprioriMinLift, supp = aprioriMinSupp, sort = aprioriSortBy, search = aprioriSearch, page = aprioriPage) => {
    fetchAssociationRules(supp, conf, lift, 25, sort, search, page)
      .then(setAprioriData)
      .catch(console.error);
  };

  const resetAprioriFilters = () => {
    setAprioriMinConf(0.3);
    setAprioriMinLift(3.5);
    setAprioriMinSupp(0.003);
    setAprioriSortBy("lift");
    setAprioriSearch("");
    setAprioriPage(1);
    loadApriori(0.3, 3.5, 0.003, "lift", "", 1);
  };

  const handleInspectMovieAssociation = (movieId, movieTitle) => {
    setAprioriMovieLoading(true);
    setAprioriSelectedMovie({ movieId, title: movieTitle });
    fetchMovieAssociationRules(movieId, 12)
      .then((res) => {
        setAprioriMovieRules(res.rules || []);
      })
      .catch(console.error)
      .finally(() => setAprioriMovieLoading(false));
  };

  return (
    <div className="container page">
      {/* Compact OLAP Header */}
      <header className="page__head" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.25rem" }}>
              <span className="badge badge--success" style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.72rem" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }}></span>
                Warehouse Online
              </span>
              <span className="muted" style={{ fontSize: "0.78rem" }}>Physical Star Schema · moviemind_dw.db</span>
            </div>
            <h1 style={{ margin: "0.15rem 0 0.35rem", fontSize: "1.65rem" }}>OLAP Cube & Multidimensional Analytics</h1>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
              Explore the MovieMind multidimensional warehouse. Roll up. Drill down. Slice. Dice. Pivot.
            </p>
          </div>
          <button className="btn btn--secondary" onClick={handleRebuildETL} disabled={rebuilding} style={{ fontSize: "0.82rem" }}>
            <RefreshCw size={14} className={rebuilding ? "spin" : ""} />
            {rebuilding ? "Rebuilding Warehouse..." : "Rebuild Star Schema ETL"}
          </button>
        </div>
      </header>

      {/* Warehouse Summary KPI Strip */}
      {warehouse && warehouse.status === "online" && (
        <div className="kpi-strip" style={{ marginBottom: "1.5rem" }}>
          <div className="kpi-card">
            <span className="kpi-card__label"><Database size={13} /> FACT_RATING</span>
            <div className="kpi-card__value" style={{ color: "var(--brand)" }}>
              {warehouse.tables?.FACT_RATING?.toLocaleString() || "42,769"}
            </div>
            <span className="kpi-card__sub">Rating transactions</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-card__label"><Film size={13} /> DIM_MOVIE</span>
            <div className="kpi-card__value">
              {warehouse.tables?.DIM_MOVIE?.toLocaleString() || "62,423"}
            </div>
            <span className="kpi-card__sub">Distinct movie entities</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-card__label"><Users size={13} /> DIM_USER</span>
            <div className="kpi-card__value">
              {warehouse.tables?.DIM_USER?.toLocaleString() || "522"}
            </div>
            <span className="kpi-card__sub">Active user profiles</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-card__label"><Sparkles size={13} /> DIM_GENRE</span>
            <div className="kpi-card__value">
              {warehouse.tables?.DIM_GENRE?.toLocaleString() || "19"}
            </div>
            <span className="kpi-card__sub">Conformed genres</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-card__label"><Calendar size={13} /> DIM_DATE</span>
            <div className="kpi-card__value">
              {warehouse.tables?.DIM_DATE?.toLocaleString() || "3,439"}
            </div>
            <span className="kpi-card__sub">Date surrogate keys</span>
          </div>
        </div>
      )}

      {/* Structured Navigation separating OLAP Operations from Data Mining */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "1.25rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.75rem" }}>
        
        {/* OLAP Operations Group */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginRight: "4px" }}>
            OLAP Cube:
          </span>
          {[
            { id: "rollup", label: "Roll-Up", icon: Layers },
            { id: "drilldown", label: "Drill-Down", icon: TrendingUp },
            { id: "slice", label: "Slice", icon: Filter },
            { id: "dice", label: "Dice", icon: SlidersHorizontal },
            { id: "pivot", label: "Pivot Matrix", icon: TableIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`chip chip--button ${activeTab === id ? "chip--active" : ""}`}
              onClick={() => setActiveTab(id)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "0.35rem 0.75rem" }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Data Mining Group */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginRight: "4px" }}>
            Data Mining:
          </span>
          <button
            className={`chip chip--button ${activeTab === "apriori" ? "chip--active" : ""}`}
            onClick={() => setActiveTab("apriori")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", padding: "0.35rem 0.75rem" }}
          >
            <Sparkles size={14} /> Apriori (X → Y)
          </button>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. ROLL-UP WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "rollup" && rollupData && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h3 className="panel__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={18} color="var(--brand)" /> Roll-Up: Time Dimension Hierarchy
              </h3>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Hierarchy: <strong>Day → Month → Quarter → Year → Decade</strong> · Active Grain: <span className="badge badge--brand">{rollupData.current_level}</span>
              </div>
            </div>
            <div className="chips" style={{ margin: 0 }}>
              {["day", "month", "quarter", "year", "decade"].map((lvl) => (
                <button
                  key={lvl}
                  className={`chip ${rollupLevel === lvl ? "is-active" : ""}`}
                  onClick={() => loadRollup(lvl)}
                  style={{ fontSize: "0.78rem" }}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Roll-up KPI Strip */}
          <div className="kpi-strip" style={{ marginBottom: "16px" }}>
            <div className="kpi-card">
              <span className="kpi-card__label"><Layers size={13} /> Active Hierarchy Level</span>
              <div className="kpi-card__value" style={{ textTransform: "capitalize", color: "var(--brand)" }}>{rollupData.current_level}</div>
              <span className="kpi-card__sub">{rollupData.hierarchy_path}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><BarChart2 size={13} /> Aggregated Buckets</span>
              <div className="kpi-card__value">{rollupData.data?.length || 0}</div>
              <span className="kpi-card__sub">Distinct {rollupData.current_level} partitions</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Database size={13} /> Total Fact Ratings</span>
              <div className="kpi-card__value">
                {rollupData.data?.reduce((acc, row) => acc + (row.rating_count || 0), 0).toLocaleString()}
              </div>
              <span className="kpi-card__sub">100% warehouse coverage</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Sparkles size={13} /> Mean Aggregated Rating</span>
              <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
                {(rollupData.data?.reduce((acc, row) => acc + (row.average_rating * row.rating_count), 0) / 
                  (rollupData.data?.reduce((acc, row) => acc + row.rating_count, 0) || 1)).toFixed(2)} ★
              </div>
              <span className="kpi-card__sub">Weighted mean across buckets</span>
            </div>
          </div>

          {/* Visualization & Result Table */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "16px", height: "340px" }}>
              <h4 style={{ fontSize: "0.85rem", marginBottom: "8px", color: "var(--text)" }}>Rating Volume & Average Trend by {rollupData.current_level}</h4>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={rollupData.data} margin={{ top: 8, right: 12, left: -4, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="time_bucket" {...AXIS} angle={-30} textAnchor="end" interval={0} tickLine={false} />
                  <YAxis yAxisId="left" {...AXIS} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 5]} {...AXIS} tickLine={false} axisLine={false} />
                  <Tooltip {...TIP} />
                  <Bar yAxisId="left" dataKey="rating_count" name="Ratings Count" fill="#e50914" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="average_rating" name="Average Rating (★)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-wrapper" style={{ maxHeight: "340px", overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time Bucket ({rollupData.current_level})</th>
                    <th>Total Ratings</th>
                    <th>Average Rating</th>
                    <th>Unique Movies</th>
                    <th>Active Users</th>
                  </tr>
                </thead>
                <tbody>
                  {rollupData.data.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.time_bucket}</strong></td>
                      <td>{row.rating_count.toLocaleString()}</td>
                      <td><span className="badge badge--star">{row.average_rating} ★</span></td>
                      <td>{row.unique_movies.toLocaleString()}</td>
                      <td>{row.active_users.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytical Insight */}
          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Analytical Takeaway</div>
            <p className="insight-box__text">
              Rolling up along the <code>DIM_DATE</code> hierarchy from <em>Day</em> to <em>{rollupData.current_level}</em> consolidates 42,769 granular fact transactions into {rollupData.data?.length} macro summary buckets. This aggregation allows macroscopic trend inspection without full-table linear scans.
            </p>
          </div>

          {/* Query Context */}
          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Dimension:</strong> Time (DIM_DATE)</span>
            <span><strong>Active Level:</strong> {rollupLevel.toUpperCase()}</span>
            <span><strong>Measure:</strong> COUNT(rating_key), AVG(rating)</span>
            <span><strong>Source:</strong> FACT_RATING ⋈ DIM_DATE</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. DRILL-DOWN WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "drilldown" && drillData && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 className="panel__title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={18} color="var(--brand)" /> Drill-Down: Hierarchical Deep-Dive
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: "0.82rem" }}>Breadcrumb:</span>
              <button className="chip is-active" onClick={() => loadDrilldown(null, null, null)} style={{ fontSize: "0.78rem" }}>
                All Years
              </button>
              {drillYear && (
                <>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <button className="chip is-active" onClick={() => loadDrilldown(drillYear, null, null)} style={{ fontSize: "0.78rem" }}>
                    Year {drillYear}
                  </button>
                </>
              )}
              {drillQuarter && (
                <>
                  <ChevronRight size={14} color="var(--text-muted)" />
                  <button className="chip is-active" onClick={() => loadDrilldown(drillYear, drillQuarter, null)} style={{ fontSize: "0.78rem" }}>
                    Q{drillQuarter}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Drilldown KPI Strip */}
          <div className="kpi-strip" style={{ marginBottom: "16px" }}>
            <div className="kpi-card">
              <span className="kpi-card__label"><TrendingUp size={13} /> Current Hierarchy Level</span>
              <div className="kpi-card__value" style={{ color: "var(--brand)" }}>{drillData.current_level}</div>
              <span className="kpi-card__sub">{drillData.data?.length || 0} sub-period partitions</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Database size={13} /> Level Total Ratings</span>
              <div className="kpi-card__value">
                {drillData.data?.reduce((acc, row) => acc + (row.rating_count || 0), 0).toLocaleString()}
              </div>
              <span className="kpi-card__sub">Across all visible segments</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Sparkles size={13} /> Sub-Level Mean Rating</span>
              <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
                {(drillData.data?.reduce((acc, row) => acc + (row.average_rating * row.rating_count), 0) /
                  (drillData.data?.reduce((acc, row) => acc + row.rating_count, 0) || 1)).toFixed(2)} ★
              </div>
              <span className="kpi-card__sub">Period-weighted average</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Layers size={13} /> Next Drill Target</span>
              <div className="kpi-card__value" style={{ fontSize: "1.05rem" }}>
                {drillData.next_drilldown_level ? drillData.next_drilldown_level : "Leaf Level (Day)"}
              </div>
              <span className="kpi-card__sub">Click partition card to drill</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "16px", height: "320px" }}>
              <h4 style={{ fontSize: "0.85rem", marginBottom: "8px", color: "var(--text)" }}>Rating Distribution across {drillData.current_level}</h4>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={drillData.data} margin={{ top: 8, right: 12, left: -4, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} tickLine={false} />
                  <YAxis {...AXIS} tickLine={false} axisLine={false} />
                  <Tooltip {...TIP} />
                  <Bar dataKey="rating_count" name="Ratings Count" radius={[4, 4, 0, 0]}>
                    {drillData.data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <h4 style={{ fontSize: "0.85rem", margin: "0 0 4px", color: "var(--text)" }}>Click a partition to Drill-Down deeper into the hierarchy:</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
                {drillData.data.map((item, idx) => (
                  <button
                    key={idx}
                    className="card"
                    style={{ textAlign: "left", cursor: drillData.next_drilldown_level ? "pointer" : "default", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)" }}
                    onClick={() => {
                      if (drillData.next_drilldown_level === "Quarter") {
                        loadDrilldown(item.sub_key, null, null);
                      } else if (drillData.next_drilldown_level === "Month") {
                        loadDrilldown(drillYear, item.sub_key, null);
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.88rem" }}>{item.label}</strong>
                      {drillData.next_drilldown_level && <ArrowRight size={13} color="var(--brand)" />}
                    </div>
                    <div className="muted" style={{ fontSize: "0.78rem", marginTop: "2px" }}>
                      {item.rating_count.toLocaleString()} ratings • {item.average_rating} ★
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Analytical Takeaway</div>
            <p className="insight-box__text">
              Drilling down exposes the granular breakdown of ratings across seasonal quarters and months. This reveals seasonality patterns in rating submissions that are otherwise concealed when viewing aggregated annual statistics.
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Breadcrumb Target:</strong> {drillData.breadcrumb}</span>
            <span><strong>Next Level:</strong> {drillData.next_drilldown_level || "Leaf Node"}</span>
            <span><strong>Source:</strong> FACT_RATING ⋈ DIM_DATE</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. SLICE WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "slice" && sliceData && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h3 className="panel__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Filter size={18} color="var(--brand)" /> Slice: Single Dimension Sub-Cube
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>
                Holds 1 dimension constant (<code>Genre = '{sliceVal}'</code>) to extract the cross-sectional sub-cube.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select
                className="input"
                style={{ width: "160px", padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                value={sliceVal}
                onChange={(e) => loadSlice("genre", e.target.value)}
              >
                {GENRES_LIST.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slice KPI Strip */}
          <div className="kpi-strip" style={{ marginBottom: "16px" }}>
            <div className="kpi-card">
              <span className="kpi-card__label"><Database size={13} /> Total Ratings in Slice</span>
              <div className="kpi-card__value">{sliceData.slice_summary?.total_ratings?.toLocaleString()}</div>
              <span className="kpi-card__sub">{((sliceData.slice_summary?.total_ratings / 42769) * 100).toFixed(1)}% of warehouse ratings</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Sparkles size={13} /> Slice Mean Rating</span>
              <div className="kpi-card__value" style={{ color: "#f59e0b" }}>{sliceData.slice_summary?.overall_avg_rating} ★</div>
              <span className="kpi-card__sub">Across all {sliceVal} titles</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Film size={13} /> Distinct Movies</span>
              <div className="kpi-card__value">{sliceData.slice_summary?.unique_movies?.toLocaleString()}</div>
              <span className="kpi-card__sub">Categorized under {sliceVal}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Users size={13} /> Active Users</span>
              <div className="kpi-card__value">{sliceData.slice_summary?.unique_users?.toLocaleString()}</div>
              <span className="kpi-card__sub">Rated ≥ 1 {sliceVal} movie</span>
            </div>
          </div>

          <h4 style={{ fontSize: "0.88rem", marginBottom: "8px" }}>Most Rated Movies in Slice (Genre = {sliceVal}, Sorted by Rating Volume)</h4>
          <div className="table-wrapper" style={{ marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Movie Title</th>
                  <th>Movie Release Year</th>
                  <th>Rating Volume (Count)</th>
                  <th>Average Rating</th>
                </tr>
              </thead>
              <tbody>
                {sliceData.top_movies?.map((m, idx) => (
                  <tr key={idx}>
                    <td><strong>{m.title}</strong></td>
                    <td>{m.secondary}</td>
                    <td>{m.rating_count.toLocaleString()}</td>
                    <td><span className="badge badge--star">{m.avg_rating} ★</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Analytical Takeaway</div>
            <p className="insight-box__text">
              Holding <code>DIM_GENRE.genre_name = '{sliceVal}'</code> constant isolates {sliceData.slice_summary?.unique_movies?.toLocaleString()} movies. This dimensional slice allows domain experts to benchmark genre-specific audience satisfaction against the global catalog average (3.54★).
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Dimension:</strong> DIM_GENRE.genre_name = '{sliceVal}'</span>
            <span><strong>Sort Grain:</strong> Rating Count DESC, Avg Rating DESC</span>
            <span><strong>Source:</strong> FACT_RATING ⋈ DIM_MOVIE ⋈ DIM_GENRE</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. DICE WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "dice" && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 className="panel__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <SlidersHorizontal size={18} color="var(--brand)" /> Dice: Multi-Dimensional Bounded Sub-Cube
            </h3>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>
              Applies bounding constraints across multiple dimensions simultaneously: Genre, Rating Year (when rated), and Star threshold.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "14px 16px", background: "var(--surface)", borderRadius: "var(--radius-md)", marginBottom: "16px", border: "1px solid var(--line)" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--text)" }}>Genre (DIM_GENRE)</label>
              <select
                className="input"
                value={diceGenre}
                onChange={(e) => {
                  setDiceGenre(e.target.value);
                  loadDice(e.target.value, diceYearMin, diceYearMax, diceRatingMin);
                }}
                style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
              >
                <option value="All">All Genres</option>
                {GENRES_LIST.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--text)" }}>
                Rating Year (DIM_DATE): {diceYearMin} – {diceYearMax}
              </label>
              <input
                type="range"
                min="1990"
                max="2024"
                value={diceYearMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDiceYearMin(val);
                  loadDice(diceGenre, val, diceYearMax, diceRatingMin);
                }}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--text)" }}>
                Min Rating (FACT_RATING): {diceRatingMin}★
              </label>
              <input
                type="range"
                min="1.0"
                max="4.5"
                step="0.5"
                value={diceRatingMin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDiceRatingMin(val);
                  loadDice(diceGenre, diceYearMin, diceYearMax, val);
                }}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Dice KPI Strip */}
          <div className="kpi-strip" style={{ marginBottom: "16px" }}>
            <div className="kpi-card">
              <span className="kpi-card__label"><SlidersHorizontal size={13} /> Active Dice Constraints</span>
              <div className="kpi-card__value" style={{ fontSize: "1.1rem", color: "var(--brand)" }}>3 Dimensions</div>
              <span className="kpi-card__sub">Genre + Rating Year + Min Rating</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Database size={13} /> Qualifying Records</span>
              <div className="kpi-card__value">{diceData?.dice_results?.length || 0} Sub-cells</div>
              <span className="kpi-card__sub">Matching compound criteria</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card__label"><Sparkles size={13} /> Diced Sub-Cube Volume</span>
              <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
                {diceData?.dice_results?.reduce((acc, r) => acc + r.rating_count, 0).toLocaleString() || 0}
              </div>
              <span className="kpi-card__sub">Total rating transactions in sub-cube</span>
            </div>
          </div>

          <h4 style={{ fontSize: "0.88rem", marginBottom: "8px" }}>Diced Multidimensional Results</h4>
          <div className="table-wrapper" style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Movie Title</th>
                  <th>Movie Release Year</th>
                  <th>Genres</th>
                  <th>Rating Year</th>
                  <th>Rating Count</th>
                  <th>Average Rating</th>
                </tr>
              </thead>
              <tbody>
                {diceData?.dice_results?.map((r, idx) => (
                  <tr key={idx}>
                    <td><strong>{r.title}</strong></td>
                    <td>{r.release_year}</td>
                    <td><span className="muted" style={{ fontSize: "0.8rem" }}>{r.genres}</span></td>
                    <td><span className="badge">{r.rating_year}</span></td>
                    <td>{r.rating_count.toLocaleString()}</td>
                    <td><span className="badge badge--star">{r.avg_rating} ★</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Analytical Takeaway</div>
            <p className="insight-box__text">
              Dicing isolates a bounded hyper-rectangle inside the OLAP cube: <code>Genre = {diceGenre}</code>, <code>Rating Year ∈ [{diceYearMin}, {diceYearMax}]</code>, and <code>Rating ≥ {diceRatingMin}★</code>. This reveals how modern audiences evaluated specific historical catalog titles over recent review periods.
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Constraint 1:</strong> DIM_GENRE.genre_name = '{diceGenre}'</span>
            <span><strong>Constraint 2:</strong> DIM_DATE.year BETWEEN {diceYearMin} AND {diceYearMax}</span>
            <span><strong>Constraint 3:</strong> FACT_RATING.rating ≥ {diceRatingMin}</span>
            <span><strong>Source:</strong> FACT_RATING ⋈ DIM_MOVIE ⋈ DIM_DATE</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. PIVOT WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "pivot" && pivotData && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h3 className="panel__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <TableIcon size={18} color="var(--brand)" /> Pivot: 2D Cross-Tabulation Matrix
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>
                Rotates axes: <strong>Genre (Rows)</strong> × <strong>Rating Decade (Columns)</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className={`chip ${pivotMeasure === "avg_rating" ? "is-active" : ""}`}
                onClick={() => loadPivot("avg_rating")}
                style={{ fontSize: "0.78rem" }}
              >
                Measure: Average Rating (★)
              </button>
              <button
                className={`chip ${pivotMeasure === "rating_count" ? "is-active" : ""}`}
                onClick={() => loadPivot("rating_count")}
                style={{ fontSize: "0.78rem" }}
              >
                Measure: Rating Volume
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ marginBottom: "16px", overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "120px" }}>Genre \ Decade</th>
                  {pivotData.columns?.map((col) => (
                    <th key={col} style={{ textAlign: "right" }}>{col}s</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotData.matrix?.map((row, idx) => (
                  <tr key={idx}>
                    <td><strong>{row.genre}</strong></td>
                    {pivotData.columns?.map((col) => {
                      const val = row[col];
                      const isHigh = pivotMeasure === "avg_rating" ? val >= 3.6 : val >= 1000;
                      return (
                        <td
                          key={col}
                          style={{
                            textAlign: "right",
                            fontWeight: isHigh ? "700" : "400",
                            background: isHigh ? "rgba(229, 9, 20, 0.05)" : "transparent",
                            color: isHigh ? "var(--brand)" : "inherit"
                          }}
                        >
                          {val ? (pivotMeasure === "avg_rating" ? `${val.toFixed(2)} ★` : val.toLocaleString()) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Analytical Takeaway</div>
            <p className="insight-box__text">
              Pivoting rotates two independent dimension axes into a 2D cross-tabulation grid. This highlights historical genre performance across cinematic eras, showing how user satisfaction for genres like <em>Sci-Fi</em> and <em>Drama</em> shifted across different rating decades.
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Row Dimension:</strong> DIM_GENRE.genre_name</span>
            <span><strong>Column Dimension:</strong> DIM_DATE.decade</span>
            <span><strong>Measure:</strong> {pivotMeasure === "avg_rating" ? "AVG(f.rating)" : "COUNT(f.rating_key)"}</span>
            <span><strong>Source:</strong> FACT_RATING ⋈ DIM_GENRE ⋈ DIM_DATE</span>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. APRIORI DATA MINING WORKSPACE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "apriori" && (
        <section className="card panel" style={{ padding: "1.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)", background: "rgba(229, 9, 20, 0.08)", padding: "2px 8px", borderRadius: "100px", marginBottom: "0.3rem" }}>
                <Sparkles size={12} />
                Unsupervised Data Mining Engine
              </div>
              <h3 className="panel__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "1.35rem" }}>
                Apriori Association Rule Mining (X → Y)
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.84rem" }}>
                Market basket co-occurrence analysis discovering frequent movie pairs from positive viewer transaction baskets (ratings ≥ 4.0★).
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="btn btn--secondary"
                onClick={resetAprioriFilters}
                style={{ fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <RotateCcw size={13} /> Reset Filters
              </button>
              <Link to="/recommendations" className="btn btn--primary" style={{ fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Brain size={14} /> Recommender Integration <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Telemetry Strip: Baskets & Mining Provenance */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "0.8rem", color: "#475569", flexWrap: "wrap", marginBottom: "16px" }}>
            <span><strong>Positive Baskets:</strong> {aprioriData?.stats?.total_baskets || 511} users (from {aprioriData?.stats?.total_users || 522} total)</span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span><strong>Basket Criterion:</strong> Rating ≥ 4.0★</span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span><strong>Avg Basket Size:</strong> {aprioriData?.stats?.avg_basket_size || 42.8} movies</span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span><strong>Median Size:</strong> {aprioriData?.stats?.median_basket_size || 28.0}</span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span><strong>Min Support:</strong> 0.5% (≥ 2 co-occurrences)</span>
          </div>

          {/* Interactive Slicing & Filter Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", padding: "14px 16px", background: "var(--surface)", borderRadius: "var(--radius-md)", marginBottom: "16px", border: "1px solid var(--line)" }}>
            {/* Confidence Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text)" }}>
                  Minimum Confidence:
                </label>
                <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--brand)" }}>
                  {(aprioriMinConf * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={aprioriMinConf}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAprioriMinConf(val);
                  setAprioriPage(1);
                  loadApriori(val, aprioriMinLift, aprioriMinSupp, aprioriSortBy, aprioriSearch, 1);
                }}
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>$P(Y|X)$ Conditional Probability</span>
            </div>

            {/* Lift Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--text)" }}>
                  Minimum Lift:
                </label>
                <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#10b981" }}>
                  {aprioriMinLift.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="50.0"
                step="0.5"
                value={aprioriMinLift}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAprioriMinLift(val);
                  setAprioriPage(1);
                  loadApriori(aprioriMinConf, val, aprioriMinSupp, aprioriSortBy, aprioriSearch, 1);
                }}
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Multiplier over random chance</span>
            </div>

            {/* Sort Order Selector */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--text)" }}>
                Sort Mined Rules By:
              </label>
              <select
                value={aprioriSortBy}
                onChange={(e) => {
                  const val = e.target.value;
                  setAprioriSortBy(val);
                  setAprioriPage(1);
                  loadApriori(aprioriMinConf, aprioriMinLift, aprioriMinSupp, val, aprioriSearch, 1);
                }}
                style={{ width: "100%", padding: "5px 8px", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)" }}
              >
                <option value="lift">Highest Lift Multiplier (Strongest)</option>
                <option value="combined">Combined Quality Score (Lift × Conf × √Supp)</option>
                <option value="confidence">Highest Confidence (%)</option>
                <option value="support">Highest Support (Frequent Basket)</option>
              </select>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Prioritize precision vs popularity</span>
            </div>

            {/* Movie Title Filter */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--text)" }}>
                Filter by Movie Title:
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={13} style={{ position: "absolute", left: "8px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="e.g. Star Wars, Matrix..."
                  value={aprioriSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAprioriSearch(val);
                    setAprioriPage(1);
                    loadApriori(aprioriMinConf, aprioriMinLift, aprioriMinSupp, aprioriSortBy, val, 1);
                  }}
                  style={{ width: "100%", padding: "5px 8px 5px 26px", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid var(--line)" }}
                />
              </div>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Search antecedent or consequent</span>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="kpi-strip" style={{ marginBottom: "16px" }}>
            <div className="kpi-card" style={{ borderTop: "3px solid var(--brand)" }}>
              <span className="kpi-card__label"><Sparkles size={13} /> Total Mined Rules</span>
              <div className="kpi-card__value" style={{ color: "var(--brand)" }}>
                {(aprioriData?.total_mined_rules || 9666).toLocaleString()} Rules
              </div>
              <span className="kpi-card__sub">Stored in offline analytical index</span>
            </div>

            <div className="kpi-card" style={{ borderTop: "3px solid #0E7C86" }}>
              <span className="kpi-card__label"><Filter size={13} /> Filtered Matching Rules</span>
              <div className="kpi-card__value">
                {(aprioriData?.total_rules ?? 0).toLocaleString()} Rules
              </div>
              <span className="kpi-card__sub">
                {aprioriData?.total_rules && aprioriData?.total_mined_rules
                  ? `${((aprioriData.total_rules / aprioriData.total_mined_rules) * 100).toFixed(1)}% of total corpus`
                  : `Confidence ≥ ${(aprioriMinConf * 100).toFixed(0)}% · Lift ≥ ${aprioriMinLift.toFixed(1)}×`}
              </span>
            </div>

            <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
              <span className="kpi-card__label"><TrendingUp size={13} /> Max Lift in View</span>
              <div className="kpi-card__value" style={{ color: "#10b981" }}>
                {aprioriData?.rules?.length ? `${Math.max(...aprioriData.rules.map(r => r.lift)).toFixed(1)}×` : `${(aprioriData?.stats?.lift_summary?.max || 255.5).toFixed(1)}×`}
              </div>
              <span className="kpi-card__sub">Empirical co-occurrence multiplier</span>
            </div>

            <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
              <span className="kpi-card__label"><Award size={13} /> Max Confidence</span>
              <div className="kpi-card__value" style={{ color: "#f59e0b" }}>
                {aprioriData?.rules?.length ? `${(Math.max(...aprioriData.rules.map(r => r.confidence)) * 100).toFixed(0)}%` : "100%"}
              </div>
              <span className="kpi-card__sub">Highest conditional probability</span>
            </div>
          </div>

          {/* Main Content Area: Rules Table OR Helpful Empty State */}
          {aprioriData && aprioriData.rules?.length > 0 ? (
            <div style={{ marginBottom: "16px" }}>
              <div className="table-wrapper" style={{ marginBottom: "10px" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45px" }}>Rank</th>
                      <th>Antecedent Movie (IF Liked X)</th>
                      <th>Consequent Movie (THEN Also Liked Y)</th>
                      <th style={{ textAlign: "right" }}>Support</th>
                      <th style={{ textAlign: "right" }}>Confidence</th>
                      <th style={{ textAlign: "right" }}>Lift Ratio</th>
                      <th>Co-occurrence Assessment</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprioriData.rules.map((r, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "700", color: "var(--text-muted)" }}>
                          #{(aprioriPage - 1) * 25 + idx + 1}
                        </td>
                        <td>
                          <strong>{r.antecedent_title}</strong>
                        </td>
                        <td>
                          <strong style={{ color: "var(--brand)" }}>{r.consequent_title}</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div>{(r.support * 100).toFixed(2)}%</div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {r.supporting_baskets || 2}/{r.total_baskets || 511} baskets
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "600" }}>
                          {(r.confidence * 100).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="badge badge--brand" style={{ fontWeight: "700" }}>
                            {r.lift.toFixed(1)}×
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                            {r.quality_band || "Positive Association"}
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {r.rule_text}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleInspectMovieAssociation(r.antecedent_id, r.antecedent_title)}
                            className="btn btn--secondary"
                            style={{ padding: "3px 8px", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                            title="Inspect all association rules for this movie"
                          >
                            <Eye size={11} /> Explore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>
                  Showing {aprioriData.rules.length} of {aprioriData.total_rules?.toLocaleString() || 0} matching rules
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    disabled={aprioriPage <= 1}
                    onClick={() => {
                      const p = aprioriPage - 1;
                      setAprioriPage(p);
                      loadApriori(aprioriMinConf, aprioriMinLift, aprioriMinSupp, aprioriSortBy, aprioriSearch, p);
                    }}
                    className="btn btn--secondary"
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: "4px 8px", fontWeight: "600" }}>Page {aprioriPage}</span>
                  <button
                    disabled={aprioriData.rules.length < 25}
                    onClick={() => {
                      const p = aprioriPage + 1;
                      setAprioriPage(p);
                      loadApriori(aprioriMinConf, aprioriMinLift, aprioriMinSupp, aprioriSortBy, aprioriSearch, p);
                    }}
                    className="btn btn--secondary"
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Enhanced Informative Empty State with Corpus Exploration */
            <div className="card" style={{ padding: "2rem 1.5rem", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
              <div style={{ textAlign: "center", maxWidth: "580px", margin: "0 auto 1.5rem" }}>
                <Info size={32} color="var(--brand)" style={{ margin: "0 auto 10px" }} />
                <h3 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>No Rules Match Current Thresholds</h3>
                <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", margin: "0 0 14px" }}>
                  0 of 9,666 mined rules satisfy <strong>Confidence ≥ {(aprioriMinConf * 100).toFixed(0)}%</strong> and <strong>Lift ≥ {aprioriMinLift.toFixed(1)}×</strong> simultaneously.
                </p>

                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn btn--secondary"
                    onClick={() => {
                      setAprioriMinConf(0.25);
                      loadApriori(0.25, aprioriMinLift, aprioriMinSupp, aprioriSortBy, aprioriSearch, 1);
                    }}
                    style={{ fontSize: "0.78rem" }}
                  >
                    Relax Confidence to 25%
                  </button>
                  <button
                    className="btn btn--secondary"
                    onClick={() => {
                      setAprioriMinLift(3.5);
                      loadApriori(aprioriMinConf, 3.5, aprioriMinSupp, aprioriSortBy, aprioriSearch, 1);
                    }}
                    style={{ fontSize: "0.78rem" }}
                  >
                    Relax Lift to 3.5×
                  </button>
                  <button className="btn btn--primary" onClick={resetAprioriFilters} style={{ fontSize: "0.78rem" }}>
                    <RotateCcw size={13} /> Reset to Recommended Defaults
                  </button>
                </div>
              </div>

              {/* Top Available Rules Fallback Table */}
              {aprioriData?.top_available && aprioriData.top_available.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "0.88rem", fontWeight: "700" }}>
                    Top Available Mined Associations in Dataset:
                  </h4>
                  <table className="data-table" style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr>
                        <th>Antecedent Movie (X)</th>
                        <th>Consequent Movie (Y)</th>
                        <th>Support</th>
                        <th>Confidence</th>
                        <th>Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aprioriData.top_available.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td><strong>{r.antecedent_title}</strong></td>
                          <td><strong>{r.consequent_title}</strong></td>
                          <td>{(r.support * 100).toFixed(2)}%</td>
                          <td>{(r.confidence * 100).toFixed(1)}%</td>
                          <td><span className="badge badge--brand">{r.lift.toFixed(1)}×</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VISUALIZATION SECTION: CONFIDENCE VS LIFT SCATTER + DISTRIBUTION HISTOGRAMS */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px", marginBottom: "16px" }}>
            {/* Confidence vs Lift Scatter Plot */}
            <div className="card" style={{ padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                    <TrendingUp size={15} color="var(--brand)" /> Confidence vs. Lift Pareto Frontier
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    Scatter distribution of itemset rules. High lift + high confidence upper-right points represent high-precision recommendations.
                  </p>
                </div>
              </div>

              <div style={{ height: "210px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 15, bottom: 15, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" dataKey="confidence" name="Confidence" unit="%" domain={[20, 100]} {...AXIS} tickLine={false} />
                    <YAxis type="number" dataKey="lift" name="Lift" domain={[0, "auto"]} {...AXIS} tickLine={false} tickFormatter={(v) => `${v}×`} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "var(--surface)", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: "0.78rem", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                            <div style={{ fontWeight: "700", color: "var(--text)" }}>{d.antecedent} → {d.consequent}</div>
                            <div>Lift: <strong>{d.lift}×</strong></div>
                            <div>Confidence: <strong>{d.confidence}%</strong></div>
                            <div>Support: <strong>{d.support}%</strong></div>
                          </div>
                        );
                      }}
                    />
                    <Scatter name="Rules" data={aprioriData?.scatter_sample || []} fill="var(--brand)" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lift & Confidence Distribution Histograms */}
            <div className="card" style={{ padding: "14px" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                <BarChart3 size={15} color="#0E7C86" /> Lift Multiplier Distribution
              </h4>
              <p style={{ margin: "0 0 10px", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Frequency of mined association rules across lift multiplier buckets.
              </p>

              <div style={{ height: "185px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aprioriData?.histograms?.lift || []} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="range" {...AXIS} tickLine={false} />
                    <YAxis {...AXIS} tickLine={false} axisLine={false} />
                    <Tooltip {...TIP} formatter={(v) => [`${v.toLocaleString()} rules`, "Frequency"]} />
                    <Bar dataKey="count" fill="#0E7C86" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MOVIE ASSOCIATION EXPLORER */}
          <div className="card" style={{ padding: "16px", marginBottom: "16px", background: "linear-gradient(135deg, rgba(79,70,229,0.03) 0%, rgba(14,124,134,0.03) 100%)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Brain size={16} color="var(--brand)" /> Interactive Movie Association Inspector
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Select any catalogue title to inspect all co-liked movie basket associations mined for recommendations.
                </p>
              </div>

              {/* Quick movie select */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: "600" }}>Popular Suggestions:</label>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {popularMoviesList.slice(0, 4).map((pm) => (
                    <button
                      key={pm.movieId}
                      onClick={() => handleInspectMovieAssociation(pm.movieId, pm.title)}
                      className="btn btn--secondary"
                      style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                    >
                      {pm.title.replace(/\s*\(\d{4}\)\s*$/, "").slice(0, 15)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Movie Associations Display */}
            {aprioriSelectedMovie && (
              <div>
                <div style={{ padding: "8px 12px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--line)", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Inspecting Target Title:</span>
                    <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text)" }}>{aprioriSelectedMovie.title}</div>
                  </div>
                  <Link
                    to={`/recommendations?movie_id=${aprioriSelectedMovie.movieId}`}
                    className="btn btn--primary"
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    Generate Hybrid Recommendations <ArrowRight size={12} />
                  </Link>
                </div>

                {aprioriMovieLoading ? (
                  <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading co-occurrence associations...</div>
                ) : aprioriMovieRules.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                    {aprioriMovieRules.slice(0, 6).map((mr, mi) => (
                      <div key={mi} style={{ padding: "10px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.78rem" }}>
                        <div style={{ fontWeight: "700", color: "var(--brand)", marginBottom: "4px" }}>
                          {mr.consequent_id === aprioriSelectedMovie.movieId ? mr.antecedent_title : mr.consequent_title}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                          <span>Lift Multiplier: <strong style={{ color: "#10b981" }}>{mr.lift.toFixed(1)}×</strong></span>
                          <span>Confidence: <strong>{(mr.confidence * 100).toFixed(0)}%</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    No direct pairwise rules exceeded the $0.5\%$ support threshold for this specific title.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Academic Viva Context & Data Mining Insights */}
          <div className="insight-box" style={{ marginBottom: "12px" }}>
            <div className="insight-box__title"><Sparkles size={14} /> Data Mining & Association Rule Mathematics</div>
            <p className="insight-box__text">
              Apriori operates via the <strong>Downward-Closure Property</strong>: any subset of a frequent itemset must also be frequent. For two items X and Y, Support P(X ∩ Y) = count(X ∪ Y) / N, Confidence P(Y | X) = Support(X ∪ Y) / Support(X), and Lift = Confidence(X → Y) / Support(Y). A Lift ratio &gt;&gt; 1.0 proves true positive co-preference, providing high-precision serendipitous recommendation signals.
            </p>
          </div>

          <div style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span><strong>Algorithm:</strong> Apriori Frequent Itemset Generation</span>
            <span><strong>Basket Definition:</strong> User ratings ≥ 4.0★ (511 baskets)</span>
            <span><strong>Total Rules:</strong> 9,666 cached rules</span>
            <span><strong>Execution Engine:</strong> Offline Transaction Basket Mining</span>
          </div>
        </section>
      )}
    </div>
  );
}

