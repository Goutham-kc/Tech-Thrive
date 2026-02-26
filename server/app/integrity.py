import hashlib
from .loader import get_chunks


def get_chunk_hash(module_id: int, chunk_index: int) -> str:
    data = get_chunks()[module_id][chunk_index]  # already bytes
    return hashlib.sha256(data).hexdigest()