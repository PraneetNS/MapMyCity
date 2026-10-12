#!/usr/bin/env python3
"""
scripts/export_geojson.py
=========================
GeoJSON export utility for MapMyCity spatial defects and cluster layers.
Exports spatial data for consumption in QGIS, Mapbox, Leaflet, or ArcGIS.
"""

import sys
import os
import json
import argparse
from typing import Dict, Any, List

# Add parent path for imports if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def load_or_generate_clusters() -> List[Dict[str, Any]]:
    mock_path = os.path.join(os.path.dirname(__file__), "..", "mock_data", "seed_clusters.json")
    if os.path.exists(mock_path):
        try:
            with open(mock_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Built-in synthetic fallback
    return [
        {
            "id": "c101-sample",
            "mission_type": "pothole",
            "ward_id": "Ward 4 (Central)",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "submission_count": 5,
            "status": "active",
            "severity": "high",
            "first_reported_at": "2026-09-01T10:00:00Z"
        },
        {
            "id": "c102-sample",
            "mission_type": "drainage",
            "ward_id": "Ward 12 (North)",
            "latitude": 12.9816,
            "longitude": 77.6046,
            "submission_count": 3,
            "status": "in_progress",
            "severity": "medium",
            "first_reported_at": "2026-09-05T14:30:00Z"
        },
        {
            "id": "c103-sample",
            "mission_type": "garbage",
            "ward_id": "Ward 7 (West)",
            "latitude": 12.9616,
            "longitude": 77.5846,
            "submission_count": 8,
            "status": "active",
            "severity": "critical",
            "first_reported_at": "2026-08-28T09:15:00Z"
        }
    ]


def convert_to_geojson(clusters: List[Dict[str, Any]], category: str = None, min_reports: int = 1) -> Dict[str, Any]:
    features = []
    for c in clusters:
        if category and c.get("mission_type") != category:
            continue
        if c.get("submission_count", 1) < min_reports:
            continue

        lat = c.get("latitude")
        lng = c.get("longitude")
        if lat is None or lng is None:
            continue

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lng), float(lat)]
            },
            "properties": {
                "id": c.get("id"),
                "category": c.get("mission_type"),
                "ward": c.get("ward_id"),
                "status": c.get("status"),
                "reports_count": c.get("submission_count", 1),
                "severity": c.get("severity", "medium"),
                "first_reported": c.get("first_reported_at")
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": features
    }


def main():
    parser = argparse.ArgumentParser(description="Export MapMyCity spatial defects to GeoJSON")
    parser.add_argument("--output", "-o", default=None, help="Target GeoJSON output filepath")
    parser.add_argument("--category", "-c", default=None, help="Filter by mission/defect category")
    parser.add_argument("--min-reports", "-m", type=int, default=1, help="Minimum reports in cluster threshold")
    parser.add_argument("--pretty", action="store_true", help="Format with indentation")
    args = parser.parse_args()

    clusters = load_or_generate_clusters()
    geojson_doc = convert_to_geojson(clusters, category=args.category, min_reports=args.min_reports)

    output_str = json.dumps(geojson_doc, indent=2 if args.pretty else None)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_str)
        print(f"[SUCCESS] Exported {len(geojson_doc['features'])} spatial features to {args.output}")
    else:
        print(output_str)


if __name__ == "__main__":
    main()
