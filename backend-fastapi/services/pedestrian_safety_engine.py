"""
Pedestrian and Cyclist Micro-Mobility Safety Engine.
Analyzes pedestrian hazard index, sidewalk continuity, lighting adequacy,
universal accessibility (tactile paving, curb ramps), and road conflict zones.
"""

from typing import Dict, Any, List, Optional
import math


class PedestrianSafetyEngine:
    """Evaluates multi-factor vulnerability index for pedestrians, wheelchair users, and cyclists."""

    def evaluate_corridor_hazard(
        self,
        corridor_name: str,
        sidewalk_continuity_pct: float,
        illumination_pct: float,
        tactile_paving_pct: float,
        pothole_trip_hazards_count: int,
        open_drain_hazard_count: int,
        wheelchair_curb_ramps_present: bool = True,
        pedestrian_flow_density: str = "MODERATE"
    ) -> Dict[str, Any]:
        """
        Computes composite pedestrian hazard index (0 to 100, where 100 is extreme risk).
        """
        sidewalk = max(0.0, min(100.0, float(sidewalk_continuity_pct)))
        lighting = max(0.0, min(100.0, float(illumination_pct)))
        tactile = max(0.0, min(100.0, float(tactile_paving_pct)))
        trips = max(0, int(pothole_trip_hazards_count))
        open_drains = max(0, int(open_drain_hazard_count))

        # Base vulnerability from missing infrastructure (0 to 60 points)
        sidewalk_deficit = (100.0 - sidewalk) * 0.30       # Up to 30 pts
        lighting_deficit = (100.0 - lighting) * 0.18       # Up to 18 pts
        tactile_deficit = (100.0 - tactile) * 0.12         # Up to 12 pts

        # Physical hazard penalties (up to 40 points)
        trip_penalty = min(20.0, trips * 3.5)
        drain_penalty = min(20.0, open_drains * 7.0)

        # Accessibility modifier
        accessibility_penalty = 0.0 if wheelchair_curb_ramps_present else 8.0

        # Flow density multiplier
        density_multipliers = {
            "LOW": 0.9,
            "MODERATE": 1.0,
            "HIGH": 1.15,
            "CRITICAL_TRANSIT_HUB": 1.30
        }
        mult = density_multipliers.get(pedestrian_flow_density.upper(), 1.0)

        raw_index = (sidewalk_deficit + lighting_deficit + tactile_deficit + trip_penalty + drain_penalty + accessibility_penalty) * mult
        hazard_index = round(min(100.0, max(0.0, raw_index)), 1)

        # Classify risk tier
        if hazard_index < 25.0:
            risk_tier = "LOW_RISK"
        elif hazard_index < 50.0:
            risk_tier = "MODERATE_RISK"
        elif hazard_index < 75.0:
            risk_tier = "HIGH_RISK"
        else:
            risk_tier = "SEVERE_VULNERABILITY"

        # Actionable engineering recommendations
        interventions: List[str] = []
        if sidewalk < 60.0:
            interventions.append("Construct continuous paved sidewalk with minimum 1.8m clear walkway.")
        if trips > 2:
            interventions.append(f"Repair {trips} high-priority trip hazard craters and pavement cracks.")
        if open_drains > 0:
            interventions.append(f"URGENT: Install ductile iron safety grating on {open_drains} open storm drain inlets.")
        if lighting < 50.0:
            interventions.append("Retrofit high-efficiency 90W LED streetlights at 25-meter intervals.")
        if tactile < 40.0:
            interventions.append("Install IRC-compliant tactile directional and warning paving for visual impairment safety.")
        if not wheelchair_curb_ramps_present:
            interventions.append("Install 1:12 gradient dropped curb ramps at pedestrian road crossings.")

        if not interventions:
            interventions.append("Corridor meets pedestrian safety standards; schedule routine quarterly maintenance.")

        return {
            "corridor_name": corridor_name,
            "pedestrian_hazard_index": hazard_index,
            "risk_tier": risk_tier,
            "metrics": {
                "sidewalk_continuity_pct": sidewalk,
                "illumination_adequacy_pct": lighting,
                "tactile_paving_pct": tactile,
                "pothole_trip_hazards_count": trips,
                "open_drain_hazard_count": open_drains,
                "wheelchair_curb_ramps_present": wheelchair_curb_ramps_present,
                "pedestrian_flow_density": pedestrian_flow_density
            },
            "recommended_interventions": interventions,
            "audit_standard": "IRC_SP_091_PEDESTRIAN_URBAN_DESIGN"
        }
