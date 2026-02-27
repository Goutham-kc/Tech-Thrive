import os
import sqlite3
from .config import CHUNK_DIR, DB_PATH

# module_id (int) -> chunk_index (int) -> raw bytes
CHUNKS: dict[int, dict[int, bytes]] = {}


def _get_valid_module_ids() -> set[int]:
    """Return the set of module IDs currently in the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT id FROM modules").fetchall()
        conn.close()
        return {row[0] for row in rows}
    except Exception:
        return set()


def preload_chunks() -> None:
    global CHUNKS
    CHUNKS = {}

    if not os.path.exists(CHUNK_DIR):
        return

    valid_ids = _get_valid_module_ids()

    for module_id_str in os.listdir(CHUNK_DIR):
        module_path = os.path.join(CHUNK_DIR, module_id_str)

        if not os.path.isdir(module_path):
            continue

        try:
            module_id = int(module_id_str)
        except ValueError:
            continue

        # Skip stale folders whose DB row no longer exists
        if module_id not in valid_ids:
            continue

        CHUNKS[module_id] = {}

        for file in os.listdir(module_path):
            if not file.endswith(".bin"):
                continue

            try:
                chunk_index = int(file[:-4])  # strip ".bin"
            except ValueError:
                continue

            file_path = os.path.join(module_path, file)

            with open(file_path, "rb") as f:
                CHUNKS[module_id][chunk_index] = f.read()


preload_chunks()


def get_chunks() -> dict[int, dict[int, bytes]]:
    """Always returns the current CHUNKS dict."""
    return CHUNKS