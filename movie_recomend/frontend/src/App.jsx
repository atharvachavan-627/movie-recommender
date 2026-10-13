import { Suspense, lazy, useEffect } from "react";
import { Navigate, Routes, Route, useLocation, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import useHealth from "./hooks/useHealth";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Recommendations from "./pages/Recommendations";
import HowItWorks from "./pages/HowItWorks";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSettings from "./pages/AdminSettings";
import AdminLayout from "./components/AdminLayout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { useAdminAuth } from "./context/AdminAuthContext";

const Analytics = lazy(() => import("./pages/Analytics"));
const OLAPAnalytics = lazy(() => import("./pages/OLAPAnalytics"));
const MLInsights = lazy(() => import("./pages/MLInsights"));
const WarehouseETL = lazy(() => import("./pages/WarehouseETL"));
const TechnicalGuide = lazy(() => import("./pages/TechnicalGuide"));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
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

function OldTechnicalRedirect({ to }) {
  const { admin, loading } = useAdminAuth();
  if (loading) {
    return (
      <div className="container page">
        <div className="skeleton skeleton--hero" />
      </div>
    );
  }
  if (admin) {
    return <Navigate to={to} replace />;
  }
  return <Navigate to="/admin/login" replace state={{ from: { pathname: to } }} />;
}

export default function App() {
  const { user, initializing, logout } = useAuth();
  const location = useLocation();
  const status = useHealth();

  if (initializing) {
    return (
      <div className="auth-loading" role="status">
        Loading MovieMind...
      </div>
    );
  }

  const isAdminRoute = location.pathname.startsWith("/admin");

  // ==========================================================================
  // 1. ADMIN PORTAL ROUTING
  // ==========================================================================
  if (isAdminRoute) {
    return (
      <div className="admin-app-root">
        <ScrollManager />
        <Routes>
          {/* Public Admin Login Route */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Console Routes */}
          <Route
            path="/admin/*"
            element={
              <AdminProtectedRoute>
                <AdminLayout>
                  <Suspense
                    fallback={
                      <div className="container page">
                        <div className="skeleton skeleton--hero" style={{ height: "400px" }} />
                      </div>
                    }
                  >
                    <Routes>
                      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="/dashboard" element={<AdminDashboard />} />
                      <Route path="/warehouse" element={<WarehouseETL />} />
                      <Route path="/olap" element={<OLAPAnalytics />} />
                      <Route path="/ml-insights" element={<MLInsights />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/technical-guide" element={<TechnicalGuide />} />
                      <Route path="/settings" element={<AdminSettings />} />
                      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </AdminLayout>
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </div>
    );
  }

  // ==========================================================================
  // 2. OLD TECHNICAL ROUTES REDIRECTS (AUDITED MIGRATION)
  // ==========================================================================
  const legacyRedirects = {
    "/warehouse": "/admin/warehouse",
    "/olap": "/admin/olap",
    "/ml-insights": "/admin/ml-insights",
    "/analytics": "/admin/analytics",
    "/viva": "/admin/technical-guide",
  };

  if (legacyRedirects[location.pathname]) {
    return <OldTechnicalRedirect to={legacyRedirects[location.pathname]} />;
  }

  // ==========================================================================
  // 3. USER APPLICATION ROUTING
  // ==========================================================================
  return (
    <div className="app">
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
        </Routes>
      ) : (
        <>
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
              <Route path="/how-it-works" element={<ProtectedRoute><HowItWorks /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}
