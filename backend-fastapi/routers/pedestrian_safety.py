"""
Pedestrian and Cyclist Micro-Mobility Safety Index Router.
Provides endpoints for corridor vulnerability scoring, ward pedestrian audits,
and universal accessibility gap remediation.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import uuid
from datetime import datetime, timezone

from services.pedestrian_safety_engine import PedestrianSafetyEngine

router = APIRouter(prefix="/api/v1/safety", tags=["Pedestrian & Micro-Mobility Safety"])
safety_engine = PedestrianSafetyEngine()

# Ward Corridor Mock Database
WARD_CORRIDORS: Dict[str, List[Dict[str, Any]]] = {
    "ward_101": [
        {
            "id": "corr-101-a",
            "name": "100 Feet Road Corridor",
            "sidewalk_continuity_pct": 75.0,
            "illumination_pct": 80.0,
            "tactile_paving_pct": 40.0,
            "pothole_trip_hazards_count": 2,
            "open_drain_hazard_count": 0,
            "wheelchair_curb_ramps_present": True,
            "pedestrian_flow_density": "HIGH"
        },
        {
            "id": "corr-101-b",
            "name": "Old Madras Road Underpass Link",
            "sidewalk_continuity_pct": 30.0,
            "illumination_pct": 35.0,
            "tactile_paving_pct": 0.0,
            "pothole_trip_hazards_count": 6,
            "open_drain_hazard_count": 1,
            "wheelchair_curb_ramps_present": False,
            "pedestrian_flow_density": "CRITICAL_TRANSIT_HUB"
        }
    ],
    "ward_102": [
        {
            "id": "corr-102-a",
            "name": "Indiranagar 12th Main Crossway",
            "sidewalk_continuity_pct": 88.0,
            "illumination_pct": 85.0,
            "tactile_paving_pct": 65.0,
            "pothole_trip_hazards_count": 1,
            "open_drain_hazard_count": 0,
            "wheelchair_curb_ramps_present": True,
            "pedestrian_flow_density": "MODERATE"
        }
    ]
}


class CorridorAuditRequest(BaseModel):
    corridor_name: str = Field(..., min_length=2)
    sidewalk_continuity_pct: float = Field(..., ge=0.0, le=100.0)
    illumination_pct: float = Field(..., ge=0.0, le=100.0)
    tactile_paving_pct: float = Field(..., ge=0.0, le=100.0)
    pothole_trip_hazards_count: int = Field(0, ge=0)
    open_drain_hazard_count: int = Field(0, ge=0)
    wheelchair_curb_ramps_present: bool = Field(True)
    pedestrian_flow_density: str = Field("MODERATE")


@router.post("/corridor/score", summary="Calculate pedestrian hazard index for corridor")
def score_corridor(request: CorridorAuditRequest):
    """Computes composite pedestrian hazard index (0-100) and actionable interventions."""
    result = safety_engine.evaluate_corridor_hazard(
        corridor_name=request.corridor_name,
        sidewalk_continuity_pct=request.sidewalk_continuity_pct,
        illumination_pct=request.illumination_pct,
        tactile_paving_pct=request.tactile_paving_pct,
        pothole_trip_hazards_count=request.pothole_trip_hazards_count,
        open_drain_hazard_count=request.open_drain_hazard_count,
        wheelchair_curb_ramps_present=request.wheelchair_curb_ramps_present,
        pedestrian_flow_density=request.pedestrian_flow_density
    )
    return result


@router.get("/wards/{ward_id}/audit", summary="Get complete pedestrian safety audit for ward")
def get_ward_safety_audit(ward_id: str):
    """Returns scored corridors, average ward hazard rating, and priority interventions."""
    corridors = WARD_CORRIDORS.get(ward_id)
    if not corridors:
        # Generate default dynamic corridors for any requested ward
        corridors = [
            {
                "id": f"corr-{ward_id}-1",
                "name": f"Ward {ward_id} Main Radial Avenue",
                "sidewalk_continuity_pct": 55.0,
                "illumination_pct": 60.0,
                "tactile_paving_pct": 20.0,
                "pothole_trip_hazards_count": 3,
                "open_drain_hazard_count": 1,
                "wheelchair_curb_ramps_present": False,
                "pedestrian_flow_density": "HIGH"
            }
        ]

    scored = []
    total_score = 0.0
    for c in corridors:
        evaluation = safety_engine.evaluate_corridor_hazard(
            corridor_name=c["name"],
            sidewalk_continuity_pct=c["sidewalk_continuity_pct"],
            illumination_pct=c["illumination_pct"],
            tactile_paving_pct=c["tactile_paving_pct"],
            pothole_trip_hazards_count=c["pothole_trip_hazards_count"],
            open_drain_hazard_count=c["open_drain_hazard_count"],
            wheelchair_curb_ramps_present=c["wheelchair_curb_ramps_present"],
            pedestrian_flow_density=c["pedestrian_flow_density"]
        )
        scored.append({"corridor_id": c["id"], **evaluation})
        total_score += evaluation["pedestrian_hazard_index"]

    avg_hazard = round(total_score / len(scored), 1) if scored else 0.0

    return {
        "ward_id": ward_id,
        "ward_average_hazard_index": avg_hazard,
        "overall_status": "NEEDS_ATTENTION" if avg_hazard > 50.0 else "FAIR",
        "audited_corridors_count": len(scored),
        "corridors": scored,
        "audited_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/city/high-risk-corridors", summary="List high-risk pedestrian corridors across city")
def get_high_risk_corridors():
    """Returns corridors with Severe or High risk requiring immediate urban design interventions."""
    all_corridors = []
    for ward_id, corridor_list in WARD_CORRIDORS.items():
        for c in corridor_list:
            evaluation = safety_engine.evaluate_corridor_hazard(
                corridor_name=c["name"],
                sidewalk_continuity_pct=c["sidewalk_continuity_pct"],
                illumination_pct=c["illumination_pct"],
                tactile_paving_pct=c["tactile_paving_pct"],
                pothole_trip_hazards_count=c["pothole_trip_hazards_count"],
                open_drain_hazard_count=c["open_drain_hazard_count"],
                wheelchair_curb_ramps_present=c["wheelchair_curb_ramps_present"],
                pedestrian_flow_density=c["pedestrian_flow_density"]
            )
            if evaluation["pedestrian_hazard_index"] >= 45.0:
                all_corridors.append({
                    "ward_id": ward_id,
                    "corridor_id": c["id"],
                    **evaluation
                })

    all_corridors.sort(key=lambda x: x["pedestrian_hazard_index"], reverse=True)
    return {
        "high_risk_corridors": all_corridors,
        "total_critical_count": len(all_corridors)
    }
