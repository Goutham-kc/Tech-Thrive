import os
import shutil
import pathlib
from fastapi import UploadFile
from .config import UPLOAD_DIR, CHUNK_DIR
from .preprocess import process_module
from .loader import preload_chunks

os.makedirs(UPLOAD_DIR, exist_ok=True)


async def handle_upload(file: UploadFile, title: str, topic: str, tier: int) -> int:
    """
    Save the uploaded file, process it through the PIR pipeline, and reload
    the in-memory chunk cache.  Returns the new module_id.
    """
    # Sanitize filename — strip any directory components to prevent path traversal
    safe_name = pathlib.Path(file.filename).name
    if not safe_name:
        safe_name = "upload"

    file_path = os.path.join(UPLOAD_DIR, safe_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # process_module now handles DB insertion itself and returns the real id
    module_id, chunk_count, compressed_size = process_module(
        file_path, title, topic, tier
    )

    # Reload the chunk cache so the new module is immediately queryable
    preload_chunks()

    return module_id


def delete_module_files(module_id: int) -> None:
    """Remove the chunk folder for a deleted module."""
    folder = os.path.join(CHUNK_DIR, str(module_id))
    if os.path.isdir(folder):
        shutil.rmtree(folder)