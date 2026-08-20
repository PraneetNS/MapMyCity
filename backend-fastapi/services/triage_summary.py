"""
AI-assisted Moderator Triage Summary Generator
Generates grounded, factual 1-line cluster summaries for municipal administrators.
Uses metadata strictly to avoid hallucination; includes in-memory batch caching.
"""

import os
import time
from typing import Dict, Any, Optional

# In-memory triage summary cache: cluster_id -> (summary, timestamp, sub_count)
_TRIAGE_SUMMARY_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour TTL unless submission count changes

def generate_grounded_triage_summary(
    cluster_id: str,
    mission_type: str,
    submission_count: int,
    first_reported_at: Optional[str] = None,
    last_reported_at: Optional[str] = None,
    ward: Optional[str] = None,
    flags_count: int = 0,
    night_ratio: float = 0.0,
    landmark: Optional[str] = None,
    force_refresh: bool = False
) -> str:
    """
    Produces a single, dense, factual triage line strictly grounded in input metadata.
    Avoids speculation and hallucination.
    """
    cluster_key = str(cluster_id)
    cached = _TRIAGE_SUMMARY_CACHE.get(cluster_key)
    now = time.time()

    if (
        not force_refresh
        and cached
        and cached.get("sub_count") == submission_count
        and (now - cached.get("timestamp", 0)) < CACHE_TTL_SECONDS
    ):
        return cached["summary"]

    # Calculate active duration in human terms
    duration_str = "recently reported"
    if first_reported_at and last_reported_at:
        try:
            from datetime import datetime
            dt_first = datetime.fromisoformat(str(first_reported_at).replace("Z", "+00:00"))
            dt_last = datetime.fromisoformat(str(last_reported_at).replace("Z", "+00:00"))
            delta_days = max(1, (dt_last - dt_first).days)
            if delta_days >= 30:
                duration_str = f"active for ~{delta_days // 30} month{'s' if delta_days >= 60 else ''}"
            elif delta_days >= 7:
                duration_str = f"active for ~{delta_days // 7} week{'s' if delta_days >= 14 else ''}"
            elif delta_days > 1:
                duration_str = f"active for {delta_days} days"
            else:
                duration_str = "reported within 24h"
        except Exception:
            duration_str = "active recently"

    # Category name formatting
    cat_name = mission_type.replace("_", " ").capitalize() if mission_type else "Civic issue"
    
    # Reports count & timing descriptor
    parts = []
    
    # 1. Report volume & duration
    parts.append(f"{submission_count} report{'s' if submission_count > 1 else ''} ({duration_str})")
    
    # 2. Timing profile
    if night_ratio >= 0.6:
        parts.append("mostly night-time")
    elif night_ratio <= 0.2 and submission_count >= 3:
        parts.append("daytime peak")

    # 3. Location context
    loc_part = ""
    if landmark:
        loc_part = f"near {landmark}"
    elif ward:
        loc_part = f"in {ward}"
    
    if loc_part:
        parts.append(loc_part)

    # 4. Critical flags / severity context
    if flags_count > 0:
        parts.append(f"{flags_count} flagged anomaly")
    
    # Formulate strictly grounded factual sentence
    summary = f"{cat_name}: " + ", ".join(parts) + "."

    # Update cache
    _TRIAGE_SUMMARY_CACHE[cluster_key] = {
        "summary": summary,
        "timestamp": now,
        "sub_count": submission_count
    }

    return summary


def batch_refresh_cluster_summaries(clusters: list) -> Dict[str, str]:
    """
    Batch helper to refresh summaries across a list of cluster dicts.
    """
    results = {}
    for c in clusters:
        cid = str(c.get("id", ""))
        if not cid:
            continue
        summary = generate_grounded_triage_summary(
            cluster_id=cid,
            mission_type=c.get("mission_type", "civic_issue"),
            submission_count=c.get("submission_count", 1),
            first_reported_at=c.get("first_reported_at"),
            last_reported_at=c.get("last_reported_at"),
            ward=c.get("ward") or c.get("ward_name"),
            flags_count=c.get("flags_count", 0),
            night_ratio=c.get("night_ratio", 0.0),
            landmark=c.get("landmark")
        )
        results[cid] = summary
    return results
