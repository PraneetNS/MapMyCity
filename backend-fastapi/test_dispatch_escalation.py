"""
Unit and Integration Tests for Autonomous Municipal Dispatch and SLA Escalation Engine.
"""

import pytest
from datetime import datetime, timezone, timedelta
from services.dispatch_escalation import DispatchEscalationService, DEPARTMENT_REGISTRY


@pytest.fixture
def dispatch_service():
    return DispatchEscalationService()


def test_route_department_mapping(dispatch_service):
    roads_dept = dispatch_service.route_department("pothole")
    assert roads_dept["id"] == "dept_roads"
    assert roads_dept["short_code"] == "ROADS"

    drain_dept = dispatch_service.route_department("waterlogging")
    assert drain_dept["id"] == "dept_drainage"
    assert drain_dept["short_code"] == "DRAIN"

    elec_dept = dispatch_service.route_department("streetlight_out")
    assert elec_dept["id"] == "dept_electrical"
    assert elec_dept["short_code"] == "ELEC"

    swm_dept = dispatch_service.route_department("garbage_dump")
    assert swm_dept["id"] == "dept_sanitation"
    assert swm_dept["short_code"] == "SWM"


def test_route_department_fallback(dispatch_service):
    dept = dispatch_service.route_department("unknown_alien_defect")
    assert dept["id"] == "dept_roads"


def test_determine_priority_levels(dispatch_service):
    # Emergency: weather alert + high severity
    p_emerg = dispatch_service.determine_priority(severity_score=0.8, weather_alert=True)
    assert p_emerg == "EMERGENCY"

    # Critical: severity >= 0.85
    p_crit = dispatch_service.determine_priority(severity_score=0.9, weather_alert=False)
    assert p_crit == "CRITICAL"

    # Critical via crowd confirmation
    p_crit_confirm = dispatch_service.determine_priority(severity_score=0.4, confirmations_count=12)
    assert p_crit_confirm == "CRITICAL"

    # High
    p_high = dispatch_service.determine_priority(severity_score=0.65)
    assert p_high == "HIGH"

    # Medium
    p_med = dispatch_service.determine_priority(severity_score=0.4)
    assert p_med == "MEDIUM"

    # Low
    p_low = dispatch_service.determine_priority(severity_score=0.2)
    assert p_low == "LOW"


def test_calculate_sla_deadline(dispatch_service):
    dept = DEPARTMENT_REGISTRY["dept_roads"]
    deadline_emerg = dispatch_service.calculate_sla_deadline(dept, "EMERGENCY")
    now = datetime.now(timezone.utc)
    diff_emerg = (deadline_emerg - now).total_seconds() / 3600.0
    assert 11.5 <= diff_emerg <= 12.5

    deadline_std = dispatch_service.calculate_sla_deadline(dept, "MEDIUM")
    diff_std = (deadline_std - now).total_seconds() / 3600.0
    assert 47.5 <= diff_std <= 48.5


def test_create_work_order(dispatch_service):
    wo = dispatch_service.create_work_order(
        cluster_id="clust-1234",
        category="pothole",
        ward_id="ward_bbmp_150",
        severity_score=0.88,
        confirmations_count=6,
        notes="Deep crater near junction"
    )

    assert wo["id"] is not None
    assert wo["order_number"].startswith("WO-")
    assert wo["department_id"] == "dept_roads"
    assert wo["priority"] == "CRITICAL"
    assert wo["status"] == "DISPATCHED"
    assert wo["contractor_name"] == "Apex Urban Roadworks Ltd."
    assert wo["notes"] == "Deep crater near junction"


def test_evaluate_sla_status_on_track_and_breached(dispatch_service):
    wo = dispatch_service.create_work_order(
        cluster_id="clust-9999",
        category="streetlight_out",
        ward_id="ward_bbmp_150",
        severity_score=0.3
    )

    # Fresh order should be ON_TRACK
    status_fresh = dispatch_service.evaluate_sla_status(wo)
    assert status_fresh["sla_state"] == "ON_TRACK"
    assert status_fresh["hours_remaining"] > 0
    assert not status_fresh["is_breached"]

    # Mutate deadline to the past to simulate overdue breach
    past_time = datetime.now(timezone.utc) - timedelta(hours=5)
    wo["sla_deadline"] = past_time.isoformat()

    status_breached = dispatch_service.evaluate_sla_status(wo)
    assert status_breached["sla_state"] == "BREACHED"
    assert status_breached["hours_remaining"] < 0
    assert status_breached["is_breached"] is True


def test_trigger_escalation(dispatch_service):
    wo = dispatch_service.create_work_order(
        cluster_id="clust-esc-1",
        category="waterlogging",
        ward_id="ward_bbmp_174",
        severity_score=0.75
    )
    wo_id = wo["id"]
    assert wo["escalation_level"] == 0

    esc_res = dispatch_service.trigger_escalation(wo_id, reason="Response exceeded 6 hours")
    assert esc_res["new_status"] == "ESCALATED"
    assert esc_res["escalation_level"] == 1

    # Second escalation
    esc_res2 = dispatch_service.trigger_escalation(wo_id, reason="Severe flood hazard persisted")
    assert esc_res2["escalation_level"] == 2


def test_update_work_order_lifecycle(dispatch_service):
    wo = dispatch_service.create_work_order(
        cluster_id="clust-lifecycle",
        category="pothole",
        ward_id="ward_bbmp_150"
    )
    wo_id = wo["id"]

    # Start progress
    wo_in_prog = dispatch_service.update_work_order_status(wo_id, "IN_PROGRESS", actor_id="CREW_LEAD_42")
    assert wo_in_prog["status"] == "IN_PROGRESS"

    # Resolve with proof
    proof = "https://storage.mapmycity.in/proofs/patch_complete_123.jpg"
    wo_resolved = dispatch_service.update_work_order_status(
        wo_id,
        "RESOLVED",
        actor_id="CREW_LEAD_42",
        proof_url=proof,
        notes="Cold-mix asphalt laid and roller compacted."
    )
    assert wo_resolved["status"] == "RESOLVED"
    assert wo_resolved["resolution_proof_url"] == proof

    # Invalid status should raise error
    with pytest.raises(ValueError):
        dispatch_service.update_work_order_status(wo_id, "NON_EXISTENT_STATUS")


def test_list_and_filter_work_orders(dispatch_service):
    dispatch_service.create_work_order("c1", "pothole", "ward_bbmp_150")
    dispatch_service.create_work_order("c2", "waterlogging", "ward_bbmp_150")
    dispatch_service.create_work_order("c3", "streetlight_out", "ward_bbmp_174")

    all_orders = dispatch_service.list_work_orders()
    assert len(all_orders) == 3

    ward150_orders = dispatch_service.list_work_orders(ward_id="ward_bbmp_150")
    assert len(ward150_orders) == 2

    ward174_orders = dispatch_service.list_work_orders(ward_id="ward_bbmp_174")
    assert len(ward174_orders) == 1
