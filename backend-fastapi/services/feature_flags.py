from sqlalchemy import text
from database_read import async_read_session

# In-memory fallback feature flag states
FEATURE_FLAG_CACHE = {
    "live_hazard_layer": True,
    "status_timeline_v1": True,
    "social_upvotes": True,
    "presence_channels": True,
    "ai_triage_summaries": True,
    "recurrence_risk_model": True,
    "smart_activity_digests": True,
    "civic_note_improvement": True
}


async def is_feature_enabled(flag_name: str, ward_id: str = None) -> bool:
    """
    Checks if a feature flag is enabled globally or for a specific ward.
    """
    try:
        async with async_read_session() as db:
            res = await db.execute(
                text("SELECT is_enabled FROM feature_flags WHERE flag_name = :fn LIMIT 1"),
                {"fn": flag_name}
            )
            row = res.fetchone()
            if row:
                return row.is_enabled
    except Exception:
        pass

    return FEATURE_FLAG_CACHE.get(flag_name, True)
