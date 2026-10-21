"""
REST Router for Civic Asset Tags & Physical QR Infrastructure Registry.
Allows citizens and municipal field engineers to:
- Resolve physical QR codes on street infrastructure
- Query nearby registered civic assets using GPS coordinates
- Log condition inspections with photo verification
- Register new municipal assets with authenticated QR payloads
"""

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from services.civic_asset_service import CivicAssetTagService

router = APIRouter(prefix="/api/v1/assets", tags=["Civic Asset Tags & QR Infrastructure Registry"])


class RegisterAssetRequest(BaseModel):
    asset_code: str = Field(..., max_length=64, description="Unique asset code (e.g. BLR-STLT-04921)")
    asset_type: str = Field(..., max_length=48, description="Asset type: streetlight, manhole, traffic_signal, etc.")
    ward_id: str = Field(..., max_length=64, description="Municipal ward identifier")
    latitude: float = Field(..., description="GPS Latitude")
    longitude: float = Field(..., description="GPS Longitude")
    location_description: str = Field(..., description="Human-readable physical location")
    department: Optional[str] = Field("BBMP_CIVIC_WORKS", description="Responsible municipal department")
    installation_year: Optional[int] = Field(2024, description="Year of physical installation")


class RecordInspectionRequest(BaseModel):
    condition_rating: int = Field(..., ge=1, le=5, description="Condition rating from 1 (hazardous) to 5 (excellent)")
    inspector_id: Optional[str] = Field("citizen", description="Inspector identifier or username")
    inspector_role: Optional[str] = Field("citizen", description="Role: citizen, contractor, ward_engineer, auditor")
    reported_defect: Optional[str] = Field(None, description="Observed defect title")
    notes: Optional[str] = Field(None, description="Detailed field notes")
    photo_url: Optional[str] = Field(None, description="Evidence photo URL")


@router.get("/lookup", response_model=Dict[str, Any])
async def lookup_civic_asset(
    code: Optional[str] = Query(None, description="Asset code (e.g. BLR-STLT-04921)"),
    qr: Optional[str] = Query(None, description="Raw QR code text or deep link URI")
):
    """
    Resolves an infrastructure asset by its code or scanned QR payload.
    """
    query_str = qr or code
    if not query_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'code' or 'qr' query parameter."
        )

    try:
        return CivicAssetTagService.verify_and_resolve_qr(query_str)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/nearby", response_model=List[Dict[str, Any]])
async def get_nearby_assets(
    lat: float = Query(..., description="Current Latitude"),
    lon: float = Query(..., description="Current Longitude"),
    radius_meters: float = Query(1000.0, ge=10.0, le=10000.0, description="Search radius in meters")
):
    """
    Returns registered civic assets within the specified radius of the coordinates,
    sorted by closest distance.
    """
    return CivicAssetTagService.get_nearby_assets(lat, lon, radius_meters=radius_meters)


@router.get("", response_model=List[Dict[str, Any]])
async def list_civic_assets(ward_id: Optional[str] = Query(None, description="Filter by municipal ward ID")):
    """
    Lists all registered civic assets, optionally filtered by ward.
    """
    return CivicAssetTagService.list_all_assets(ward_id=ward_id)


@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def register_civic_asset(req: RegisterAssetRequest):
    """
    Registers a new municipal infrastructure asset and generates a cryptographically authenticated QR payload.
    """
    try:
        asset = CivicAssetTagService.register_asset(
            asset_code=req.asset_code,
            asset_type=req.asset_type,
            ward_id=req.ward_id,
            latitude=req.latitude,
            longitude=req.longitude,
            location_description=req.location_description,
            department=req.department or "BBMP_CIVIC_WORKS",
            installation_year=req.installation_year or 2024,
        )
        return asset
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{asset_code}/inspect", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def record_asset_inspection(asset_code: str, req: RecordInspectionRequest):
    """
    Records a field inspection for a civic asset, updating its health status and maintenance history.
    """
    try:
        return CivicAssetTagService.record_inspection(
            asset_code=asset_code,
            condition_rating=req.condition_rating,
            inspector_id=req.inspector_id or "citizen",
            inspector_role=req.inspector_role or "citizen",
            reported_defect=req.reported_defect,
            notes=req.notes,
            photo_url=req.photo_url,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
