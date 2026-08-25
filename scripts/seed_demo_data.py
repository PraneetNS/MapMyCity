"""
MapMyCity Demo & Staging Data Generator Script.
Populates mock spatial defect clusters, road roughness telemetry,
citizen feedback surveys, and partner webhooks for local development.
"""

import sys
import os
import json
import random
import uuid
from datetime import datetime, timezone, timedelta

# Default mock categories and sample coordinates around central metro ward
CATEGORIES = ["pothole", "streetlight", "garbage", "drainage", "accessibility", "safety_concern"]
WARDS = ["Ward 4 (Central)", "Ward 12 (North)", "Ward 7 (West)", "Ward 2 (South)", "Ward 18 (East)"]
ASPECTS = ["rapid_resolution", "high_quality_patch", "clean_site", "good_communication", "debris_remaining", "partial_fix"]

def generate_mock_clusters(count: int = 25):
    clusters = []
    base_lat, base_lng = 12.9716, 77.5946 # Bangalore Metro Center
    now = datetime.now(timezone.utc)

    for i in range(count):
        cat = random.choice(CATEGORIES)
        ward = random.choice(WARDS)
        status = random.choice(["active", "resolved", "in_progress"])
        days_ago = random.randint(1, 45)
        created_at = (now - timedelta(days=days_ago)).isoformat()
        lat = base_lat + random.uniform(-0.04, 0.04)
        lng = base_lng + random.uniform(-0.04, 0.04)

        clusters.append({
            "id": str(uuid.uuid4()),
            "mission_type": cat,
            "ward_id": ward,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "submission_count": random.randint(1, 8),
            "status": status,
            "first_reported_at": created_at,
            "last_reported_at": (now - timedelta(days=random.randint(0, days_ago))).isoformat()
        })
    return clusters

def generate_mock_surveys(clusters, count: int = 40):
    surveys = []
    now = datetime.now(timezone.utc)

    for i in range(count):
        cluster = random.choice(clusters)
        rating = random.choices([5, 4, 3, 2, 1], weights=[45, 30, 15, 6, 4])[0]
        days_ago = random.randint(1, 30)
        selected_aspects = random.sample(ASPECTS, k=random.randint(1, 3))

        surveys.append({
            "id": str(uuid.uuid4()),
            "user_id": f"citizen_{random.randint(100, 999)}",
            "cluster_id": cluster["id"],
            "ward_id": cluster["ward_id"],
            "category": cluster["mission_type"],
            "rating": rating,
            "aspects": selected_aspects,
            "feedback_text": f"Resolution feedback for {cluster['mission_type']} in {cluster['ward_id']}.",
            "resolution_speed_rating": min(5, rating + random.choice([-1, 0, 1])),
            "workmanship_rating": min(5, rating + random.choice([-1, 0, 1])),
            "sentiment_score": round((rating - 3) / 2.0, 2),
            "created_at": (now - timedelta(days=days_ago)).isoformat()
        })
    return surveys

def main():
    print("==================================================")
    print("MapMyCity Mock Data Generation Utility")
    print("==================================================")
    clusters = generate_mock_clusters(25)
    surveys = generate_mock_surveys(clusters, 40)

    output_dir = os.path.join(os.path.dirname(__file__), "..", "mock_data")
    os.makedirs(output_dir, exist_ok=True)

    clusters_path = os.path.join(output_dir, "seed_clusters.json")
    surveys_path = os.path.join(output_dir, "seed_surveys.json")

    with open(clusters_path, "w", encoding="utf-8") as f:
        json.dump(clusters, f, indent=2)

    with open(surveys_path, "w", encoding="utf-8") as f:
        json.dump(surveys, f, indent=2)

    print(f"[SUCCESS] Generated {len(clusters)} mock clusters -> {clusters_path}")
    print(f"[SUCCESS] Generated {len(surveys)} mock citizen surveys -> {surveys_path}")
    print("==================================================")

if __name__ == "__main__":
    main()
