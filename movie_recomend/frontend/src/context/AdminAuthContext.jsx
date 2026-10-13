import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { adminLogin, adminLogout, fetchAdminMe, getAdminToken, clearAdminToken } from "../services/adminApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAdminAuth = useCallback(async () => {
    try {
      const data = await fetchAdminMe();
      if (data && data.authenticated && data.role === "admin") {
        setAdmin(data);
      } else {
        setAdmin(null);
      }
    } catch {
      clearAdminToken();
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAdminToken();
      setAdmin(null);
    };
    window.addEventListener("moviemind:admin-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("moviemind:admin-unauthorized", handleUnauthorized);
  }, []);

  const login = async (username, password) => {
    const res = await adminLogin(username, password);
    if (res && res.admin) {
      setAdmin(res.admin);
      return res.admin;
    }
    throw new Error("Invalid administrator response from server");
  };

  const logout = async () => {
    await adminLogout();
    setAdmin(null);
  };

  const value = {
    admin,
    loading,
    isAuthenticated: Boolean(admin),
    login,
    logout,
    checkAdminAuth,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
