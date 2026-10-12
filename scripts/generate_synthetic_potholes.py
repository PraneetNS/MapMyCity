#!/usr/bin/env python3
"""
scripts/generate_synthetic_potholes.py
======================================
Synthetic dataset generator for road defect computer vision heuristics.
Synthesizes bounding-box annotation records (YOLO/VOC format), simulated lighting
degradation (night, wet reflection, glare), and defect severity labels.
"""

import sys
import os
import json
import random
import argparse
from typing import Dict, Any, List

DEFECT_CLASSES = ["pothole_shallow", "pothole_deep", "alligator_cracking", "drainage_overflow", "debris"]
WEATHER_CONDITIONS = ["clear_day", "overcast", "night_low_light", "rainy_wet_surface"]


def generate_defect_annotations(count: int = 10, img_width: int = 1280, img_height: int = 720) -> List[Dict[str, Any]]:
    annotations = []
    for i in range(count):
        defect_type = random.choice(DEFECT_CLASSES)
        weather = random.choice(WEATHER_CONDITIONS)

        # Generate realistic defect bounding box in road region (bottom 60% of frame)
        box_w = random.randint(120, 380)
        box_h = random.randint(80, 260)
        x_min = random.randint(100, img_width - box_w - 100)
        y_min = random.randint(int(img_height * 0.40), img_height - box_h - 40)
        x_max = x_min + box_w
        y_max = y_min + box_h

        # Compute normalized YOLO coordinates [x_center, y_center, w, h]
        x_center = round((x_min + x_max) / (2.0 * img_width), 4)
        y_center = round((y_min + y_max) / (2.0 * img_height), 4)
        norm_w = round(box_w / img_width, 4)
        norm_h = round(box_h / img_height, 4)

        blur_score = round(random.uniform(0.1, 0.95), 2)
        is_usable = blur_score > 0.40 and weather != "night_low_light"

        annotations.append({
            "image_filename": f"synth_road_{100 + i:04d}.jpg",
            "image_dimensions": {"width": img_width, "height": img_height},
            "environment": weather,
            "defect_class": defect_type,
            "bounding_box_pixels": [x_min, y_min, x_max, y_max],
            "yolo_bbox": [x_center, y_center, norm_w, norm_h],
            "quality_metrics": {
                "blur_score": blur_score,
                "contrast": round(random.uniform(0.5, 0.9), 2),
                "is_quality_pass": is_usable
            }
        })
    return annotations


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic defect training annotations")
    parser.add_argument("--count", "-c", type=int, default=10, help="Number of synthetic samples")
    parser.add_argument("--output", "-o", help="Target JSON output filepath")
    args = parser.parse_args()

    items = generate_defect_annotations(args.count)

    print("==================================================")
    print("MapMyCity Synthetic Defect Dataset Generator")
    print("==================================================")
    print(f"Generated {len(items)} synthetic labeled defect instances.")
    passed = sum(1 for x in items if x["quality_metrics"]["is_quality_pass"])
    print(f"Quality heuristic pass rate: {passed}/{len(items)} ({round(passed / len(items) * 100)}%)")

    for x in items[:3]:
        print(f" - {x['image_filename']}: {x['defect_class']} ({x['environment']}) YOLO: {x['yolo_bbox']}")

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)
        print(f"[SUCCESS] Saved annotations to {args.output}")
    print("==================================================")


if __name__ == "__main__":
    main()
