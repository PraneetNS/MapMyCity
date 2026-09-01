"""
Weather Provider Abstraction & Open-Meteo Implementation.
Provides normalized weather observations and hourly precipitation forecasts
without coupling internal civic engines to any single vendor response format.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import os
import httpx
from pydantic import BaseModel, Field


class WeatherObservation(BaseModel):
    latitude: float
    longitude: float
    temperature: float
    precipitation_mm: float
    precipitation_probability: float = 0.0
    rain_intensity: str = "none"  # none, light, moderate, heavy, extreme
    humidity: float = 65.0
    wind_speed: float = 10.0
    weather_condition: str = "Clear"
    observed_at: datetime
    source: str = "open-meteo"


class WeatherForecastItem(BaseModel):
    forecast_time: datetime
    precipitation_mm: float
    precipitation_probability: float
    rain_intensity: str
    temperature: float
    weather_condition: str = "Rain"


class WeatherForecast(BaseModel):
    latitude: float
    longitude: float
    current: WeatherObservation
    hourly: List[WeatherForecastItem]
    total_expected_precipitation_mm: float
    max_hourly_rate_mm: float
    peak_forecast_time: Optional[datetime] = None
    source: str = "open-meteo"


def classify_rain_intensity(mm_per_hour: float) -> str:
    if mm_per_hour <= 0.1:
        return "none"
    elif mm_per_hour < 2.5:
        return "light"
    elif mm_per_hour < 7.6:
        return "moderate"
    elif mm_per_hour < 50.0:
        return "heavy"
    else:
        return "extreme"


def wmo_weather_code_to_str(code: int) -> str:
    if code == 0:
        return "Clear"
    elif code in (1, 2, 3):
        return "Partly Cloudy"
    elif code in (45, 48):
        return "Foggy"
    elif code in (51, 53, 55, 56, 57):
        return "Drizzle"
    elif code in (61, 63, 65, 66, 67):
        return "Rain"
    elif code in (71, 73, 75, 77):
        return "Snow"
    elif code in (80, 81, 82):
        return "Heavy Showers"
    elif code in (95, 96, 99):
        return "Thunderstorm"
    return "Cloudy"


class WeatherProvider(ABC):
    """Abstract interface for environmental & weather observation providers."""

    @abstractmethod
    async def get_current_weather(self, latitude: float, longitude: float) -> WeatherObservation:
        pass

    @abstractmethod
    async def get_forecast(self, latitude: float, longitude: float, hours: int = 24) -> WeatherForecast:
        pass


class OpenMeteoWeatherProvider(WeatherProvider):
    """
    Concrete Weather Provider using Open-Meteo (WMO-standard, keyless, global high-precision).
    Includes automatic fallback mock data if network is unavailable.
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def _generate_mock_forecast(self, latitude: float, longitude: float, hours: int = 24) -> WeatherForecast:
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        current_obs = WeatherObservation(
            latitude=latitude,
            longitude=longitude,
            temperature=27.5,
            precipitation_mm=4.2,
            precipitation_probability=85.0,
            rain_intensity="moderate",
            humidity=82.0,
            wind_speed=18.5,
            weather_condition="Moderate Rain",
            observed_at=now,
            source="open-meteo-simulated"
        )

        hourly_items: List[WeatherForecastItem] = []
        total_precip = 0.0
        max_rate = 0.0
        peak_time = now

        for i in range(hours):
            t = now + timedelta(hours=i)
            # Simulated monsoon afternoon rain spike
            rate = 14.5 if 2 <= i <= 6 else (4.0 if i < 10 else 0.5)
            prob = 90.0 if 2 <= i <= 6 else 40.0
            intensity = classify_rain_intensity(rate)
            total_precip += rate
            if rate > max_rate:
                max_rate = rate
                peak_time = t

            hourly_items.append(WeatherForecastItem(
                forecast_time=t,
                precipitation_mm=round(rate, 2),
                precipitation_probability=prob,
                rain_intensity=intensity,
                temperature=26.0 - (i * 0.2),
                weather_condition="Heavy Showers" if rate > 10 else "Rain"
            ))

        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            current=current_obs,
            hourly=hourly_items,
            total_expected_precipitation_mm=round(total_precip, 2),
            max_hourly_rate_mm=round(max_rate, 2),
            peak_forecast_time=peak_time,
            source="open-meteo-simulated"
        )

    async def get_current_weather(self, latitude: float, longitude: float) -> WeatherObservation:
        try:
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
                "timezone": "UTC"
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(self.BASE_URL, params=params)
                if res.status_code == 200:
                    data = res.json()
                    curr = data.get("current", {})
                    precip = float(curr.get("precipitation", 0.0))
                    return WeatherObservation(
                        latitude=latitude,
                        longitude=longitude,
                        temperature=float(curr.get("temperature_2m", 25.0)),
                        precipitation_mm=precip,
                        precipitation_probability=75.0 if precip > 0 else 10.0,
                        rain_intensity=classify_rain_intensity(precip),
                        humidity=float(curr.get("relative_humidity_2m", 70.0)),
                        wind_speed=float(curr.get("wind_speed_10m", 12.0)),
                        weather_condition=wmo_weather_code_to_str(int(curr.get("weather_code", 0))),
                        observed_at=datetime.now(timezone.utc),
                        source="open-meteo"
                    )
        except Exception:
            pass

        # Fallback
        mock = self._generate_mock_forecast(latitude, longitude, 1)
        return mock.current

    async def get_forecast(self, latitude: float, longitude: float, hours: int = 24) -> WeatherForecast:
        try:
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
                "hourly": "temperature_2m,precipitation_probability,precipitation,rain,weather_code",
                "forecast_days": max(1, min(3, (hours // 24) + 1)),
                "timezone": "UTC"
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(self.BASE_URL, params=params)
                if res.status_code == 200:
                    data = res.json()
                    curr = data.get("current", {})
                    hourly = data.get("hourly", {})

                    curr_precip = float(curr.get("precipitation", 0.0))
                    current_obs = WeatherObservation(
                        latitude=latitude,
                        longitude=longitude,
                        temperature=float(curr.get("temperature_2m", 25.0)),
                        precipitation_mm=curr_precip,
                        precipitation_probability=80.0 if curr_precip > 0 else 15.0,
                        rain_intensity=classify_rain_intensity(curr_precip),
                        humidity=float(curr.get("relative_humidity_2m", 70.0)),
                        wind_speed=float(curr.get("wind_speed_10m", 12.0)),
                        weather_condition=wmo_weather_code_to_str(int(curr.get("weather_code", 0))),
                        observed_at=datetime.now(timezone.utc),
                        source="open-meteo"
                    )

                    times = hourly.get("time", [])
                    precips = hourly.get("precipitation", [])
                    probs = hourly.get("precipitation_probability", [])
                    temps = hourly.get("temperature_2m", [])
                    wcodes = hourly.get("weather_code", [])

                    hourly_items: List[WeatherForecastItem] = []
                    total_precip = 0.0
                    max_rate = 0.0
                    peak_time = None

                    limit = min(hours, len(times))
                    for i in range(limit):
                        t = datetime.fromisoformat(times[i]).replace(tzinfo=timezone.utc)
                        p = float(precips[i]) if i < len(precips) else 0.0
                        pr = float(probs[i]) if i < len(probs) else 0.0
                        temp = float(temps[i]) if i < len(temps) else 25.0
                        wc = int(wcodes[i]) if i < len(wcodes) else 0

                        total_precip += p
                        if p > max_rate:
                            max_rate = p
                            peak_time = t

                        hourly_items.append(WeatherForecastItem(
                            forecast_time=t,
                            precipitation_mm=round(p, 2),
                            precipitation_probability=pr,
                            rain_intensity=classify_rain_intensity(p),
                            temperature=temp,
                            weather_condition=wmo_weather_code_to_str(wc)
                        ))

                    return WeatherForecast(
                        latitude=latitude,
                        longitude=longitude,
                        current=current_obs,
                        hourly=hourly_items,
                        total_expected_precipitation_mm=round(total_precip, 2),
                        max_hourly_rate_mm=round(max_rate, 2),
                        peak_forecast_time=peak_time or datetime.now(timezone.utc),
                        source="open-meteo"
                    )
        except Exception:
            pass

        return self._generate_mock_forecast(latitude, longitude, hours)


def get_weather_provider() -> WeatherProvider:
    """Factory creating configured WeatherProvider implementation."""
    provider_name = os.getenv("WEATHER_PROVIDER", "open-meteo").lower()
    if provider_name in ("open-meteo", "openmeteo", "default"):
        return OpenMeteoWeatherProvider()
    return OpenMeteoWeatherProvider()
