import os
import pathlib
import gzip
from .config import CHUNK_SIZE, CHUNK_DIR
from .catalog import add_module


def process_module(path: str, title: str, topic: str, tier: int) -> tuple[int, int, int]:
    """
    Compress and chunk a module file.

    The DB row is inserted FIRST so we use the real AUTOINCREMENT id as the
    chunk folder name — eliminating the TOCTOU race condition and any
    divergence between the filesystem and the database.

    Returns (module_id, chunk_count, compressed_size).
    """
    safe_filename = pathlib.Path(path).name

    with open(path, "rb") as f:
        raw = f.read()

    compressed = gzip.compress(raw, compresslevel=6)
    compressed_size = len(compressed)

    chunks = [
        compressed[i:i + CHUNK_SIZE]
        for i in range(0, compressed_size, CHUNK_SIZE)
    ]
    chunk_count = len(chunks)

    # Insert row first — DB assigns the real id
    module_id = add_module(title, topic, tier, chunk_count, compressed_size, safe_filename)

    # Write chunks under the real DB id
    module_folder = os.path.join(CHUNK_DIR, str(module_id))
    os.makedirs(module_folder, exist_ok=True)

    for idx, chunk in enumerate(chunks):
        with open(os.path.join(module_folder, f"{idx}.bin"), "wb") as f:
            f.write(chunk)

    return module_id, chunk_count, compressed_size