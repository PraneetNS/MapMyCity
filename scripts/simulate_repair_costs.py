#!/usr/bin/env python3
"""
scripts/simulate_repair_costs.py
================================
Simulates batch municipal repair cost forecasting, Bill of Materials (BOM)
quantification, and contractor bidding evaluation across urban wards.
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
    from services.repair_cost_engine import RepairCostEngine
except ImportError:
    class RepairCostEngine:
        def calculate_pothole_bom(self, surface_area_sqm, depth_cm, traffic_tier="MEDIUM", emergency_patch=False, contingency_pct=10.0):
            area = max(0.1, surface_area_sqm)
            depth = max(2.0, depth_cm) / 100.0
            vol = area * depth
            asphalt_kg = vol * 2400.0
            asphalt_t = asphalt_kg / 1000.0
            tack_kg = area * 0.25
            cost = asphalt_t * 4850.0 + tack_kg * 78.0 + 3500.0
            return {
                "surface_area_sqm": area,
                "depth_cm": depth_cm,
                "estimated_volume_cum": vol,
                "materials_breakdown": {
                    "asphalt_mix_kg": asphalt_kg,
                    "asphalt_mix_tonnes": asphalt_t,
                    "tack_coat_emulsion_kg": tack_kg,
                    "granular_subbase_kg": 0.0,
                    "needs_base_course_reinstatement": False,
                    "mix_grade": "VG-30_BITUMINOUS_CONCRETE"
                },
                "financial_breakdown_inr": {
                    "materials_cost": cost * 0.5,
                    "labor_cost": cost * 0.3,
                    "equipment_and_mobilization_cost": cost * 0.2,
                    "total_estimated_cost": cost
                },
                "operational_estimates": {
                    "estimated_repair_duration_hours": 3.5,
                    "roller_compaction_hours": 1.5,
                    "recommended_crew_size": 4
                },
                "environmental_impact": {
                    "embodied_carbon_kg_co2e": round(asphalt_kg * 0.052, 2)
                }
            }


WARDS = ["ward_bbmp_150", "ward_bbmp_174", "ward_bbmp_085", "ward_bbmp_101", "ward_bbmp_092"]
TRAFFIC_TIERS = ["LOW", "MEDIUM", "HIGH", "HEAVY_CORRIDOR"]


def run_repair_simulation(
    defect_count: int = 25,
    emergency_mode: bool = False,
    output_path: str = None
) -> Dict[str, Any]:
    engine = RepairCostEngine()
    start_time = time.perf_counter()

    results: List[Dict[str, Any]] = []
    total_budget_inr = 0.0
    total_asphalt_kg = 0.0
    total_tack_coat_kg = 0.0
    total_carbon_kg = 0.0
    ward_breakdown: Dict[str, Dict[str, float]] = {w: {"budget": 0.0, "asphalt_kg": 0.0, "defects": 0} for w in WARDS}

    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print(f"\n========================================================")
    print(f"  MapMyCity - Municipal Repair Cost & BOM Simulator")
    print(f"========================================================")
    print(f"Simulating {defect_count} defect clusters (Emergency Cold-Patch: {emergency_mode})...\n")

    for i in range(defect_count):
        ward = random.choice(WARDS)
        area = round(random.uniform(0.4, 4.5), 2)
        depth = round(random.uniform(3.0, 11.0), 1)
        traffic = random.choice(TRAFFIC_TIERS)

        bom = engine.calculate_pothole_bom(
            surface_area_sqm=area,
            depth_cm=depth,
            traffic_tier=traffic,
            emergency_patch=emergency_mode
        )

        cost = bom["financial_breakdown_inr"]["total_estimated_cost"]
        asphalt = bom["materials_breakdown"]["asphalt_mix_kg"]
        tack = bom["materials_breakdown"]["tack_coat_emulsion_kg"]
        carbon = bom["environmental_impact"]["embodied_carbon_kg_co2e"]

        total_budget_inr += cost
        total_asphalt_kg += asphalt
        total_tack_coat_kg += tack
        total_carbon_kg += carbon

        ward_breakdown[ward]["budget"] += cost
        ward_breakdown[ward]["asphalt_kg"] += asphalt
        ward_breakdown[ward]["defects"] += 1

        results.append({
            "id": f"SIM-DEFECT-{i+1:03d}",
            "ward_id": ward,
            "surface_area_sqm": area,
            "depth_cm": depth,
            "traffic_tier": traffic,
            "cost_inr": cost,
            "asphalt_kg": asphalt,
            "embodied_carbon_kg": carbon
        })

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    print(f"Simulation completed in {elapsed_ms:.2f} ms")
    print(f"--------------------------------------------------------")
    print(f"Total Forecasted Budget : INR {total_budget_inr:,.2f}")
    print(f"Total Asphalt Required  : {total_asphalt_kg / 1000.0:.2f} Metric Tonnes ({total_asphalt_kg:,.1f} kg)")
    print(f"Total Bitumen Tack Coat : {total_tack_coat_kg:,.1f} kg")
    print(f"Embodied CO2 Impact     : {total_carbon_kg:,.1f} kg CO2e")
    print(f"Average Cost per Defect : INR {total_budget_inr / defect_count:,.2f}")
    print(f"--------------------------------------------------------")
    print(f"Ward Breakdown:")
    for w, data in ward_breakdown.items():
        if data["defects"] > 0:
            print(f"  {w:18}: {data['defects']} defects | INR {data['budget']:,.2f} | {data['asphalt_kg']/1000:.2f} MT Asphalt")

    summary = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "defects_simulated": defect_count,
        "elapsed_ms": elapsed_ms,
        "total_budget_inr": round(total_budget_inr, 2),
        "total_asphalt_metric_tonnes": round(total_asphalt_kg / 1000.0, 3),
        "total_tack_coat_kg": round(total_tack_coat_kg, 2),
        "total_embodied_carbon_kg": round(total_carbon_kg, 2),
        "ward_breakdown": ward_breakdown,
        "clusters": results
    }

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"\n[OK] Results exported to {output_path}")

    return summary


def main():
    parser = argparse.ArgumentParser(description="Simulate municipal repair cost and BOM forecasting.")
    parser.add_argument("--count", type=int, default=30, help="Number of defect clusters to simulate (default: 30)")
    parser.add_argument("--emergency", action="store_true", help="Simulate emergency cold-patch repairs")
    parser.add_argument("--output", type=str, default=None, help="Path to write JSON export")

    args = parser.parse_args()
    run_repair_simulation(defect_count=args.count, emergency_mode=args.emergency, output_path=args.output)


if __name__ == "__main__":
    main()
