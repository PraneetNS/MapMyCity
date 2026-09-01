"""
Weather-Civic Issue Correlation Service.
Discovers relationships between rainfall amounts and civic failures
(waterlogging, drainage backups, asphalt potholes, utility trips)
and computes dynamic weather-adjusted operational priorities.
"""

from typing import Dict, Any, List, Optional
import math
from datetime import datetime, timezone


class WeatherCorrelationService:
    """Statistical correlation engine linking rainfall to civic defect severity."""

    WEATHER_SENSITIVE_CATEGORIES = {
        "pothole": {"base_multiplier": 0.25, "rain_threshold_mm": 20.0},
        "garbage": {"base_multiplier": 0.15, "rain_threshold_mm": 25.0},
        "accessibility": {"base_multiplier": 0.10, "rain_threshold_mm": 30.0},
        "infrastructure": {"base_multiplier": 0.20, "rain_threshold_mm": 25.0},
        "waterlogging": {"base_multiplier": 0.50, "rain_threshold_mm": 15.0},
        "drainage": {"base_multiplier": 0.45, "rain_threshold_mm": 15.0},
        "utility_outage": {"base_multiplier": 0.30, "rain_threshold_mm": 30.0},
    }

    @classmethod
    def calculate_location_critical_threshold(
        cls,
        historical_flood_events: int,
        historical_drainage_issues: int,
        default_threshold_mm: float = 35.0
    ) -> float:
        """
        Calculates location-specific critical rainfall threshold (mm) where flooding begins.
        Locations with repeat historical incidents trigger at lower precipitation levels.
        """
        threshold = float(default_threshold_mm)
        if historical_flood_events >= 10:
            threshold -= 15.0  # Chronic low-lying hotspot (e.g. 20mm triggers flood)
        elif historical_flood_events >= 5:
            threshold -= 10.0
        elif historical_flood_events >= 2:
            threshold -= 5.0

        if historical_drainage_issues >= 3:
            threshold -= 5.0

        return max(12.0, min(60.0, threshold))

    @classmethod
    def calculate_weather_adjusted_priority(
        cls,
        base_severity: float,
        mission_type: str,
        forecast_rainfall_mm: float,
        is_monsoon: bool = True
    ) -> Dict[str, Any]:
        """
        Computes operational priority boost for municipal work orders
        without permanently modifying citizen baseline severity.
        """
        cat = (mission_type or "pothole").lower()
        config = cls.WEATHER_SENSITIVE_CATEGORIES.get(cat, {"base_multiplier": 0.10, "rain_threshold_mm": 30.0})

        rain_threshold = config["rain_threshold_mm"]
        rain_factor = max(0.0, min(2.0, forecast_rainfall_mm / rain_threshold)) if rain_threshold > 0 else 0.0

        # Multiplier bounded between 1.0 and 1.6
        multiplier = 1.0 + (config["base_multiplier"] * rain_factor * (1.2 if is_monsoon else 1.0))
        multiplier = max(1.0, min(1.60, multiplier))

        adjusted_priority = round(base_severity * multiplier, 2)
        priority_boost_percent = int(round((multiplier - 1.0) * 100))

        factors = []
        if forecast_rainfall_mm >= rain_threshold:
            factors.append(f"Forecast {forecast_rainfall_mm}mm rain exceeds {cat} failure threshold ({rain_threshold}mm)")
        if priority_boost_percent >= 20:
            factors.append("High weather vulnerability - prioritize preventive clearing")

        return {
            "base_severity": base_severity,
            "weather_adjusted_priority": adjusted_priority,
            "multiplier": round(multiplier, 2),
            "priority_boost_percent": priority_boost_percent,
            "is_weather_elevated": priority_boost_percent >= 15,
            "factors": factors
        }

    @classmethod
    def detect_hotspot_correlation(
        cls,
        location_name: str,
        historical_event_count: int,
        avg_rainfall_mm: float
    ) -> Dict[str, Any]:
        """Generates statistical correlation summary for civic hotspot."""
        return {
            "location_name": location_name,
            "historical_event_count": historical_event_count,
            "avg_preceding_rainfall_mm": avg_rainfall_mm,
            "correlation_strength": "STRONG" if historical_event_count >= 5 else "MODERATE",
            "summary": f"{location_name} historically experiences waterlogging when rainfall exceeds ~{int(avg_rainfall_mm * 0.75)}mm."
        }
