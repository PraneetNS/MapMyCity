"""
Unit tests for RepairCostEngine and CPWD Schedule of Rates calculation.
"""

import unittest
from services.repair_cost_engine import RepairCostEngine, CPWDRateSchedule


class TestRepairCostEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RepairCostEngine()

    def test_standard_small_pothole_calculation(self):
        # 1.0 sqm pothole with 5 cm depth
        res = self.engine.calculate_pothole_bom(
            surface_area_sqm=1.0,
            depth_cm=5.0,
            traffic_tier="LOW",
            emergency_patch=False
        )

        self.assertEqual(res["defect_type"], "pothole")
        # Surface area + 15% engineered squaring
        self.assertAlmostEqual(res["surface_area_sqm"], 1.15, places=2)
        self.assertAlmostEqual(res["depth_cm"], 5.0, places=1)

        # Volume = 1.15 * 0.05 = 0.0575 m³
        self.assertAlmostEqual(res["estimated_volume_cum"], 0.0575, places=3)

        # Materials check
        materials = res["materials_breakdown"]
        # Asphalt weight = 0.0575 * 2400 = 138 kg
        self.assertAlmostEqual(materials["asphalt_mix_kg"], 138.0, places=1)
        self.assertEqual(materials["needs_base_course_reinstatement"], False)
        self.assertEqual(materials["mix_grade"], "VG-30_BITUMINOUS_CONCRETE")

        # Costs check
        costs = res["financial_breakdown_inr"]
        self.assertGreater(costs["total_estimated_cost"], 3000.0)
        self.assertGreater(costs["labor_cost"], 1000.0)
        self.assertGreater(costs["equipment_and_mobilization_cost"], 1500.0)

        # Carbon check
        carbon = res["environmental_impact"]
        self.assertGreater(carbon["embodied_carbon_kg_co2e"], 5.0)

    def test_deep_severe_crater_with_subbase(self):
        # Deep 10 cm pothole requiring subbase granular reinstatement
        res = self.engine.calculate_pothole_bom(
            surface_area_sqm=3.0,
            depth_cm=10.0,
            traffic_tier="HEAVY_CORRIDOR",
            emergency_patch=False
        )

        materials = res["materials_breakdown"]
        self.assertTrue(materials["needs_base_course_reinstatement"])
        self.assertGreater(materials["granular_subbase_kg"], 100.0)
        self.assertGreater(materials["asphalt_mix_kg"], 200.0)

        # High traffic corridor multiplier is 1.40
        costs = res["financial_breakdown_inr"]
        self.assertEqual(costs["traffic_factor_multiplier"], 1.40)
        self.assertGreater(costs["total_estimated_cost"], 8000.0)

    def test_emergency_cold_patch_pricing(self):
        # Emergency all-weather cold patch
        res_emergency = self.engine.calculate_pothole_bom(
            surface_area_sqm=0.8,
            depth_cm=4.0,
            emergency_patch=True
        )
        self.assertEqual(res_emergency["materials_breakdown"]["mix_grade"], "COLD_PATCH_POLYMER")

        res_standard = self.engine.calculate_pothole_bom(
            surface_area_sqm=0.8,
            depth_cm=4.0,
            emergency_patch=False
        )

        # Cold patch material costs more per tonne than hot-mix asphalt
        self.assertGreater(
            res_emergency["financial_breakdown_inr"]["materials_cost"],
            res_standard["financial_breakdown_inr"]["materials_cost"]
        )

    def test_drainage_and_streetlight_utility_repairs(self):
        # Drainage clog estimate
        drain_res = self.engine.estimate_utility_or_drainage_repair(
            defect_type="waterlogging",
            severity_score=0.75,
            linear_meters=8.0
        )
        self.assertEqual(drain_res["defect_type"], "waterlogging")
        self.assertGreater(drain_res["financial_breakdown_inr"]["total_estimated_cost"], 3000.0)

        # Streetlight failure estimate
        light_res = self.engine.estimate_utility_or_drainage_repair(
            defect_type="streetlight_out",
            severity_score=0.6,
            linear_meters=1.0
        )
        self.assertEqual(light_res["defect_type"], "streetlight_out")
        self.assertGreater(light_res["financial_breakdown_inr"]["total_estimated_cost"], 4000.0)


if __name__ == "__main__":
    unittest.main()
