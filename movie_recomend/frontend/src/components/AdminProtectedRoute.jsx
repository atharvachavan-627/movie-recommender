import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="admin-loading-screen" role="status" aria-live="polite">
        <div className="admin-loading-card">
          <div className="admin-loading-spinner">
            <Loader2 className="spin" size={36} />
          </div>
          <h3>Verifying Administrator Privileges</h3>
          <p>Validating secure session and credentials...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    // Preserve intended destination safely in state
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}
