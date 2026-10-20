#!/usr/bin/env python3
"""
scripts/audit_pedestrian_safety.py
==================================
Audits pedestrian and cyclist micro-mobility corridors across municipal wards.
Calculates vulnerability hazard ratings (0-100), generates IRC SP-091 design
remediations, and exports GIS GeoJSON linestrings for city urban planners.
"""

import sys
import os
import json
import time
import argparse
from typing import List, Dict, Any

# Ensure backend-fastapi directory is accessible for domain service imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend-fastapi")))

try:
    from services.pedestrian_safety_engine import PedestrianSafetyEngine
except ImportError:
    class PedestrianSafetyEngine:
        def evaluate_corridor_hazard(self, corridor_name, sidewalk_continuity_pct, illumination_pct, tactile_paving_pct, pothole_trip_hazards_count, open_drain_hazard_count, wheelchair_curb_ramps_present=True, pedestrian_flow_density="MODERATE"):
            deficit = (100 - sidewalk_continuity_pct) * 0.3 + (100 - illumination_pct) * 0.2 + (100 - tactile_paving_pct) * 0.1
            penalty = min(20.0, pothole_trip_hazards_count * 3.5) + min(20.0, open_drain_hazard_count * 7.0)
            score = round(min(100.0, deficit + penalty), 1)
            tier = "LOW_RISK" if score < 25 else "MODERATE_RISK" if score < 50 else "HIGH_RISK" if score < 75 else "SEVERE_VULNERABILITY"
            return {
                "corridor_name": corridor_name,
                "pedestrian_hazard_index": score,
                "risk_tier": tier,
                "recommended_interventions": ["Sidewalk restoration required."] if score > 40 else ["Routine maintenance."]
            }


BENCHMARK_CORRIDORS = [
    {
        "ward_id": "ward_bbmp_150",
        "name": "Outer Ring Road - Bellandur Tech Hub Link",
        "sidewalk": 42.0,
        "lighting": 55.0,
        "tactile": 10.0,
        "trips": 5,
        "drains": 1,
        "ramps": False,
        "density": "CRITICAL_TRANSIT_HUB",
        "coords": [[77.6742, 12.9260], [77.6815, 12.9298]]
    },
    {
        "ward_id": "ward_bbmp_174",
        "name": "27th Main Commercial High Street",
        "sidewalk": 78.0,
        "lighting": 82.0,
        "tactile": 45.0,
        "trips": 1,
        "drains": 0,
        "ramps": True,
        "density": "HIGH",
        "coords": [[77.6410, 12.9120], [77.6490, 12.9150]]
    },
    {
        "ward_id": "ward_bbmp_101",
        "name": "Old Madras Road Metro Feeder Walkway",
        "sidewalk": 25.0,
        "lighting": 30.0,
        "tactile": 0.0,
        "trips": 8,
        "drains": 2,
        "ramps": False,
        "density": "HIGH",
        "coords": [[77.6380, 12.9780], [77.6460, 12.9810]]
    },
    {
        "ward_id": "ward_bbmp_085",
        "name": "Doddanekkundi Industrial Radial Access",
        "sidewalk": 15.0,
        "lighting": 20.0,
        "tactile": 0.0,
        "trips": 6,
        "drains": 2,
        "ramps": False,
        "density": "MODERATE",
        "coords": [[77.7010, 12.9720], [77.7090, 12.9750]]
    },
    {
        "ward_id": "ward_bbmp_102",
        "name": "12th Main Indiranagar Boulevard",
        "sidewalk": 92.0,
        "lighting": 90.0,
        "tactile": 80.0,
        "trips": 0,
        "drains": 0,
        "ramps": True,
        "density": "MODERATE",
        "coords": [[77.6415, 12.9710], [77.6420, 12.9650]]
    }
]


def audit_corridors(geojson_path: str = None) -> List[Dict[str, Any]]:
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    engine = PedestrianSafetyEngine()
    print(f"\n========================================================")
    print(f"  MapMyCity - Pedestrian & Micro-Mobility Safety Audit")
    print(f"========================================================")
    print(f"Auditing {len(BENCHMARK_CORRIDORS)} urban corridors according to IRC SP-091...\n")

    audited = []
    features = []

    for c in BENCHMARK_CORRIDORS:
        eval_res = engine.evaluate_corridor_hazard(
            corridor_name=c["name"],
            sidewalk_continuity_pct=c["sidewalk"],
            illumination_pct=c["lighting"],
            tactile_paving_pct=c["tactile"],
            pothole_trip_hazards_count=c["trips"],
            open_drain_hazard_count=c["drains"],
            wheelchair_curb_ramps_present=c["ramps"],
            pedestrian_flow_density=c["density"]
        )

        record = {
            "ward_id": c["ward_id"],
            "corridor_name": c["name"],
            "pedestrian_hazard_index": eval_res["pedestrian_hazard_index"],
            "risk_tier": eval_res["risk_tier"],
            "recommended_interventions": eval_res["recommended_interventions"]
        }
        audited.append(record)

        tier_badge = (
            "[CRITICAL]" if eval_res["risk_tier"] == "SEVERE_VULNERABILITY"
            else "[HIGH]    " if eval_res["risk_tier"] == "HIGH_RISK"
            else "[MODERATE]" if eval_res["risk_tier"] == "MODERATE_RISK"
            else "[SAFE]    "
        )

        print(f"{tier_badge} {c['name']}")
        print(f"           Hazard Index: {eval_res['pedestrian_hazard_index']}/100 | Sidewalk: {c['sidewalk']}% | Lighting: {c['lighting']}%")
        print(f"           Key Action  : {eval_res['recommended_interventions'][0]}\n")

        # Create GeoJSON LineString feature
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": c["coords"]
            },
            "properties": {
                "ward_id": c["ward_id"],
                "corridor_name": c["name"],
                "hazard_index": eval_res["pedestrian_hazard_index"],
                "risk_tier": eval_res["risk_tier"],
                "interventions_count": len(eval_res["recommended_interventions"])
            }
        })

    if geojson_path:
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, indent=2)
        print(f"[OK] GIS Corridor Heatmap exported to {geojson_path}")

    return audited


def main():
    parser = argparse.ArgumentParser(description="Audit pedestrian corridors for micro-mobility safety.")
    parser.add_argument("--geojson", type=str, default=None, help="Path to export GeoJSON FeatureCollection")
    args = parser.parse_args()

    audit_corridors(geojson_path=args.geojson)


if __name__ == "__main__":
    main()
