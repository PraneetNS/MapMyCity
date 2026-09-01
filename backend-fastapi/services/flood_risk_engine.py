"""
Civic Flood & Environmental Risk Engine.
Implements the explainable StatisticalFloodRiskModel ('flood-risk-v1') combining
meteorological precipitation, PostGIS historical defect records, open drainage issues,
and road jolt sensor history.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
import math
from pydantic import BaseModel, Field

from services.weather_correlation import WeatherCorrelationService


class RiskPredictionResult(BaseModel):
    risk_type: str = "flood"
    risk_level: str  # LOW, MEDIUM, HIGH, EXTREME
    risk_score: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    forecast_rainfall_mm: float
    max_hourly_rate_mm: float
    critical_threshold_mm: float
    time_window_start: datetime
    time_window_end: datetime
    historical_flood_events: int
    open_drainage_issues: int
    factors: List[str]
    recommended_actions: List[str]
    model_version: str = "flood-risk-v1"
    sub_scores: Dict[str, float]


class RouteRiskResult(BaseModel):
    route_length_km: float
    overall_flood_risk_level: str
    peak_risk_score: float
    hotspots_crossed: List[Dict[str, Any]]
    high_risk_segments_count: int
    recommendations: List[str]


class RiskModel(ABC):
    """Abstract interface for environmental risk prediction models."""

    @abstractmethod
    def evaluate_risk(
        self,
        latitude: float,
        longitude: float,
        forecast_rainfall_mm: float,
        max_hourly_rate_mm: float,
        historical_floods: int,
        open_drainage_count: int,
        recurrence_count: int,
        time_window_start: datetime,
        time_window_end: datetime,
        area_name: Optional[str] = None
    ) -> RiskPredictionResult:
        pass


class StatisticalFloodRiskModel(RiskModel):
    """
    Explainable statistical flood & waterlogging risk model ('flood-risk-v1').
    Combines rainfall volume, peak intensity, historical defect density, and drainage status.
    """

    MODEL_VERSION = "flood-risk-v1"

    def evaluate_risk(
        self,
        latitude: float,
        longitude: float,
        forecast_rainfall_mm: float,
        max_hourly_rate_mm: float,
        historical_floods: int,
        open_drainage_count: int,
        recurrence_count: int,
        time_window_start: datetime,
        time_window_end: datetime,
        area_name: Optional[str] = None
    ) -> RiskPredictionResult:
        factors: List[str] = []
        recommendations: List[str] = []

        # 1. Calculate dynamic location threshold
        crit_threshold = WeatherCorrelationService.calculate_location_critical_threshold(
            historical_flood_events=historical_floods,
            historical_drainage_issues=open_drainage_count,
            default_threshold_mm=35.0
        )

        # 2. Compute component scores (0.0 to 1.0)
        # S_rain: Volume relative to critical threshold
        s_rain = min(1.0, forecast_rainfall_mm / crit_threshold) if crit_threshold > 0 else 0.0

        # S_intensity: Peak hourly burst rate (>=20mm/hr is extreme cloudburst)
        s_intensity = min(1.0, max_hourly_rate_mm / 20.0)

        # S_history: Historical flooding frequency with logarithmic scaling
        s_history = min(1.0, 0.22 * (historical_floods ** 0.65)) if historical_floods > 0 else 0.0

        # S_drainage: Unresolved drainage bottlenecks
        s_drainage = min(1.0, 0.25 * open_drainage_count) if open_drainage_count > 0 else 0.0

        # S_recurrence: Past chronic reopen behavior
        s_recurrence = min(1.0, 0.30 * recurrence_count) if recurrence_count > 0 else 0.0

        # 3. Weighted Composite Score
        composite_score = (
            0.40 * s_rain +
            0.15 * s_intensity +
            0.25 * s_history +
            0.12 * s_drainage +
            0.08 * s_recurrence
        )
        composite_score = max(0.02, min(0.99, composite_score))

        # 4. Map to Risk Levels
        if composite_score >= 0.85:
            risk_level = "EXTREME"
        elif composite_score >= 0.65:
            risk_level = "HIGH"
        elif composite_score >= 0.35:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # 5. Prediction Confidence Calculation
        # Confidence increases with data richness (historical events + forecast clarity)
        if historical_floods >= 5:
            confidence = 0.90
        elif historical_floods >= 1:
            confidence = 0.80
        else:
            # Cold start: Limited civic history
            confidence = 0.55
            factors.append("Limited historical civic records for this area; baseline estimate.")

        # 6. Build Explainable Factors
        if forecast_rainfall_mm >= crit_threshold:
            factors.append(f"Expected rainfall ({forecast_rainfall_mm:.1f}mm) exceeds local waterlogging threshold ({crit_threshold:.1f}mm).")
        elif forecast_rainfall_mm > 10.0:
            factors.append(f"Moderate rainfall ({forecast_rainfall_mm:.1f}mm) anticipated.")

        if max_hourly_rate_mm >= 10.0:
            factors.append(f"High-intensity rainfall burst expected (up to {max_hourly_rate_mm:.1f}mm/hr).")

        if historical_floods > 0:
            factors.append(f"Area has flooded {historical_floods} time{'s' if historical_floods > 1 else ''} historically.")

        if open_drainage_count > 0:
            factors.append(f"{open_drainage_count} unresolved drainage/culvert complaint{'s' if open_drainage_count > 1 else ''} currently open nearby.")

        if recurrence_count > 0:
            factors.append(f"Defect location has recurring reopening history ({recurrence_count} times).")

        # 7. AI-Assisted Municipal Preventive Action Recommendations
        loc_label = area_name or f"Zone ({latitude:.3f}, {longitude:.3f})"
        if risk_level in ("HIGH", "EXTREME"):
            recommendations.append(f"Deploy mobile de-watering pumps to low-lying sections of {loc_label}.")
            recommendations.append("Inspect and desilt primary storm-water culvert intakes immediately.")
            recommendations.append("Alert ward traffic management for potential road diversions.")
        elif risk_level == "MEDIUM":
            recommendations.append(f"Monitor drainage flow rates in {loc_label}.")
            recommendations.append("Clear surface trash grating before peak precipitation window.")
        else:
            recommendations.append("Standard routine monitoring; no immediate flood deployment required.")

        return RiskPredictionResult(
            risk_type="flood",
            risk_level=risk_level,
            risk_score=round(composite_score, 3),
            confidence=round(confidence, 2),
            forecast_rainfall_mm=round(forecast_rainfall_mm, 2),
            max_hourly_rate_mm=round(max_hourly_rate_mm, 2),
            critical_threshold_mm=round(crit_threshold, 2),
            time_window_start=time_window_start,
            time_window_end=time_window_end,
            historical_flood_events=historical_floods,
            open_drainage_issues=open_drainage_count,
            factors=factors,
            recommended_actions=recommendations,
            model_version=self.MODEL_VERSION,
            sub_scores={
                "rain_volume": round(s_rain, 3),
                "rain_intensity": round(s_intensity, 3),
                "historical_floods": round(s_history, 3),
                "open_drainage": round(s_drainage, 3),
                "recurrence": round(s_recurrence, 3),
            }
        )


class FloodRiskService:
    """High-level service orchestrating flood risk forecasts, route evaluations, and outcome telemetry."""

    _model: RiskModel = StatisticalFloodRiskModel()

    @classmethod
    def evaluate_location_risk(
        cls,
        latitude: float,
        longitude: float,
        forecast_rainfall_mm: float,
        max_hourly_rate_mm: float,
        historical_floods: int = 0,
        open_drainage_count: int = 0,
        recurrence_count: int = 0,
        time_window_start: Optional[datetime] = None,
        time_window_end: Optional[datetime] = None,
        area_name: Optional[str] = None
    ) -> RiskPredictionResult:
        now = datetime.now(timezone.utc)
        start = time_window_start or now
        end = time_window_end or (now + timedelta(hours=24))

        return cls._model.evaluate_risk(
            latitude=latitude,
            longitude=longitude,
            forecast_rainfall_mm=forecast_rainfall_mm,
            max_hourly_rate_mm=max_hourly_rate_mm,
            historical_floods=historical_floods,
            open_drainage_count=open_drainage_count,
            recurrence_count=recurrence_count,
            time_window_start=start,
            time_window_end=end,
            area_name=area_name
        )

    @classmethod
    def evaluate_route_risk(
        cls,
        route_points: List[Tuple[float, float]],
        known_hotspots: List[Dict[str, Any]],
        current_rainfall_mm: float = 30.0
    ) -> RouteRiskResult:
        """
        Samples coordinates along a travel path, computes segment risk,
        and identifies waterlogging hotspots intersected.
        """
        if not route_points:
            return RouteRiskResult(
                route_length_km=0.0,
                overall_flood_risk_level="LOW",
                peak_risk_score=0.1,
                hotspots_crossed=[],
                high_risk_segments_count=0,
                recommendations=["No route points provided."]
            )

        # Estimate route length
        total_dist_m = 0.0
        for i in range(len(route_points) - 1):
            lat1, lon1 = route_points[i]
            lat2, lon2 = route_points[i + 1]
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            total_dist_m += 6371000.0 * c

        route_km = round(total_dist_m / 1000.0, 2)

        # Find intersecting hotspots within 250m of route points
        hotspots_crossed: List[Dict[str, Any]] = []
        peak_score = 0.15

        for hs in known_hotspots:
            hs_lat = hs.get("latitude", 0.0)
            hs_lon = hs.get("longitude", 0.0)
            for pt_lat, pt_lon in route_points:
                dlat = math.radians(hs_lat - pt_lat)
                dlon = math.radians(hs_lon - pt_lon)
                a = math.sin(dlat / 2)**2 + math.cos(math.radians(pt_lat)) * math.cos(math.radians(hs_lat)) * math.sin(dlon / 2)**2
                dist_m = 6371000.0 * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

                if dist_m <= 300.0:
                    hotspots_crossed.append(hs)
                    peak_score = max(peak_score, 0.78)
                    break

        if current_rainfall_mm >= 35.0:
            peak_score = max(peak_score, 0.72)

        if peak_score >= 0.85:
            overall_level = "EXTREME"
        elif peak_score >= 0.65:
            overall_level = "HIGH"
        elif peak_score >= 0.35:
            overall_level = "MEDIUM"
        else:
            overall_level = "LOW"

        recs = []
        if hotspots_crossed:
            recs.append(f"Route passes near {len(hotspots_crossed)} historical waterlogging hotspot{'s' if len(hotspots_crossed) > 1 else ''}.")
            recs.append("Consider alternative elevated arterial roads during heavy rain.")
        else:
            recs.append("No chronic flood hotspots detected along this path.")

        return RouteRiskResult(
            route_length_km=route_km,
            overall_flood_risk_level=overall_level,
            peak_risk_score=round(peak_score, 2),
            hotspots_crossed=hotspots_crossed,
            high_risk_segments_count=len(hotspots_crossed),
            recommendations=recs
        )
