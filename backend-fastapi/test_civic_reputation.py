import pytest
from fastapi.testclient import TestClient

from main import app
from services.civic_contribution import (
    CivicContributionService,
    calculate_civic_level,
    DEFAULT_POINT_RULES,
    DEFAULT_BADGES,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_teardown():
    CivicContributionService.reset_for_testing()
    yield
    CivicContributionService.reset_for_testing()


# ── 1. Unit Tests: Points Awarding & Levels ────────────────────────────────────

def test_calculate_civic_level():
    assert calculate_civic_level(0) == 1
    assert calculate_civic_level(99) == 1
    assert calculate_civic_level(100) == 2
    assert calculate_civic_level(250) == 3
    assert calculate_civic_level(500) == 4
    assert calculate_civic_level(1000) == 5
    assert calculate_civic_level(2000) == 6
    assert calculate_civic_level(5000) == 8


def test_award_verified_points_and_idempotency():
    user = "citizen_test_01"

    # 1. Award verified report (+100)
    res1 = CivicContributionService.award_points(
        user_id=user,
        event_type="REPORT_VERIFIED",
        reference_type="report",
        reference_id="rep_101",
        metadata={"mission_type": "pothole"},
        trust_score=0.92
    )
    assert res1["awarded"] is True
    assert res1["points"] == 100
    assert res1["total_civic_score"] == 100
    assert res1["level"] == 2

    # 2. Duplicate Idempotency Call: Must not award twice
    res2 = CivicContributionService.award_points(
        user_id=user,
        event_type="REPORT_VERIFIED",
        reference_type="report",
        reference_id="rep_101",
        metadata={"mission_type": "pothole"},
        trust_score=0.92
    )
    assert res2["awarded"] is False
    assert res2["points"] == 0
    assert res2["reason"] == "duplicate_idempotency"

    # Verify score did not increase
    profile = CivicContributionService.get_or_create_profile(user)
    assert profile["civic_score"] == 100


def test_trust_score_gating():
    user = "low_trust_user"

    # User with trust score 0.35 (below 0.50 threshold) attempting high-point action
    res = CivicContributionService.award_points(
        user_id=user,
        event_type="REPORT_VERIFIED",
        reference_type="report",
        reference_id="rep_201",
        trust_score=0.35
    )
    assert res["awarded"] is False
    assert "trust_score_below_threshold" in res["reason"]


def test_point_reversal_preserves_ledger():
    user = "citizen_reversal_test"

    # Award points
    res = CivicContributionService.award_points(
        user_id=user,
        event_type="REPORT_VERIFIED",
        reference_type="report",
        reference_id="rep_301",
        trust_score=0.85
    )
    event_id = res["event_id"]
    assert res["total_civic_score"] == 100

    # Reverse points (fraudulent detection)
    rev_res = CivicContributionService.reverse_points(
        user_id=user,
        original_event_id=event_id,
        reason="Photo determined to be online screenshot",
        admin_id="mod_chief"
    )
    assert rev_res["reversed"] is True
    assert rev_res["points_deducted"] == 100
    assert rev_res["current_civic_score"] == 0

    # History should contain both original and reversal event (append-only)
    history = CivicContributionService.get_contribution_history(user)
    assert len(history) == 2
    assert any(h["event_type"] == "POINT_REVERSAL" for h in history)


def test_badge_progression_unlock():
    user = "badge_hunter"

    # Award 10 verified road reports to unlock Bronze Road Guardian
    for i in range(10):
        CivicContributionService.award_points(
            user_id=user,
            event_type="REPORT_VERIFIED",
            reference_type="report",
            reference_id=f"pothole_{i}",
            metadata={"mission_type": "pothole"},
            trust_score=0.90
        )

    badges = CivicContributionService.get_user_badges(user)
    road_badge = next((b for b in badges if b["id"] == "road_guardian"), None)
    assert road_badge is not None
    assert road_badge["earned"] is True
    assert road_badge["current_tier"] == "BRONZE"
    assert road_badge["next_tier_target"] == 50


# ── 2. Integration Tests: API Endpoints ────────────────────────────────────────

def test_api_civic_profile_and_score():
    res = client.get("/users/me/civic-profile?user_id=citizen_api_01")
    assert res.status_code == 200
    data = res.json()
    assert "civic_score" in data
    assert "level" in data
    assert "trust_score_percent" in data

    res_score = client.get("/users/me/civic-score?user_id=citizen_api_01")
    assert res_score.status_code == 200
    assert "explanation" in res_score.json()


def test_api_contributions_and_badges():
    user = "citizen_api_02"
    # Award points via API
    client.post("/reputation/award", json={
        "user_id": user,
        "event_type": "ISSUE_CONFIRMED",
        "reference_type": "confirmation",
        "reference_id": "conf_99",
        "trust_score": 0.88
    })

    res_contrib = client.get(f"/users/me/contributions?user_id={user}")
    assert res_contrib.status_code == 200
    contribs = res_contrib.json()
    assert len(contribs) >= 1
    assert contribs[0]["event_type"] == "ISSUE_CONFIRMED"

    res_badges = client.get(f"/users/me/badges?user_id={user}")
    assert res_badges.status_code == 200
    assert len(res_badges.json()) >= 8


def test_api_public_profile_privacy():
    user = "citizen_privacy_test"
    res = client.get(f"/users/{user}/public-civic-profile")
    assert res.status_code == 200
    data = res.json()
    assert "display_name" in data
    assert "civic_level" in data
    # Ensure sensitive private internal fields are not exposed
    assert "device_id" not in data
    assert "trust_score" not in data
    assert "coordinates" not in data


def test_api_admin_adjust_and_analytics():
    user = "admin_adjust_user"
    res_adj = client.post("/admin/reputation/adjust", json={
        "user_id": user,
        "points": 150,
        "reason": "Special municipal commendation for flood volunteer work",
        "admin_id": "ward_officer_43"
    })
    assert res_adj.status_code == 200
    assert res_adj.json()["total_civic_score"] == 150

    res_analytics = client.get("/admin/reputation/analytics")
    assert res_analytics.status_code == 200
    analytics = res_analytics.json()
    assert "total_civic_points_awarded" in analytics
    assert "verified_contribution_rate_percent" in analytics


def test_api_leaderboard():
    res = client.get("/leaderboard?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "leaderboard" in data
    assert len(data["leaderboard"]) <= 5
