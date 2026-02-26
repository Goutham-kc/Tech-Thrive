import hashlib
from .loader import CHUNKS


def get_chunk_hash(module_id, chunk_index):
    data = bytes(CHUNKS[module_id][chunk_index])
    return hashlib.sha256(data).hexdigest()