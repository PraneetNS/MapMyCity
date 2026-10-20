"""
Unit tests for PedestrianSafetyEngine and corridor vulnerability index.
"""

import unittest
from services.pedestrian_safety_engine import PedestrianSafetyEngine


class TestPedestrianSafetyEngine(unittest.TestCase):
    def setUp(self):
        self.engine = PedestrianSafetyEngine()

    def test_safe_pedestrian_plaza(self):
        # High quality corridor: 95% sidewalk, 90% lighting, 80% tactile, 0 hazards
        res = self.engine.evaluate_corridor_hazard(
            corridor_name="MG Road Promenade",
            sidewalk_continuity_pct=95.0,
            illumination_pct=90.0,
            tactile_paving_pct=80.0,
            pothole_trip_hazards_count=0,
            open_drain_hazard_count=0,
            wheelchair_curb_ramps_present=True,
            pedestrian_flow_density="HIGH"
        )

        self.assertEqual(res["corridor_name"], "MG Road Promenade")
        self.assertLess(res["pedestrian_hazard_index"], 25.0)
        self.assertEqual(res["risk_tier"], "LOW_RISK")
        self.assertIn("Corridor meets pedestrian safety standards", res["recommended_interventions"][0])

    def test_hazardous_corridor_severe_vulnerability(self):
        # Dilapidated corridor: no sidewalk, dark, open drains, potholes
        res = self.engine.evaluate_corridor_hazard(
            corridor_name="Old Industrial Radial Road",
            sidewalk_continuity_pct=10.0,
            illumination_pct=20.0,
            tactile_paving_pct=0.0,
            pothole_trip_hazards_count=5,
            open_drain_hazard_count=2,
            wheelchair_curb_ramps_present=False,
            pedestrian_flow_density="CRITICAL_TRANSIT_HUB"
        )

        self.assertEqual(res["risk_tier"], "SEVERE_VULNERABILITY")
        self.assertGreaterEqual(res["pedestrian_hazard_index"], 75.0)

        # Check recommended interventions
        interventions_text = " ".join(res["recommended_interventions"])
        self.assertIn("tactile directional and warning paving", interventions_text)
        self.assertIn("ductile iron safety grating", interventions_text)
        self.assertIn("1:12 gradient dropped curb ramps", interventions_text)

    def test_wheelchair_ramp_penalty(self):
        res_with_ramps = self.engine.evaluate_corridor_hazard(
            corridor_name="Residency Road",
            sidewalk_continuity_pct=70.0,
            illumination_pct=70.0,
            tactile_paving_pct=50.0,
            pothole_trip_hazards_count=1,
            open_drain_hazard_count=0,
            wheelchair_curb_ramps_present=True
        )

        res_without_ramps = self.engine.evaluate_corridor_hazard(
            corridor_name="Residency Road",
            sidewalk_continuity_pct=70.0,
            illumination_pct=70.0,
            tactile_paving_pct=50.0,
            pothole_trip_hazards_count=1,
            open_drain_hazard_count=0,
            wheelchair_curb_ramps_present=False
        )

        self.assertGreater(
            res_without_ramps["pedestrian_hazard_index"],
            res_with_ramps["pedestrian_hazard_index"]
        )


if __name__ == "__main__":
    unittest.main()
