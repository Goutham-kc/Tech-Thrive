import numpy as np
from .config import CHUNK_SIZE


class ByteKpirEngine:
    def __init__(self, cache: dict):
        """
        cache format:
        {
            module_id: {
                chunk_index: [byte values]
            }
        }
        """
        self.cache = cache
        self.module_ids = sorted(cache.keys())
        self.n_modules = len(self.module_ids)

    def compute(self, vectors: list[list[int]], chunk_idx: int) -> list[bytes]:

        # Build matrix M (N x CHUNK_SIZE)
        chunks = []

        for module_id in self.module_ids:

            if chunk_idx not in self.cache[module_id]:
                raise ValueError("Chunk not found")

            chunk = bytes(self.cache[module_id][chunk_idx])

            if len(chunk) < CHUNK_SIZE:
                chunk += bytes(CHUNK_SIZE - len(chunk))

            chunks.append(np.frombuffer(chunk, dtype=np.uint8))

        M = np.stack(chunks).astype(np.int32)  # shape (N, CHUNK_SIZE)

        responses = []

        for v in vectors:
            vec = np.array(v, dtype=np.int32)  # 0–255

            result = (vec @ M) % 256
            responses.append(result.astype(np.uint8).tobytes())

        return responses