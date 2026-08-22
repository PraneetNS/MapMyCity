"""
Campaign Banners API — Part 3 (Future Backlog)
NGO Audit Tasks API — Part 5 (Future Backlog)

PRECONDITION GATES:
  Part 3 (campaigns):  Activate after 12 months of real data. Seeded campaign
                       rows have active_from=NULL as hard off-switch.
  Part 5 (audit_tasks): Activate after first NGO partner signs MoU.
                        TASK_BOARD_ENABLED env flag defaults to false.
"""

import os
from typing import Optional, List
from pydantic import BaseModel

TASK_BOARD_ENABLED = os.getenv("TASK_BOARD_ENABLED", "false").lower() == "true"

TASK_BOARD_PRECONDITION = (
    "The NGO task board is not yet enabled. "
    "See FUTURE_BACKLOG.md Part 5: an active NGO/CSR partner MoU referencing "
    "the accessibility audit data export must exist before TASK_BOARD_ENABLED=true."
)


# ── Campaign models ────────────────────────────────────────────────────────────

class CampaignOut(BaseModel):
    id: str
    title: str
    body: str
    cta_deep_link: Optional[str]
    category_filter: Optional[str]
    is_dismissible: bool


# ── Task board models ──────────────────────────────────────────────────────────

class AuditTaskOut(BaseModel):
    id: str
    partner_org_id: str
    partner_name: str
    location_hint: str
    latitude: Optional[float]
    longitude: Optional[float]
    task_type: str
    status: str
    notes: Optional[str]
    created_at: str


class ClaimTaskRequest(BaseModel):
    user_id: str


class CompleteTaskRequest(BaseModel):
    user_id: str
    resulting_submission_id: Optional[str] = None


# ── Campaign handlers ──────────────────────────────────────────────────────────

async def get_active_campaigns(category: Optional[str] = None, ward_id: Optional[str] = None, db=None):
    """
    GET /campaigns/active
    Returns campaigns currently in their active window.
    Returns empty list (not 503) if no campaigns are live — the app always calls
    this; an empty result is the normal state until precondition is met.
    """
    from sqlalchemy import text
    filters = [
        "active_from IS NOT NULL",
        "active_from <= NOW()",
        "active_until >= NOW()",
    ]
    params: dict = {}

    if category:
        filters.append("(category_filter IS NULL OR category_filter = :cat)")
        params["cat"] = category

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT id, title, body, cta_deep_link, category_filter, is_dismissible
            FROM campaigns
            WHERE {where}
            ORDER BY active_from DESC
        """),
        params,
    )
    campaigns = [
        CampaignOut(
            id=str(r[0]),
            title=r[1],
            body=r[2],
            cta_deep_link=r[3],
            category_filter=r[4],
            is_dismissible=r[5] if r[5] is not None else True,
        )
        for r in rows.fetchall()
    ]
    return {"campaigns": campaigns, "count": len(campaigns)}


async def list_campaigns_admin(db=None):
    """GET /admin/campaigns — full list for admin management."""
    from sqlalchemy import text
    rows = await db.execute(
        text("""
            SELECT id, title, body, active_from, active_until,
                   category_filter, cta_deep_link, is_dismissible,
                   target_ward_ids, created_by_admin, created_at
            FROM campaigns ORDER BY created_at DESC
        """)
    )
    return {
        "campaigns": [
            {
                "id": str(r[0]), "title": r[1], "body": r[2],
                "active_from": str(r[3]) if r[3] else None,
                "active_until": str(r[4]) if r[4] else None,
                "category_filter": r[5], "cta_deep_link": r[6],
                "is_dismissible": r[7], "target_ward_ids": r[8],
                "created_by_admin": r[9], "created_at": str(r[10]),
            }
            for r in rows.fetchall()
        ]
    }


class CreateCampaignRequest(BaseModel):
    title: str
    body: str
    active_from: Optional[str] = None   # ISO datetime or null = off
    active_until: Optional[str] = None
    category_filter: Optional[str] = None
    cta_deep_link: Optional[str] = None
    target_ward_ids: Optional[List[str]] = None
    admin_key: str


async def create_campaign(data: CreateCampaignRequest, db=None):
    """POST /admin/campaigns — create or schedule a campaign."""
    from sqlalchemy import text
    row = await db.execute(
        text("""
            INSERT INTO campaigns
                (title, body, active_from, active_until, category_filter,
                 cta_deep_link, target_ward_ids, created_by_admin)
            VALUES (:title, :body, :af, :au, :cat, :cta, :wids, :admin)
            RETURNING id, created_at
        """),
        {
            "title": data.title, "body": data.body,
            "af": data.active_from, "au": data.active_until,
            "cat": data.category_filter, "cta": data.cta_deep_link,
            "wids": data.target_ward_ids, "admin": data.admin_key,
        },
    )
    await db.commit()
    r = row.fetchone()
    return {"id": str(r[0]), "created_at": str(r[1])}


# ── Audit Task handlers ────────────────────────────────────────────────────────

async def list_open_tasks(
    task_type: Optional[str] = None,
    partner_org_id: Optional[str] = None,
    db=None,
):
    """GET /audit-tasks — open tasks visible on the volunteer task board."""
    if not TASK_BOARD_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=TASK_BOARD_PRECONDITION)

    from sqlalchemy import text
    filters = ["at.status = 'open'", "po.is_active = TRUE"]
    params: dict = {}
    if task_type:
        filters.append("at.task_type = :task_type")
        params["task_type"] = task_type
    if partner_org_id:
        filters.append("at.partner_org_id = :pid")
        params["pid"] = partner_org_id

    where = " AND ".join(filters)
    rows = await db.execute(
        text(f"""
            SELECT at.id, at.partner_org_id, po.name, at.location_hint,
                   at.latitude, at.longitude, at.task_type,
                   at.status, at.notes, at.created_at
            FROM audit_tasks at
            JOIN partner_organisations po ON po.id = at.partner_org_id
            WHERE {where}
            ORDER BY at.created_at DESC
        """),
        params,
    )
    tasks = [
        AuditTaskOut(
            id=str(r[0]), partner_org_id=str(r[1]), partner_name=r[2],
            location_hint=r[3], latitude=r[4], longitude=r[5],
            task_type=r[6], status=r[7], notes=r[8], created_at=str(r[9]),
        )
        for r in rows.fetchall()
    ]
    return {"tasks": tasks, "count": len(tasks)}


async def claim_task(task_id: str, data: ClaimTaskRequest, db=None):
    """POST /audit-tasks/{task_id}/claim — volunteer claims an open task."""
    if not TASK_BOARD_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=TASK_BOARD_PRECONDITION)

    from sqlalchemy import text
    row = await db.execute(
        text("""
            UPDATE audit_tasks
            SET status = 'claimed', claimed_by_user_id = :uid, claimed_at = NOW()
            WHERE id = :tid AND status = 'open'
            RETURNING id, status
        """),
        {"tid": task_id, "uid": data.user_id},
    )
    await db.commit()
    r = row.fetchone()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="Task is no longer open or does not exist.")
    return {"task_id": str(r[0]), "status": r[1], "claimed_by": data.user_id}


async def complete_task(task_id: str, data: CompleteTaskRequest, db=None):
    """
    POST /audit-tasks/{task_id}/complete
    Mark task complete, link resulting submission, award badge.
    Completed tasks feed directly into the accessibility_audits data flow.
    """
    if not TASK_BOARD_ENABLED:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=TASK_BOARD_PRECONDITION)

    from sqlalchemy import text
    # 1. Mark task complete
    row = await db.execute(
        text("""
            UPDATE audit_tasks
            SET status = 'completed',
                completed_at = NOW(),
                resulting_submission_id = :sid,
                badge_awarded = TRUE
            WHERE id = :tid AND claimed_by_user_id = :uid AND status = 'claimed'
            RETURNING id
        """),
        {"tid": task_id, "uid": data.user_id, "sid": data.resulting_submission_id},
    )
    await db.commit()
    r = row.fetchone()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="Task cannot be completed — not claimed by this user or already done.")

    # 2. Award NGO task completer badge (idempotent via UNIQUE constraint)
    try:
        await db.execute(
            text("""
                INSERT INTO user_badges (user_id, badge_type, source_task_id)
                VALUES (:uid, 'ngo_task_completer', :tid)
                ON CONFLICT (user_id, badge_type) DO NOTHING
            """),
            {"uid": data.user_id, "tid": task_id},
        )
        await db.commit()
    except Exception:
        pass  # Badge already awarded — not an error

    return {
        "task_id": str(r[0]),
        "status": "completed",
        "badge_awarded": True,
        "badge_type": "ngo_task_completer",
        "message": "Task completed. Submission linked to accessibility audit data flow.",
    }
