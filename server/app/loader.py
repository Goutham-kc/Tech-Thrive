import os
from .config import CHUNK_DIR

CHUNKS = {}


def preload_chunks():
    global CHUNKS
    CHUNKS = {}

    if not os.path.exists(CHUNK_DIR):
        return

    for module_id in os.listdir(CHUNK_DIR):
        module_path = os.path.join(CHUNK_DIR, module_id)

        if not os.path.isdir(module_path):
            continue

        CHUNKS[int(module_id)] = {}

        for file in os.listdir(module_path):
            if not file.endswith(".bin"):
                continue

            chunk_index = int(file.replace(".bin", ""))
            file_path = os.path.join(module_path, file)

            with open(file_path, "rb") as f:
                CHUNKS[int(module_id)][chunk_index] = list(f.read())


preload_chunks()