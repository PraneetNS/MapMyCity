"""
Automated Defect Repair Cost and Bill of Materials (BOM) Calculation Engine.
Calibrated according to standard Central Public Works Department (CPWD) Delhi Schedule of Rates (DSR)
and Ministry of Road Transport and Highways (MoRTH) Section 500 Bituminous Specifications.
"""

from typing import Dict, Any, Optional
import math


class CPWDRateSchedule:
    """Standard municipal unit schedule of rates (INR) and physical constants."""
    ASPHALT_DENSITY_KG_PER_CUM = 2400.0          # Dense Bituminous Macadam / Bituminous Concrete
    AGGREGATE_DENSITY_KG_PER_CUM = 2200.0        # Granular Sub-base / Wet Mix Macadam
    TACK_COAT_RATE_KG_PER_SQM = 0.25             # Rapid Setting Bitumen Emulsion RS-1

    # Standard Item Costs (INR)
    HOT_MIX_ASPHALT_PER_TONNE = 4850.0           # ₹4,850 / MT (Bituminous Concrete VG-30)
    COLD_PATCH_ASPHALT_PER_TONNE = 6200.0        # ₹6,200 / MT (Ready-to-use polymer modified cold patch)
    TACK_COAT_PER_KG = 78.0                      # ₹78 / kg
    WMM_BASE_PER_CUM = 1650.0                    # ₹1,650 / m³
    COMPACTOR_ROLLER_PER_HOUR = 950.0            # ₹950 / hr (Tandem vibratory roller)
    CREW_LABOR_PER_HOUR = 850.0                  # ₹850 / hr (1 Foreman + 2 Rake operators + 1 Helper)
    BASE_MOBILIZATION_FLAT = 1500.0              # ₹1,500 base setup and safety cone mobilization

    # Embodied Carbon Factors (kg CO2e per unit)
    CARBON_ASPHALT_PER_KG = 0.052                # Embodied CO2 per kg hot mix bitumen
    CARBON_AGGREGATE_PER_KG = 0.012              # Embodied CO2 per kg crushed quarry aggregate


class RepairCostEngine:
    """Calculates granular Bill of Materials (BOM), repair duration, and budget for civic defects."""

    def __init__(self, rates: Optional[CPWDRateSchedule] = None):
        self.rates = rates or CPWDRateSchedule()

    def calculate_pothole_bom(
        self,
        surface_area_sqm: float,
        depth_cm: float,
        traffic_tier: str = "MEDIUM",
        emergency_patch: bool = False,
        contingency_pct: float = 10.0
    ) -> Dict[str, Any]:
        """
        Calculates full materials, equipment, labor breakdown, and carbon emissions for road patching.
        """
        # Ensure positive minimum dimensions
        surface_area = max(0.05, float(surface_area_sqm))
        depth_m = max(0.02, float(depth_cm) / 100.0)

        # Standard safety overcut: add 15% perimeter squaring for proper mechanical keying
        engineered_area = round(surface_area * 1.15, 3)
        volume_cum = round(engineered_area * depth_m, 4)

        # Base course requirement if pothole depth exceeds 6 cm
        needs_base_course = depth_m > 0.06
        if needs_base_course:
            base_course_thickness = depth_m * 0.45
            wearing_course_thickness = depth_m * 0.55
            base_volume_cum = engineered_area * base_course_thickness
            wearing_volume_cum = engineered_area * wearing_course_thickness
        else:
            base_volume_cum = 0.0
            wearing_volume_cum = volume_cum

        # Material weights
        asphalt_weight_kg = round(wearing_volume_cum * self.rates.ASPHALT_DENSITY_KG_PER_CUM, 2)
        asphalt_tonnes = asphalt_weight_kg / 1000.0
        tack_coat_kg = round(engineered_area * self.rates.TACK_COAT_RATE_KG_PER_SQM, 2)
        aggregate_kg = round(base_volume_cum * self.rates.AGGREGATE_DENSITY_KG_PER_CUM, 2)

        # Material pricing
        if emergency_patch:
            asphalt_cost = asphalt_tonnes * self.rates.COLD_PATCH_ASPHALT_PER_TONNE
        else:
            asphalt_cost = asphalt_tonnes * self.rates.HOT_MIX_ASPHALT_PER_TONNE

        tack_coat_cost = tack_coat_kg * self.rates.TACK_COAT_PER_KG
        base_aggregate_cost = base_volume_cum * self.rates.WMM_BASE_PER_CUM
        total_materials_cost = asphalt_cost + tack_coat_cost + base_aggregate_cost

        # Work duration estimation
        base_hours = 2.0
        area_hours = engineered_area * 0.35
        depth_hours = 1.0 if needs_base_course else 0.0
        total_work_hours = round(min(12.0, base_hours + area_hours + depth_hours), 1)

        roller_hours = round(max(1.0, total_work_hours * 0.5), 1)
        equipment_cost = roller_hours * self.rates.COMPACTOR_ROLLER_PER_HOUR + self.rates.BASE_MOBILIZATION_FLAT
        labor_cost = total_work_hours * self.rates.CREW_LABOR_PER_HOUR

        # Traffic factor adjustment
        traffic_multipliers = {
            "LOW": 1.0,
            "MEDIUM": 1.10,
            "HIGH": 1.25,
            "HEAVY_CORRIDOR": 1.40
        }
        traffic_factor = traffic_multipliers.get(traffic_tier.upper(), 1.10)

        subtotal = (total_materials_cost + equipment_cost + labor_cost) * traffic_factor
        contingency_amount = subtotal * (contingency_pct / 100.0)
        total_estimated_cost = round(subtotal + contingency_amount, 2)

        # Embodied carbon calculation
        carbon_asphalt = asphalt_weight_kg * self.rates.CARBON_ASPHALT_PER_KG
        carbon_aggregate = aggregate_kg * self.rates.CARBON_AGGREGATE_PER_KG
        total_carbon_kg = round(carbon_asphalt + carbon_aggregate, 2)

        confidence_score = 0.92 if engineered_area < 5.0 else 0.84

        return {
            "defect_type": "pothole",
            "surface_area_sqm": engineered_area,
            "depth_cm": round(depth_m * 100, 1),
            "estimated_volume_cum": volume_cum,
            "materials_breakdown": {
                "asphalt_mix_kg": asphalt_weight_kg,
                "asphalt_mix_tonnes": round(asphalt_tonnes, 3),
                "tack_coat_emulsion_kg": tack_coat_kg,
                "granular_subbase_kg": aggregate_kg,
                "needs_base_course_reinstatement": needs_base_course,
                "mix_grade": "COLD_PATCH_POLYMER" if emergency_patch else "VG-30_BITUMINOUS_CONCRETE"
            },
            "financial_breakdown_inr": {
                "materials_cost": round(total_materials_cost, 2),
                "labor_cost": round(labor_cost, 2),
                "equipment_and_mobilization_cost": round(equipment_cost, 2),
                "traffic_factor_multiplier": traffic_factor,
                "contingency_pct": contingency_pct,
                "total_estimated_cost": total_estimated_cost
            },
            "operational_estimates": {
                "estimated_repair_duration_hours": total_work_hours,
                "roller_compaction_hours": roller_hours,
                "recommended_crew_size": 4 if not needs_base_course else 6
            },
            "environmental_impact": {
                "embodied_carbon_kg_co2e": total_carbon_kg,
                "co2_mitigation_benefit_score": round(max(10, 100 - (total_carbon_kg * 0.4)), 1)
            },
            "confidence_score": confidence_score,
            "schedule_standard": "CPWD_DSR_2024"
        }

    def estimate_utility_or_drainage_repair(
        self,
        defect_type: str,
        severity_score: float = 0.5,
        linear_meters: float = 5.0
    ) -> Dict[str, Any]:
        """Calculates repair cost for non-pothole civic infrastructure defects."""
        length = max(1.0, float(linear_meters))
        sev = min(1.0, max(0.1, float(severity_score)))

        if defect_type in ("waterlogging", "drainage_clog"):
            labor_hours = round(3.0 + (length * 0.8 * sev), 1)
            equipment_cost = 2500.0 if sev > 0.6 else 1200.0  # Suction jetting truck
            materials_cost = 800.0 + (length * 150.0)         # Grating, desilting consumables
        elif defect_type in ("streetlight_out", "wire_snapped"):
            labor_hours = 2.5
            equipment_cost = 1800.0                           # Aerial cherry picker bucket truck
            materials_cost = 3200.0 if sev > 0.5 else 1400.0  # 90W LED Luminaire + armored cable
        else:
            labor_hours = 3.0
            equipment_cost = 1000.0
            materials_cost = 1500.0

        labor_cost = labor_hours * self.rates.CREW_LABOR_PER_HOUR
        total_cost = round(materials_cost + equipment_cost + labor_cost, 2)

        return {
            "defect_type": defect_type,
            "linear_extent_meters": length,
            "financial_breakdown_inr": {
                "materials_cost": round(materials_cost, 2),
                "labor_cost": round(labor_cost, 2),
                "equipment_and_mobilization_cost": round(equipment_cost, 2),
                "total_estimated_cost": total_cost
            },
            "operational_estimates": {
                "estimated_repair_duration_hours": labor_hours,
                "recommended_crew_size": 3
            },
            "confidence_score": 0.88,
            "schedule_standard": "CPWD_DSR_2024"
        }
