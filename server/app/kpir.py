import numpy as np
from .config import CHUNK_SIZE, K


class ByteKpirEngine:
    def __init__(self, cache: dict[int, dict[int, bytes]]):
        self.cache = cache
        self.module_ids = sorted(cache.keys())
        self.n_modules = len(self.module_ids)

        if self.n_modules == 0:
            raise ValueError("No modules loaded in cache")

    def compute(self, vectors: list[list[int]], chunk_idx: int) -> list[bytes]:
        """
        Each vector v in vectors selects a linear combination of chunks over Z_256.

        NOTE: Privacy holds only when each of the k vectors is sent to a
        separate, non-colluding server.  In this single-server deployment the
        /kpir endpoint processes all k vectors together; the server can
        observe v0+v1+v2 = e_i and determine the queried index.  This is
        intentional for the current demo/single-server setup.  To restore the
        full information-theoretic privacy guarantee, deploy three independent
        server instances and send one vector to each.
        """
        if len(vectors) != K:
            raise ValueError(f"Expected {K} vectors, got {len(vectors)}")

        for i, v in enumerate(vectors):
            if len(v) != self.n_modules:
                raise ValueError(
                    f"Vector {i} length {len(v)} != n_modules {self.n_modules}"
                )
            if any(val < 0 or val > 255 for val in v):
                raise ValueError(f"Vector {i} contains values outside Z_256")

        # Build the module matrix M: shape (n_modules, CHUNK_SIZE)
        #
        # Modules have different lengths, so some won't have chunk_idx at all.
        # A missing chunk means that module ends before this index — treat it
        # as all-zeros so it contributes nothing to the dot product.  This is
        # mathematically correct: the client recovers the target module's real
        # chunk, and shorter modules simply don't interfere.
        chunks = []
        for module_id in self.module_ids:
            chunk = self.cache[module_id].get(chunk_idx, b'')

            # Pad to CHUNK_SIZE (handles both missing chunks and short last chunks)
            if len(chunk) < CHUNK_SIZE:
                chunk = chunk + bytes(CHUNK_SIZE - len(chunk))

            chunks.append(np.frombuffer(chunk, dtype=np.uint8))

        M = np.stack(chunks).astype(np.int32)  # (n_modules, CHUNK_SIZE)

        # For each query vector compute v @ M mod 256
        responses = []
        for v in vectors:
            vec = np.array(v, dtype=np.int32)
            result = (vec @ M) % 256
            responses.append(result.astype(np.uint8).tobytes())

        return responses