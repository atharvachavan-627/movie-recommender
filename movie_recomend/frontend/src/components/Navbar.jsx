import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut, Menu, X, Sparkles, UserRound, ShieldCheck } from "lucide-react";
import Logo from "./Logo";
import { useAdminAuth } from "../context/AdminAuthContext";

const USER_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/explore", label: "Explore" },
  { to: "/recommend", label: "Get Recommendations" },
  { to: "/how-it-works", label: "How It Works" },
];

const STATUS_LABEL = { online: "API online", offline: "API offline", checking: "Connecting" };

export default function Navbar({ status, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { admin } = useAdminAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="container nav__inner">
        <Link to="/" className="nav__brand" aria-label="MovieMind home">
          <Logo />
        </Link>

        <nav className={`nav__links ${open ? "is-open" : ""}`} aria-label="Primary">
          {USER_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav__link" onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/profile" className="nav__link nav__link-mobile-only" onClick={() => setOpen(false)}>
            User Profile
          </NavLink>
          {admin && (
            <Link to="/admin/dashboard" className="nav__link nav__link--admin-badge" onClick={() => setOpen(false)}>
              <ShieldCheck size={16} /> Admin Console
            </Link>
          )}
          <Link to="/recommend" className="btn btn--primary nav__cta-mobile" onClick={() => setOpen(false)}>
            <Sparkles size={16} /> Get recommendations
          </Link>
        </nav>

        <div className="nav__right">
          <span className={`status status--${status}`} title="FastAPI backend status">
            <span className="status__dot" />
            <span className="status__label">{STATUS_LABEL[status]}</span>
          </span>

          {admin && (
            <Link to="/admin/dashboard" className="btn btn--ghost nav__admin-btn" title="Open Administrator Control Center">
              <ShieldCheck size={16} className="text-brand" />
              <span>Admin Console</span>
            </Link>
          )}

          <Link to="/recommend" className="btn btn--primary nav__cta">
            <Sparkles size={16} /> Get recommendations
          </Link>

          <Link to="/profile" className="nav__profile" title={`View profile for ${user.name} (@${user.username})`}>
            <UserRound size={16} />
            <span>{user.name}</span>
          </Link>

          <button className="btn btn--ghost nav__logout" onClick={onLogout} aria-label="Log out">
            <LogOut size={16} />
            <span>Log out</span>
          </button>

          <button
            className="nav__toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
