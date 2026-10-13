import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  Database, 
  Cpu, 
  BarChart3, 
  GitBranch, 
  Layers, 
  Sparkles 
} from "lucide-react";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Preserve previous intended route or default to /admin/dashboard
  const from = location.state?.from?.pathname || "/admin/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid administrator credentials. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        {/* Left Information Panel */}
        <div className="admin-login-left">
          <div className="admin-brand-header">
            <span className="admin-logo-mark">
              <span className="admin-logo-film">MM</span>
            </span>
            <div className="admin-brand-text">
              <h2>MovieMind Admin</h2>
              <span className="admin-brand-tag">DWM & ML Intelligence Platform</span>
            </div>
          </div>

          <div className="admin-left-pitch">
            <h3>Movie Recommendation Intelligence Platform</h3>
            <p className="admin-left-desc">
              Centralized administrative command center for end-to-end analytical data warehousing, 
              scalable OLAP cube queries, and production machine learning models.
            </p>
          </div>

          <div className="admin-features-list">
            <h4>Secure administration for:</h4>
            <ul>
              <li>
                <span className="feature-icon"><Database size={16} /></span>
                <div>
                  <strong>Data Warehouse</strong>
                  <span>Physical Star Schema with referential audit</span>
                </div>
              </li>
              <li>
                <span className="feature-icon"><Layers size={16} /></span>
                <div>
                  <strong>ETL Operations</strong>
                  <span>Surrogate keys derivation & fact deduplication</span>
                </div>
              </li>
              <li>
                <span className="feature-icon"><BarChart3 size={16} /></span>
                <div>
                  <strong>OLAP Analytics</strong>
                  <span>Roll-Up, Drill-Down, Slice, Dice & Pivot matrix</span>
                </div>
              </li>
              <li>
                <span className="feature-icon"><Cpu size={16} /></span>
                <div>
                  <strong>Machine Learning</strong>
                  <span>Decision Tree, Naive Bayes & Regression suite</span>
                </div>
              </li>
              <li>
                <span className="feature-icon"><Sparkles size={16} /></span>
                <div>
                  <strong>Data Mining</strong>
                  <span>Apriori association rules & K-Means clustering</span>
                </div>
              </li>
              <li>
                <span className="feature-icon"><GitBranch size={16} /></span>
                <div>
                  <strong>Recommendation Evaluation</strong>
                  <span>NDCG@K, Precision@K & Catalog Coverage benchmarks</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="admin-left-footer">
            <span className="admin-security-badge">
              <ShieldCheck size={16} /> Encrypted Session • RBAC Enforced
            </span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="admin-login-right">
          <div className="admin-login-box">
            <div className="admin-form-header">
              <div className="admin-badge-pill">RESTRICTED CONSOLE</div>
              <h1>ADMINISTRATOR LOGIN</h1>
              <p>Enter authorized credentials to access system management.</p>
            </div>

            {error && (
              <div className="admin-error-alert" role="alert" aria-live="assertive">
                <AlertCircle size={18} className="admin-error-icon" />
                <div className="admin-error-text">
                  <strong>Authentication Failed</strong>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="admin-form" noValidate>
              <div className="admin-field">
                <label htmlFor="admin-username">Administrator Username</label>
                <div className="admin-input-wrapper">
                  <User size={18} className="field-icon" />
                  <input
                    id="admin-username"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="e.g. moviemind_admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="admin-password">Password</label>
                <div className="admin-input-wrapper">
                  <Lock size={18} className="field-icon" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="admin-pw-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="admin-submit-btn"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Signing in to Admin Portal...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Sign In to Admin Portal</span>
                  </>
                )}
              </button>
            </form>

            <div className="admin-back-link-wrapper">
              <Link to="/" className="admin-back-link">
                <ArrowLeft size={16} />
                <span>Back to MovieMind</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
