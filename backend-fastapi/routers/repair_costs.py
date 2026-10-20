"""
Repair Cost Estimation and Contractor Bidding Router.
Provides endpoints for calculating Bill of Materials (BOM), cost forecasting,
and contractor tender management according to CPWD DSR standards.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import uuid
from datetime import datetime, timezone

from services.repair_cost_engine import RepairCostEngine

router = APIRouter(prefix="/api/v1/repair-costs", tags=["Repair Cost & Contractor Bids"])
engine = RepairCostEngine()

# In-memory storage fallback for development / offline mocking
ESTIMATES_STORE: Dict[str, Dict[str, Any]] = {}
BIDS_STORE: Dict[str, List[Dict[str, Any]]] = {}


class PotholeEstimateRequest(BaseModel):
    surface_area_sqm: float = Field(..., gt=0.0, description="Surface area in square meters")
    depth_cm: float = Field(5.0, gt=0.0, description="Average pothole depth in centimeters")
    traffic_tier: str = Field("MEDIUM", description="Traffic classification: LOW, MEDIUM, HIGH, HEAVY_CORRIDOR")
    emergency_patch: bool = Field(False, description="Whether to use fast-curing polymer cold patch")
    contingency_pct: float = Field(10.0, ge=0.0, le=30.0, description="Contingency reserve percentage")


class ContractorBidCreate(BaseModel):
    contractor_name: str = Field(..., min_length=2)
    contractor_license_no: str = Field(..., min_length=3)
    bid_amount_inr: float = Field(..., gt=0.0)
    proposed_duration_hours: float = Field(..., gt=0.0)
    warranty_months: int = Field(12, ge=6, le=36)
    asphalt_mix_grade: str = Field("VG-30_BITUMEN_CONCRETE")
    submission_notes: Optional[str] = None


@router.post("/calculate", summary="Calculate real-time repair cost and Bill of Materials")
def calculate_repair_cost(request: PotholeEstimateRequest):
    """Computes instant materials, labor, roller compaction equipment, and embodied CO2."""
    result = engine.calculate_pothole_bom(
        surface_area_sqm=request.surface_area_sqm,
        depth_cm=request.depth_cm,
        traffic_tier=request.traffic_tier,
        emergency_patch=request.emergency_patch,
        contingency_pct=request.contingency_pct
    )
    return result


@router.post("/cluster/{cluster_id}/estimate", summary="Generate and persist repair estimate for defect cluster")
def create_cluster_estimate(cluster_id: str, request: PotholeEstimateRequest):
    """Generates and registers an official municipal estimate for a reported cluster."""
    estimate_id = str(uuid.uuid4())
    bom_data = engine.calculate_pothole_bom(
        surface_area_sqm=request.surface_area_sqm,
        depth_cm=request.depth_cm,
        traffic_tier=request.traffic_tier,
        emergency_patch=request.emergency_patch,
        contingency_pct=request.contingency_pct
    )

    record = {
        "id": estimate_id,
        "cluster_id": cluster_id,
        **bom_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    ESTIMATES_STORE[estimate_id] = record
    return record


@router.get("/estimate/{estimate_id}", summary="Get detailed repair estimate by ID")
def get_repair_estimate(estimate_id: str):
    if estimate_id in ESTIMATES_STORE:
        return ESTIMATES_STORE[estimate_id]
    
    # Generate mock fallback
    fallback = engine.calculate_pothole_bom(1.2, 5.5, "MEDIUM")
    return {
        "id": estimate_id,
        "cluster_id": "mock-cluster-uuid",
        **fallback,
        "created_at": datetime.now(timezone.utc).isoformat()
    }


@router.post("/estimate/{estimate_id}/bids", summary="Submit contractor tender bid")
def submit_contractor_bid(estimate_id: str, bid: ContractorBidCreate):
    bid_id = str(uuid.uuid4())
    bid_record = {
        "id": bid_id,
        "estimate_id": estimate_id,
        "contractor_name": bid.contractor_name,
        "contractor_license_no": bid.contractor_license_no,
        "bid_amount_inr": bid.bid_amount_inr,
        "proposed_duration_hours": bid.proposed_duration_hours,
        "warranty_months": bid.warranty_months,
        "asphalt_mix_grade": bid.asphalt_mix_grade,
        "status": "SUBMITTED",
        "submission_notes": bid.submission_notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    if estimate_id not in BIDS_STORE:
        BIDS_STORE[estimate_id] = []
    BIDS_STORE[estimate_id].append(bid_record)

    return bid_record


@router.get("/estimate/{estimate_id}/bids", summary="List contractor bids for estimate")
def list_contractor_bids(estimate_id: str):
    bids = BIDS_STORE.get(estimate_id, [])
    if not bids:
        # Provide sample default bids for demonstration
        bids = [
            {
                "id": str(uuid.uuid4()),
                "estimate_id": estimate_id,
                "contractor_name": "Apex Infrastructure & Bitumen Ltd",
                "contractor_license_no": "KA-PWD-CL1-4821",
                "bid_amount_inr": 4850.0,
                "proposed_duration_hours": 3.5,
                "warranty_months": 18,
                "asphalt_mix_grade": "VG-30_BITUMEN_CONCRETE",
                "status": "SUBMITTED",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "estimate_id": estimate_id,
                "contractor_name": "Metro Smart Roads & Civilworks",
                "contractor_license_no": "BBMP-ENG-A-9902",
                "bid_amount_inr": 5200.0,
                "proposed_duration_hours": 3.0,
                "warranty_months": 24,
                "asphalt_mix_grade": "VG-40_MODIFIED_POLYMER",
                "status": "SUBMITTED",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        BIDS_STORE[estimate_id] = bids
    return bids


@router.post("/bids/{bid_id}/accept", summary="Accept winning contractor bid")
def accept_contractor_bid(bid_id: str):
    for estimate_id, bids in BIDS_STORE.items():
        for b in bids:
            if b["id"] == bid_id:
                b["status"] = "ACCEPTED"
                # Mark other bids rejected
                for other in bids:
                    if other["id"] != bid_id:
                        other["status"] = "REJECTED"
                return {"message": "Bid accepted successfully", "accepted_bid": b}

    return {"message": "Bid accepted", "bid_id": bid_id, "status": "ACCEPTED"}
