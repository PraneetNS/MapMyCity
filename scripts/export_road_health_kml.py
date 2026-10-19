#!/usr/bin/env python3
"""
scripts/export_road_health_kml.py
=================================
Exports road segment roughness (IRI) and Road Health Index (RHI) traces into
GIS-compatible KML (Google Earth) or GeoJSON format for municipal highway engineers.
"""

import sys
import os
import json
import argparse
from typing import List, Dict, Any

# Ensure backend-fastapi directory is accessible for domain service imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend-fastapi")))

try:
    from services.road_health_aggregator import RoadHealthAggregator
except ImportError:
    class RoadHealthAggregator:
        def compute_iri_from_telemetry(self, samples, speed):
            return 3.2
        def iri_to_road_health_index(self, iri):
            return 70


SAMPLE_CORRIDORS = [
    {
        "name": "Outer Ring Road (Bellandur Flyover)",
        "ward": "ward_bbmp_150",
        "coords": [[77.6744, 12.9260], [77.6780, 12.9295], [77.6820, 12.9325]],
        "rhi": 42,
        "iri": 5.4,
        "potholes": 6
    },
    {
        "name": "Sarjapur Main Road (Kaikondrahalli)",
        "ward": "ward_bbmp_150",
        "coords": [[77.6850, 12.9120], [77.6910, 12.9140], [77.6980, 12.9160]],
        "rhi": 36,
        "iri": 6.3,
        "potholes": 9
    },
    {
        "name": "HSR 27th Main Commercial Corridor",
        "ward": "ward_bbmp_174",
        "coords": [[77.6440, 12.9110], [77.6480, 12.9150], [77.6520, 12.9190]],
        "rhi": 82,
        "iri": 2.1,
        "potholes": 1
    },
    {
        "name": "Doddanekkundi Industrial Road",
        "ward": "ward_bbmp_085",
        "coords": [[77.7010, 12.9720], [77.7080, 12.9750], [77.7140, 12.9780]],
        "rhi": 28,
        "iri": 7.8,
        "potholes": 14
    }
]


def rhi_to_kml_color(rhi: int) -> str:
    """Returns KML aabbggrr color code based on surface condition."""
    if rhi >= 75:
        return "ff00cc00"  # Green
    elif rhi >= 50:
        return "ff00d7ff"  # Yellow/Gold
    elif rhi >= 35:
        return "ff0080ff"  # Orange
    return "ff0000ff"      # Red


def build_kml(corridors: List[Dict[str, Any]]) -> str:
    placemarks = []
    for c in corridors:
        coord_str = " ".join(f"{pt[0]},{pt[1]},0" for pt in c["coords"])
        color = rhi_to_kml_color(c["rhi"])
        style_id = f"style_{c['rhi']}"

        placemark = f"""
    <Style id="{style_id}">
      <LineStyle>
        <color>{color}</color>
        <width>5</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>{c['name']} (RHI: {c['rhi']})</name>
      <description><![CDATA[
        <b>Ward:</b> {c['ward']}<br/>
        <b>Road Health Index:</b> {c['rhi']}/100<br/>
        <b>Roughness (IRI):</b> {c['iri']} m/km<br/>
        <b>Detected Potholes:</b> {c['potholes']}<br/>
      ]]></description>
      <styleUrl>#{style_id}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>{coord_str}</coordinates>
      </LineString>
    </Placemark>"""
        placemarks.append(placemark)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>MapMyCity Road Surface Health Survey</name>
    <description>International Roughness Index (IRI) and Road Health Index (RHI) traces</description>
    {''.join(placemarks)}
  </Document>
</kml>"""


def build_geojson(corridors: List[Dict[str, Any]]) -> Dict[str, Any]:
    features = []
    for c in corridors:
        features.append({
            "type": "Feature",
            "properties": {
                "corridor_name": c["name"],
                "ward_id": c["ward"],
                "road_health_index": c["rhi"],
                "international_roughness_index": c["iri"],
                "pothole_cluster_count": c["potholes"],
                "condition": "GOOD" if c["rhi"] >= 75 else "POOR" if c["rhi"] >= 35 else "CRITICAL"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": c["coords"]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Export road health and IRI roughness traces to KML/GeoJSON.")
    parser.add_argument("--format", choices=["kml", "geojson"], default="kml", help="Output format (kml or geojson)")
    parser.add_argument("--out", type=str, required=True, help="Destination file path (e.g. road_health.kml)")
    args = parser.parse_args()

    print(f"[INFO] Exporting {len(SAMPLE_CORRIDORS)} road health corridor surveys to {args.format.upper()}...")

    if args.format == "kml":
        content = build_kml(SAMPLE_CORRIDORS)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        geojson_data = build_geojson(SAMPLE_CORRIDORS)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

    print(f"[OK] Export successfully written to: {args.out}")


if __name__ == "__main__":
    main()
