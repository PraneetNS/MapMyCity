"""
Automated Municipal Dispatch and SLA Escalation Domain Engine.
Routes urban defect clusters to municipal departments, calculates priority SLAs,
and triggers auto-escalation when response thresholds are breached.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import uuid

# Department definitions and keyword mappings
DEPARTMENT_REGISTRY: Dict[str, Dict[str, Any]] = {
    "dept_roads": {
        "id": "dept_roads",
        "name": "Roads & Infrastructure Engineering",
        "short_code": "ROADS",
        "categories": ["pothole", "road_crack", "surface_damage", "manhole_cover", "subsidence"],
        "default_sla_hours": 48,
        "emergency_sla_hours": 12,
        "escalation_email": "dispatch.roads@bbmp.gov.in"
    },
    "dept_drainage": {
        "id": "dept_drainage",
        "name": "Stormwater & Urban Drainage",
        "short_code": "DRAIN",
        "categories": ["waterlogging", "drainage_clog", "flooding", "gutter_overflow"],
        "default_sla_hours": 24,
        "emergency_sla_hours": 6,
        "escalation_email": "dispatch.drainage@bbmp.gov.in"
    },
    "dept_electrical": {
        "id": "dept_electrical",
        "name": "Street Lighting & Public Power",
        "short_code": "ELEC",
        "categories": ["streetlight_out", "wire_snapped", "transformer_spark", "dark_corridor"],
        "default_sla_hours": 36,
        "emergency_sla_hours": 12,
        "escalation_email": "dispatch.lighting@bbmp.gov.in"
    },
    "dept_sanitation": {
        "id": "dept_sanitation",
        "name": "Solid Waste & Public Sanitation",
        "short_code": "SWM",
        "categories": ["garbage_dump", "debris_pile", "hazardous_waste", "overflowing_bin"],
        "default_sla_hours": 24,
        "emergency_sla_hours": 8,
        "escalation_email": "dispatch.sanitation@bbmp.gov.in"
    }
}

# Ward contractor directory for automated routing
WARD_CONTRACTORS: Dict[str, str] = {
    "ward_bbmp_150": "Apex Urban Roadworks Ltd.",
    "ward_bbmp_174": "Metro Infra Maintenance JV",
    "ward_bbmp_085": "Kaveri Civic Works Enterprise",
    "ward_bbmp_default": "Municipal Rapid Response Division"
}


class DispatchEscalationService:
    def __init__(self, db_pool=None):
        self.db_pool = db_pool
        # In-memory store for fallback / testing
        self._work_orders: Dict[str, Dict[str, Any]] = {}
        self._events: List[Dict[str, Any]] = []

    def route_department(self, category: str) -> Dict[str, Any]:
        """Maps an issue category to the responsible municipal department."""
        clean_cat = category.lower().strip()
        for dept in DEPARTMENT_REGISTRY.values():
            if clean_cat in dept["categories"] or any(k in clean_cat for k in dept["categories"]):
                return dept
        return DEPARTMENT_REGISTRY["dept_roads"]

    def determine_priority(
        self,
        severity_score: float,
        confirmations_count: int = 0,
        weather_alert: bool = False
    ) -> str:
        """Determines dispatch priority tier based on severity, crowd confirmation, and hazard conditions."""
        if weather_alert and severity_score >= 0.7:
            return "EMERGENCY"
        if severity_score >= 0.85 or confirmations_count >= 10:
            return "CRITICAL"
        if severity_score >= 0.6 or confirmations_count >= 5:
            return "HIGH"
        if severity_score >= 0.35:
            return "MEDIUM"
        return "LOW"

    def calculate_sla_deadline(self, department: Dict[str, Any], priority: str) -> datetime:
        """Calculates SLA deadline timestamp based on department turnaround norms."""
        now = datetime.now(timezone.utc)
        if priority in ("CRITICAL", "EMERGENCY"):
            hours = department["emergency_sla_hours"]
        elif priority == "HIGH":
            hours = max(int(department["default_sla_hours"] * 0.5), 12)
        elif priority == "LOW":
            hours = department["default_sla_hours"] * 2
        else:
            hours = department["default_sla_hours"]

        return now + timedelta(hours=hours)

    def create_work_order(
        self,
        cluster_id: str,
        category: str,
        ward_id: str,
        severity_score: float = 0.5,
        confirmations_count: int = 0,
        weather_alert: bool = False,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates and dispatches a work order for a confirmed defect cluster."""
        dept = self.route_department(category)
        priority = self.determine_priority(severity_score, confirmations_count, weather_alert)
        deadline = self.calculate_sla_deadline(dept, priority)
        contractor = WARD_CONTRACTORS.get(ward_id, WARD_CONTRACTORS["ward_bbmp_default"])

        wo_id = str(uuid.uuid4())
        order_num = f"WO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{wo_id[:6].upper()}"

        work_order = {
            "id": wo_id,
            "order_number": order_num,
            "cluster_id": cluster_id,
            "category": category,
            "ward_id": ward_id,
            "department_id": dept["id"],
            "department_name": dept["name"],
            "contractor_name": contractor,
            "priority": priority,
            "status": "DISPATCHED",
            "sla_deadline": deadline.isoformat(),
            "escalation_level": 0,
            "notes": notes or f"Auto-dispatched for {category} cluster",
            "materials_cost": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        self._work_orders[wo_id] = work_order
        self._log_event(wo_id, "DISPATCHED", None, "DISPATCHED", {"contractor": contractor, "priority": priority})
        return work_order

    def evaluate_sla_status(self, work_order: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates SLA compliance, time remaining, and warning states."""
        deadline = datetime.fromisoformat(work_order["sla_deadline"])
        now = datetime.now(timezone.utc)
        created = datetime.fromisoformat(work_order["created_at"])

        total_duration = (deadline - created).total_seconds()
        remaining = (deadline - now).total_seconds()

        if remaining <= 0:
            sla_state = "BREACHED"
        elif total_duration > 0 and (remaining / total_duration) <= 0.25:
            sla_state = "WARNING"
        else:
            sla_state = "ON_TRACK"

        return {
            "order_number": work_order["order_number"],
            "sla_state": sla_state,
            "hours_remaining": round(remaining / 3600.0, 1),
            "is_breached": remaining <= 0,
            "escalation_level": work_order.get("escalation_level", 0)
        }

    def trigger_escalation(self, work_order_id: str, reason: str = "SLA Breach") -> Dict[str, Any]:
        """Escalates an overdue or high-friction work order to the next municipal authority tier."""
        wo = self._work_orders.get(work_order_id)
        if not wo:
            raise KeyError(f"Work order {work_order_id} not found")

        prev_level = wo["escalation_level"]
        wo["escalation_level"] = prev_level + 1
        wo["status"] = "ESCALATED"
        wo["updated_at"] = datetime.now(timezone.utc).isoformat()

        self._log_event(work_order_id, "ESCALATED", wo["status"], "ESCALATED", {
            "reason": reason,
            "escalated_from_level": prev_level,
            "new_level": wo["escalation_level"]
        })

        return {
            "id": work_order_id,
            "order_number": wo["order_number"],
            "new_status": "ESCALATED",
            "escalation_level": wo["escalation_level"],
            "escalated_to": f"Zonal Chief Engineer (Tier {wo['escalation_level']})"
        }

    def update_work_order_status(
        self,
        work_order_id: str,
        new_status: str,
        actor_id: str = "FIELD_OPERATOR",
        proof_url: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Updates work order lifecycle (IN_PROGRESS, RESOLVED, REJECTED) with audit trail."""
        valid_statuses = {"PENDING", "DISPATCHED", "IN_PROGRESS", "RESOLVED", "ESCALATED", "REJECTED"}
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status {new_status}. Must be one of {valid_statuses}")

        wo = self._work_orders.get(work_order_id)
        if not wo:
            raise KeyError(f"Work order {work_order_id} not found")

        prev_status = wo["status"]
        wo["status"] = new_status
        wo["updated_at"] = datetime.now(timezone.utc).isoformat()
        if proof_url:
            wo["resolution_proof_url"] = proof_url
        if notes:
            wo["notes"] = f"{wo.get('notes', '')}\nUpdate: {notes}".strip()

        self._log_event(work_order_id, f"STATUS_{new_status}", prev_status, new_status, {
            "actor": actor_id,
            "proof_url": proof_url
        })

        return wo

    def list_work_orders(
        self,
        ward_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Lists work orders with optional ward and status filters."""
        results = list(self._work_orders.values())
        if ward_id:
            results = [w for w in results if w["ward_id"] == ward_id]
        if status:
            results = [w for w in results if w["status"] == status]
        return results

    def _log_event(
        self,
        work_order_id: str,
        event_type: str,
        prev_status: Optional[str],
        new_status: str,
        payload: Dict[str, Any]
    ) -> None:
        self._events.append({
            "id": str(uuid.uuid4()),
            "work_order_id": work_order_id,
            "event_type": event_type,
            "previous_status": prev_status,
            "new_status": new_status,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
