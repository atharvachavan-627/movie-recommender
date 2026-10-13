const API_BASE_URL = "http://127.0.0.1:8000/api";

const ADMIN_TOKEN_KEY = "moviemind_admin_token";

export function getAdminToken() {
  return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminRequest(url, options = {}, requiresAuth = true) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getAdminToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Admin-Token", token);
  }

  // Include credentials so HttpOnly session cookie is transmitted with CORS
  const fetchOptions = {
    ...options,
    headers,
    credentials: "include",
  };

  const res = await fetch(url, fetchOptions);

  if (res.status === 401 && requiresAuth) {
    clearAdminToken();
    window.dispatchEvent(new Event("moviemind:admin-unauthorized"));
  }

  if (!res.ok) {
    let detail = "Request failed. Please try again.";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // Non-JSON response
    }
    throw new Error(detail);
  }

  return res.json();
}

/**
 * Authenticate administrator credentials against server.
 */
export async function adminLogin(username, password) {
  const res = await adminRequest(
    `${API_BASE_URL}/admin/auth/login`,
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    false
  );

  if (res.access_token) {
    setAdminToken(res.access_token);
  }
  return res;
}

/**
 * Invalidate administrator session on backend and clear local session state.
 */
export async function adminLogout() {
  try {
    await adminRequest(`${API_BASE_URL}/admin/auth/logout`, { method: "POST" }, false);
  } catch (err) {
    console.warn("Server admin logout error (ignoring during local cleanup):", err);
  } finally {
    clearAdminToken();
  }
}

/**
 * Verify active administrator session.
 */
export async function fetchAdminMe() {
  return adminRequest(`${API_BASE_URL}/admin/auth/me`);
}

/**
 * Live KPI and data warehouse summary for Admin Dashboard.
 */
export async function fetchAdminSummary() {
  return adminRequest(`${API_BASE_URL}/admin/dashboard/summary`);
}

/**
 * Real-time health check across all architectural layers.
 */
export async function fetchAdminSystemHealth() {
  return adminRequest(`${API_BASE_URL}/admin/system/health`);
}
