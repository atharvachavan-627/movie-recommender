import { useEffect, useState } from "react";
import { Film, Users, Star, Database, BarChart2, TrendingUp, Trophy } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid, Cell } from "recharts";
import { fetchAnalyticsOverview, fetchPopularMovies, fetchGenreAnalytics, fetchRatingAnalytics } from "../services/api";

const COLORS = ["#4F46E5", "#0E7C86", "#6D4AFF", "#E5383B", "#F59E0B", "#0EA5E9", "#10B981", "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#64748B"];
const AXIS = { stroke: "#7B8099", fontSize: 12 };
const TIP = { contentStyle: { background: "#fff", border: "1px solid #E4E6F0", borderRadius: 10, boxShadow: "0 8px 24px -8px rgba(18,20,43,.18)", fontSize: 13 }, cursor: { fill: "rgba(79,70,229,.06)" } };

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="card stat">
      <span className={`stat__icon bg-${tone}`}><Icon size={22} /></span>
      <div><div className="stat__label">{label}</div><div className="stat__value">{value}</div></div>
    </div>
  );
}

function Panel({ icon: Icon, title, children }) {
  return (
    <section className="card panel">
      <h3 className="panel__title"><Icon size={18} /> {title}</h3>
      {children}
    </section>
  );
}

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [popular, setPopular] = useState([]);
  const [genres, setGenres] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([fetchAnalyticsOverview(), fetchPopularMovies(10), fetchGenreAnalytics(), fetchRatingAnalytics()])
      .then(([o, p, g, r]) => { setOverview(o); setPopular(p); setGenres(g); setRatings(r); })
      .catch((e) => { console.error("Failed to load analytics:", e); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  const v = (x, f) => (x === undefined || x === null ? "-" : f(x));

  return (
    <div className="container page">
      <header className="page__head">
        <h1>Analytics</h1>
        <p>Exploratory analysis of the MovieLens 25M dataset: aggregation, distribution and popularity.</p>
      </header>

      {error && <div className="empty empty--box"><h3>Analytics are unavailable</h3><p>Could not reach the backend. Start the FastAPI server and refresh.</p></div>}

      <div className="stats-grid">
        <Stat icon={Film} tone="hybrid" label="Total movies" value={loading ? "..." : v(overview?.total_movies, (x) => x.toLocaleString())} />
        <Stat icon={Users} tone="collab" label="Total users" value={loading ? "..." : v(overview?.total_users, (x) => x.toLocaleString())} />
        <Stat icon={Database} tone="content" label="Total ratings" value={loading ? "..." : v(overview?.total_ratings, (x) => `${(x / 1e6).toFixed(1)} million`)} />
        <Stat icon={Star} tone="star" label="Global average" value={loading ? "..." : v(overview?.avg_rating, (x) => `${Number(x).toFixed(2)} / 5`)} />
      </div>

      {!error && (
        <>
          <div className="grid-2">
            <Panel icon={BarChart2} title="Movies per genre">
              {loading ? <div className="skeleton skeleton--chart" /> : (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={genres.slice(0, 12)} margin={{ top: 8, right: 8, left: -8, bottom: 28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" vertical={false} />
                      <XAxis dataKey="genre" {...AXIS} angle={-35} textAnchor="end" interval={0} tickLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} />
                      <Tooltip {...TIP} />
                      <Bar dataKey="movie_count" name="Movies" radius={[6, 6, 0, 0]}>
                        {genres.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel icon={TrendingUp} title="Rating distribution">
              {loading ? <div className="skeleton skeleton--chart" /> : (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ratings} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" vertical={false} />
                      <XAxis dataKey="rating" {...AXIS} tickLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} tickFormatter={(x) => `${(x / 1e6).toFixed(1)}M`} />
                      <Tooltip {...TIP} formatter={(x) => [`${(x / 1e6).toFixed(2)}M ratings`, "Total"]} labelFormatter={(l) => `${l} stars`} />
                      <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2.5} fill="url(#rg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <Panel icon={Trophy} title="Most rated movies">
            {loading ? <div className="skeleton skeleton--chart" /> : (
              <div className="chart chart--tall">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={popular} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F7" horizontal={false} />
                    <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="title" {...AXIS} width={170} tickLine={false} axisLine={false}
                      tickFormatter={(t) => { const s = t.replace(/\s*\(\d{4}\)\s*$/, ""); return s.length > 24 ? `${s.slice(0, 24)}...` : s; }} />
                    <Tooltip {...TIP} />
                    <Bar dataKey="rating_count" name="Ratings" fill="#4F46E5" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
