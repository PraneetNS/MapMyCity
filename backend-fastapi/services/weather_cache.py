"""
Weather Cache Service.
Provides memory/DB caching with TTLs to prevent excessive external vendor requests
and speed up spatial risk queries.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from services.weather_provider import WeatherObservation, WeatherForecast, get_weather_provider


class WeatherCacheService:
    """In-memory & DB cache for live weather observations and forecasts."""

    CURRENT_TTL_MINUTES = 15
    FORECAST_TTL_MINUTES = 60

    _current_cache: Dict[str, Dict[str, Any]] = {}
    _forecast_cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def _get_grid_key(cls, latitude: float, longitude: float, precision: int = 2) -> str:
        """Rounds coordinates to grid buckets (~1km resolution)."""
        lat_bucket = round(latitude, precision)
        lon_bucket = round(longitude, precision)
        return f"{lat_bucket}_{lon_bucket}"

    @classmethod
    async def get_current_weather(cls, latitude: float, longitude: float) -> WeatherObservation:
        key = cls._get_grid_key(latitude, longitude)
        now = datetime.now(timezone.utc)

        if key in cls._current_cache:
            entry = cls._current_cache[key]
            if now < entry["expires_at"]:
                return entry["data"]

        provider = get_weather_provider()
        obs = await provider.get_current_weather(latitude, longitude)

        cls._current_cache[key] = {
            "data": obs,
            "expires_at": now + timedelta(minutes=cls.CURRENT_TTL_MINUTES)
        }
        return obs

    @classmethod
    async def get_forecast(cls, latitude: float, longitude: float, hours: int = 24) -> WeatherForecast:
        key = f"{cls._get_grid_key(latitude, longitude)}_{hours}"
        now = datetime.now(timezone.utc)

        if key in cls._forecast_cache:
            entry = cls._forecast_cache[key]
            if now < entry["expires_at"]:
                return entry["data"]

        provider = get_weather_provider()
        forecast = await provider.get_forecast(latitude, longitude, hours)

        cls._forecast_cache[key] = {
            "data": forecast,
            "expires_at": now + timedelta(minutes=cls.FORECAST_TTL_MINUTES)
        }
        return forecast

    @classmethod
    def clear_cache(cls):
        """Clears cache during testing."""
        cls._current_cache.clear()
        cls._forecast_cache.clear()
