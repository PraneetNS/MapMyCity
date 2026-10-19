"""
Unit tests for Road Health Index (RHI) and International Roughness Index (IRI) Aggregator.
"""

import pytest
from services.road_health_aggregator import RoadHealthAggregator


@pytest.fixture
def aggregator():
    return RoadHealthAggregator()


def test_compute_iri_smooth_road(aggregator):
    # Smooth highway: tiny vertical jolt vibrations around 0.1 - 0.2 m/s^2
    samples = [0.12, -0.15, 0.08, -0.05, 0.18, 0.09, -0.11]
    iri = aggregator.compute_iri_from_telemetry(samples, speed_kmh=60.0)
    assert iri < 2.0
    assert iri >= 0.8


def test_compute_iri_rough_road(aggregator):
    # Rough road with pothole hits: violent vertical jolts up to 2.5 - 3.5 m/s^2
    samples = [1.8, -2.4, 3.1, -1.9, 2.8, -3.2, 0.5, 2.1]
    iri = aggregator.compute_iri_from_telemetry(samples, speed_kmh=40.0)
    assert iri >= 5.0


def test_compute_iri_empty_samples(aggregator):
    iri = aggregator.compute_iri_from_telemetry([], speed_kmh=50.0)
    assert iri == 2.0


def test_iri_to_road_health_index(aggregator):
    assert aggregator.iri_to_road_health_index(1.0) == 100
    assert aggregator.iri_to_road_health_index(1.2) == 100

    rhi_fair = aggregator.iri_to_road_health_index(3.5)
    assert 65 <= rhi_fair <= 80

    rhi_poor = aggregator.iri_to_road_health_index(7.0)
    assert 20 <= rhi_poor <= 40

    rhi_crit = aggregator.iri_to_road_health_index(11.0)
    assert rhi_crit <= 15


def test_calculate_repaving_priority_weighting(aggregator):
    # Highly degraded road, high defect count, high traffic corridor
    priority_high = aggregator.calculate_repaving_priority(
        rhi_score=25,
        defect_cluster_count=8,
        traffic_factor=1.4
    )
    assert priority_high >= 75.0

    # Pristine quiet neighborhood road
    priority_low = aggregator.calculate_repaving_priority(
        rhi_score=95,
        defect_cluster_count=0,
        traffic_factor=1.0
    )
    assert priority_low <= 15.0


def test_aggregate_ward_health_metrics(aggregator):
    corridors = [
        {"name": "Street A", "rhi": 40, "iri": 6.0},
        {"name": "Street B", "rhi": 30, "iri": 7.2},
        {"name": "Street C", "rhi": 85, "iri": 2.2},
        {"name": "Street D", "rhi": 45, "iri": 5.5}
    ]

    res = aggregator.aggregate_ward_health("ward_bbmp_150", corridors)
    assert res["ward_id"] == "ward_bbmp_150"
    assert res["ward_name"] == "Bellandur"
    assert res["total_monitored_segments"] == 4
    assert res["avg_rhi"] == 50
    assert res["paved_road_pct"] == 25.0
    assert res["repaving_urgency"] == "HIGH"
    assert res["rough_road_km"] > 0


def test_aggregate_ward_health_empty(aggregator):
    res = aggregator.aggregate_ward_health("ward_bbmp_174", [])
    assert res["total_monitored_segments"] == 0
    assert res["avg_rhi"] == 80
    assert res["repaving_urgency"] == "LOW"
