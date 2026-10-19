"""
Road Health Index (RHI) and International Roughness Index (IRI) Aggregator.
Processes crowdsourced vehicular accelerometer telemetry and spatial clusters
to evaluate street degradation, calculate IRI, and prioritize repaving programs.
"""

import math
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


class RoadHealthAggregator:
    def __init__(self):
        # Ward road baseline data (km total, typical traffic weights)
        self.ward_metadata = {
            "ward_bbmp_150": {"name": "Bellandur", "network_km": 142.5, "traffic_factor": 1.4},
            "ward_bbmp_174": {"name": "HSR Layout", "network_km": 118.0, "traffic_factor": 1.2},
            "ward_bbmp_085": {"name": "Doddanekkundi", "network_km": 96.0, "traffic_factor": 1.3},
            "ward_bbmp_default": {"name": "Central Municipal Ward", "network_km": 100.0, "traffic_factor": 1.0}
        }

    def compute_iri_from_telemetry(
        self,
        vertical_accel_samples: List[float],
        speed_kmh: float
    ) -> float:
        """
        Estimates International Roughness Index (IRI in m/km) from vertical accelerometer
        jolt variance and vehicle traversal speed.
        IRI < 2.0: Smooth / Newly Paved
        2.0 - 4.0: Fair / Normal Wear
        4.0 - 6.0: Rough / Frequent Bumps
        > 6.0: Very Poor / Severe Potholes & Rutting
        """
        if not vertical_accel_samples:
            return 2.0

        valid_speed = max(speed_kmh, 15.0)  # Normalize low-speed distortion
        # Calculate root mean square of vertical acceleration
        mean_sq = sum(a ** 2 for a in vertical_accel_samples) / len(vertical_accel_samples)
        rms_accel = math.sqrt(mean_sq)

        # ASTM E1926 golden car response approximation
        # Faster speed dampens perceived IRI per unit acceleration
        speed_factor = math.pow(valid_speed / 40.0, 0.45)
        raw_iri = (rms_accel * 4.2) / speed_factor
        return round(max(0.8, min(raw_iri, 12.0)), 2)

    def iri_to_road_health_index(self, iri: float) -> int:
        """
        Converts IRI (m/km) to a 0-100 RHI Score:
        IRI <= 1.5 -> RHI 95-100 (Pristine)
        IRI == 3.5 -> RHI ~ 65 (Acceptable)
        IRI == 6.0 -> RHI ~ 35 (Poor)
        IRI >= 9.0 -> RHI < 15 (Critical)
        """
        if iri <= 1.2:
            return 100
        score = 100.0 - (iri - 1.2) * 11.5
        return int(max(5, min(100, round(score))))

    def calculate_repaving_priority(
        self,
        rhi_score: int,
        defect_cluster_count: int,
        traffic_factor: float = 1.0
    ) -> float:
        """
        Calculates a 0-100 Repaving Urgency Priority Score.
        Combines road surface degradation (50%), active defect cluster count (30%),
        and traffic multiplier (20%).
        """
        degradation_component = (100 - rhi_score) * 0.50
        defect_component = min(defect_cluster_count * 4.0, 30.0)
        traffic_component = min((traffic_factor - 1.0) * 50.0, 20.0) if traffic_factor > 1.0 else 10.0

        priority_score = degradation_component + defect_component + traffic_component
        return round(min(100.0, max(0.0, priority_score)), 1)

    def aggregate_ward_health(
        self,
        ward_id: str,
        corridor_samples: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Aggregates road health across monitored street segments within a municipal ward.
        """
        meta = self.ward_metadata.get(ward_id, self.ward_metadata["ward_bbmp_default"])
        if not corridor_samples:
            return {
                "ward_id": ward_id,
                "ward_name": meta["name"],
                "total_monitored_segments": 0,
                "avg_rhi": 80,
                "avg_iri": 2.5,
                "rough_road_km": 0.0,
                "paved_road_pct": 100.0,
                "repaving_urgency": "LOW"
            }

        total_segments = len(corridor_samples)
        total_rhi = sum(c.get("rhi", 75) for c in corridor_samples)
        total_iri = sum(c.get("iri", 3.0) for c in corridor_samples)
        rough_segments = sum(1 for c in corridor_samples if c.get("rhi", 75) < 50)

        avg_rhi = int(round(total_rhi / total_segments))
        avg_iri = round(total_iri / total_segments, 2)
        rough_km = round((rough_segments / total_segments) * meta["network_km"], 1)
        paved_pct = round(((total_segments - rough_segments) / total_segments) * 100.0, 1)

        if avg_rhi < 45:
            urgency = "CRITICAL"
        elif avg_rhi < 65:
            urgency = "HIGH"
        elif avg_rhi < 78:
            urgency = "MODERATE"
        else:
            urgency = "LOW"

        return {
            "ward_id": ward_id,
            "ward_name": meta["name"],
            "total_monitored_segments": total_segments,
            "avg_rhi": avg_rhi,
            "avg_iri": avg_iri,
            "rough_road_km": rough_km,
            "paved_road_pct": paved_pct,
            "repaving_urgency": urgency,
            "traffic_factor": meta["traffic_factor"],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
