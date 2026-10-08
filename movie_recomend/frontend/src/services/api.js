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

// --- Auth Endpoints ---

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

// --- Movie Catalog Endpoints ---

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

// --- Recommendations Endpoints ---

export async function fetchContentRecommendations(movieId, limit = 10) {
  return request(`${API_BASE_URL}/recommendations/content/${movieId}?limit=${limit}`);
}

export async function fetchCollaborativeRecommendations(movieId, limit = 10) {
  return request(`${API_BASE_URL}/recommendations/collaborative/${movieId}?limit=${limit}`);
}

export async function fetchHybridRecommendations(movieId, limit = 10, contentWeight = 0.4, collabWeight = 0.6) {
  return request(`${API_BASE_URL}/recommendations/hybrid/${movieId}?limit=${limit}&content_w=${contentWeight}&collab_w=${collabWeight}`);
}

export async function fetchRecommendationEvaluation() {
  return request(`${API_BASE_URL}/recommendations/evaluation`);
}

// --- DWM Analytics Endpoints ---

export async function fetchAnalyticsOverview() {
  return request(`${API_BASE_URL}/analytics/overview`);
}

export async function fetchExecutiveInsights() {
  return request(`${API_BASE_URL}/analytics/executive-insights`);
}

export async function fetchPopularMovies(limit = 10) {
  return request(`${API_BASE_URL}/analytics/popular?limit=${limit}`);
}

export async function fetchGenreAnalytics(minRatings = 0) {
  return request(`${API_BASE_URL}/analytics/genres?min_ratings=${minRatings}`);
}

export async function fetchRatingAnalytics() {
  return request(`${API_BASE_URL}/analytics/ratings`);
}

export async function fetchTimeSeriesAnalytics(granularity = "year") {
  return request(`${API_BASE_URL}/analytics/time-series?granularity=${encodeURIComponent(granularity)}`);
}

export async function fetchMovieRankings({ sortBy = "rating_count", minRatings = 10, genre = null, search = null, limit = 25, page = 1 } = {}) {
  let url = `${API_BASE_URL}/analytics/movie-rankings?sort_by=${encodeURIComponent(sortBy)}&min_ratings=${minRatings}&limit=${limit}&page=${page}`;
  if (genre && genre !== "All") url += `&genre=${encodeURIComponent(genre)}`;
  if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
  return request(url);
}

export async function fetchUserAnalytics() {
  return request(`${API_BASE_URL}/analytics/user-behavior`);
}

export async function fetchGenreTimeMatrix(measure = "avg_rating") {
  return request(`${API_BASE_URL}/analytics/genre-time-matrix?measure=${encodeURIComponent(measure)}`);
}

export async function fetchAnalyticalExplorer({ dimension = "genre", measure = "rating_count", sortOrder = "desc", limit = 20, minRatings = 0 } = {}) {
  return request(`${API_BASE_URL}/analytics/explorer?dimension=${encodeURIComponent(dimension)}&measure=${encodeURIComponent(measure)}&sort_order=${encodeURIComponent(sortOrder)}&limit=${limit}&min_ratings=${minRatings}`);
}

export async function fetchDataQualityReport() {
  return request(`${API_BASE_URL}/dwm/data-quality`);
}

// --- Physical Data Warehouse & OLAP API ---

export async function fetchWarehouseSummary() {
  return request(`${API_BASE_URL}/warehouse/summary`);
}

export async function fetchWarehouseTableDetails(tableName) {
  return request(`${API_BASE_URL}/warehouse/table/${encodeURIComponent(tableName)}`);
}

export async function rebuildWarehouseETL() {
  return request(`${API_BASE_URL}/warehouse/etl/rebuild`, { method: "POST" });
}

export async function fetchOLAPRollup(level = "year") {
  return request(`${API_BASE_URL}/olap/rollup?level=${encodeURIComponent(level)}`);
}

export async function fetchOLAPDrilldown(targetYear = null, targetQuarter = null, targetMonth = null) {
  let url = `${API_BASE_URL}/olap/drilldown`;
  const params = [];
  if (targetYear !== null && targetYear !== undefined) params.push(`target_year=${targetYear}`);
  if (targetQuarter !== null && targetQuarter !== undefined) params.push(`target_quarter=${targetQuarter}`);
  if (targetMonth !== null && targetMonth !== undefined) params.push(`target_month=${targetMonth}`);
  if (params.length > 0) url += `?${params.join("&")}`;
  return request(url);
}

export async function fetchOLAPSlice(dimension = "genre", value = "Action") {
  return request(`${API_BASE_URL}/olap/slice?dimension=${encodeURIComponent(dimension)}&value=${encodeURIComponent(value)}`);
}

export async function fetchOLAPDice(genre = "Action", yearMin = 2015, yearMax = 2024, ratingMin = 3.5, limit = 25) {
  let url = `${API_BASE_URL}/olap/dice?limit=${limit}`;
  if (genre) url += `&genre=${encodeURIComponent(genre)}`;
  if (yearMin !== null) url += `&year_min=${yearMin}`;
  if (yearMax !== null) url += `&year_max=${yearMax}`;
  if (ratingMin !== null) url += `&rating_min=${ratingMin}`;
  return request(url);
}

export async function fetchOLAPPivot(rowDim = "genre", colDim = "decade", measure = "avg_rating") {
  return request(`${API_BASE_URL}/olap/pivot?row_dim=${encodeURIComponent(rowDim)}&col_dim=${encodeURIComponent(colDim)}&measure=${encodeURIComponent(measure)}`);
}

// --- Apriori Association Rule Mining API ---

export async function fetchAssociationRules(minSupport = null, minConfidence = null, minLift = null, limit = 50, sortBy = "lift", search = null, page = 1) {
  let url = `${API_BASE_URL}/mining/association-rules?limit=${limit}&sort_by=${encodeURIComponent(sortBy)}&page=${page}`;
  if (minSupport !== null && minSupport !== undefined) url += `&min_support=${minSupport}`;
  if (minConfidence !== null && minConfidence !== undefined) url += `&min_confidence=${minConfidence}`;
  if (minLift !== null && minLift !== undefined) url += `&min_lift=${minLift}`;
  if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
  return request(url);
}

export async function fetchMovieAssociationRules(movieId, limit = 10) {
  return request(`${API_BASE_URL}/mining/movie-rules/${movieId}?limit=${limit}`);
}

// --- Machine Learning & Classification API ---

export async function fetchMLValidation() {
  return request(`${API_BASE_URL}/ml/validation`);
}

export async function fetchMLEvaluation() {
  return request(`${API_BASE_URL}/ml/evaluation`);
}

export async function fetchClassificationMetrics() {
  return request(`${API_BASE_URL}/ml/classification/metrics`);
}

export async function fetchMLFeatureImportance() {
  return request(`${API_BASE_URL}/ml/feature-importance`);
}

export async function fetchMLClusters() {
  return request(`${API_BASE_URL}/ml/clusters`);
}

export async function fetchMLDemoUsers() {
  return request(`${API_BASE_URL}/ml/demo-users`);
}

export async function fetchMLUserProfile() {
  return request(`${API_BASE_URL}/ml/user-profile`);
}

export async function linkMovieLensUser(movielens_user_id) {
  return request(`${API_BASE_URL}/ml/link-movielens-user`, {
    method: "POST",
    body: JSON.stringify({ movielens_user_id })
  });
}

export async function rateMovie(movie_id, rating) {
  return request(`${API_BASE_URL}/ml/rate-movie`, {
    method: "POST",
    body: JSON.stringify({ movie_id, rating })
  });
}

export async function predictRating(movie_id, model = "random_forest", movielens_user_id = null) {
  return request(`${API_BASE_URL}/ml/predict-rating`, {
    method: "POST",
    body: JSON.stringify({ movie_id, model, movielens_user_id })
  });
}

export async function predictClassification(movie_id, model = "decision_tree", movielens_user_id = null) {
  return request(`${API_BASE_URL}/ml/classification/predict`, {
    method: "POST",
    body: JSON.stringify({ movie_id, model, movielens_user_id })
  });
}
