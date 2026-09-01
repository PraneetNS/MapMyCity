import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from main import app
from services.weather_provider import (
    OpenMeteoWeatherProvider,
    classify_rain_intensity,
    wmo_weather_code_to_str,
)
from services.weather_cache import WeatherCacheService
from services.weather_correlation import WeatherCorrelationService
from services.flood_risk_engine import FloodRiskService, StatisticalFloodRiskModel

client = TestClient(app)


# ── 1. Weather Provider & Normalization Unit Tests ─────────────────────────────

def test_classify_rain_intensity():
    assert classify_rain_intensity(0.0) == "none"
    assert classify_rain_intensity(1.2) == "light"
    assert classify_rain_intensity(5.5) == "moderate"
    assert classify_rain_intensity(18.0) == "heavy"
    assert classify_rain_intensity(65.0) == "extreme"


def test_wmo_code_mapping():
    assert wmo_weather_code_to_str(0) == "Clear"
    assert wmo_weather_code_to_str(63) == "Rain"
    assert wmo_weather_code_to_str(81) == "Heavy Showers"
    assert wmo_weather_code_to_str(95) == "Thunderstorm"


@pytest.mark.asyncio
async def test_weather_provider_and_cache():
    WeatherCacheService.clear_cache()
    lat, lon = 12.9352, 77.6245

    curr = await WeatherCacheService.get_current_weather(lat, lon)
    assert curr.latitude == lat
    assert curr.longitude == lon
    assert curr.temperature > 0

    forecast = await WeatherCacheService.get_forecast(lat, lon, hours=24)
    assert len(forecast.hourly) == 24
    assert forecast.total_expected_precipitation_mm >= 0.0


# ── 2. Weather-Civic Correlation Unit Tests ────────────────────────────────────

def test_location_critical_threshold_adaptation():
    """Validates that chronic low-lying flood areas trigger at lower rainfall thresholds."""
    # Low history location
    t_normal = WeatherCorrelationService.calculate_location_critical_threshold(
        historical_flood_events=0,
        historical_drainage_issues=0,
        default_threshold_mm=35.0
    )
    # Chronic hotspot with 10+ flood events
    t_chronic = WeatherCorrelationService.calculate_location_critical_threshold(
        historical_flood_events=12,
        historical_drainage_issues=5,
        default_threshold_mm=35.0
    )

    assert t_normal == 35.0
    assert t_chronic <= 20.0
    assert t_chronic < t_normal


def test_weather_adjusted_operational_priority():
    """Validates that heavy rain forecast escalates work order operational priority."""
    # Normal dry day
    res_dry = WeatherCorrelationService.calculate_weather_adjusted_priority(
        base_severity=3.0,
        mission_type="drainage",
        forecast_rainfall_mm=0.0
    )
    # Heavy rain forecast
    res_rain = WeatherCorrelationService.calculate_weather_adjusted_priority(
        base_severity=3.0,
        mission_type="drainage",
        forecast_rainfall_mm=45.0
    )

    assert res_dry["weather_adjusted_priority"] == 3.0
    assert res_rain["weather_adjusted_priority"] > 3.0
    assert res_rain["is_weather_elevated"] is True
    assert len(res_rain["factors"]) >= 1


# ── 3. Flood Risk Engine Unit Tests ────────────────────────────────────────────

def test_flood_risk_engine_scoring_and_explainability():
    """Validates explainable risk score calculation, discrete risk level, and recommendations."""
    risk_low = FloodRiskService.evaluate_location_risk(
        latitude=12.935,
        longitude=77.624,
        forecast_rainfall_mm=2.0,
        max_hourly_rate_mm=0.5,
        historical_floods=0,
        open_drainage_count=0
    )
    assert risk_low.risk_level == "LOW"
    assert risk_low.risk_score < 0.35

    risk_high = FloodRiskService.evaluate_location_risk(
        latitude=12.935,
        longitude=77.624,
        forecast_rainfall_mm=55.0,
        max_hourly_rate_mm=18.0,
        historical_floods=8,
        open_drainage_count=4,
        area_name="Koramangala 4th Block"
    )
    assert risk_high.risk_level in ("HIGH", "EXTREME")
    assert risk_high.risk_score >= 0.65
    assert risk_high.confidence >= 0.85
    assert any("flooded 8 times" in f for f in risk_high.factors)
    assert any("pumps" in a.lower() for a in risk_high.recommended_actions)


def test_route_flood_risk_calculation():
    """Validates that travel routes crossing known flood hotspots receive appropriate warnings."""
    # Route passing directly through Koramangala hotspot (12.9352, 77.6245)
    points = [
        (12.9300, 77.6200),
        (12.9352, 77.6245),
        (12.9400, 77.6300)
    ]
    known_hotspots = [
        {"hotspot_name": "Koramangala 80ft Road", "latitude": 12.9352, "longitude": 77.6245}
    ]

    res = FloodRiskService.evaluate_route_risk(
        route_points=points,
        known_hotspots=known_hotspots,
        current_rainfall_mm=40.0
    )
    assert res.high_risk_segments_count >= 1
    assert len(res.hotspots_crossed) >= 1
    assert res.overall_flood_risk_level in ("HIGH", "EXTREME")


# ── 4. API Endpoints Integration Tests ─────────────────────────────────────────

def test_api_weather_current_and_forecast():
    res_curr = client.get("/weather/current?lat=12.9352&lng=77.6245")
    assert res_curr.status_code == 200
    data_curr = res_curr.json()
    assert "temperature" in data_curr
    assert "precipitation_mm" in data_curr

    res_fc = client.get("/weather/forecast?lat=12.9352&lng=77.6245&hours=24")
    assert res_fc.status_code == 200
    data_fc = res_fc.json()
    assert len(data_fc["hourly"]) == 24
    assert "total_expected_precipitation_mm" in data_fc


def test_api_flood_risk_and_map():
    res_risk = client.get("/civic-risk/flood?lat=12.9352&lng=77.6245&hours=24")
    assert res_risk.status_code == 200
    data_risk = res_risk.json()
    assert data_risk["risk_type"] == "flood"
    assert data_risk["risk_level"] in ("LOW", "MEDIUM", "HIGH", "EXTREME")
    assert "factors" in data_risk
    assert "recommended_actions" in data_risk

    res_map = client.get("/civic-risk/map")
    assert res_map.status_code == 200
    data_map = res_map.json()
    assert isinstance(data_map, list)
    assert len(data_map) >= 1
    assert "risk_score" in data_map[0]


def test_api_hotspots_and_route():
    res_hs = client.get("/civic-risk/hotspots")
    assert res_hs.status_code == 200
    assert len(res_hs.json()) >= 1

    res_route = client.get("/civic-risk/route?coords=12.9352,77.6245;12.9784,77.6412")
    assert res_route.status_code == 200
    data_route = res_route.json()
    assert "overall_flood_risk_level" in data_route
    assert "route_length_km" in data_route


def test_api_weather_analytics():
    res_analytics = client.get("/civic-risk/analytics/weather-intelligence")
    assert res_analytics.status_code == 200
    data = res_analytics.json()
    assert "citywide_risk_level" in data
    assert "chronic_hotspots_count" in data
    assert "recommended_citywide_actions" in data
