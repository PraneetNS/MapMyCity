"""
Server-side Note Improvement Suggestion Service
Refines short or ambiguous civic report notes into clear, professional phrasing.
Includes sliding-window per-user rate limiting (max 10 requests/hour).
"""

import time
from typing import Dict, Any, Tuple

# In-memory rate limiting store: user_id -> list of timestamps
_USER_RATE_LIMITS: Dict[str, list] = {}
MAX_REQUESTS_PER_HOUR = 10
WINDOW_SECONDS = 3600

# Civic domain category templates for contextual refinement
CATEGORY_PHRASING_MAP = {
    "pothole": "Deep crater/pothole approximately {detail} causing vehicle damage and traffic hazard.",
    "garbage": "Accumulated solid waste/garbage dump {detail} attracting stray animals and blocking pathway.",
    "safety_concern": "Public safety risk: {detail} posing risk to commuters and pedestrians during dark hours.",
    "infrastructure": "Damaged public infrastructure: {detail} requiring municipal engineering inspection and repair.",
    "accessibility": "Accessibility barrier: {detail} blocking wheelchair, elderly, and stroller access.",
    "utility_outage": "Public utility disruption: {detail} affecting residential water/power supply in the locality.",
    "noise": "Excessive noise disturbance: {detail} exceeding permissible decibel limits.",
    "other": "Civic grievance: {detail} requiring urgent local authority intervention."
}

def check_rate_limit(user_identifier: str) -> Tuple[bool, int]:
    """
    Returns (is_allowed, remaining_quota)
    """
    now = time.time()
    timestamps = _USER_RATE_LIMITS.get(user_identifier, [])
    # Filter out timestamps older than WINDOW_SECONDS
    valid = [ts for ts in timestamps if (now - ts) < WINDOW_SECONDS]
    
    if len(valid) >= MAX_REQUESTS_PER_HOUR:
        _USER_RATE_LIMITS[user_identifier] = valid
        return False, 0

    valid.append(now)
    _USER_RATE_LIMITS[user_identifier] = valid
    return True, MAX_REQUESTS_PER_HOUR - len(valid)

def suggest_improved_civic_note(
    note: str,
    category: str = "pothole",
    user_id: str = "anonymous"
) -> Dict[str, Any]:
    """
    Generates an improved civic report phrasing suggestion.
    """
    allowed, remaining = check_rate_limit(user_id)
    if not allowed:
        return {
            "success": False,
            "error": "Rate limit exceeded. You can request up to 10 note improvements per hour.",
            "original_note": note,
            "suggested_note": note,
            "remaining_quota": 0
        }

    clean_note = note.strip()
    cat_key = (category or "other").lower()
    
    if not clean_note:
        # Default prompt based on category
        detail = "observed on the road"
    else:
        detail = clean_note

    # Apply civic phrasing transformation
    template = CATEGORY_PHRASING_MAP.get(cat_key, CATEGORY_PHRASING_MAP["other"])
    suggested = template.format(detail=detail)

    return {
        "success": True,
        "original_note": note,
        "suggested_note": suggested,
        "category": cat_key,
        "remaining_quota": remaining
    }
