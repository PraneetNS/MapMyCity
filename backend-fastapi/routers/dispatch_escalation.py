"""
FastAPI Router for Municipal Work Orders, Autonomous Dispatch, and SLA Escalation.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from services.dispatch_escalation import DispatchEscalationService, DEPARTMENT_REGISTRY

router = APIRouter(prefix="/api/v1/dispatch", tags=["Municipal Dispatch & Work Orders"])
dispatch_service = DispatchEscalationService()


class CreateWorkOrderRequest(BaseModel):
    cluster_id: str = Field(..., description="UUID of the confirmed defect cluster")
    category: str = Field(..., example="pothole", description="Defect category")
    ward_id: str = Field(..., example="ward_bbmp_150", description="Municipal Ward identifier")
    severity_score: float = Field(0.5, ge=0.0, le=1.0)
    confirmations_count: int = Field(0, ge=0)
    weather_alert: bool = False
    notes: Optional[str] = None


class UpdateWorkOrderStatusRequest(BaseModel):
    status: str = Field(..., example="IN_PROGRESS")
    actor_id: str = Field("OPERATOR_APP", description="Operator / Contractor user ID")
    resolution_proof_url: Optional[str] = None
    notes: Optional[str] = None


class EscalateOrderRequest(BaseModel):
    reason: str = Field("SLA Breach threshold reached", description="Reason for escalation")


@router.get("/departments", summary="List municipal departments and SLA baselines")
async def list_departments():
    return {
        "departments": list(DEPARTMENT_REGISTRY.values())
    }


@router.post("/orders", summary="Create or auto-dispatch a work order")
async def create_work_order(req: CreateWorkOrderRequest):
    order = dispatch_service.create_work_order(
        cluster_id=req.cluster_id,
        category=req.category,
        ward_id=req.ward_id,
        severity_score=req.severity_score,
        confirmations_count=req.confirmations_count,
        weather_alert=req.weather_alert,
        notes=req.notes
    )
    return {"status": "success", "work_order": order}


@router.get("/orders", summary="List work orders with optional filters")
async def list_work_orders(
    ward_id: Optional[str] = Query(None, description="Filter by Ward ID"),
    status: Optional[str] = Query(None, description="Filter by Status (PENDING, DISPATCHED, IN_PROGRESS, RESOLVED, ESCALATED)")
):
    orders = dispatch_service.list_work_orders(ward_id=ward_id, status=status)
    return {
        "count": len(orders),
        "work_orders": orders
    }


@router.get("/orders/{order_id}", summary="Get work order details and SLA status")
async def get_work_order(order_id: str):
    orders = dispatch_service.list_work_orders()
    matching = [o for o in orders if o["id"] == order_id or o["order_number"] == order_id]
    if not matching:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    order = matching[0]
    sla_info = dispatch_service.evaluate_sla_status(order)
    return {
        "work_order": order,
        "sla_status": sla_info
    }


@router.patch("/orders/{order_id}/status", summary="Update work order status and attach resolution proof")
async def update_order_status(order_id: str, req: UpdateWorkOrderStatusRequest):
    try:
        updated = dispatch_service.update_work_order_status(
            work_order_id=order_id,
            new_status=req.status,
            actor_id=req.actor_id,
            proof_url=req.resolution_proof_url,
            notes=req.notes
        )
        return {"status": "success", "work_order": updated}
    except KeyError:
        raise HTTPException(status_code=404, detail="Work order not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/escalate", summary="Escalate work order to higher municipal authority")
async def escalate_order(order_id: str, req: EscalateOrderRequest):
    try:
        result = dispatch_service.trigger_escalation(work_order_id=order_id, reason=req.reason)
        return {"status": "success", "escalation": result}
    except KeyError:
        raise HTTPException(status_code=404, detail="Work order not found")


@router.get("/sla-summary", summary="Aggregated ward-level SLA compliance metrics")
async def get_sla_summary():
    orders = dispatch_service.list_work_orders()
    total = len(orders)
    breached = 0
    on_track = 0
    warning = 0

    for o in orders:
        status_info = dispatch_service.evaluate_sla_status(o)
        state = status_info["sla_state"]
        if state == "BREACHED":
            breached += 1
        elif state == "WARNING":
            warning += 1
        else:
            on_track += 1

    compliance_rate = round(((total - breached) / total * 100.0), 1) if total > 0 else 100.0

    return {
        "total_active_orders": total,
        "on_track": on_track,
        "warning": warning,
        "breached": breached,
        "sla_compliance_rate_pct": compliance_rate
    }
