"""
CivicAssetTagService — Physical QR / NFC Municipal Infrastructure Registry & Inspection Service.
Enables:
1. Verification and resolution of physical QR codes attached to civic assets (streetlights, transformers, storm drains, etc.).
2. Condition inspection logging by citizens, ward engineers, and contractors.
3. Automated health state transitions ('OPERATIONAL', 'DEGRADED', 'FAULTY', 'HAZARDOUS').
4. Spatial discovery of nearby civic assets using Haversine distance calculations.
"""

from typing import List, Dict, Any, Optional
import math
import uuid
from datetime import datetime, timezone

# Seeded in-memory asset database for rapid lookup & zero-latency edge sync
INITIAL_CIVIC_ASSETS: List[Dict[str, Any]] = [
    {
        "id": "asset-blr-stlt-04921",
        "asset_code": "BLR-STLT-04921",
        "asset_type": "streetlight",
        "ward_id": "ward_101",
        "location_description": "Pole #42, 100 Feet Rd, near 12th Main Junction, Indiranagar",
        "latitude": 12.971891,
        "longitude": 77.641154,
        "qr_payload": "mapmycity://asset/BLR-STLT-04921?token=sec_98124_stlt",
        "qr_verification_token": "sec_98124_stlt",
        "department": "BBMP_ELECTRICAL",
        "installation_year": 2021,
        "last_inspected_at": "2026-09-10T10:00:00Z",
        "health_status": "FAULTY",
        "active_cluster_id": "cluster-blr-101",
        "created_at": "2026-01-15T08:00:00Z"
    },
    {
        "id": "asset-blr-mnh-01029",
        "asset_code": "BLR-MNH-01029",
        "asset_type": "manhole",
        "ward_id": "ward_101",
        "location_description": "Cast iron storm chamber opposite Metro Pillar 84",
        "latitude": 12.973412,
        "longitude": 77.642981,
        "qr_payload": "mapmycity://asset/BLR-MNH-01029?token=sec_55102_mnh",
        "qr_verification_token": "sec_55102_mnh",
        "department": "BWSSB_WATER_SEWERAGE",
        "installation_year": 2019,
        "last_inspected_at": "2026-08-20T14:30:00Z",
        "health_status": "OPERATIONAL",
        "active_cluster_id": None,
        "created_at": "2026-01-15T08:00:00Z"
    },
    {
        "id": "asset-blr-trf-00318",
        "asset_code": "BLR-TRF-00318",
        "asset_type": "traffic_signal",
        "ward_id": "ward_102",
        "location_description": "Indiranagar 80 Feet Road & 12th Main 4-Way Traffic Signal",
        "latitude": 12.975200,
        "longitude": 77.645500,
        "qr_payload": "mapmycity://asset/BLR-TRF-00318?token=sec_11902_trf",
        "qr_verification_token": "sec_11902_trf",
        "department": "BANGALORE_TRAFFIC_POLICE_BTP",
        "installation_year": 2023,
        "last_inspected_at": "2026-10-01T09:15:00Z",
        "health_status": "OPERATIONAL",
        "active_cluster_id": None,
        "created_at": "2026-02-01T08:00:00Z"
    },
    {
        "id": "asset-blr-drn-00844",
        "asset_code": "BLR-DRN-00844",
        "asset_type": "storm_drain",
        "ward_id": "ward_101",
        "location_description": "Primary culvert inlet behind CMH Hospital Road",
        "latitude": 12.978100,
        "longitude": 77.640200,
        "qr_payload": "mapmycity://asset/BLR-DRN-00844?token=sec_77201_drn",
        "qr_verification_token": "sec_77201_drn",
        "department": "BBMP_STORMWATER_DRAINS",
        "installation_year": 2020,
        "last_inspected_at": "2026-09-28T16:00:00Z",
        "health_status": "DEGRADED",
        "active_cluster_id": None,
        "created_at": "2026-01-20T08:00:00Z"
    }
]

_ASSETS_MAP: Dict[str, Dict[str, Any]] = {a["asset_code"]: dict(a) for a in INITIAL_CIVIC_ASSETS}
_INSPECTIONS: List[Dict[str, Any]] = []


def _haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class CivicAssetTagService:
    @staticmethod
    def get_asset_by_code(asset_code: str) -> Optional[Dict[str, Any]]:
        """Look up registered asset by unique code (e.g. BLR-STLT-04921)."""
        return _ASSETS_MAP.get(asset_code.upper().strip())

    @staticmethod
    def verify_and_resolve_qr(qr_payload_or_code: str) -> Dict[str, Any]:
        """
        Parses QR string: supports both raw code (e.g. 'BLR-STLT-04921')
        and standard deep-link uri ('mapmycity://asset/BLR-STLT-04921?token=...').
        """
        raw = qr_payload_or_code.strip()
        code = raw

        if "asset/" in raw:
            part = raw.split("asset/")[1]
            code = part.split("?")[0].strip()

        asset = CivicAssetTagService.get_asset_by_code(code)
        if not asset:
            raise KeyError(f"Civic asset with code '{code}' is not registered in the municipal database.")

        return asset

    @staticmethod
    def register_asset(
        asset_code: str,
        asset_type: str,
        ward_id: str,
        latitude: float,
        longitude: float,
        location_description: str,
        department: str = "BBMP_CIVIC_WORKS",
        installation_year: int = 2024,
    ) -> Dict[str, Any]:
        """Registers a new physical infrastructure asset with an authenticated QR payload."""
        code = asset_code.upper().strip()
        if code in _ASSETS_MAP:
            raise ValueError(f"Asset code {code} is already registered.")

        token = f"sec_{uuid.uuid4().hex[:10]}"
        asset_id = f"asset-{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        record = {
            "id": asset_id,
            "asset_code": code,
            "asset_type": asset_type.lower().strip(),
            "ward_id": ward_id.strip(),
            "location_description": location_description.strip(),
            "latitude": float(latitude),
            "longitude": float(longitude),
            "qr_payload": f"mapmycity://asset/{code}?token={token}",
            "qr_verification_token": token,
            "department": department,
            "installation_year": installation_year,
            "last_inspected_at": None,
            "health_status": "OPERATIONAL",
            "active_cluster_id": None,
            "created_at": now_iso
        }

        _ASSETS_MAP[code] = record
        return record

    @staticmethod
    def record_inspection(
        asset_code: str,
        condition_rating: int,
        inspector_id: str = "citizen",
        inspector_role: str = "citizen",
        reported_defect: Optional[str] = None,
        notes: Optional[str] = None,
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Records an inspection check and updates the asset's health status based on rating:
        1: HAZARDOUS
        2: FAULTY
        3: DEGRADED
        4-5: OPERATIONAL
        """
        asset = CivicAssetTagService.get_asset_by_code(asset_code)
        if not asset:
            raise KeyError(f"Asset {asset_code} not found.")

        if not (1 <= condition_rating <= 5):
            raise ValueError("condition_rating must be between 1 and 5.")

        # Update health status
        if condition_rating == 1:
            asset["health_status"] = "HAZARDOUS"
        elif condition_rating == 2:
            asset["health_status"] = "FAULTY"
        elif condition_rating == 3:
            asset["health_status"] = "DEGRADED"
        else:
            asset["health_status"] = "OPERATIONAL"

        now_iso = datetime.now(timezone.utc).isoformat()
        asset["last_inspected_at"] = now_iso

        inspection_record = {
            "id": f"insp-{uuid.uuid4().hex[:10]}",
            "asset_tag_id": asset["id"],
            "asset_code": asset["asset_code"],
            "inspector_id": inspector_id,
            "inspector_role": inspector_role,
            "condition_rating": condition_rating,
            "reported_defect": reported_defect,
            "notes": notes,
            "photo_url": photo_url,
            "health_status": asset["health_status"],
            "created_at": now_iso
        }

        _INSPECTIONS.append(inspection_record)
        return inspection_record

    @staticmethod
    def get_nearby_assets(lat: float, lon: float, radius_meters: float = 1000.0) -> List[Dict[str, Any]]:
        """Finds all registered assets within radius meters of coordinates."""
        results = []
        for asset in _ASSETS_MAP.values():
            dist = _haversine_distance_meters(lat, lon, asset["latitude"], asset["longitude"])
            if dist <= radius_meters:
                item = dict(asset)
                item["distance_meters"] = round(dist, 1)
                results.append(item)
        results.sort(key=lambda x: x["distance_meters"])
        return results

    @staticmethod
    def list_all_assets(ward_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns all registered assets, optionally filtered by ward."""
        items = list(_ASSETS_MAP.values())
        if ward_id:
            items = [a for a in items if a["ward_id"] == ward_id]
        return items

    @staticmethod
    def reset_to_initial():
        """Resets registry to defaults for testing."""
        global _ASSETS_MAP, _INSPECTIONS
        _ASSETS_MAP = {a["asset_code"]: dict(a) for a in INITIAL_CIVIC_ASSETS}
        _INSPECTIONS = []
