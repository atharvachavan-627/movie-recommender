const API_BASE_URL = "http://127.0.0.1:8000/api";

function getToken() {
  return window.localStorage.getItem("moviemind_token") || window.sessionStorage.getItem("moviemind_session_token");
}

async function request(url, options = {}, requiresAuth = true) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (requiresAuth && token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && requiresAuth) window.dispatchEvent(new Event("moviemind:unauthorized"));
  if (!res.ok) {
    let detail = "Request failed. Please try again.";
    try { detail = (await res.json()).detail || detail; } catch { /* non-JSON error */ }
    throw new Error(detail);
  }
  return res.json();
}

export function loginRequest(credentials) {
  return request("http://127.0.0.1:8000/auth/login", { method: "POST", body: JSON.stringify(credentials) }, false);
}

export function registerRequest(details) {
  return request("http://127.0.0.1:8000/auth/register", { method: "POST", body: JSON.stringify(details) }, false);
}

export function fetchCurrentUser() {
  return request("http://127.0.0.1:8000/auth/me");
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchMovies(limit = 20, offset = 0, genre = null) {
  let url = `${API_BASE_URL}/movies?limit=${limit}&offset=${offset}`;
  if (genre && genre !== "All") {
    url += `&genre=${encodeURIComponent(genre)}`;
  }
  return request(url);
}

export async function searchMovies(query, limit = 20, genre = null) {
  let url = `${API_BASE_URL}/movies/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  if (genre && genre !== "All") {
    url += `&genre=${encodeURIComponent(genre)}`;
  }
  return request(url);
}

export async function fetchMovieDetails(movieId) {
  return request(`${API_BASE_URL}/movies/${movieId}`);
}

export async function fetchContentRecommendations(movieId, limit = 10) {
  return request(`${API_BASE_URL}/recommendations/content/${movieId}?limit=${limit}`);
}

export async function fetchCollaborativeRecommendations(movieId, limit = 10) {
  return request(`${API_BASE_URL}/recommendations/collaborative/${movieId}?limit=${limit}`);
}

export async function fetchHybridRecommendations(movieId, limit = 10, contentWeight = 0.4, collabWeight = 0.6) {
  return request(`${API_BASE_URL}/recommendations/hybrid/${movieId}?limit=${limit}&content_w=${contentWeight}&collab_w=${collabWeight}`);
}

export async function fetchAnalyticsOverview() {
  return request(`${API_BASE_URL}/analytics/overview`);
}

export async function fetchPopularMovies(limit = 10) {
  return request(`${API_BASE_URL}/analytics/popular?limit=${limit}`);
}

export async function fetchGenreAnalytics() {
  return request(`${API_BASE_URL}/analytics/genres`);
}

export async function fetchRatingAnalytics() {
  return request(`${API_BASE_URL}/analytics/ratings`);
}
