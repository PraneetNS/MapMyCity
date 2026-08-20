"""
Smart Activity Digest Generator
Produces natural-language 1-line activity summaries per citizen/ward.
Uses instant, deterministic sentence templates without server LLM cost.
"""

from typing import Dict, Any, List

def generate_smart_user_digest(
    user_id: str,
    ward_name: str = "Ward 12 - Indiranagar",
    resolved_count: int = 0,
    in_progress_count: int = 0,
    acknowledged_count: int = 0,
    upvotes_received: int = 0,
    active_streak_weeks: int = 1,
    reporter_rank_pct: str = "Top 5%"
) -> Dict[str, Any]:
    """
    Synthesizes multiple raw status events into a concise, encouraging sentence.
    """
    clauses = []
    
    if resolved_count > 0:
        clauses.append(f"{resolved_count} report{'s' if resolved_count > 1 else ''} fixed & resolved")
    
    if in_progress_count > 0:
        clauses.append(f"{in_progress_count} moved to in-progress")

    if acknowledged_count > 0 and len(clauses) == 0:
        clauses.append(f"{acknowledged_count} acknowledged by municipal team")

    if not clauses:
        if upvotes_received > 0:
            clauses.append(f"your reports received {upvotes_received} neighbor upvotes")
        else:
            clauses.append("all your reports are actively monitored by the ward patrol")

    summary_text = " • ".join(clauses).capitalize() + f" in {ward_name}."

    badge_msg = f"{reporter_rank_pct} active reporter"
    if active_streak_weeks > 1:
        badge_msg += f" • {active_streak_weeks}-week streak 🔥"

    return {
        "user_id": user_id,
        "ward_name": ward_name,
        "summary_text": summary_text,
        "resolved_count": resolved_count,
        "in_progress_count": in_progress_count,
        "acknowledged_count": acknowledged_count,
        "upvotes_received": upvotes_received,
        "reporter_percentile": reporter_rank_pct,
        "active_streak_weeks": active_streak_weeks,
        "badge_msg": badge_msg,
        "generated_at": "this week"
    }
