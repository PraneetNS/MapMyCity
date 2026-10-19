"""
FastAPI Router for Road Health Index (RHI), International Roughness Index (IRI),
and Municipal Repaving Priority Rankings.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from services.road_health_aggregator import RoadHealthAggregator

router = APIRouter(prefix="/api/v1/road-health", tags=["Road Health & Roughness Index"])
rhi_aggregator = RoadHealthAggregator()


class ComputeIRIRequest(BaseModel):
    vertical_accel_samples: List[float] = Field(..., description="Z-axis accelerometer readings in m/s^2")
    speed_kmh: float = Field(..., ge=0.0, le=180.0, description="Vehicle speed in km/h")


class PriorityCorridorItem(BaseModel):
    corridor_id: str
    street_name: str
    ward_id: str
    rhi_score: int
    iri_m_per_km: float
    defect_clusters: int
    repaving_priority_score: float
    recommended_action: str


@router.post("/compute-iri", summary="Calculate IRI and Road Health Index from accelerometer telemetry")
async def compute_iri(req: ComputeIRIRequest):
    iri = rhi_aggregator.compute_iri_from_telemetry(req.vertical_accel_samples, req.speed_kmh)
    rhi = rhi_aggregator.iri_to_road_health_index(iri)
    
    if rhi >= 80:
        condition = "GOOD"
    elif rhi >= 55:
        condition = "FAIR"
    elif rhi >= 35:
        condition = "POOR"
    else:
        condition = "CRITICAL_SURFACE_FAILURE"

    return {
        "iri_m_per_km": iri,
        "road_health_index": rhi,
        "surface_condition": condition,
        "sample_count": len(req.vertical_accel_samples),
        "vehicle_speed_kmh": req.speed_kmh
    }


@router.get("/wards/{ward_id}", summary="Get ward-level road network health and roughness metrics")
async def get_ward_road_health(ward_id: str):
    # Simulated corridor telemetry for the ward
    simulated_corridors = [
        {"name": "Outer Ring Road Sector 1", "rhi": 42, "iri": 5.4},
        {"name": "Sarjapur Link Boulevard", "rhi": 38, "iri": 6.1},
        {"name": "14th Main Arterial", "rhi": 72, "iri": 2.8},
        {"name": "5th Cross Residential", "rhi": 65, "iri": 3.4},
        {"name": "Kasavanahalli Main Rd", "rhi": 31, "iri": 7.2}
    ]
    ward_summary = rhi_aggregator.aggregate_ward_health(ward_id, simulated_corridors)
    return ward_summary


@router.get("/priority-corridors", summary="Ranked street corridors prioritized for municipal resurfacing")
async def get_priority_corridors(
    ward_id: Optional[str] = Query(None, description="Filter by Ward ID"),
    limit: int = Query(10, ge=1, le=50)
):
    demo_corridors = [
        {
            "corridor_id": "corr-01",
            "street_name": "Kasavanahalli Main Road",
            "ward_id": "ward_bbmp_150",
            "rhi_score": 31,
            "iri_m_per_km": 7.2,
            "defect_clusters": 8,
            "traffic_factor": 1.4
        },
        {
            "corridor_id": "corr-02",
            "street_name": "Sarjapur Link Road Jn",
            "ward_id": "ward_bbmp_150",
            "rhi_score": 38,
            "iri_m_per_km": 6.1,
            "defect_clusters": 5,
            "traffic_factor": 1.4
        },
        {
            "corridor_id": "corr-03",
            "street_name": "19th Main Road HSR Sector 1",
            "ward_id": "ward_bbmp_174",
            "rhi_score": 45,
            "iri_m_per_km": 5.1,
            "defect_clusters": 4,
            "traffic_factor": 1.2
        },
        {
            "corridor_id": "corr-04",
            "street_name": "Alpine Eco Road",
            "ward_id": "ward_bbmp_085",
            "rhi_score": 49,
            "iri_m_per_km": 4.8,
            "defect_clusters": 3,
            "traffic_factor": 1.3
        }
    ]

    if ward_id:
        demo_corridors = [c for c in demo_corridors if c["ward_id"] == ward_id]

    ranked = []
    for c in demo_corridors:
        priority = rhi_aggregator.calculate_repaving_priority(
            rhi_score=c["rhi_score"],
            defect_cluster_count=c["defect_clusters"],
            traffic_factor=c["traffic_factor"]
        )
        action = "Full Mill and Overlay" if priority >= 60 else "Deep Patching & Seal Coat"
        ranked.append({
            **c,
            "repaving_priority_score": priority,
            "recommended_action": action
        })

    ranked.sort(key=lambda x: x["repaving_priority_score"], reverse=True)
    return {
        "count": len(ranked[:limit]),
        "corridors": ranked[:limit]
    }
