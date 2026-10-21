"""
Unit tests for CivicAssetTagService.
Verifies QR resolution, asset registration, inspection logging with health transitions,
and Haversine spatial radius discovery.
"""

import pytest
from services.civic_asset_service import CivicAssetTagService

@pytest.fixture(autouse=True)
def reset_service():
    CivicAssetTagService.reset_to_initial()
    yield
    CivicAssetTagService.reset_to_initial()

def test_lookup_existing_asset():
    asset = CivicAssetTagService.get_asset_by_code("BLR-STLT-04921")
    assert asset is not None
    assert asset["asset_type"] == "streetlight"
    assert asset["ward_id"] == "ward_101"
    assert asset["department"] == "BBMP_ELECTRICAL"

def test_verify_and_resolve_qr_payloads():
    # Test raw code
    res1 = CivicAssetTagService.verify_and_resolve_qr("BLR-MNH-01029")
    assert res1["asset_code"] == "BLR-MNH-01029"
    assert res1["asset_type"] == "manhole"

    # Test full deep link QR format
    res2 = CivicAssetTagService.verify_and_resolve_qr("mapmycity://asset/BLR-STLT-04921?token=sec_98124_stlt")
    assert res2["asset_code"] == "BLR-STLT-04921"

    # Test unknown QR
    with pytest.raises(KeyError, match="not registered"):
        CivicAssetTagService.verify_and_resolve_qr("BLR-UNKNOWN-99999")

def test_register_new_asset():
    code = "BLR-HYD-00441"
    new_asset = CivicAssetTagService.register_asset(
        asset_code=code,
        asset_type="water_hydrant",
        ward_id="ward_103",
        latitude=12.980000,
        longitude=77.650000,
        location_description="Near Defense Colony Park gate",
        department="BWSSB_WATER_SEWERAGE"
    )
    assert new_asset["asset_code"] == code
    assert new_asset["health_status"] == "OPERATIONAL"
    assert "mapmycity://asset/BLR-HYD-00441" in new_asset["qr_payload"]

    # Duplicate registration should raise ValueError
    with pytest.raises(ValueError, match="already registered"):
        CivicAssetTagService.register_asset(
            asset_code=code,
            asset_type="water_hydrant",
            ward_id="ward_103",
            latitude=12.98,
            longitude=77.65,
            location_description="Duplicate"
        )

def test_record_inspection_and_health_transitions():
    code = "BLR-TRF-00318"
    # Inspect with rating 2 -> FAULTY
    insp = CivicAssetTagService.record_inspection(
        asset_code=code,
        condition_rating=2,
        inspector_id="eng_kumar_04",
        inspector_role="ward_engineer",
        reported_defect="Red amber light flicker",
        notes="Timing board controller replaced soon."
    )
    assert insp["condition_rating"] == 2
    assert insp["health_status"] == "FAULTY"

    updated = CivicAssetTagService.get_asset_by_code(code)
    assert updated["health_status"] == "FAULTY"
    assert updated["last_inspected_at"] is not None

    # Inspect with rating 1 -> HAZARDOUS
    insp_crit = CivicAssetTagService.record_inspection(
        asset_code=code,
        condition_rating=1,
        reported_defect="Signal pole knocked down by vehicle"
    )
    assert insp_crit["health_status"] == "HAZARDOUS"

    # Inspect with rating 5 -> OPERATIONAL
    insp_fixed = CivicAssetTagService.record_inspection(
        asset_code=code,
        condition_rating=5,
        reported_defect="Re-anchored and operational"
    )
    assert insp_fixed["health_status"] == "OPERATIONAL"

def test_nearby_spatial_search():
    # Search near Indiranagar 100 Feet Rd coordinates: (12.971891, 77.641154)
    nearby = CivicAssetTagService.get_nearby_assets(12.971891, 77.641154, radius_meters=1500.0)
    assert len(nearby) >= 2
    # First result should be the streetlight at distance ~ 0m
    assert nearby[0]["asset_code"] == "BLR-STLT-04921"
    assert nearby[0]["distance_meters"] <= 5.0
    # Next result should be further away
    assert nearby[1]["distance_meters"] > nearby[0]["distance_meters"]
