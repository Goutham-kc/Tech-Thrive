import secrets
import time
from .config import SESSION_TTL

SESSIONS: dict[str, dict] = {}


def _cleanup_expired() -> None:
    """Remove expired sessions to prevent unbounded memory growth."""
    now = time.time()
    expired = [tok for tok, s in SESSIONS.items() if now > s["expires"]]
    for tok in expired:
        del SESSIONS[tok]


def create_session(ghost_id: str) -> str:
    _cleanup_expired()
    token = secrets.token_hex(32)
    SESSIONS[token] = {
        "ghost_id": ghost_id,
        "expires": time.time() + SESSION_TTL,
    }
    return token


def validate_session(token: str) -> bool:
    session = SESSIONS.get(token)
    if not session:
        return False
    if time.time() > session["expires"]:
        del SESSIONS[token]
        return False
    # Slide the expiry window on each valid use so active downloads don't expire
    session["expires"] = time.time() + SESSION_TTL
    return True