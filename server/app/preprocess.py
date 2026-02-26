import os
import brotli
from .config import CHUNK_SIZE, CHUNK_DIR
from .catalog import get_next_module_id


def process_module(path):
    with open(path, "rb") as f:
        raw = f.read()

    compressed = brotli.compress(raw)

    module_id = get_next_module_id()
    module_folder = os.path.join(CHUNK_DIR, str(module_id))
    os.makedirs(module_folder, exist_ok=True)

    chunks = [
        compressed[i:i + CHUNK_SIZE]
        for i in range(0, len(compressed), CHUNK_SIZE)
    ]

    for idx, chunk in enumerate(chunks):
        with open(os.path.join(module_folder, f"{idx}.bin"), "wb") as f:
            f.write(chunk)

    return module_id, len(chunks)