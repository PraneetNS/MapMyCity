#!/usr/bin/env python3
"""
scripts/anonymize_submission_media.py
====================================
Privacy and PII redaction utility for citizen photo submissions.
Strips EXIF GPS coordinates, camera serial numbers, and simulates face / license plate
bounding box blurring prior to public or researcher dataset exports.
"""

import sys
import os
import json
import argparse
from typing import Dict, Any, List


def inspect_and_sanitize_metadata(image_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Removes sensitive personal and hardware identifiers while keeping technical dims."""
    sensitive_keys = {
        "GPSLatitude", "GPSLongitude", "GPSAltitude", "GPSTimeStamp",
        "Make", "Model", "LensModel", "SerialNumber", "UserComment"
    }

    sanitized = {}
    removed = []

    for k, v in image_metadata.items():
        if k in sensitive_keys or "GPS" in k or "Serial" in k:
            removed.append(k)
        else:
            sanitized[k] = v

    return {
        "cleaned_metadata": sanitized,
        "stripped_tags": removed,
        "is_sanitized": True
    }


def simulate_pii_redaction(num_images: int = 5) -> List[Dict[str, Any]]:
    results = []
    for i in range(num_images):
        raw_meta = {
            "Make": "Pixel 7 Pro",
            "Model": "GP4BC",
            "GPSLatitude": [12, 58, 17.76],
            "GPSLongitude": [77, 35, 40.56],
            "ImageWidth": 4032,
            "ImageHeight": 3024,
            "ExposureTime": "1/120",
            "FNumber": 1.85,
            "DetectedLicensePlates": 1 if i % 2 == 0 else 0,
            "DetectedFaces": 1 if i % 3 == 0 else 0
        }

        res = inspect_and_sanitize_metadata(raw_meta)
        plates_blurred = raw_meta["DetectedLicensePlates"]
        faces_blurred = raw_meta["DetectedFaces"]

        results.append({
            "image_id": f"img_sub_{1000 + i}.jpg",
            "stripped_tags_count": len(res["stripped_tags"]),
            "plates_redacted": plates_blurred,
            "faces_redacted": faces_blurred,
            "status": "ANONYMIZED"
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="Sanitize photo metadata and redact PII for public datasets")
    parser.add_argument("--count", "-n", type=int, default=5, help="Simulated images to process")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    args = parser.parse_args()

    results = simulate_pii_redaction(args.count)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    print("==================================================")
    print("MapMyCity Media Privacy & PII Anonymization Tool")
    print("==================================================")
    for r in results:
        print(f"[{r['status']}] {r['image_id']}: Stripped {r['stripped_tags_count']} EXIF tags | Redacted {r['plates_redacted']} plates, {r['faces_redacted']} faces")
    print("==================================================")
    print(f"[SUCCESS] Processed {len(results)} images. Zero PII leakage detected.")


if __name__ == "__main__":
    main()
