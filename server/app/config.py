from pathlib import Path
import os
import warnings

# server/ directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Core PIR settings
CHUNK_SIZE = 4096
K = 3

# Paths
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "catalog.db"
CHUNK_DIR = DATA_DIR / "chunks"
UPLOAD_DIR = BASE_DIR / "uploads"

# Session settings — 15 minutes gives enough headroom for large multi-chunk downloads
SESSION_TTL = 900  # seconds

# Compression — gzip level (1=fast, 9=best)
GZIP_LEVEL = 6

# Security
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "kc")
