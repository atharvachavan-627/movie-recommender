import { Suspense, lazy, useEffect } from "react";
import { Navigate, Routes, Route, useLocation, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import useHealth from "./hooks/useHealth";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Recommendations from "./pages/Recommendations";
const Analytics = lazy(() => import("./pages/Analytics"));
const OLAPAnalytics = lazy(() => import("./pages/OLAPAnalytics"));
const MLInsights = lazy(() => import("./pages/MLInsights"));
const WarehouseETL = lazy(() => import("./pages/WarehouseETL"));
const VivaMode = lazy(() => import("./pages/VivaMode"));
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <div className="container page empty">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="btn btn--primary">Back to home</Link>
    </div>
  );
}

export default function App() {
  const { user, initializing, logout } = useAuth();
  const location = useLocation();
  const status = useHealth();
  if (initializing) return <div className="auth-loading" role="status">Loading MovieMind...</div>;
  return (
    <div className="app">
      {!user && <Routes><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} /></Routes>}
      {user && <>
        <a href="#main" className="skip">Skip to content</a>
        <Navbar status={status} user={user} onLogout={logout} />
        <ScrollManager />
      <main id="main" className="app__main">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Home status={status} /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
          <Route path="/recommend" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/recommend/:movieId" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/recommendations/:movieId" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><WarehouseETL /></Suspense></ProtectedRoute>} />
          <Route path="/olap" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><OLAPAnalytics /></Suspense></ProtectedRoute>} />
          <Route path="/ml-insights" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><MLInsights /></Suspense></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><Analytics /></Suspense></ProtectedRoute>} />
          <Route path="/viva" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><VivaMode /></Suspense></ProtectedRoute>} />
          <Route path="/how-it-works" element={<ProtectedRoute><Suspense fallback={<div className="container page"><div className="skeleton skeleton--hero" /></div>}><VivaMode /></Suspense></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      </>}
    </div>
  );
}
