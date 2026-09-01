import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from main import app
from services.community_confidence import CommunityConfidenceService, CommunityConfirmationService
from routers.civic_issues import MOCK_CIVIC_ISSUES, MOCK_CONFIRMATIONS, MOCK_EVIDENCE

client = TestClient(app)


# ── 1. Confidence & Recency Unit Tests ─────────────────────────────────────────

def test_confidence_basic_scaling():
    """Validates that community confidence increases monotonically with independent reporters and confirmations."""
    now = datetime.now(timezone.utc)
    
    # 1 reporter, no confirmations
    res1 = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=1,
        confirmations=[],
        image_count=0,
        passive_count=0,
        current_status="NEW",
        current_time=now
    )
    
    # 5 independent reporters + 3 independent device confirmations + 2 images
    confirmations_5 = [
        {"device_id": f"dev-{i}", "confirmation_type": "STILL_EXISTS", "created_at": now, "distance_meters": 20.0, "trust_score": 0.9}
        for i in range(5)
    ]
    res2 = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=5,
        confirmations=confirmations_5,
        image_count=2,
        passive_count=1,
        current_status="NEW",
        current_time=now
    )

    assert res2["confidence_score"] > res1["confidence_score"]
    assert res2["confidence_percent"] >= 70
    assert res2["suggested_status"] == "COMMUNITY_CONFIRMED"


def test_recency_half_life_decay():
    """Validates that older confirmations decay in influence according to a 14-day half-life."""
    now = datetime.now(timezone.utc)
    fresh_time = now
    fourteen_days_ago = now - timedelta(days=14)
    twenty_eight_days_ago = now - timedelta(days=28)

    w_fresh = CommunityConfidenceService.calculate_recency_weight(fresh_time, now)
    w_14d = CommunityConfidenceService.calculate_recency_weight(fourteen_days_ago, now)
    w_28d = CommunityConfidenceService.calculate_recency_weight(twenty_eight_days_ago, now)

    assert round(w_fresh, 2) == 1.0
    assert round(w_14d, 2) == 0.50
    assert round(w_28d, 2) == 0.25


def test_independence_weighting_deduplication():
    """
    Validates that 10 confirmations from the SAME device produce significantly lower confidence
    than 10 confirmations from 10 DISTINCT devices.
    """
    now = datetime.now(timezone.utc)

    # 10 confirmations from SAME device
    same_device_confs = [
        {"device_id": "dev-same", "confirmation_type": "STILL_EXISTS", "created_at": now, "distance_meters": 10.0, "trust_score": 0.8}
        for _ in range(10)
    ]
    res_same = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=1,
        confirmations=same_device_confs,
        image_count=0,
        passive_count=0,
        current_time=now
    )

    # 10 confirmations from 10 DISTINCT devices
    distinct_device_confs = [
        {"device_id": f"dev-{i}", "confirmation_type": "STILL_EXISTS", "created_at": now, "distance_meters": 10.0, "trust_score": 0.8}
        for i in range(10)
    ]
    res_distinct = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=1,
        confirmations=distinct_device_confs,
        image_count=0,
        passive_count=0,
        current_time=now
    )

    assert res_same["independent_devices"] == 1
    assert res_distinct["independent_devices"] == 10
    assert res_distinct["confidence_score"] > res_same["confidence_score"]
    assert res_distinct["weighted_still_exists"] > res_same["weighted_still_exists"] * 2.0


def test_severity_escalation_worsening():
    """Validates that GETTING_WORSE confirmations escalate severity score with structured reasons."""
    worsening = [
        {"device_id": "d1", "confirmation_type": "GETTING_WORSE", "worsening_reason": "more_dangerous"},
        {"device_id": "d2", "confirmation_type": "GETTING_WORSE", "worsening_reason": "larger"},
        {"device_id": "d3", "confirmation_type": "GETTING_WORSE", "worsening_reason": "affecting_more_people"}
    ]
    sev = CommunityConfidenceService.calculate_severity_score(base_severity=2.0, getting_worse_confirmations=worsening)
    assert sev >= 3.0
    assert sev <= 5.0


def test_resolution_dispute_detection():
    """Validates that citizen STILL_EXISTS confirmations on a resolved issue trigger a dispute."""
    now = datetime.now(timezone.utc)
    confirmations = [
        {"device_id": "dev-a", "confirmation_type": "STILL_EXISTS", "created_at": now, "distance_meters": 15.0, "trust_score": 0.9},
        {"device_id": "dev-b", "confirmation_type": "STILL_EXISTS", "created_at": now, "distance_meters": 20.0, "trust_score": 0.9}
    ]
    res = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=1,
        confirmations=confirmations,
        image_count=1,
        passive_count=0,
        current_status="RESOLVED_PENDING_VERIFICATION",
        current_time=now
    )

    assert res["disputed_resolution"] is True
    assert res["suggested_status"] == "REOPENED"


# ── 2. Anti-Abuse & Rate Limiting Unit Tests ───────────────────────────────────

def test_confirmation_rate_limit():
    """Validates cooldown enforcement per device on identical confirmation buttons."""
    now = datetime.now(timezone.utc)
    existing = [
        {
            "device_id": "dev-rapid-1",
            "confirmation_type": "STILL_EXISTS",
            "created_at": now - timedelta(minutes=5)
        }
    ]

    # Attempt second confirmation within 30 min window -> Disallowed
    allowed, reason = CommunityConfirmationService.check_rate_limit(
        existing_confirmations=existing,
        device_id="dev-rapid-1",
        confirmation_type="STILL_EXISTS",
        current_time=now
    )
    assert allowed is False
    assert "wait" in reason.lower()

    # Attempt after 35 min window -> Allowed
    allowed_after, _ = CommunityConfirmationService.check_rate_limit(
        existing_confirmations=existing,
        device_id="dev-rapid-1",
        confirmation_type="STILL_EXISTS",
        current_time=now + timedelta(minutes=35)
    )
    assert allowed_after is True


# ── 3. API Endpoints Integration Tests ─────────────────────────────────────────

def test_api_get_all_issues():
    """Tests GET /issues and /api/v1/issues list retrieval with filtering."""
    response = client.get("/issues")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "community_confidence" in data[0]
    assert "confidence_percent" in data[0]

    # Test /api/v1/issues
    v1_res = client.get("/api/v1/issues?category=pothole")
    assert v1_res.status_code == 200
    v1_data = v1_res.json()
    assert all(item["category"] == "pothole" for item in v1_data)


def test_api_get_single_issue_and_community():
    """Tests GET /issues/{id} and /issues/{id}/community breakdown."""
    res_issue = client.get("/issues/iss-001")
    assert res_issue.status_code == 200
    issue = res_issue.json()
    assert issue["id"] == "iss-001"

    res_comm = client.get("/issues/iss-001/community")
    assert res_comm.status_code == 200
    comm = res_comm.json()
    assert comm["issue_id"] == "iss-001"
    assert "independent_devices" in comm
    assert "timeline" in comm
    assert "breakdown" in comm


def test_api_submit_confirmation_and_dispute():
    """Tests POST /issues/{id}/confirm workflow including Getting Worse and dispute creation."""
    payload = {
        "type": "GETTING_WORSE",
        "worsening_reason": "larger",
        "comment": "Pothole has grown significantly",
        "latitude": 19.0761,
        "longitude": 72.8778,
        "device_id": f"dev-test-{datetime.now().timestamp()}"
    }
    response = client.post("/issues/iss-001/confirm", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["issue_id"] == "iss-001"
    assert res_data["confirmation"]["type"] == "GETTING_WORSE"
    assert "community" in res_data
    assert res_data["community"]["still_exists"] >= 1


def test_api_evidence_and_followers():
    """Tests evidence upload and issue follower subscription endpoints."""
    # Add evidence
    evidence_payload = {
        "evidence_type": "IMAGE",
        "media_url": "https://res.cloudinary.com/demo/pothole_fixed.jpg",
        "description": "City workers applying asphalt patch",
        "device_id": "dev-evidence-test"
    }
    evi_res = client.post("/issues/iss-001/evidence", json=evidence_payload)
    assert evi_res.status_code == 200
    assert evi_res.json()["status"] == "success"

    # Get evidence
    get_evi_res = client.get("/issues/iss-001/evidence")
    assert get_evi_res.status_code == 200
    assert len(get_evi_res.json()) >= 1

    # Follow issue
    follow_res = client.post("/issues/iss-001/follow?user_id=usr-test-99")
    assert follow_res.status_code == 200

    # Unfollow issue
    unfollow_res = client.delete("/issues/iss-001/follow?user_id=usr-test-99")
    assert unfollow_res.status_code == 200


def test_api_consensus_analytics():
    """Tests GET /issues/analytics/consensus endpoint."""
    res = client.get("/issues/analytics/consensus")
    assert res.status_code == 200
    data = res.json()
    assert "total_civic_issues" in data
    assert "average_confidence" in data
    assert "dispute_rate" in data
    assert "community_verified_resolution_rate" in data
