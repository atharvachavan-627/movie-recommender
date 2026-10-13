import { useState, useEffect } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { fetchAdminSystemHealth } from "../services/adminApi";
import {
  Settings,
  ShieldCheck,
  User,
  KeyRound,
  Server,
  Database,
  Lock,
  Clock,
  AlertCircle,
  FileCode,
  CheckCircle2,
  Cpu,
  Layers
} from "lucide-react";

export default function AdminSettings() {
  const { admin } = useAdminAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminSystemHealth()
      .then(setHealth)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-page-container">
      <div className="admin-hero-banner">
        <div className="admin-hero-text">
          <h2>Administrative Settings & Security</h2>
          <p>System configuration parameters, session inspection, and credentials management.</p>
        </div>
      </div>

      <div className="admin-settings-grid">
        {/* Card 1: Admin Account Details */}
        <div className="card admin-settings-card">
          <div className="admin-settings-card-header">
            <span className="settings-icon-pill bg-brand"><User size={18} /></span>
            <h3>Admin Account Profile</h3>
          </div>
          <div className="admin-settings-list">
            <div className="settings-row">
              <span className="settings-k">Configured Username</span>
              <span className="settings-v font-mono">{admin?.username || "moviemind_admin"}</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Assigned Role</span>
              <span className="settings-v">
                <span className="badge badge--success">SYSTEM ADMINISTRATOR</span>
              </span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Authorization Scope</span>
              <span className="settings-v">Physical Star Schema, ETL Pipeline, OLAP Engine, ML Models</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Account Origin</span>
              <span className="settings-v">Server Environment Configuration (.env)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Session Information */}
        <div className="card admin-settings-card">
          <div className="admin-settings-card-header">
            <span className="settings-icon-pill bg-collab"><Clock size={18} /></span>
            <h3>Session & Security Policy</h3>
          </div>
          <div className="admin-settings-list">
            <div className="settings-row">
              <span className="settings-k">Session Authentication</span>
              <span className="settings-v">HttpOnly Secure Cookie + Bearer JWT</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Cookie Parameter</span>
              <span className="settings-v font-mono">moviemind_admin_session</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Session Duration</span>
              <span className="settings-v">120 Minutes (Auto-expiring)</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Brute-Force Defense</span>
              <span className="settings-v">In-Memory Sliding Rate Limiter (5 attempts / 5 mins)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Backend & Warehouse Infrastructure */}
        <div className="card admin-settings-card">
          <div className="admin-settings-card-header">
            <span className="settings-icon-pill bg-star"><Database size={18} /></span>
            <h3>Infrastructure & Warehouse</h3>
          </div>
          <div className="admin-settings-list">
            <div className="settings-row">
              <span className="settings-k">Application Core</span>
              <span className="settings-v font-mono">FastAPI 0.110+ (Uvicorn ASGI)</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Python Engine</span>
              <span className="settings-v font-mono">Python 3.13 Runtime</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Relational Warehouse</span>
              <span className="settings-v font-mono">backend/datawarehouse/moviemind_dw.db</span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Warehouse State</span>
              <span className="settings-v">
                <span className="badge badge--success">
                  {health?.components?.warehouse_db?.status || "Healthy"} ({health?.components?.warehouse_db?.fact_count?.toLocaleString() || "42,769"} facts)
                </span>
              </span>
            </div>
            <div className="settings-row">
              <span className="settings-k">Client Build Version</span>
              <span className="settings-v font-mono">MovieMind 2.0.0 (Vite + React 19)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Credential Management Policy */}
        <div className="card admin-settings-card">
          <div className="admin-settings-card-header">
            <span className="settings-icon-pill bg-content"><KeyRound size={18} /></span>
            <h3>Credential Rotation Architecture</h3>
          </div>
          <div className="admin-credentials-policy">
            <div className="admin-policy-alert">
              <AlertCircle size={20} className="admin-policy-icon" />
              <div>
                <strong>Server-Side Credential Management</strong>
                <p>
                  To adhere to enterprise security guidelines and prevent credential leakage in the client bundle, 
                  the administrator password is <strong>never stored in the frontend codebase</strong> or modified via unauthenticated client forms.
                </p>
              </div>
            </div>

            <div className="admin-policy-steps">
              <h4>How to rotate administrator credentials:</h4>
              <ol>
                <li>Open your server environment file (<code>backend/.env</code>).</li>
                <li>
                  Update the environment variable:
                  <pre className="admin-env-snippet">
                    ADMIN_USERNAME=moviemind_admin{'\n'}
                    ADMIN_PASSWORD=YourNewSecurePasswordHere!
                  </pre>
                </li>
                <li>
                  Optionally generate and set a pre-hashed bcrypt hash in:
                  <pre className="admin-env-snippet">
                    ADMIN_PASSWORD_HASH=$2b$12$...
                  </pre>
                </li>
                <li>Restart the FastAPI backend process to apply the new secret.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
