import os
from fastapi import UploadFile
from .config import UPLOAD_DIR
from preprocess import process_module
from .catalog import add_module
from .loader import preload_chunks

os.makedirs(UPLOAD_DIR, exist_ok=True)


def handle_upload(file: UploadFile, title, topic, tier):
    path = os.path.join(UPLOAD_DIR, file.filename)

    with open(path, "wb") as f:
        f.write(file.file.read())

    module_id, chunk_count = process_module(path)

    add_module(title, topic, tier, chunk_count)

    preload_chunks()

    return module_id