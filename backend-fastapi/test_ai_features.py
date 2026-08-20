"""
Unit Tests for AI-Assisted Features Suite
Tests Triage Summary, Recurrence Risk Prediction, Smart Activity Digest, and Note Improvement.
"""

from services.triage_summary import generate_grounded_triage_summary, batch_refresh_cluster_summaries
from services.recurrence_predictor import predict_recurrence_risk
from services.smart_digest import generate_smart_user_digest
from services.note_improver import suggest_improved_civic_note

def test_triage_summary():
    print("Testing Triage Summary Generation...")
    summary = generate_grounded_triage_summary(
        cluster_id="cluster-123",
        mission_type="pothole",
        submission_count=12,
        first_reported_at="2026-08-01T10:00:00Z",
        last_reported_at="2026-08-20T22:00:00Z",
        ward="Ward 12 - Indiranagar",
        night_ratio=0.75,
        flags_count=1
    )
    print(f"Generated summary: {summary}")
    assert "Pothole" in summary
    assert "12 reports" in summary
    assert "mostly night-time" in summary
    assert "Indiranagar" in summary
    print("[PASS] Triage Summary test passed!")


def test_recurrence_prediction():
    print("Testing Recurrence Risk Predictor...")
    # Low risk case
    low_risk = predict_recurrence_risk(
        mission_type="accessibility",
        submission_count=1,
        past_reopen_count=0
    )
    assert low_risk["risk_level"] in ("low", "medium")
    print(f"Low risk score: {low_risk['recurrence_risk_score']} ({low_risk['risk_level']})")

    # High risk case (monsoon pothole with reopen history and high vehicle impact)
    high_risk = predict_recurrence_risk(
        mission_type="pothole",
        submission_count=14,
        past_reopen_count=2,
        is_monsoon_season=True,
        is_high_traffic_corridor=True,
        avg_jolt_intensity=3.2
    )
    print(f"High risk score: {high_risk['recurrence_risk_score']} ({high_risk['risk_level']})")
    assert high_risk["is_high_risk"] is True
    assert len(high_risk["risk_factors"]) >= 2
    assert "Monitor this one" in high_risk["recommendation"]
    print("[PASS] Recurrence Risk test passed!")

def test_smart_digest():
    print("Testing Smart Activity Digest...")
    digest = generate_smart_user_digest(
        user_id="user_777",
        ward_name="Ward 12 - Indiranagar",
        resolved_count=3,
        in_progress_count=2,
        active_streak_weeks=6,
        reporter_rank_pct="Top 5%"
    )
    print(f"Generated digest: {digest['summary_text']}")
    assert "3 reports fixed & resolved" in digest["summary_text"]
    assert "2 moved to in-progress" in digest["summary_text"]
    assert "Indiranagar" in digest["summary_text"]
    print("[PASS] Smart Activity Digest test passed!")

def test_note_improver():
    print("Testing Note Improvement Service...")
    res = suggest_improved_civic_note(
        note="crater near bus stop",
        category="pothole",
        user_id="user_test_1"
    )
    print(f"Original note: {res['original_note']}")
    print(f"Suggested note: {res['suggested_note']}")
    assert res["success"] is True
    assert "crater near bus stop" in res["suggested_note"]
    assert "traffic hazard" in res["suggested_note"]
    print("[PASS] Note Improvement test passed!")

if __name__ == "__main__":
    test_triage_summary()
    test_recurrence_prediction()
    test_smart_digest()
    test_note_improver()
    print("\nALL AI-ASSISTED FEATURE UNIT TESTS PASSED SUCCESSFULLY!")

