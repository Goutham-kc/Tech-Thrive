from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from .kpir import compute_masked_dot
from .config import CHUNK_SIZE

app = FastAPI()

# --- MOCK DATA (temporary RAM data) ---
MOCK_DATA = {
    module_id: {
        chunk_index: np.random.randint(0, 255, CHUNK_SIZE).tolist()
        for chunk_index in range(3)
    }
    for module_id in range(1, 11)
}
# --------------------------------------

class KpirRequest(BaseModel):
    subset_ids: list[int]
    masked_vector: list[int]
    chunk_index: int


@app.get("/catalog")
def get_catalog():
    return {"modules": list(MOCK_DATA.keys())}


@app.post("/kpir")
def kpir(request: KpirRequest):
    matrix = []

    for module_id in request.subset_ids:
        matrix.append(MOCK_DATA[module_id][request.chunk_index])

    result = compute_masked_dot(request.masked_vector, matrix)

    return {"data": result}