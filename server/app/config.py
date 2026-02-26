from pathlib import Path
import os

BASE_DIR = Path(__file__).parent

CHUNK_SIZE = 4096
K = 3
N_MODULES = 20
MAX_CHUNKS = 20

DB_PATH = BASE_DIR / "data" / "catalog.db"
CHUNK_DIR = BASE_DIR / "data" / "chunks"
UPLOAD_DIR = BASE_DIR / "uploads"

MODULES_RAW_DIR = BASE_DIR / "modules" / "raw"
MODULES_CHUNKED_DIR = BASE_DIR / "modules" / "chunked"
MODULES_VIDEO_DIR = BASE_DIR / "modules" / "video"

SESSION_TTL = 60
VIDEO_SESSION_TTL = 3600

BROTLI_QUALITY = 6

DAILY_SALT_ROTATION = 86400

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "change-this-before-deploy")