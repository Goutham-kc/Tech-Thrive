import os
from .config import CHUNK_DIR

# module_id (int) -> chunk_index (int) -> raw bytes
CHUNKS: dict[int, dict[int, bytes]] = {}


def preload_chunks() -> None:
    global CHUNKS
    CHUNKS = {}

    if not os.path.exists(CHUNK_DIR):
        return

    for module_id_str in os.listdir(CHUNK_DIR):
        module_path = os.path.join(CHUNK_DIR, module_id_str)

        if not os.path.isdir(module_path):
            continue

        try:
            module_id = int(module_id_str)
        except ValueError:
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
                CHUNKS[module_id][chunk_index] = f.read()  # store as bytes, not list


preload_chunks()


def get_chunks() -> dict[int, dict[int, bytes]]:
    """Always returns the current CHUNKS dict."""
    return CHUNKS