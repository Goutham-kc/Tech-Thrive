from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from pydantic import BaseModel

from .catalog import (
    get_placement_quiz,
    init_db, get_bucket, delete_module,
    add_quiz_question, get_quiz, delete_quiz_question,
)
from .session import create_session, validate_session
from . import loader
from .admin import handle_upload, delete_module_files
from .integrity import get_chunk_hash
from .config import ADMIN_SECRET
from .kpir import ByteKpirEngine

app = FastAPI()


class TruncateIPMiddleware(BaseHTTPMiddleware):
    """
    Truncates the client IP before it can reach any route handler or logger.

    IPv4 — zeroes the last octet:      192.168.1.55  → 192.168.1.0
    IPv6 — keeps the first 3 groups:   2001:db8:85a3::8a2e  → 2001:db8:85a3::

    This is data minimisation, not anonymisation. Render/Vercel edge logs
    still capture the full IP upstream; this only affects what your app sees.
    """
    @staticmethod
    def _truncate(ip: str) -> str:
        if not ip:
            return ip
        if ":" in ip:
            # IPv6 — keep first 3 groups, blank the rest
            groups = ip.split(":")
            return ":".join(groups[:3]) + "::"
        else:
            # IPv4 — zero out the last octet
            parts = ip.split(".")
            if len(parts) == 4:
                return f"{parts[0]}.{parts[1]}.{parts[2]}.0"
        return ip

    async def dispatch(self, request: Request, call_next):
        if request.client:
            truncated = self._truncate(request.client.host)
            request.scope["client"] = (truncated, request.client.port)
        return await call_next(request)


# NOTE: Restrict allow_origins to your frontend domain in production.
app.add_middleware(TruncateIPMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


# -------- Error Handling --------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request format"},
    )


# -------- Models --------

class SessionRequest(BaseModel):
    ghost_id: str


class KpirRequest(BaseModel):
    token: str
    vectors: list[list[int]]
    chunk_index: int


class QuizQuestionRequest(BaseModel):
    admin_key: str
    module_id: int
    question: str
    options: list[str]
    correct: int


class DeleteQuizQuestionRequest(BaseModel):
    admin_key: str


class DeleteModuleRequest(BaseModel):
    admin_key: str


# -------- Public Routes --------

@app.post("/session")
def session(request: SessionRequest):
    token = create_session(request.ghost_id)
    return {"token": token}


@app.get("/catalog")
def catalog(request: Request, topic: str = None, tier: int = None):
    """
    Returns modules that are both in the DB *and* have chunks loaded in memory.

    The PIR engine is built from the in-memory chunk cache (loader.get_chunks()).
    If the catalog returned modules without chunks, the client would generate
    vectors of the wrong length and every /kpir call would fail with a 400.
    Filtering here keeps the two sources of truth permanently in sync.
    """
    print(f"Client IP: {request.client.host}")  # will show truncated IP — remove after testing
    chunks = loader.get_chunks()
    loaded_ids = set(chunks.keys())
    all_modules = get_bucket(topic, tier)
    modules = [m for m in all_modules if m["id"] in loaded_ids]
    return {"modules": modules}


@app.post("/kpir")
def kpir(request: KpirRequest):
    if not validate_session(request.token):
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if not request.vectors:
        raise HTTPException(status_code=400, detail="Empty vector set")

    chunks = loader.get_chunks()
    if not chunks:
        raise HTTPException(status_code=503, detail="No modules loaded on server")

    engine = ByteKpirEngine(chunks)

    n_modules = len(loader.get_chunks())
    for i, v in enumerate(request.vectors):
        if len(v) != n_modules:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Vector {i} has length {len(v)} but server has {n_modules} module(s) loaded. "
                    f"Re-fetch /catalog to get the correct module count before building vectors."
                ),
            )

    try:
        responses = engine.compute(request.vectors, request.chunk_index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"responses": [list(r) for r in responses]}


@app.get("/integrity")
def integrity(module_id: int, chunk_index: int):
    chunks = loader.get_chunks()
    if module_id not in chunks:
        raise HTTPException(status_code=404, detail="Module not found")
    if chunk_index not in chunks[module_id]:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return {"hash": get_chunk_hash(module_id, chunk_index)}


@app.get("/quiz/{module_id}")
def quiz(module_id: int):
    questions = get_quiz(module_id)
    return {"questions": questions}


# -------- Admin Routes --------

@app.get("/admin/modules")
def list_modules(admin_key: str):
    """Returns all modules in the DB for the admin panel — unfiltered by chunk state."""
    if admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")
    chunks = loader.get_chunks()
    loaded_ids = set(chunks.keys())
    all_modules = get_bucket()
    # Tag each module so the admin can see which ones are missing chunk files
    for m in all_modules:
        m["chunks_loaded"] = m["id"] in loaded_ids
    return {"modules": all_modules}


@app.post("/admin/upload")
async def upload_module(
    admin_key: str = Form(...),
    title: str = Form(...),
    topic: str = Form(...),
    tier: int = Form(...),
    file: UploadFile = File(...),
):
    if admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")

    module_id = await handle_upload(file, title, topic, tier)

    # Return full updated catalog so the admin panel can refresh immediately
    return {
        "status": "uploaded",
        "module_id": module_id,
        "modules": get_bucket(),
    }


@app.delete("/admin/modules/{module_id}")
def remove_module(module_id: int, request: DeleteModuleRequest):
    if request.admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")

    deleted = delete_module(module_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Module not found")

    # Remove chunk files from disk and reload the in-memory cache
    delete_module_files(module_id)
    loader.preload_chunks()

    return {"status": "deleted", "modules": get_bucket()}


@app.post("/admin/quiz")
def add_question(request: QuizQuestionRequest):
    if request.admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if len(request.options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 options required")

    if request.correct < 0 or request.correct >= len(request.options):
        raise HTTPException(status_code=400, detail="correct index out of range")

    try:
        question_id = add_quiz_question(
            request.module_id,
            request.question,
            request.options,
            request.correct,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"status": "created", "question_id": question_id}


@app.delete("/admin/quiz/{question_id}")
def delete_question(question_id: int, request: DeleteQuizQuestionRequest):
    if request.admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")

    deleted = delete_quiz_question(question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")

    return {"status": "deleted"}


@app.get("/placement-quiz")
def placement_quiz():
    """
    Returns 2 randomly sampled questions per module across all modules.
    Used once at registration to determine starting unlocks.
    No session token required — the user hasn't completed auth yet.
    """
    questions = get_placement_quiz(questions_per_module=2)
    return {"questions": questions}