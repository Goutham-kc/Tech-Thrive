import numpy as np
from .config import CHUNK_SIZE, K, N_MODULES


class ByteKpirEngine:
    def __init__(self, cache: dict):
        self.cache = cache
        self.module_ids = sorted(cache.keys())
        self.n_modules = len(self.module_ids)

        if self.n_modules != N_MODULES:
            raise ValueError(f"Expected {N_MODULES} modules, got {self.n_modules}")

    def compute(self, vectors: list[list[int]], chunk_idx: int) -> list[bytes]:
        if len(vectors) != K:
            raise ValueError(f"Expected {K} vectors, got {len(vectors)}")

        for i, v in enumerate(vectors):
            if len(v) != self.n_modules:
                raise ValueError(f"Vector {i} length {len(v)} != {self.n_modules}")
            if any(val < 0 or val > 255 for val in v):
                raise ValueError(f"Vector {i} contains values outside Z_256")

        chunks = []
        for module_id in self.module_ids:
            if chunk_idx not in self.cache[module_id]:
                raise ValueError(f"Chunk {chunk_idx} not found in module {module_id}")

            chunk = bytes(self.cache[module_id][chunk_idx])

            if len(chunk) < CHUNK_SIZE:
                chunk += bytes(CHUNK_SIZE - len(chunk))

            chunks.append(np.frombuffer(chunk, dtype=np.uint8))

        M = np.stack(chunks).astype(np.int32)

        responses = []
        for v in vectors:
            vec = np.array(v, dtype=np.int32)
            result = (vec @ M) % 256
            responses.append(result.astype(np.uint8).tobytes())

        return responses