import sqlite3
from .config import DB_PATH


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            topic TEXT,
            tier INTEGER,
            chunk_count INTEGER
        )
    """)

    conn.commit()
    conn.close()


def add_module(title, topic, tier, chunk_count):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO modules (title, topic, tier, chunk_count) VALUES (?, ?, ?, ?)",
        (title, topic, tier, chunk_count)
    )

    conn.commit()
    conn.close()


def get_next_module_id():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT MAX(id) FROM modules")
    result = cursor.fetchone()[0]

    conn.close()

    return 1 if result is None else result + 1


def get_bucket(topic=None, tier=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = "SELECT id, title, topic, tier FROM modules WHERE 1=1"
    params = []

    if topic:
        query += " AND topic=?"
        params.append(topic)

    if tier:
        query += " AND tier=?"
        params.append(tier)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {"id": r[0], "title": r[1], "topic": r[2], "tier": r[3]}
        for r in rows
    ]