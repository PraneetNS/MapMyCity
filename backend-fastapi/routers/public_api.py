"""
Public Read-Only Aggregate Data API — Part 2 (Future Backlog)

PRECONDITION GATE: All endpoints return HTTP 503 unless PUBLIC_API_ENABLED=true.
Do NOT enable until FUTURE_BACKLOG.md Part 2 precondition is confirmed met:
  - >= 500 submissions across >= 3 wards with >= 180 days of history.
  - Run: SELECT COUNT(*), COUNT(DISTINCT ward_id),
           MAX(created_at) - MIN(created_at) AS span FROM submissions;

IMPORTANT: This API exposes ONLY anonymised aggregate data.
  - Never returns individual submission rows
  - Never returns user identifiers of any kind
  - Only cluster counts, resolution stats, and time-bucketed aggregates
  - API key required to track usage and rate-limit scraping

Rate limits (enforced in middleware):
  - Unauthenticated: 0 req/s (must register a key)
  - API key holders: 60 req/min, 1000 req/day
"""

import os
import time
import hashlib
import secrets
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from collections import defaultdict

PUBLIC_API_ENABLED = os.getenv("PUBLIC_API_ENABLED", "false").lower() == "true"

PRECONDITION_MSG = (
    "The public data API is not yet enabled. "
    "See FUTURE_BACKLOG.md Part 2: the platform needs >= 500 submissions "
    "across >= 3 wards spanning >= 180 days before this endpoint is activated. "
    "Set PUBLIC_API_ENABLED=true once confirmed."
)

# ── In-memory API key store (swap for DB table in production) ──────────────────
# Schema: { api_key_hash: { name, email, registered_at, req_count_today, last_reset } }
_API_KEYS: dict = {}

# ── Simple in-process rate limiter (swap for Redis in production) ──────────────
_RATE_BUCKETS: dict = defaultdict(lambda: {"count": 0, "window_start": time.time()})
RATE_LIMIT_PER_MIN = 60
RATE_LIMIT_PER_DAY = 1000


def _gate():
    if not PUBLIC_API_ENABLED:
        raise HTTPException(status_code=503, detail=PRECONDITION_MSG)


def _authenticate(x_api_key: Optional[str]) -> str:
    """Validate API key, return key_hash."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-Api-Key header required. Register at /api/v1/public/register-key")
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    if key_hash not in _API_KEYS:
        raise HTTPException(status_code=403, detail="Invalid API key.")
    return key_hash


def _rate_check(key_hash: str):
    bucket = _RATE_BUCKETS[key_hash]
    now = time.time()
    if now - bucket["window_start"] > 60:
        bucket["count"] = 0
        bucket["window_start"] = now
    bucket["count"] += 1
    if bucket["count"] > RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {RATE_LIMIT_PER_MIN} req/min. See docs/public_api_openapi.yaml for limits.")


# ── Request / Response models ──────────────────────────────────────────────────

class RegisterKeyRequest(BaseModel):
    name: str
    email: str
    intended_use: str   # "research" | "journalism" | "civic_tech" | "other"


class RegisterKeyResponse(BaseModel):
    api_key: str
    message: str


# ── Route handlers (registered in main.py under /api/v1/public) ───────────────

async def register_api_key(data: RegisterKeyRequest):
    """
    POST /api/v1/public/register-key
    Simple, frictionless API key registration — no email verification needed.
    Usage is tracked for abuse detection only. Data is genuinely open.
    """
    _gate()
    raw_key = f"mmc_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    _API_KEYS[key_hash] = {
        "name": data.name,
        "email": data.email,
        "intended_use": data.intended_use,
        "registered_at": time.time(),
    }
    return RegisterKeyResponse(
        api_key=raw_key,
        message=(
            "API key issued. Include it as the X-Api-Key header on all requests. "
            "Rate limit: 60 req/min, 1000 req/day. "
            "Full documentation: /api/v1/public/docs"
        ),
    )


async def get_cluster_counts(
    x_api_key: Optional[str] = Header(default=None),
    ward_id: Optional[str] = Query(default=None, description="Filter to a specific ward"),
    category: Optional[str] = Query(default=None, description="Filter by issue category"),
    period: str = Query(default="30d", description="Time window: 7d | 30d | 90d | 1y"),
    db=None,
):
    """
    GET /api/v1/public/cluster-counts
    Cluster counts by category and ward — never individual submission rows.
    """
    _gate()
    key_hash = _authenticate(x_api_key)
    _rate_check(key_hash)

    from sqlalchemy import text
    period_map = {"7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "1 year"}
    pg_interval = period_map.get(period, "30 days")

    filters = ["c.created_at >= NOW() - INTERVAL :interval"]
    params = {"interval": pg_interval}
    if ward_id:
        filters.append("s.ward_id = :ward_id")
        params["ward_id"] = ward_id
    if category:
        filters.append("s.mission_type = :category")
        params["category"] = category

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT s.mission_type, s.ward_id, COUNT(DISTINCT c.id) AS cluster_count,
                   COUNT(s.id) AS report_count
            FROM clusters c
            JOIN submissions s ON s.cluster_id = c.id
            WHERE {where}
            GROUP BY s.mission_type, s.ward_id
            ORDER BY report_count DESC
        """),
        params,
    )
    results = [
        {
            "category": r[0],
            "ward_id": r[1],
            "cluster_count": r[2],
            "report_count": r[3],
        }
        for r in rows.fetchall()
    ]
    return {
        "period": period,
        "ward_filter": ward_id,
        "category_filter": category,
        "results": results,
        "note": "Aggregate data only. No individual submissions or user identifiers are exposed.",
    }


async def get_resolution_stats(
    x_api_key: Optional[str] = Header(default=None),
    ward_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    period: str = Query(default="90d"),
    db=None,
):
    """
    GET /api/v1/public/resolution-stats
    Resolution-time statistics by category and ward — aggregate only.
    """
    _gate()
    key_hash = _authenticate(x_api_key)
    _rate_check(key_hash)

    from sqlalchemy import text
    period_map = {"7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "1 year"}
    pg_interval = period_map.get(period, "90 days")

    filters = ["re.resolved_at >= NOW() - INTERVAL :interval"]
    params = {"interval": pg_interval}
    if ward_id:
        filters.append("s.ward_id = :ward_id")
        params["ward_id"] = ward_id
    if category:
        filters.append("s.mission_type = :category")
        params["category"] = category

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT
                s.mission_type,
                s.ward_id,
                COUNT(*) AS resolved_count,
                ROUND(AVG(EXTRACT(EPOCH FROM (re.resolved_at - s.created_at)) / 3600)::numeric, 1) AS avg_resolution_hours,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
                    EXTRACT(EPOCH FROM (re.resolved_at - s.created_at)) / 3600)::numeric, 1
                ) AS median_resolution_hours,
                SUM(CASE WHEN re.met_sla THEN 1 ELSE 0 END) AS sla_met_count
            FROM resolution_events re
            JOIN submissions s ON s.id = re.submission_id
            WHERE {where}
            GROUP BY s.mission_type, s.ward_id
            ORDER BY resolved_count DESC
        """),
        params,
    )
    results = [
        {
            "category": r[0],
            "ward_id": r[1],
            "resolved_count": r[2],
            "avg_resolution_hours": float(r[3]) if r[3] else None,
            "median_resolution_hours": float(r[4]) if r[4] else None,
            "sla_met_count": r[5],
            "sla_met_pct": round(r[5] / r[2] * 100, 1) if r[2] else None,
        }
        for r in rows.fetchall()
    ]
    return {
        "period": period,
        "ward_filter": ward_id,
        "category_filter": category,
        "results": results,
        "note": "Aggregate statistics only. Resolution events from municipally-partnered wards only.",
    }


async def get_time_series(
    x_api_key: Optional[str] = Header(default=None),
    ward_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    bucket: str = Query(default="week", description="Bucket: day | week | month"),
    period: str = Query(default="1y"),
    db=None,
):
    """
    GET /api/v1/public/time-series
    Report volume over time — useful for seasonal spike analysis.
    """
    _gate()
    key_hash = _authenticate(x_api_key)
    _rate_check(key_hash)

    from sqlalchemy import text
    period_map = {"7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "1 year"}
    bucket_map = {"day": "day", "week": "week", "month": "month"}
    pg_interval = period_map.get(period, "1 year")
    pg_bucket = bucket_map.get(bucket, "week")

    filters = ["created_at >= NOW() - INTERVAL :interval"]
    params = {"interval": pg_interval}
    if ward_id:
        filters.append("ward_id = :ward_id")
        params["ward_id"] = ward_id
    if category:
        filters.append("mission_type = :category")
        params["category"] = category

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT
                DATE_TRUNC(:bucket, created_at) AS bucket,
                mission_type,
                ward_id,
                COUNT(*) AS report_count
            FROM submissions
            WHERE {where}
            GROUP BY 1, 2, 3
            ORDER BY 1 DESC
        """),
        {"bucket": pg_bucket, **params},
    )
    results = [
        {
            "bucket": str(r[0]),
            "category": r[1],
            "ward_id": r[2],
            "report_count": r[3],
        }
        for r in rows.fetchall()
    ]
    return {"bucket_size": bucket, "period": period, "results": results}
