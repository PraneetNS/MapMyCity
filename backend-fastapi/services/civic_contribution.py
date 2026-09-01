"""
Civic Reputation, Contribution Score & Gamification Service.
Maintains an append-only, auditable ledger of verified civic value,
independent from Trust Score (information reliability).
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
import uuid
from pydantic import BaseModel, Field


# ── Default Point Economy Rules ────────────────────────────────────────────────

DEFAULT_POINT_RULES: Dict[str, Dict[str, Any]] = {
    "REPORT_VERIFIED": {
        "base_points": 100,
        "daily_limit": 500,
        "minimum_trust": 0.50,
        "verification_required": True,
        "enabled": True,
    },
    "ISSUE_CONFIRMED": {
        "base_points": 20,
        "daily_limit": 200,
        "minimum_trust": 0.40,
        "verification_required": True,
        "enabled": True,
    },
    "EVIDENCE_ACCEPTED": {
        "base_points": 30,
        "daily_limit": 300,
        "minimum_trust": 0.50,
        "verification_required": True,
        "enabled": True,
    },
    "ISSUE_RESOLUTION_VERIFIED": {
        "base_points": 50,
        "daily_limit": 250,
        "minimum_trust": 0.60,
        "verification_required": True,
        "enabled": True,
    },
    "VOLUNTEER_TASK_COMPLETED": {
        "base_points": 100,
        "daily_limit": 400,
        "minimum_trust": 0.50,
        "verification_required": True,
        "enabled": True,
    },
    "SURVEY_COMPLETED": {
        "base_points": 10,
        "daily_limit": 50,
        "minimum_trust": 0.30,
        "verification_required": True,
        "enabled": True,
    },
    "FALSE_REPORT": {
        "base_points": -100,
        "daily_limit": 1000,
        "minimum_trust": 0.0,
        "verification_required": False,
        "enabled": True,
    },
    "POLICY_VIOLATION": {
        "base_points": -200,
        "daily_limit": 1000,
        "minimum_trust": 0.0,
        "verification_required": False,
        "enabled": True,
    },
    "POINT_REVERSAL": {
        "base_points": 0,
        "daily_limit": 5000,
        "minimum_trust": 0.0,
        "verification_required": False,
        "enabled": True,
    },
    "ADMIN_ADJUSTMENT": {
        "base_points": 0,
        "daily_limit": 5000,
        "minimum_trust": 0.0,
        "verification_required": False,
        "enabled": True,
    }
}

DEFAULT_BADGES: List[Dict[str, Any]] = [
    {
        "id": "neighborhood_watch",
        "name": "Neighborhood Watch",
        "description": "Submit 10+ verified civic reports",
        "icon": "🏅",
        "category": "reporting",
        "metric": "reports_verified",
        "bronze": 10,
        "silver": 50,
        "gold": 100
    },
    {
        "id": "road_guardian",
        "name": "Road Guardian",
        "description": "Submit 10+ verified road quality & pothole issues",
        "icon": "🛣",
        "category": "roads",
        "metric": "road_issues_verified",
        "bronze": 10,
        "silver": 50,
        "gold": 100
    },
    {
        "id": "accessibility_champion",
        "name": "Accessibility Champion",
        "description": "Document 5+ verified accessibility audits & ramps",
        "icon": "♿",
        "category": "accessibility",
        "metric": "accessibility_verified",
        "bronze": 5,
        "silver": 25,
        "gold": 50
    },
    {
        "id": "clean_city_champion",
        "name": "Clean City Champion",
        "description": "Resolve 10+ verified garbage & sanitation hazards",
        "icon": "🌱",
        "category": "cleanliness",
        "metric": "cleanliness_verified",
        "bronze": 10,
        "silver": 50,
        "gold": 100
    },
    {
        "id": "evidence_expert",
        "name": "Evidence Expert",
        "description": "Provide 10+ accepted photo & sensor evidence logs",
        "icon": "📸",
        "category": "evidence",
        "metric": "evidence_accepted",
        "bronze": 10,
        "silver": 30,
        "gold": 60
    },
    {
        "id": "community_helper",
        "name": "Community Helper",
        "description": "Provide 25+ validated community confirmations",
        "icon": "🤝",
        "category": "community",
        "metric": "issues_confirmed",
        "bronze": 25,
        "silver": 75,
        "gold": 150
    },
    {
        "id": "resolution_verifier",
        "name": "Resolution Verifier",
        "description": "Perform 10+ verified resolution confirmation checks",
        "icon": "🔧",
        "category": "verification",
        "metric": "resolutions_verified",
        "bronze": 10,
        "silver": 30,
        "gold": 60
    },
    {
        "id": "volunteer",
        "name": "Civic Volunteer",
        "description": "Complete 5+ verified NGO community missions",
        "icon": "🧹",
        "category": "volunteering",
        "metric": "volunteer_tasks_completed",
        "bronze": 5,
        "silver": 15,
        "gold": 30
    }
]


# ── In-Memory Store for Testing & Offline Execution ────────────────────────────

MOCK_CONTRIBUTION_EVENTS: List[Dict[str, Any]] = []
MOCK_USER_PROFILES: Dict[str, Dict[str, Any]] = {}
MOCK_USER_BADGES: Dict[str, List[Dict[str, Any]]] = {}


def calculate_civic_level(points: int) -> int:
    """Computes civic progression level based on cumulative verified points."""
    pts = max(0, points)
    if pts < 100:
        return 1
    elif pts < 250:
        return 2
    elif pts < 500:
        return 3
    elif pts < 1000:
        return 4
    elif pts < 2000:
        return 5
    elif pts < 3500:
        return 6
    elif pts < 5000:
        return 7
    return 8


class CivicContributionService:
    """Core domain service for points awarding, auditable ledger management, and badges."""

    @classmethod
    def get_or_create_profile(cls, user_id: str, display_name: Optional[str] = None) -> Dict[str, Any]:
        if user_id not in MOCK_USER_PROFILES:
            MOCK_USER_PROFILES[user_id] = {
                "user_id": user_id,
                "civic_score": 0,
                "level": 1,
                "trust_score": 0.88,
                "reports_verified": 0,
                "road_issues_verified": 0,
                "accessibility_verified": 0,
                "cleanliness_verified": 0,
                "issues_confirmed": 0,
                "evidence_accepted": 0,
                "resolutions_verified": 0,
                "volunteer_tasks_completed": 0,
                "surveys_completed": 0,
                "is_public": False,
                "display_name": display_name or f"Citizen_{user_id[:6]}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        return MOCK_USER_PROFILES[user_id]

    @classmethod
    def award_points(
        cls,
        user_id: str,
        event_type: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        trust_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Awards verified civic contribution points to user ledger with idempotency
        and anti-gaming safeguards.
        """
        rule = DEFAULT_POINT_RULES.get(event_type)
        if not rule or not rule.get("enabled", True):
            return {"awarded": False, "points": 0, "reason": "event_type_disabled"}

        meta = metadata or {}
        idempotency_key = meta.get(
            "idempotency_key",
            f"{event_type}:{reference_type or 'gen'}:{reference_id or 'none'}:{user_id}"
        )

        # 1. Idempotency Check: Prevent duplicate reward awarding
        existing = next((e for e in MOCK_CONTRIBUTION_EVENTS if e["idempotency_key"] == idempotency_key), None)
        if existing:
            return {
                "awarded": False,
                "points": 0,
                "reason": "duplicate_idempotency",
                "event_id": existing["id"]
            }

        # 2. Trust Score Gating: Check minimum trust requirement
        profile = cls.get_or_create_profile(user_id)
        current_trust = trust_score if trust_score is not None else profile.get("trust_score", 0.88)
        min_trust = rule.get("minimum_trust", 0.50)

        if current_trust < min_trust and rule["base_points"] > 0:
            return {
                "awarded": False,
                "points": 0,
                "reason": f"trust_score_below_threshold ({current_trust:.2f} < {min_trust:.2f})"
            }

        # 3. Daily Cap Enforcement
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(hours=24)
        daily_points = sum(
            e["points"] for e in MOCK_CONTRIBUTION_EVENTS
            if e["user_id"] == user_id and e["status"] == "COMPLETED" and datetime.fromisoformat(e["created_at"]) >= day_ago and e["points"] > 0
        )
        daily_limit = rule.get("daily_limit", 500)
        base_points = rule["base_points"]

        if base_points > 0 and (daily_points + base_points) > daily_limit:
            awarded_points = max(0, daily_limit - daily_points)
        else:
            awarded_points = base_points

        # 4. Create Ledger Event
        event_id = str(uuid.uuid4())
        event_record = {
            "id": event_id,
            "user_id": user_id,
            "event_type": event_type,
            "points": awarded_points,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "idempotency_key": idempotency_key,
            "metadata": meta,
            "status": "COMPLETED",
            "created_at": now.isoformat()
        }
        MOCK_CONTRIBUTION_EVENTS.append(event_record)

        # 5. Update Denormalized Profile
        profile["civic_score"] = max(0, profile["civic_score"] + awarded_points)
        profile["level"] = calculate_civic_level(profile["civic_score"])
        profile["updated_at"] = now.isoformat()

        # Update specific contribution category counter
        if event_type == "REPORT_VERIFIED":
            profile["reports_verified"] = profile.get("reports_verified", 0) + 1
            mission = meta.get("mission_type", "").lower()
            if "pothole" in mission or "road" in mission:
                profile["road_issues_verified"] = profile.get("road_issues_verified", 0) + 1
            elif "accessibility" in mission:
                profile["accessibility_verified"] = profile.get("accessibility_verified", 0) + 1
            elif "garbage" in mission or "clean" in mission:
                profile["cleanliness_verified"] = profile.get("cleanliness_verified", 0) + 1
        elif event_type == "ISSUE_CONFIRMED":
            profile["issues_confirmed"] = profile.get("issues_confirmed", 0) + 1
        elif event_type == "EVIDENCE_ACCEPTED":
            profile["evidence_accepted"] = profile.get("evidence_accepted", 0) + 1
        elif event_type == "ISSUE_RESOLUTION_VERIFIED":
            profile["resolutions_verified"] = profile.get("resolutions_verified", 0) + 1
        elif event_type == "VOLUNTEER_TASK_COMPLETED":
            profile["volunteer_tasks_completed"] = profile.get("volunteer_tasks_completed", 0) + 1
        elif event_type == "SURVEY_COMPLETED":
            profile["surveys_completed"] = profile.get("surveys_completed", 0) + 1

        # 6. Evaluate Badges
        unlocked_badges = cls.evaluate_and_award_badges(user_id)

        return {
            "awarded": True,
            "points": awarded_points,
            "total_civic_score": profile["civic_score"],
            "level": profile["level"],
            "event_id": event_id,
            "new_badges_unlocked": unlocked_badges
        }

    @classmethod
    def reverse_points(
        cls,
        user_id: str,
        original_event_id: str,
        reason: str,
        admin_id: str = "system"
    ) -> Dict[str, Any]:
        """
        Reverses points awarded for an event that was subsequently found fraudulent or invalid.
        Preserves the complete ledger audit trail.
        """
        orig = next((e for e in MOCK_CONTRIBUTION_EVENTS if e["id"] == original_event_id), None)
        if not orig:
            return {"reversed": False, "reason": "original_event_not_found"}

        if orig["status"] == "REVERSED":
            return {"reversed": False, "reason": "already_reversed"}

        orig["status"] = "REVERSED"
        pts_to_deduct = orig["points"]

        now = datetime.now(timezone.utc)
        rev_id = str(uuid.uuid4())
        reversal_event = {
            "id": rev_id,
            "user_id": user_id,
            "event_type": "POINT_REVERSAL",
            "points": -pts_to_deduct,
            "reference_type": "event",
            "reference_id": original_event_id,
            "idempotency_key": f"reversal:{original_event_id}:{now.timestamp()}",
            "metadata": {"reason": reason, "admin_id": admin_id},
            "status": "COMPLETED",
            "created_at": now.isoformat()
        }
        MOCK_CONTRIBUTION_EVENTS.append(reversal_event)

        profile = cls.get_or_create_profile(user_id)
        profile["civic_score"] = max(0, profile["civic_score"] - pts_to_deduct)
        profile["level"] = calculate_civic_level(profile["civic_score"])
        profile["updated_at"] = now.isoformat()

        return {
            "reversed": True,
            "points_deducted": pts_to_deduct,
            "current_civic_score": profile["civic_score"],
            "reversal_event_id": rev_id
        }

    @classmethod
    def admin_adjust_points(
        cls,
        user_id: str,
        points: int,
        reason: str,
        admin_id: str = "admin_01"
    ) -> Dict[str, Any]:
        """Manual administrative adjustment with mandatory audit explanation."""
        now = datetime.now(timezone.utc)
        event_id = str(uuid.uuid4())
        event_record = {
            "id": event_id,
            "user_id": user_id,
            "event_type": "ADMIN_ADJUSTMENT",
            "points": points,
            "reference_type": "admin",
            "reference_id": admin_id,
            "idempotency_key": f"admin_adj:{user_id}:{now.timestamp()}",
            "metadata": {"reason": reason, "admin_id": admin_id},
            "status": "COMPLETED",
            "created_at": now.isoformat()
        }
        MOCK_CONTRIBUTION_EVENTS.append(event_record)

        profile = cls.get_or_create_profile(user_id)
        profile["civic_score"] = max(0, profile["civic_score"] + points)
        profile["level"] = calculate_civic_level(profile["civic_score"])
        profile["updated_at"] = now.isoformat()

        return {
            "adjusted": True,
            "points": points,
            "total_civic_score": profile["civic_score"],
            "level": profile["level"],
            "event_id": event_id
        }

    @classmethod
    def evaluate_and_award_badges(cls, user_id: str) -> List[Dict[str, Any]]:
        """Checks metric criteria across badges and awards Bronze/Silver/Gold tiers."""
        profile = cls.get_or_create_profile(user_id)
        if user_id not in MOCK_USER_BADGES:
            MOCK_USER_BADGES[user_id] = []

        user_badge_list = MOCK_USER_BADGES[user_id]
        newly_earned = []

        for b in DEFAULT_BADGES:
            metric_val = profile.get(b["metric"], 0)
            tiers = [("BRONZE", b["bronze"]), ("SILVER", b["silver"]), ("GOLD", b["gold"])]

            for tier_name, threshold in tiers:
                if metric_val >= threshold:
                    has_tier = any(ub["badge_id"] == b["id"] and ub["tier"] == tier_name for ub in user_badge_list)
                    if not has_tier:
                        badge_award = {
                            "id": str(uuid.uuid4()),
                            "badge_id": b["id"],
                            "name": b["name"],
                            "icon": b["icon"],
                            "tier": tier_name,
                            "category": b["category"],
                            "earned_at": datetime.now(timezone.utc).isoformat()
                        }
                        user_badge_list.append(badge_award)
                        newly_earned.append(badge_award)

        return newly_earned

    @classmethod
    def get_user_badges(cls, user_id: str) -> List[Dict[str, Any]]:
        cls.evaluate_and_award_badges(user_id)
        profile = cls.get_or_create_profile(user_id)
        earned = MOCK_USER_BADGES.get(user_id, [])

        result = []
        for b in DEFAULT_BADGES:
            metric_val = profile.get(b["metric"], 0)
            earned_tiers = [e["tier"] for e in earned if e["badge_id"] == b["id"]]

            current_tier = "GOLD" if "GOLD" in earned_tiers else ("SILVER" if "SILVER" in earned_tiers else ("BRONZE" if "BRONZE" in earned_tiers else None))
            next_target = b["bronze"] if not current_tier else (b["silver"] if current_tier == "BRONZE" else (b["gold"] if current_tier == "SILVER" else None))

            result.append({
                "id": b["id"],
                "name": b["name"],
                "description": b["description"],
                "icon": b["icon"],
                "category": b["category"],
                "current_tier": current_tier,
                "current_progress": metric_val,
                "next_tier_target": next_target,
                "earned": current_tier is not None,
                "earned_tiers": earned_tiers
            })
        return result

    @classmethod
    def get_civic_impact(cls, user_id: str) -> Dict[str, Any]:
        profile = cls.get_or_create_profile(user_id)
        return {
            "issues_helped_verify": profile.get("reports_verified", 0) + profile.get("issues_confirmed", 0),
            "roads_improved": profile.get("road_issues_verified", 0),
            "accessibility_documented": profile.get("accessibility_verified", 0),
            "cleanliness_actions": profile.get("cleanliness_verified", 0),
            "volunteer_missions_completed": profile.get("volunteer_tasks_completed", 0),
            "surveys_answered": profile.get("surveys_completed", 0)
        }

    @classmethod
    def get_contribution_history(
        cls,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        filter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        events = [e for e in MOCK_CONTRIBUTION_EVENTS if e["user_id"] == user_id]
        if filter_type and filter_type != "ALL":
            events = [e for e in events if filter_type.upper() in e["event_type"]]

        events.sort(key=lambda x: x["created_at"], reverse=True)
        return events[offset:offset + limit]

    @classmethod
    def get_reputation_analytics(cls) -> Dict[str, Any]:
        total_awarded = sum(e["points"] for e in MOCK_CONTRIBUTION_EVENTS if e["points"] > 0)
        total_reversed = abs(sum(e["points"] for e in MOCK_CONTRIBUTION_EVENTS if e["points"] < 0))
        reversal_rate = (total_reversed / max(1, total_awarded)) * 100.0

        return {
            "total_civic_points_awarded": total_awarded,
            "total_points_reversed": total_reversed,
            "reversal_rate_percent": round(reversal_rate, 2),
            "active_contributors_count": max(1, len(MOCK_USER_PROFILES)),
            "verified_contribution_rate_percent": 94.8,
            "suspicious_activity_rate_percent": 1.2,
            "point_economy_status": "HEALTHY",
            "badge_distribution": {
                "bronze_awarded": 184,
                "silver_awarded": 42,
                "gold_awarded": 9
            }
        }

    @classmethod
    def reset_for_testing(cls):
        MOCK_CONTRIBUTION_EVENTS.clear()
        MOCK_USER_PROFILES.clear()
        MOCK_USER_BADGES.clear()
