from fastapi.middleware.cors import CORSMiddleware
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/catalog")
def get_catalog():
    return {"modules": list(MOCK_DATA.keys())}