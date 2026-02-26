import secrets
import time

SESSIONS = {}


def create_session(ghost_id):
    token = secrets.token_hex(16)
    SESSIONS[token] = {
        "ghost_id": ghost_id,
        "expires": time.time() + 60
    }
    return token


def validate_session(token):
    session = SESSIONS.get(token)

    if not session:
        return False

    if time.time() > session["expires"]:
        del SESSIONS[token]
        return False

    return True