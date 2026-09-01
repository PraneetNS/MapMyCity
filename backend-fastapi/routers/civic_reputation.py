"""
Civic Reputation & Gamification Router.
Provides endpoints for civic profiles, contribution history ledger,
badge showcases, public impact metrics, and administrative reward governance.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Path, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from services.civic_contribution import (
    CivicContributionService,
    DEFAULT_POINT_RULES,
    DEFAULT_BADGES,
)

router = APIRouter(
    tags=["Civic Reputation & Gamification"]
)


# ── Pydantic Request / Response Schemas ────────────────────────────────────────

class AwardPointsRequest(BaseModel):
    user_id: str
    event_type: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    trust_score: Optional[float] = None


class ReversePointsRequest(BaseModel):
    user_id: str
    original_event_id: str
    reason: str
    admin_id: Optional[str] = "admin_01"


class AdminAdjustRequest(BaseModel):
    user_id: str
    points: int
    reason: str
    admin_id: Optional[str] = "admin_01"


class CivicProfileResponse(BaseModel):
    user_id: str
    display_name: str
    civic_score: int
    level: int
    trust_score: float
    trust_score_percent: int
    reports_verified: int
    issues_confirmed: int
    evidence_accepted: int
    volunteer_tasks_completed: int
    surveys_completed: int
    is_public: bool


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/users/me/civic-profile", response_model=CivicProfileResponse)
async def get_my_civic_profile(
    user_id: str = Query("default_user", description="Citizen user or device ID")
):
    """Returns the authenticated citizen's full civic profile and level."""
    profile = CivicContributionService.get_or_create_profile(user_id)
    trust = profile.get("trust_score", 0.88)
    return {
        **profile,
        "trust_score_percent": int(round(trust * 100))
    }


@router.get("/users/me/civic-score")
async def get_my_civic_score(
    user_id: str = Query("default_user")
):
    """Returns current civic score, level, and trust score comparison."""
    profile = CivicContributionService.get_or_create_profile(user_id)
    return {
        "user_id": user_id,
        "civic_score": profile["civic_score"],
        "level": profile["level"],
        "trust_score": profile.get("trust_score", 0.88),
        "explanation": "Civic Score rewards verified civic participation. Trust Score reflects report and evidence reliability."
    }


@router.get("/users/me/contributions")
async def get_my_contributions(
    user_id: str = Query("default_user"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filter_type: Optional[str] = Query(None, description="ALL, REPORT, CONFIRM, EVIDENCE, VOLUNTEER, SURVEY")
):
    """Returns paginated, auditable contribution ledger events."""
    return CivicContributionService.get_contribution_history(
        user_id=user_id,
        limit=limit,
        offset=offset,
        filter_type=filter_type
    )


@router.get("/users/me/badges")
async def get_my_badges(
    user_id: str = Query("default_user")
):
    """Returns all badges with current tier status and progression."""
    return CivicContributionService.get_user_badges(user_id)


@router.get("/users/me/impact")
async def get_my_civic_impact(
    user_id: str = Query("default_user")
):
    """Returns verified civic impact summary (issues helped resolve, cleanup missions)."""
    return CivicContributionService.get_civic_impact(user_id)


@router.get("/users/{user_id}/public-civic-profile")
async def get_public_civic_profile(
    user_id: str = Path(...)
):
    """
    Returns public civic profile. Strips private device IDs, GPS trails, and internal trust scores.
    """
    profile = CivicContributionService.get_or_create_profile(user_id)
    badges = [b for b in CivicContributionService.get_user_badges(user_id) if b["earned"]]

    return {
        "user_id": user_id,
        "display_name": profile.get("display_name", f"Citizen_{user_id[:6]}"),
        "civic_level": profile.get("level", 1),
        "verified_contributions_count": (
            profile.get("reports_verified", 0) +
            profile.get("issues_confirmed", 0) +
            profile.get("evidence_accepted", 0) +
            profile.get("volunteer_tasks_completed", 0)
        ),
        "badges": badges,
        "member_since": profile.get("created_at", datetime.now(timezone.utc).isoformat())
    }


@router.get("/leaderboard")
async def get_civic_leaderboard(
    ward_id: Optional[str] = Query(None, description="Optional ward filter"),
    limit: int = Query(20, ge=1, le=50)
):
    """Returns community contributor leaderboard with privacy-preserving display names."""
    sample_users = [
        {"display_name": "Rohan M. (HSR)", "civic_score": 1840, "level": 5, "badges_count": 6, "rank": 1},
        {"display_name": "Ananya S. (Koramangala)", "civic_score": 1620, "level": 5, "badges_count": 5, "rank": 2},
        {"display_name": "Vikram K. (Indiranagar)", "civic_score": 1390, "level": 5, "badges_count": 4, "rank": 3},
        {"display_name": "Pooja D. (Bellandur)", "civic_score": 980, "level": 4, "badges_count": 4, "rank": 4},
        {"display_name": "Suresh N. (Whitefield)", "civic_score": 750, "level": 4, "badges_count": 3, "rank": 5},
    ]
    return {
        "scope": f"Ward {ward_id}" if ward_id else "Citywide",
        "total_active_citizens": 1420,
        "leaderboard": sample_users[:limit]
    }


@router.get("/badges")
async def get_all_badges():
    """Returns all badges registered in the gamification system."""
    return DEFAULT_BADGES


# ── Administrative & Internal Mutation Endpoints ──────────────────────────────

@router.post("/reputation/award")
async def award_civic_points(req: AwardPointsRequest):
    """Internal/worker endpoint to award verified contribution points."""
    return CivicContributionService.award_points(
        user_id=req.user_id,
        event_type=req.event_type,
        reference_type=req.reference_type,
        reference_id=req.reference_id,
        metadata=req.metadata,
        trust_score=req.trust_score
    )


@router.post("/admin/reputation/reverse")
async def reverse_civic_points(req: ReversePointsRequest):
    """Admin endpoint to reverse points awarded for fraudulent reports."""
    res = CivicContributionService.reverse_points(
        user_id=req.user_id,
        original_event_id=req.original_event_id,
        reason=req.reason,
        admin_id=req.admin_id or "admin_01"
    )
    if not res.get("reversed"):
        raise HTTPException(status_code=400, detail=res.get("reason"))
    return res


@router.post("/admin/reputation/adjust")
async def admin_adjust_points(req: AdminAdjustRequest):
    """Admin manual points adjustment with mandatory audit explanation."""
    return CivicContributionService.admin_adjust_points(
        user_id=req.user_id,
        points=req.points,
        reason=req.reason,
        admin_id=req.admin_id or "admin_01"
    )


@router.get("/admin/reputation/analytics")
async def get_reputation_analytics():
    """Returns reputation integrity and gamification health analytics."""
    return CivicContributionService.get_reputation_analytics()


@router.get("/admin/reputation/rules")
async def get_reputation_rules():
    """Returns active point economy rules."""
    return DEFAULT_POINT_RULES
