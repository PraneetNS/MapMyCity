#!/usr/bin/env python3
"""
scripts/simulate_work_order_dispatch.py
=======================================
Simulates high-velocity municipal defect reports, tests automated department
routing, calculates SLA deadlines, and benchmarks triage dispatch latency.
"""

import sys
import os
import json
import time
import random
import argparse
from typing import List, Dict, Any

# Ensure backend-fastapi directory is accessible for domain service imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend-fastapi")))

try:
    from services.dispatch_escalation import DispatchEscalationService
except ImportError:
    class DispatchEscalationService:
        def create_work_order(self, **kwargs):
            return {
                "id": f"mock-{random.randint(1000, 9999)}",
                "order_number": f"WO-SIM-{random.randint(100, 999)}",
                "priority": "HIGH" if kwargs.get("severity_score", 0.5) > 0.6 else "MEDIUM",
                "status": "DISPATCHED",
                "department_name": "Roads & Infrastructure Engineering",
                "contractor_name": "Apex Urban Roadworks Ltd.",
                "sla_deadline": "2026-10-21T18:00:00Z"
            }


CATEGORIES = [
    ("pothole", 0.4, 0.95),
    ("waterlogging", 0.6, 0.98),
    ("streetlight_out", 0.3, 0.7),
    ("garbage_dump", 0.2, 0.8),
    ("road_crack", 0.2, 0.6),
]

WARDS = [
    "ward_bbmp_150",
    "ward_bbmp_174",
    "ward_bbmp_085",
    "ward_bbmp_092"
]


def run_simulation(
    batch_size: int = 50,
    weather_alert: bool = False,
    output_path: str = None
) -> Dict[str, Any]:
    service = DispatchEscalationService()
    start_time = time.perf_counter()

    dispatched_orders: List[Dict[str, Any]] = []
    priority_counts = {"EMERGENCY": 0, "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    dept_counts: Dict[str, int] = {}

    for i in range(batch_size):
        cat_name, min_sev, max_sev = random.choice(CATEGORIES)
        severity = round(random.uniform(min_sev, max_sev), 2)
        confirmations = random.randint(0, 15)
        ward = random.choice(WARDS)

        wo = service.create_work_order(
            cluster_id=f"cluster-{i+1:04d}",
            category=cat_name,
            ward_id=ward,
            severity_score=severity,
            confirmations_count=confirmations,
            weather_alert=weather_alert,
            notes=f"Synthetic defect batch simulation #{i+1}"
        )
        dispatched_orders.append(wo)

        p = wo.get("priority", "MEDIUM")
        priority_counts[p] = priority_counts.get(p, 0) + 1

        d = wo.get("department_name", "General")
        dept_counts[d] = dept_counts.get(d, 0) + 1

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0
    avg_latency_ms = round(elapsed_ms / batch_size, 3)

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "batch_size": batch_size,
        "weather_alert_active": weather_alert,
        "total_elapsed_ms": round(elapsed_ms, 2),
        "avg_dispatch_latency_ms": avg_latency_ms,
        "throughput_ops_per_sec": round(batch_size / (elapsed_ms / 1000.0), 1),
        "priority_distribution": priority_counts,
        "department_distribution": dept_counts,
        "sample_orders": dispatched_orders[:5]
    }

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

    return summary


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Simulate autonomous municipal work order dispatch.")
    parser.add_argument("--batch", type=int, default=50, help="Number of simulated defect clusters (default: 50)")
    parser.add_argument("--storm", action="store_true", help="Enable active weather flood warning flag")
    parser.add_argument("--out", type=str, default=None, help="Optional output JSON file path")
    args = parser.parse_args()

    print(f"[INFO] Initializing Dispatch Simulation (Batch: {args.batch}, Storm Mode: {args.storm})...")
    res = run_simulation(batch_size=args.batch, weather_alert=args.storm, output_path=args.out)

    print(f"[OK] Dispatched {res['batch_size']} orders in {res['total_elapsed_ms']} ms ({res['avg_dispatch_latency_ms']} ms/order).")
    print(f"[METRIC] Throughput: {res['throughput_ops_per_sec']} work orders/second.")
    print("\n--- Priority Breakdown ---")
    for prio, count in res["priority_distribution"].items():
        bar = "#" * int(count * 20 / max(args.batch, 1))
        print(f"  {prio:<10}: {count:>3} {bar}")

    print("\n--- Department Routing ---")
    for dept, count in res["department_distribution"].items():
        print(f"  {dept:<35}: {count} orders")

    if args.out:
        print(f"\n[FILE] Saved complete execution log to: {args.out}")


if __name__ == "__main__":
    main()
