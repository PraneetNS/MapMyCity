#!/usr/bin/env python3
"""
scripts/simulate_road_telemetry.py
==================================
Simulates vehicle-mounted mobile sensor telemetry for passive road quality monitoring.
Generates realistic 3-axis accelerometer, gyroscope, speed, and GPS streams with
injected pothole jolts and roughness index calculations.
"""

import sys
import os
import json
import random
import math
import argparse
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List


def generate_telemetry_stream(
    duration_sec: int = 30,
    frequency_hz: int = 10,
    num_potholes: int = 3,
    base_lat: float = 12.9716,
    base_lng: float = 77.5946
) -> Dict[str, Any]:
    total_samples = duration_sec * frequency_hz
    interval_sec = 1.0 / frequency_hz
    start_time = datetime.now(timezone.utc)

    # Pick sample indices for sudden vertical acceleration jolts
    pothole_indices = set(random.sample(range(5, total_samples - 5), min(num_potholes, total_samples // 4)))

    samples = []
    current_lat = base_lat
    current_lng = base_lng
    current_speed_kmh = 35.0  # standard urban travel speed

    total_roughness_energy = 0.0

    for i in range(total_samples):
        timestamp = (start_time + timedelta(seconds=i * interval_sec)).isoformat()

        # GPS step progression
        lat_step = 0.000015 * (interval_sec * current_speed_kmh / 30.0)
        lng_step = 0.000018 * (interval_sec * current_speed_kmh / 30.0)
        current_lat += lat_step + random.uniform(-0.000002, 0.000002)
        current_lng += lng_step + random.uniform(-0.000002, 0.000002)

        # Baseline acceleration in G's (normal asphalt vibration)
        ax = random.gauss(0.0, 0.08)  # lateral
        ay = random.gauss(0.0, 0.09)  # longitudinal
        az = 1.0 + random.gauss(0.0, 0.12)  # vertical gravity baseline

        is_jolt = i in pothole_indices
        if is_jolt:
            # Significant vertical acceleration spike (e.g. 2.2g - 3.5g)
            jolt_magnitude = random.uniform(2.1, 3.4)
            az = jolt_magnitude
            ax += random.uniform(-0.6, 0.6)  # steering swerve
            current_speed_kmh = max(15.0, current_speed_kmh - random.uniform(4.0, 8.0))

        # International Roughness Index (IRI) acceleration metric
        roughness_component = abs(az - 1.0)
        total_roughness_energy += roughness_component

        samples.append({
            "timestamp": timestamp,
            "latitude": round(current_lat, 6),
            "longitude": round(current_lng, 6),
            "speed_kmh": round(current_speed_kmh, 1),
            "ax_g": round(ax, 3),
            "ay_g": round(ay, 3),
            "az_g": round(az, 3),
            "is_anomaly": is_jolt
        })

    avg_iri_score = round(total_roughness_energy / max(1, total_samples) * 10.0, 2)

    return {
        "device_id": f"sim-device-{random.randint(1000, 9999)}",
        "session_id": f"sess-{int(start_time.timestamp())}",
        "summary": {
            "duration_sec": duration_sec,
            "frequency_hz": frequency_hz,
            "total_samples": total_samples,
            "detected_jolts": len(pothole_indices),
            "estimated_roughness_index": avg_iri_score,
            "surface_rating": "Fair" if avg_iri_score < 4.0 else ("Poor" if avg_iri_score < 7.0 else "Critical")
        },
        "telemetry_samples": samples
    }


def main():
    parser = argparse.ArgumentParser(description="Simulate road accelerometer and GPS telemetry")
    parser.add_argument("--duration", "-d", type=int, default=15, help="Simulation duration in seconds")
    parser.add_argument("--frequency", "-f", type=int, default=10, help="Sampling frequency in Hz")
    parser.add_argument("--potholes", "-p", type=int, default=2, help="Number of pothole jolts to inject")
    parser.add_argument("--output", "-o", help="Target JSON output filepath")
    args = parser.parse_args()

    data = generate_telemetry_stream(
        duration_sec=args.duration,
        frequency_hz=args.frequency,
        num_potholes=args.potholes
    )

    summary = data["summary"]
    print("==================================================")
    print("MapMyCity Passive Sensor Road Telemetry Simulator")
    print("==================================================")
    print(f"Device ID: {data['device_id']}")
    print(f"Duration:  {summary['duration_sec']}s ({summary['total_samples']} samples @ {summary['frequency_hz']}Hz)")
    print(f"Jolts:     {summary['detected_jolts']} detected potholes")
    print(f"Roughness: IRI {summary['estimated_roughness_index']} ({summary['surface_rating']})")

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[SUCCESS] Wrote telemetry batch to {args.output}")
    print("==================================================")


if __name__ == "__main__":
    main()
