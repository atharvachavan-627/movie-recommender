import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Activity,
  Home,
  LogOut,
  Menu,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Logo from "./Logo";

const STATUS_LABEL = { online: "API online", offline: "API offline", checking: "Connecting" };

export default function Navbar({ status, user, onLogout }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnRouteChange = () => setOpen(false);
    window.addEventListener("popstate", closeOnRouteChange);
    return () => window.removeEventListener("popstate", closeOnRouteChange);
  }, []);

  return (
    <>
      {open && <div className="user-sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`user-sidebar ${open ? "is-open" : ""}`} aria-label="User navigation">
        <div className="user-sidebar__header">
          <Link to="/" className="user-sidebar__brand" onClick={() => setOpen(false)} aria-label="MovieMind home">
            <Logo />
            <span className="user-sidebar__subtitle">USER PLATFORM</span>
          </Link>
          <button className="user-sidebar__close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <nav className="user-sidebar__nav">
          <div className="user-nav-group">
            <span className="user-nav-group__label">DISCOVER</span>
            <NavLink to="/" end className="user-nav-link" onClick={() => setOpen(false)}>
              <Home size={18} /> <span>Home</span>
            </NavLink>
            <NavLink to="/explore" className="user-nav-link" onClick={() => setOpen(false)}>
              <Search size={18} /> <span>Explore Movies</span>
            </NavLink>
            <NavLink to="/recommend" className="user-nav-link" onClick={() => setOpen(false)}>
              <Sparkles size={18} /> <span>Recommendations</span>
            </NavLink>
            <NavLink to="/how-it-works" className="user-nav-link" onClick={() => setOpen(false)}>
              <Activity size={18} /> <span>How It Works</span>
            </NavLink>
          </div>

        </nav>

        <div className="user-sidebar__footer">
          <div className={`user-status status--${status}`} title="FastAPI backend status">
            <span className="status__dot" />
            <span>{STATUS_LABEL[status]}</span>
          </div>
          <Link to="/profile" className="user-sidebar__profile" onClick={() => setOpen(false)}>
            <UserRound size={17} />
            <span>Profile</span>
          </Link>
          <button className="user-sidebar__logout" onClick={onLogout}>
            <LogOut size={17} /> <span>Log out</span>
          </button>
        </div>
      </aside>
      <button className="user-sidebar-toggle" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu size={22} />
      </button>
    </>
  );
}
