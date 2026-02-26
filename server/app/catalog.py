import sqlite3
import os
import json
from .config import DB_PATH


def init_db():
    # Use Path.mkdir so we never get a bare empty-string dirname on Windows
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")   # safer concurrent writes
    conn.execute("PRAGMA foreign_keys=ON")
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            topic TEXT,
            tier INTEGER,
            chunk_count INTEGER,
            compressed_size INTEGER,
            filename TEXT
        )
    """)

    # Migration: add filename column to existing databases that were created
    # before this column existed (ALTER TABLE ignores the error if it already exists).
    existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(modules)")}
    if "filename" not in existing_cols:
        cursor.execute("ALTER TABLE modules ADD COLUMN filename TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL,
            correct INTEGER NOT NULL,
            FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
        )
    """)

    # Index for fast quiz lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_quizzes_module_id ON quizzes(module_id)
    """)

    conn.commit()
    conn.close()


def add_module(title: str, topic: str, tier: int, chunk_count: int, compressed_size: int, filename: str) -> int:
    """Insert a module row and return the real AUTOINCREMENT id."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO modules (title, topic, tier, chunk_count, compressed_size, filename)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (title, topic, tier, chunk_count, compressed_size, filename)
    )

    module_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return module_id


def get_bucket(topic=None, tier=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
SELECT id, title, topic, tier, chunk_count, compressed_size, filename
FROM modules
WHERE 1=1
"""
    params = []

    if topic:
        query += " AND topic=?"
        params.append(topic)

    if tier:
        query += " AND tier=?"
        params.append(tier)

    query += " ORDER BY id ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "title": r[1],
            "topic": r[2],
            "tier": r[3],
            "chunk_count": r[4],
            "compressed_size": r[5],
            "filename": r[6]
        }
        for r in rows
    ]


def delete_module(module_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM modules WHERE id=?", (module_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted > 0


def add_quiz_question(module_id, question, options, correct):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM modules WHERE id=?", (module_id,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Module {module_id} does not exist")

    cursor.execute(
        """
        INSERT INTO quizzes (module_id, question, options, correct)
        VALUES (?, ?, ?, ?)
        """,
        (module_id, question, json.dumps(options), correct)
    )

    conn.commit()
    question_id = cursor.lastrowid
    conn.close()
    return question_id


def get_quiz(module_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, question, options, correct
        FROM quizzes
        WHERE module_id=?
        ORDER BY id ASC
        """,
        (module_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "question": r[1],
            "options": json.loads(r[2]),
            "correct": r[3]
        }
        for r in rows
    ]


def delete_quiz_question(question_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM quizzes WHERE id=?", (question_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return deleted > 0