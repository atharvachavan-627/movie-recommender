export const genresOf = (m) =>
  m?.genres_list || (m?.genres ? m.genres.split("|").filter(Boolean) : []);

// Deterministic soft color per title, used for the poster-style banner.
export function posterStyle(title = "") {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(140deg, hsl(${h} 80% 94%) 0%, hsl(${(h + 38) % 360} 72% 85%) 100%)`,
    color: `hsl(${h} 42% 32%)`,
  };
}

export const initials = (title = "") =>
  title.replace(/\(\d{4}\)\s*$/, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();

export const cleanTitle = (title = "") => title.replace(/\s*\(\d{4}\)\s*$/, "");
export const pct = (v) => `${(Math.min(1, Math.max(0, v || 0)) * 100).toFixed(1)}%`;
