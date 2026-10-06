import os
from pathlib import Path

# Paths configuration
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Check data directory candidates
DATA_DIR_PRIMARY = ROOT_DIR / "data"
DATA_DIR_SECONDARY = BASE_DIR / "data"

if DATA_DIR_PRIMARY.exists():
    DATA_DIR = DATA_DIR_PRIMARY
else:
    DATA_DIR = DATA_DIR_SECONDARY

MOVIES_CSV = DATA_DIR / "movies.csv"
RATINGS_CSV = DATA_DIR / "ratings.csv"

# Recommendation Algorithm Weights (Configurable)
# Hybrid Score = (CONTENT_WEIGHT * Content Score) + (COLLABORATIVE_WEIGHT * Collaborative Score)
CONTENT_WEIGHT = 0.4
COLLABORATIVE_WEIGHT = 0.6

# Collaborative filtering dataset pruning threshold for high speed & memory efficiency
MIN_MOVIE_RATINGS_FOR_COLLAB = 500  # Top ~5400 most rated movies
MAX_USERS_FOR_COLLAB = 5000         # Top active users for high-precision item matrix

# Authentication and persistence configuration
DATABASE_URL = os.getenv("MOVIEMIND_DATABASE_URL", "sqlite:///moviemind.db")
JWT_ALGORITHM = os.getenv("MOVIEMIND_JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("MOVIEMIND_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("MOVIEMIND_FRONTEND_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
    if origin.strip()
]


def get_jwt_secret() -> str:
    return os.getenv("MOVIEMIND_JWT_SECRET", "moviemind_jwt_secret_key_dwm_project_2026")

