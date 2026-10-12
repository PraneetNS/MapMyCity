#!/usr/bin/env python3
"""
scripts/compute_ward_sla_metrics.py
===================================
Municipal Service Level Agreement (SLA) metrics calculation and compliance auditor.
Calculates Mean Time to Resolution (MTTR), Mean Time to Acknowledgment (MTTA),
and SLA breach percentages across administrative wards.
"""

import sys
import os
import json
import csv
import argparse
from typing import Dict, Any, List


def load_or_generate_ward_data() -> List[Dict[str, Any]]:
    return [
        {
            "ward_id": "Ward 4 (Central)",
            "total_defects": 84,
            "resolved_count": 72,
            "in_progress_count": 9,
            "pending_count": 3,
            "avg_mtta_hours": 3.8,
            "avg_mttr_hours": 42.5,
            "sla_target_hours": 72.0,
            "breached_count": 6,
            "satisfaction_rating": 4.4
        },
        {
            "ward_id": "Ward 12 (North)",
            "total_defects": 65,
            "resolved_count": 51,
            "in_progress_count": 10,
            "pending_count": 4,
            "avg_mtta_hours": 5.2,
            "avg_mttr_hours": 64.1,
            "sla_target_hours": 72.0,
            "breached_count": 9,
            "satisfaction_rating": 3.9
        },
        {
            "ward_id": "Ward 7 (West)",
            "total_defects": 112,
            "resolved_count": 88,
            "in_progress_count": 16,
            "pending_count": 8,
            "avg_mtta_hours": 6.1,
            "avg_mttr_hours": 78.3,
            "sla_target_hours": 72.0,
            "breached_count": 18,
            "satisfaction_rating": 3.6
        },
        {
            "ward_id": "Ward 2 (South)",
            "total_defects": 45,
            "resolved_count": 42,
            "in_progress_count": 2,
            "pending_count": 1,
            "avg_mtta_hours": 2.4,
            "avg_mttr_hours": 31.0,
            "sla_target_hours": 72.0,
            "breached_count": 2,
            "satisfaction_rating": 4.7
        }
    ]


def compute_sla_metrics(wards: List[Dict[str, Any]], target_ward: str = None) -> List[Dict[str, Any]]:
    processed = []
    for w in wards:
        if target_ward and target_ward.lower() not in w["ward_id"].lower():
            continue

        resolved = w["resolved_count"]
        breached = w["breached_count"]
        compliance_pct = round(((resolved - breached) / max(1, resolved)) * 100.0, 1) if resolved > 0 else 0.0

        processed.append({
            "ward": w["ward_id"],
            "total_defects": w["total_defects"],
            "resolved": resolved,
            "backlog": w["in_progress_count"] + w["pending_count"],
            "mtta_hrs": w["avg_mtta_hours"],
            "mttr_hrs": w["avg_mttr_hours"],
            "sla_compliance_pct": compliance_pct,
            "sla_status": "EXCELLENT" if compliance_pct >= 90.0 else ("ACCEPTABLE" if compliance_pct >= 75.0 else "AT_RISK"),
            "csat_score": w["satisfaction_rating"]
        })
    return processed


def main():
    parser = argparse.ArgumentParser(description="Calculate municipal ward SLA compliance metrics")
    parser.add_argument("--ward", "-w", help="Filter for specific ward substring")
    parser.add_argument("--export-csv", "-e", help="Filepath to export CSV table")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")
    args = parser.parse_args()

    data = load_or_generate_ward_data()
    metrics = compute_sla_metrics(data, target_ward=args.ward)

    if args.json:
        print(json.dumps(metrics, indent=2))
        return

    print("=========================================================================================")
    print("MapMyCity Municipal SLA & Resolution Performance Auditor")
    print("=========================================================================================")
    print(f"{'Ward':<22} | {'Total':<6} | {'Resolved':<8} | {'Backlog':<8} | {'MTTR (h)':<8} | {'SLA %':<6} | {'Status':<10}")
    print("-" * 89)

    for m in metrics:
        print(f"{m['ward']:<22} | {m['total_defects']:<6} | {m['resolved']:<8} | {m['backlog']:<8} | {m['mttr_hrs']:<8.1f} | {m['sla_compliance_pct']:<5.1f}% | {m['sla_status']:<10}")

    print("=========================================================================================")

    if args.export_csv:
        os.makedirs(os.path.dirname(os.path.abspath(args.export_csv)), exist_ok=True)
        with open(args.export_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(metrics[0].keys()))
            writer.writeheader()
            writer.writerows(metrics)
        print(f"[SUCCESS] Exported SLA metrics table to {args.export_csv}")


if __name__ == "__main__":
    main()
