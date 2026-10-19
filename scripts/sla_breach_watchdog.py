#!/usr/bin/env python3
"""
scripts/sla_breach_watchdog.py
==============================
Automated Municipal SLA Breach Watchdog Daemon.
Continuously scans active contractor work orders, evaluates SLA deadlines,
issues early breach warnings, and triggers automated executive escalations.
"""

import sys
import os
import time
import argparse
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

# Ensure backend-fastapi directory is accessible for domain service imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend-fastapi")))

try:
    from services.dispatch_escalation import DispatchEscalationService
except ImportError:
    class DispatchEscalationService:
        pass


MOCK_ACTIVE_ORDERS = [
    {
        "id": "wo-wd-01",
        "order_number": "WO-20261019-89A1",
        "ward_id": "ward_bbmp_150",
        "department": "Roads & Infrastructure Engineering",
        "contractor": "Apex Urban Roadworks Ltd.",
        "priority": "CRITICAL",
        "status": "IN_PROGRESS",
        "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat(),
        "escalation_level": 0
    },
    {
        "id": "wo-wd-02",
        "order_number": "WO-20261019-44F2",
        "ward_id": "ward_bbmp_174",
        "department": "Stormwater & Urban Drainage",
        "contractor": "Metro Infra Maintenance JV",
        "priority": "EMERGENCY",
        "status": "DISPATCHED",
        "sla_deadline": (datetime.now(timezone.utc) - timedelta(hours=1.5)).isoformat(),
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=7.5)).isoformat(),
        "escalation_level": 0
    },
    {
        "id": "wo-wd-03",
        "order_number": "WO-20261019-11C3",
        "ward_id": "ward_bbmp_085",
        "department": "Street Lighting & Public Power",
        "contractor": "Kaveri Civic Works Enterprise",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "sla_deadline": (datetime.now(timezone.utc) + timedelta(hours=18)).isoformat(),
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(),
        "escalation_level": 0
    }
]


def audit_sla_deadlines(orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    on_track = []
    warnings = []
    breaches = []

    for o in orders:
        if o["status"] in ("RESOLVED", "REJECTED"):
            continue

        deadline = datetime.fromisoformat(o["sla_deadline"])
        created = datetime.fromisoformat(o["created_at"])
        total_sec = (deadline - created).total_seconds()
        remaining_sec = (deadline - now).total_seconds()
        remaining_hours = round(remaining_sec / 3600.0, 1)

        info = {
            **o,
            "remaining_hours": remaining_hours
        }

        if remaining_sec <= 0:
            breaches.append(info)
        elif total_sec > 0 and (remaining_sec / total_sec) <= 0.25:
            warnings.append(info)
        else:
            on_track.append(info)

    return {
        "timestamp": now.isoformat(),
        "total_audited": len(orders),
        "on_track_count": len(on_track),
        "warning_count": len(warnings),
        "breach_count": len(breaches),
        "warnings": warnings,
        "breaches": breaches
    }


def execute_audit_cycle(orders: List[Dict[str, Any]], auto_escalate: bool = False):
    res = audit_sla_deadlines(orders)
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] SLA Watchdog Scan: {res['total_audited']} active orders checked.")
    print(f"  On-Track: {res['on_track_count']} | Warning (<25% time): {res['warning_count']} | Breached: {res['breach_count']}")

    if res["warnings"]:
        print("\n  [WARNING] Orders Approaching SLA Breach:")
        for w in res["warnings"]:
            print(f"   * {w['order_number']} ({w['contractor']}) - {w['remaining_hours']} hrs left [{w['ward_id']}]")

    if res["breaches"]:
        print("\n  [ALERT] SLA Breached Orders:")
        for b in res["breaches"]:
            overdue_hrs = abs(b['remaining_hours'])
            print(f"   ! {b['order_number']} Overdue by {overdue_hrs} hrs | Ward: {b['ward_id']} | Dept: {b['department']}")
            if auto_escalate:
                b["escalation_level"] += 1
                b["status"] = "ESCALATED"
                print(f"     -> Auto-escalated to Zonal Chief Engineer (Tier {b['escalation_level']})")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Municipal SLA Breach Watchdog Daemon.")
    parser.add_argument("--once", action="store_true", help="Run single audit pass and exit")
    parser.add_argument("--auto-escalate", action="store_true", help="Trigger automated executive escalations for breaches")
    parser.add_argument("--interval-sec", type=int, default=15, help="Polling interval in seconds (default: 15)")
    args = parser.parse_args()

    print("[INFO] Starting MapMyCity SLA Breach Watchdog...")
    if args.once:
        execute_audit_cycle(MOCK_ACTIVE_ORDERS, auto_escalate=args.auto_escalate)
        print("\n[OK] Watchdog single audit cycle completed.")
    else:
        print(f"[INFO] Entering continuous monitoring loop (Interval: {args.interval_sec}s). Press Ctrl+C to terminate.")
        try:
            while True:
                execute_audit_cycle(MOCK_ACTIVE_ORDERS, auto_escalate=args.auto_escalate)
                time.sleep(args.interval_sec)
        except KeyboardInterrupt:
            print("\n[INFO] SLA Breach Watchdog daemon stopped.")


if __name__ == "__main__":
    main()
