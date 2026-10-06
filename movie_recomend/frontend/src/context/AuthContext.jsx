import { createContext, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, loginRequest, registerRequest } from "../services/api";

const AuthContext = createContext(null);
const TOKEN_KEYS = ["moviemind_token", "moviemind_session_token"];

function readToken() {
  return TOKEN_KEYS.map((key) => window.localStorage.getItem(key) || window.sessionStorage.getItem(key)).find(Boolean) || null;
}

function storeToken(token, remember) {
  window.localStorage.removeItem(TOKEN_KEYS[0]);
  window.sessionStorage.removeItem(TOKEN_KEYS[1]);
  (remember ? window.localStorage : window.sessionStorage).setItem(remember ? TOKEN_KEYS[0] : TOKEN_KEYS[1], token);
}

function clearToken() {
  TOKEN_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    const token = readToken();
    if (!token) {
      setInitializing(false);
      return undefined;
    }
    fetchCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch(() => { clearToken(); if (active) setUser(null); })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener("moviemind:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("moviemind:unauthorized", handleUnauthorized);
  }, []);

  const login = async (credentials, remember) => {
    const response = await loginRequest(credentials);
    storeToken(response.access_token, remember);
    setUser(response.user);
    return response.user;
  };

  const register = async (details, remember = true) => {
    const response = await registerRequest(details);
    storeToken(response.access_token, remember);
    setUser(response.user);
    return response.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, initializing, isAuthenticated: Boolean(user), login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
