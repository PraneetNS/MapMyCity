"""
Multi-device Session Management API — Part 1 (Future Backlog)

PRECONDITION GATE: All endpoints return HTTP 503 unless MULTI_DEVICE_ENABLED=true.
Do NOT enable until FUTURE_BACKLOG.md Part 1 precondition is confirmed met:
  >= 10 distinct users reporting cross-device continuity loss within 60 days.
"""

import os
import secrets
from typing import Optional
from pydantic import BaseModel

MULTI_DEVICE_ENABLED = os.getenv("MULTI_DEVICE_ENABLED", "false").lower() == "true"

PRECONDITION_ERROR = {
    "detail": (
        "Multi-device sync is not yet enabled. "
        "See FUTURE_BACKLOG.md Part 1 for the precondition that must be met "
        "before setting MULTI_DEVICE_ENABLED=true."
    )
}


# ── Pydantic models ────────────────────────────────────────────────────────────

class RegisterSessionRequest(BaseModel):
    user_id: str
    device_fingerprint: str   # SHA-256(device_model + os_version + install_id)
    device_label: Optional[str] = None
    platform: str             # "ios" | "android" | "web"
    app_version: Optional[str] = None
    push_token: Optional[str] = None


class RevokeSessionRequest(BaseModel):
    session_id_to_revoke: str


class PushSyncedHistoryRequest(BaseModel):
    local_draft_id: str
    submission_id: Optional[str] = None
    mission_type: str
    summary: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    origin_device_fingerprint: Optional[str] = None


# ── Route handlers (registered in main.py) ─────────────────────────────────────

async def register_device_session(data: RegisterSessionRequest, db):
    """
    POST /users/{user_id}/sessions
    Register a new device session. Called on login on a new device.
    Returns a session_token to be stored in iOS Keychain / Android Keystore.
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    if data.platform not in ("ios", "android", "web"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="platform must be ios, android, or web")

    from sqlalchemy import text
    session_token = secrets.token_urlsafe(48)
    row = await db.execute(
        text("""
            INSERT INTO user_device_sessions
                (user_id, device_fingerprint, device_label, platform,
                 app_version, push_token, session_token)
            VALUES (:uid, :fp, :label, :platform, :av, :pt, :token)
            RETURNING id, device_label, platform, created_at
        """),
        {
            "uid": data.user_id,
            "fp": data.device_fingerprint,
            "label": data.device_label or f"{data.platform.title()} Device",
            "platform": data.platform,
            "av": data.app_version,
            "pt": data.push_token,
            "token": session_token,
        },
    )
    await db.commit()
    r = row.fetchone()
    return {
        "session_id": str(r[0]),
        "session_token": session_token,
        "user_id": data.user_id,
        "device_label": r[1],
        "platform": r[2],
        "created_at": str(r[3]),
    }


async def list_device_sessions(user_id: str, db):
    """
    GET /users/{user_id}/sessions
    List all active sessions — rendered in Settings > Devices signed in.
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    from sqlalchemy import text
    rows = await db.execute(
        text("""
            SELECT id, device_label, platform, app_version, last_seen_at, created_at
            FROM user_device_sessions
            WHERE user_id = :uid AND is_active = TRUE
            ORDER BY last_seen_at DESC
        """),
        {"uid": user_id},
    )
    sessions = [
        {
            "session_id": str(r[0]),
            "device_label": r[1],
            "platform": r[2],
            "app_version": r[3],
            "last_seen_at": str(r[4]),
            "created_at": str(r[5]),
        }
        for r in rows.fetchall()
    ]
    return {"sessions": sessions, "total": len(sessions)}


async def revoke_device_session(user_id: str, session_id: str, db):
    """
    DELETE /users/{user_id}/sessions/{session_id}
    Remote sign-out: revoke a specific session (e.g. a lost device).
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    from sqlalchemy import text
    await db.execute(
        text("""
            UPDATE user_device_sessions
            SET is_active = FALSE, revoked_at = NOW()
            WHERE id = :sid AND user_id = :uid
        """),
        {"sid": session_id, "uid": user_id},
    )
    await db.commit()
    return {"revoked": True, "session_id": session_id}


async def revoke_all_sessions(user_id: str, db):
    """
    DELETE /users/{user_id}/sessions
    Sign out of all devices — used for account security or deletion prep.
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    from sqlalchemy import text
    await db.execute(
        text("""
            UPDATE user_device_sessions
            SET is_active = FALSE, revoked_at = NOW()
            WHERE user_id = :uid AND is_active = TRUE
        """),
        {"uid": user_id},
    )
    await db.commit()
    return {"revoked_all": True, "user_id": user_id}


async def push_synced_history(user_id: str, data: PushSyncedHistoryRequest, db):
    """
    POST /users/{user_id}/synced-history
    Mirror a completed (synced) submission server-side so other devices can see it.
    Drafts in-progress remain device-local by design — only call after status=synced.
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    from sqlalchemy import text
    row = await db.execute(
        text("""
            INSERT INTO user_synced_history
                (user_id, submission_id, local_draft_id, mission_type, summary,
                 latitude, longitude, origin_device_fingerprint)
            VALUES (:uid, :sid, :ldid, :mt, :summary, :lat, :lng, :fp)
            ON CONFLICT DO NOTHING
            RETURNING id, synced_at
        """),
        {
            "uid": user_id,
            "sid": data.submission_id,
            "ldid": data.local_draft_id,
            "mt": data.mission_type,
            "summary": data.summary,
            "lat": data.latitude,
            "lng": data.longitude,
            "fp": data.origin_device_fingerprint,
        },
    )
    await db.commit()
    r = row.fetchone()
    return {"synced": True, "id": str(r[0]) if r else None}


async def get_synced_history(user_id: str, limit: int = 50, db=None):
    """
    GET /users/{user_id}/synced-history
    Retrieve server-side history mirror for cross-device continuity display.
    """
    if not MULTI_DEVICE_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=PRECONDITION_ERROR["detail"])

    from sqlalchemy import text
    rows = await db.execute(
        text("""
            SELECT id, local_draft_id, mission_type, summary,
                   latitude, longitude, synced_at
            FROM user_synced_history
            WHERE user_id = :uid
            ORDER BY synced_at DESC
            LIMIT :limit
        """),
        {"uid": user_id, "limit": min(limit, 200)},
    )
    history = [
        {
            "id": str(r[0]),
            "local_draft_id": r[1],
            "mission_type": r[2],
            "summary": r[3],
            "latitude": r[4],
            "longitude": r[5],
            "synced_at": str(r[6]),
        }
        for r in rows.fetchall()
    ]
    return {"history": history, "total": len(history)}
