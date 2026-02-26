from pathlib import Path
import os

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

# Session settings
SESSION_TTL = 60  # seconds

# Compression
BROTLI_QUALITY = 6

# Security
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "change-this-before-deploy")