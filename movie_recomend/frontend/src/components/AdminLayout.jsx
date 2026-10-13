import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import {
  LayoutDashboard,
  Database,
  Layers,
  ShieldCheck,
  BarChart3,
  Boxes,
  Cpu,
  Sparkles,
  GitBranch,
  BookOpen,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Activity,
  UserCheck,
} from "lucide-react";

export default function AdminLayout({ children }) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({
    data: false,
    analytics: false,
    intelligence: false,
    system: false,
  });

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes("/admin/dashboard")) return "Executive Overview & Metrics";
    if (p.includes("/admin/warehouse")) return "Physical Star Schema & ETL Pipeline";
    if (p.includes("/admin/olap")) return "Multi-Dimensional OLAP Cube & Apriori Mining";
    if (p.includes("/admin/ml-insights")) return "Machine Learning & Offline Evaluation";
    if (p.includes("/admin/analytics")) return "Data Warehousing & Mining Analytics";
    if (p.includes("/admin/technical-guide")) return "Technical Architecture & Reference";
    if (p.includes("/admin/settings")) return "Administrative Configuration & Security";
    return "MovieMind Administration";
  };

  return (
    <div className="admin-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="admin-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Admin Sidebar */}
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Admin Navigation">
        <div className="admin-sidebar__header">
          <Link to="/admin/dashboard" className="admin-sidebar__brand">
            <span className="admin-brand-icon">MM</span>
            <div className="admin-brand-titles">
              <span className="admin-brand-main">MovieMind</span>
              <span className="admin-brand-sub">ADMIN CONSOLE</span>
            </div>
          </Link>
          <button
            className="admin-sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close admin menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          {/* Overview */}
          <div className="admin-nav-single">
            <NavLink
              to="/admin/dashboard"
              end
              className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
            >
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </NavLink>
          </div>

          {/* Group 1: Data Management */}
          <div className="admin-nav-group">
            <button
              type="button"
              className="admin-nav-group__header"
              onClick={() => toggleGroup("data")}
              aria-expanded={!collapsedGroups.data}
            >
              <span>DATA MANAGEMENT</span>
              {collapsedGroups.data ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsedGroups.data && (
              <div className="admin-nav-group__items">
                <NavLink
                  to="/admin/warehouse"
                  className={({ isActive }) => `admin-nav-link ${isActive && !location.hash ? "is-active" : ""}`}
                >
                  <Database size={18} />
                  <span>Data Warehouse</span>
                </NavLink>
                <NavLink
                  to="/admin/warehouse#etl"
                  className={`admin-nav-link ${location.pathname === "/admin/warehouse" && location.hash === "#etl" ? "is-active" : ""}`}
                >
                  <Layers size={18} />
                  <span>ETL Pipeline</span>
                </NavLink>
                <NavLink
                  to="/admin/warehouse#quality"
                  className={`admin-nav-link ${location.pathname === "/admin/warehouse" && location.hash === "#quality" ? "is-active" : ""}`}
                >
                  <ShieldCheck size={18} />
                  <span>Data Quality</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 2: Analytics */}
          <div className="admin-nav-group">
            <button
              type="button"
              className="admin-nav-group__header"
              onClick={() => toggleGroup("analytics")}
              aria-expanded={!collapsedGroups.analytics}
            >
              <span>ANALYTICS</span>
              {collapsedGroups.analytics ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsedGroups.analytics && (
              <div className="admin-nav-group__items">
                <NavLink
                  to="/admin/analytics"
                  className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
                >
                  <BarChart3 size={18} />
                  <span>Analytics</span>
                </NavLink>
                <NavLink
                  to="/admin/olap"
                  className={({ isActive }) => `admin-nav-link ${isActive && !location.hash ? "is-active" : ""}`}
                >
                  <Boxes size={18} />
                  <span>OLAP Cube</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 3: Intelligence */}
          <div className="admin-nav-group">
            <button
              type="button"
              className="admin-nav-group__header"
              onClick={() => toggleGroup("intelligence")}
              aria-expanded={!collapsedGroups.intelligence}
            >
              <span>INTELLIGENCE</span>
              {collapsedGroups.intelligence ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsedGroups.intelligence && (
              <div className="admin-nav-group__items">
                <NavLink
                  to="/admin/ml-insights"
                  className={({ isActive }) => `admin-nav-link ${isActive && !location.hash ? "is-active" : ""}`}
                >
                  <Cpu size={18} />
                  <span>Machine Learning</span>
                </NavLink>
                <NavLink
                  to="/admin/olap#apriori"
                  className={`admin-nav-link ${location.pathname === "/admin/olap" && location.hash === "#apriori" ? "is-active" : ""}`}
                >
                  <Sparkles size={18} />
                  <span>Data Mining</span>
                </NavLink>
                <NavLink
                  to="/admin/ml-insights#evaluation"
                  className={`admin-nav-link ${location.pathname === "/admin/ml-insights" && location.hash === "#evaluation" ? "is-active" : ""}`}
                >
                  <GitBranch size={18} />
                  <span>Model Evaluation</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Group 4: System */}
          <div className="admin-nav-group">
            <button
              type="button"
              className="admin-nav-group__header"
              onClick={() => toggleGroup("system")}
              aria-expanded={!collapsedGroups.system}
            >
              <span>SYSTEM</span>
              {collapsedGroups.system ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsedGroups.system && (
              <div className="admin-nav-group__items">
                <NavLink
                  to="/admin/technical-guide"
                  className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
                >
                  <BookOpen size={18} />
                  <span>Technical Guide</span>
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className={({ isActive }) => `admin-nav-link ${isActive ? "is-active" : ""}`}
                >
                  <Settings size={18} />
                  <span>Admin Settings</span>
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="admin-sidebar__footer">
          <Link to="/" className="admin-nav-link admin-nav-link--ghost">
            <ExternalLink size={17} />
            <span>View User Application</span>
          </Link>
          <button
            type="button"
            className="admin-nav-link admin-nav-link--logout"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Administrative Content Area */}
      <div className="admin-main-wrap">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              className="admin-sidebar-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin sidebar menu"
            >
              <Menu size={22} />
            </button>
            <div className="admin-topbar__titles">
              <span className="admin-topbar__crumb">Administration</span>
              <h1 className="admin-topbar__h1">{getPageTitle()}</h1>
            </div>
          </div>

          <div className="admin-topbar__right">
            <div className="admin-health-pill" title="Backend & Warehouse Status">
              <span className="admin-health-dot" />
              <span>System Online</span>
            </div>
            <div className="admin-user-pill">
              <UserCheck size={16} />
              <span>{admin?.username || "Admin"}</span>
              <span className="admin-role-badge">SUPERUSER</span>
            </div>
            <Link to="/" className="btn btn--secondary btn--sm admin-switch-app-btn">
              <span>User App</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main id="admin-content" className="admin-content-body">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
