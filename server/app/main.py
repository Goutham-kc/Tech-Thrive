from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request
from pydantic import BaseModel

from .catalog import init_db, get_bucket
from .session import create_session, validate_session
from .loader import CHUNKS
from .admin import handle_upload
from .integrity import get_chunk_hash
from .config import ADMIN_SECRET
from .kpir import ByteKpirEngine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# -------- Error Handling --------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc):
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request format"}
    )


# -------- Models --------

class SessionRequest(BaseModel):
    ghost_id: str


class KpirRequest(BaseModel):
    token: str
    vectors: list[list[int]]
    chunk_index: int


# -------- Routes --------

@app.post("/session")
def session(request: SessionRequest):
    token = create_session(request.ghost_id)
    return {"token": token}


@app.get("/catalog")
def catalog(topic: str = None, tier: int = None):
    modules = get_bucket(topic, tier)
    return {"modules": modules}


@app.post("/kpir")
def kpir(request: KpirRequest):

    if not validate_session(request.token):
        raise HTTPException(status_code=401, detail="Invalid session")

    if len(request.vectors) == 0:
        raise HTTPException(status_code=400, detail="Empty vector set")

    engine = ByteKpirEngine(CHUNKS)

    try:
        responses = engine.compute(
            request.vectors,
            request.chunk_index
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid chunk request")

    return {
        "responses": [list(r) for r in responses]
    }


@app.get("/integrity")
def integrity(module_id: int, chunk_index: int):

    if module_id not in CHUNKS:
        raise HTTPException(status_code=404, detail="Module not found")

    if chunk_index not in CHUNKS[module_id]:
        raise HTTPException(status_code=404, detail="Chunk not found")

    return {
        "hash": get_chunk_hash(module_id, chunk_index)
    }


@app.post("/admin/upload")
async def upload_module(
    admin_key: str = Form(...),
    title: str = Form(...),
    topic: str = Form(...),
    tier: int = Form(...),
    file: UploadFile = File(...)
):
    if admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")

    module_id = handle_upload(file, title, topic, tier)

    return {"status": "uploaded", "module_id": module_id}