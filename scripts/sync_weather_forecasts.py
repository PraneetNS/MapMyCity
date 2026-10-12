#!/usr/bin/env python3
"""
scripts/sync_weather_forecasts.py
=================================
Automated weather forecast synchronizer and environmental flood risk evaluator.
Fetches precipitation and atmospheric metrics, computes statistical flood hazard tiers,
and updates municipal drainage warning states.
"""

import sys
import os
import json
import argparse
from datetime import datetime, timezone
from typing import Dict, Any, List

try:
    import urllib.request
    HAS_URLLIB = True
except ImportError:
    HAS_URLLIB = False


def fetch_open_meteo_live(lat: float, lon: float) -> Dict[str, Any]:
    """Fetches real-time weather from Open-Meteo free API."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m&hourly=precipitation,rain&forecast_days=1"
    req = urllib.request.Request(url, headers={"User-Agent": "MapMyCity-CivicSync/1.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def evaluate_flood_hazard(precipitation_mm: float, rain_sum_24h_mm: float) -> Dict[str, Any]:
    """Evaluates flood risk tier and operational recommendations based on rainfall."""
    if precipitation_mm >= 35.0 or rain_sum_24h_mm >= 75.0:
        tier = "extreme"
        score = 0.95
        action = "Issue city-wide storm drain overflow alerts; deploy emergency pumping units."
    elif precipitation_mm >= 15.0 or rain_sum_24h_mm >= 40.0:
        tier = "high"
        score = 0.75
        action = "Alert ward sweepers to clear catch-basin grates; divert vulnerable underpass traffic."
    elif precipitation_mm >= 5.0 or rain_sum_24h_mm >= 15.0:
        tier = "moderate"
        score = 0.45
        action = "Monitor low-lying arterial intersections; advise commuters to exercise caution."
    else:
        tier = "low"
        score = 0.10
        action = "Routine drainage maintenance; normal conditions."

    return {
        "risk_tier": tier,
        "flood_risk_score": score,
        "recommended_action": action
    }


def main():
    parser = argparse.ArgumentParser(description="Sync live weather forecasts and evaluate flood risks")
    parser.add_argument("--lat", type=float, default=12.9716, help="Latitude (default: Bangalore 12.9716)")
    parser.add_argument("--lon", type=float, default=77.5946, help="Longitude (default: Bangalore 77.5946)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without external HTTP call")
    parser.add_argument("--output", "-o", help="Target output filepath for weather snapshot")
    args = parser.parse_args()

    print("==================================================")
    print("MapMyCity Weather & Flood Intelligence Synchronizer")
    print("==================================================")
    print(f"Target Coordinates: ({args.lat}, {args.lon})")

    data = None
    if not args.dry_run and HAS_URLLIB:
        try:
            print("[INFO] Contacting Open-Meteo weather API...")
            data = fetch_open_meteo_live(args.lat, args.lon)
            print("[SUCCESS] Live forecast payload received.")
        except Exception as e:
            print(f"[WARN] Live fetch failed ({e}); falling back to local simulation.")

    if not data:
        # Realistic fallback payload
        data = {
            "latitude": args.lat,
            "longitude": args.lon,
            "current": {
                "temperature_2m": 24.5,
                "relative_humidity_2m": 82,
                "precipitation": 12.4,
                "rain": 12.4,
                "wind_speed_10m": 16.2
            },
            "hourly": {
                "precipitation": [0.0, 2.1, 8.5, 12.4, 18.0, 9.2]
            }
        }

    current = data.get("current", {})
    hourly_precip = data.get("hourly", {}).get("precipitation", [0.0])
    rain_sum_24h = sum(hourly_precip)
    current_precip = current.get("precipitation", 0.0)

    eval_result = evaluate_flood_hazard(current_precip, rain_sum_24h)

    print(f"Current Precip:     {current_precip} mm/h")
    print(f"24h Rain Sum:       {round(rain_sum_24h, 1)} mm")
    print(f"Temperature:        {current.get('temperature_2m', 25.0)} °C")
    print(f"Flood Risk Tier:    {eval_result['risk_tier'].upper()} (Score: {eval_result['flood_risk_score']})")
    print(f"Action:             {eval_result['recommended_action']}")

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "coordinates": {"lat": args.lat, "lon": args.lon},
        "weather_current": current,
        "flood_assessment": eval_result
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"[SUCCESS] Saved weather assessment to {args.output}")
    print("==================================================")


if __name__ == "__main__":
    main()
