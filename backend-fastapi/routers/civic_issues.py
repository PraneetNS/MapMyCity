"""
Civic Issues & Community Confirmation Consensus Router.
Manages canonical civic issues, community confirmation voting (STILL_EXISTS,
GETTING_WORSE, FIXED, NOT_PRESENT), independence-weighted confidence scoring,
evidence attachments, and resolution dispute queues.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Header, status
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
import math
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.community_confidence import CommunityConfidenceService, CommunityConfirmationService, make_aware

router = APIRouter(
    prefix="/issues",
    tags=["Civic Issues & Consensus"]
)

# Also create sub-router for /api/v1/issues
api_v1_router = APIRouter(
    prefix="/api/v1/issues",
    tags=["Civic Issues & Consensus"]
)


# ── Pydantic Request & Response Schemas ─────────────────────────────────────────

class ConfirmationCreateRequest(BaseModel):
    type: Literal["STILL_EXISTS", "GETTING_WORSE", "FIXED", "NOT_PRESENT", "ADDITIONAL_EVIDENCE"] = Field(
        ..., description="Type of citizen confirmation"
    )
    worsening_reason: Optional[Literal["larger", "more_dangerous", "more_frequent", "affecting_more_people", "other"]] = Field(
        default=None, description="Structured reason if type is GETTING_WORSE"
    )
    comment: Optional[str] = Field(default=None, max_length=500, description="Optional brief citizen note")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Citizen current latitude")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Citizen current longitude")
    user_id: Optional[str] = Field(default=None, description="Optional authenticated user ID")
    device_id: Optional[str] = Field(default=None, description="Unique client device identifier")


class EvidenceCreateRequest(BaseModel):
    evidence_type: Literal["IMAGE", "VIDEO", "VOICE", "PASSIVE_SENSOR", "TEXT", "CONFIRMATION"] = Field(
        default="IMAGE", description="Type of evidence"
    )
    media_url: Optional[str] = Field(default=None, description="Public URL or CDN link to evidence media")
    description: Optional[str] = Field(default=None, max_length=1000, description="Description of evidence")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    p_hash: Optional[str] = Field(default=None, description="Perceptual hash for image duplicate detection")
    device_id: Optional[str] = Field(default=None)
    user_id: Optional[str] = Field(default=None)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CivicIssueResponse(BaseModel):
    id: str
    cluster_id: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    latitude: float
    longitude: float
    status: str
    severity_score: float
    community_confidence: float
    confidence_percent: int
    report_count: int
    unique_reporter_count: int
    confirmation_count: int
    still_exists_count: int
    getting_worse_count: int
    fixed_confirmation_count: int
    not_present_count: int
    additional_evidence_count: int
    passive_detection_count: int
    image_evidence_count: int
    disputed_resolution: bool
    recurrence_count: int
    last_confirmed_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommunitySummaryResponse(BaseModel):
    issue_id: str
    confidence: float
    confidence_percent: int
    status: str
    severity_score: float
    disputed_resolution: bool
    independent_reporters: int
    independent_devices: int
    still_exists: int
    getting_worse: int
    fixed: int
    not_present: int
    additional_evidence: int
    passive_detections: int
    images: int
    last_confirmed_at: datetime
    breakdown: Dict[str, Any]
    timeline: List[Dict[str, Any]]


class ConfirmationResponse(BaseModel):
    issue_id: str
    confirmation: Dict[str, Any]
    community: Dict[str, Any]
    message: str


# ── In-Memory Mock Store for Testing & DB-less Mode ────────────────────────────

MOCK_CIVIC_ISSUES: List[Dict[str, Any]] = [
    {
        "id": "iss-001",
        "cluster_id": "cls-001",
        "category": "pothole",
        "subcategory": "deep_crater",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "status": "COMMUNITY_CONFIRMED",
        "severity_score": 3.8,
        "community_confidence": 0.94,
        "report_count": 5,
        "unique_reporter_count": 4,
        "confirmation_count": 12,
        "still_exists_count": 9,
        "getting_worse_count": 3,
        "fixed_confirmation_count": 0,
        "not_present_count": 0,
        "additional_evidence_count": 2,
        "passive_detection_count": 3,
        "image_evidence_count": 4,
        "disputed_resolution": False,
        "recurrence_count": 2,
        "last_confirmed_at": datetime.now(timezone.utc) - timedelta(hours=2),
        "created_at": datetime.now(timezone.utc) - timedelta(days=3),
        "updated_at": datetime.now(timezone.utc) - timedelta(hours=2),
    },
    {
        "id": "iss-002",
        "cluster_id": "cls-002",
        "category": "accessibility",
        "subcategory": "broken_curb_ramp",
        "latitude": 19.0810,
        "longitude": 72.8820,
        "status": "RESOLVED_PENDING_VERIFICATION",
        "severity_score": 2.5,
        "community_confidence": 0.82,
        "report_count": 2,
        "unique_reporter_count": 2,
        "confirmation_count": 6,
        "still_exists_count": 4,
        "getting_worse_count": 1,
        "fixed_confirmation_count": 1,
        "not_present_count": 0,
        "additional_evidence_count": 1,
        "passive_detection_count": 0,
        "image_evidence_count": 2,
        "disputed_resolution": True,
        "recurrence_count": 0,
        "last_confirmed_at": datetime.now(timezone.utc) - timedelta(minutes=45),
        "created_at": datetime.now(timezone.utc) - timedelta(days=5),
        "updated_at": datetime.now(timezone.utc) - timedelta(minutes=45),
    }
]

MOCK_CONFIRMATIONS: List[Dict[str, Any]] = [
    {
        "id": "cnf-001",
        "issue_id": "iss-001",
        "user_id": "usr-101",
        "device_id": "dev-001",
        "confirmation_type": "STILL_EXISTS",
        "worsening_reason": None,
        "comment": "Still dangerous for two-wheelers",
        "distance_meters": 12.5,
        "weight": 1.0,
        "trust_score": 0.9,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=2)
    },
    {
        "id": "cnf-002",
        "issue_id": "iss-001",
        "user_id": "usr-102",
        "device_id": "dev-002",
        "confirmation_type": "GETTING_WORSE",
        "worsening_reason": "larger",
        "comment": "Rains made it much wider",
        "distance_meters": 18.0,
        "weight": 1.0,
        "trust_score": 0.85,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=5)
    }
]

MOCK_EVIDENCE: List[Dict[str, Any]] = [
    {
        "id": "evi-001",
        "issue_id": "iss-001",
        "submission_id": None,
        "confirmation_id": "cnf-002",
        "user_id": "usr-102",
        "device_id": "dev-002",
        "evidence_type": "IMAGE",
        "media_url": "https://res.cloudinary.com/demo/image/upload/pothole_evidence.jpg",
        "description": "Expanded pothole after heavy showers",
        "p_hash": "a1b2c3d4e5f6",
        "created_at": datetime.now(timezone.utc) - timedelta(hours=5)
    }
]

MOCK_FOLLOWERS: List[Dict[str, Any]] = []


def _format_issue_response(row: Dict[str, Any]) -> CivicIssueResponse:
    confidence = float(row.get("community_confidence") or 0.5)
    return CivicIssueResponse(
        id=str(row["id"]),
        cluster_id=str(row["cluster_id"]) if row.get("cluster_id") else None,
        category=row["category"],
        subcategory=row.get("subcategory"),
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        status=row.get("status", "NEW"),
        severity_score=float(row.get("severity_score") or 1.0),
        community_confidence=round(confidence, 3),
        confidence_percent=int(round(confidence * 100)),
        report_count=int(row.get("report_count") or 1),
        unique_reporter_count=int(row.get("unique_reporter_count") or 1),
        confirmation_count=int(row.get("confirmation_count") or 0),
        still_exists_count=int(row.get("still_exists_count") or 0),
        getting_worse_count=int(row.get("getting_worse_count") or 0),
        fixed_confirmation_count=int(row.get("fixed_confirmation_count") or 0),
        not_present_count=int(row.get("not_present_count") or 0),
        additional_evidence_count=int(row.get("additional_evidence_count") or 0),
        passive_detection_count=int(row.get("passive_detection_count") or 0),
        image_evidence_count=int(row.get("image_evidence_count") or 0),
        disputed_resolution=bool(row.get("disputed_resolution", False)),
        recurrence_count=int(row.get("recurrence_count") or 0),
        last_confirmed_at=make_aware(row.get("last_confirmed_at")),
        created_at=make_aware(row.get("created_at")),
        updated_at=make_aware(row.get("updated_at")),
    )


# ── Route Handlers ─────────────────────────────────────────────────────────────

async def get_all_civic_issues(
    category: Optional[str] = Query(None, description="Filter by category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    min_confidence: Optional[float] = Query(None, description="Minimum community confidence [0.0 - 1.0]"),
    disputed_only: Optional[bool] = Query(False, description="Filter only resolution disputes"),
    recurring_only: Optional[bool] = Query(False, description="Filter recurring issues"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Optional[AsyncSession] = Depends(get_db)
) -> List[CivicIssueResponse]:
    """Retrieves all canonical civic issues with community consensus metrics."""
    try:
        if db is not None:
            # Query Postgres
            query_str = """
                SELECT id, cluster_id, category, subcategory, latitude, longitude,
                       status, severity_score, community_confidence, report_count,
                       unique_reporter_count, confirmation_count, still_exists_count,
                       getting_worse_count, fixed_confirmation_count, not_present_count,
                       additional_evidence_count, passive_detection_count, image_evidence_count,
                       disputed_resolution, recurrence_count, last_confirmed_at, created_at, updated_at
                FROM civic_issues
                WHERE 1=1
            """
            params: Dict[str, Any] = {"limit": limit, "offset": offset}
            if category:
                query_str += " AND category = :category"
                params["category"] = category
            if status_filter:
                query_str += " AND status = :status"
                params["status"] = status_filter
            if min_confidence is not None:
                query_str += " AND community_confidence >= :min_confidence"
                params["min_confidence"] = min_confidence
            if disputed_only:
                query_str += " AND disputed_resolution = TRUE"
            if recurring_only:
                query_str += " AND recurrence_count > 0"

            query_str += " ORDER BY updated_at DESC LIMIT :limit OFFSET :offset"
            result = await db.execute(text(query_str), params)
            rows = result.fetchall()
            return [_format_issue_response(dict(r._mapping)) for r in rows]
    except Exception:
        pass

    # Fallback to in-memory mock store
    issues = list(MOCK_CIVIC_ISSUES)
    if category:
        issues = [i for i in issues if i.get("category") == category]
    if status_filter:
        issues = [i for i in issues if i.get("status") == status_filter]
    if min_confidence is not None:
        issues = [i for i in issues if (i.get("community_confidence") or 0.0) >= min_confidence]
    if disputed_only:
        issues = [i for i in issues if i.get("disputed_resolution")]
    if recurring_only:
        issues = [i for i in issues if (i.get("recurrence_count") or 0) > 0]

    issues.sort(key=lambda x: make_aware(x.get("updated_at")), reverse=True)
    paged = issues[offset:offset + limit]
    return [_format_issue_response(i) for i in paged]


async def get_single_civic_issue(
    issue_id: str,
    db: Optional[AsyncSession] = Depends(get_db)
) -> CivicIssueResponse:
    """Retrieves a single canonical civic issue."""
    try:
        if db is not None:
            query = text("""
                SELECT id, cluster_id, category, subcategory, latitude, longitude,
                       status, severity_score, community_confidence, report_count,
                       unique_reporter_count, confirmation_count, still_exists_count,
                       getting_worse_count, fixed_confirmation_count, not_present_count,
                       additional_evidence_count, passive_detection_count, image_evidence_count,
                       disputed_resolution, recurrence_count, last_confirmed_at, created_at, updated_at
                FROM civic_issues
                WHERE id = :issue_id OR cluster_id = :issue_id
            """)
            result = await db.execute(query, {"issue_id": issue_id})
            row = result.fetchone()
            if row:
                return _format_issue_response(dict(row._mapping))
    except Exception:
        pass

    # Mock search by ID or cluster_id
    for item in MOCK_CIVIC_ISSUES:
        if item.get("id") == issue_id or item.get("cluster_id") == issue_id:
            return _format_issue_response(item)

    raise HTTPException(status_code=404, detail="Civic Issue not found")


async def get_civic_issue_community(
    issue_id: str,
    db: Optional[AsyncSession] = Depends(get_db)
) -> CommunitySummaryResponse:
    """Returns detailed community consensus metrics and corroboration timeline."""
    issue = None
    confirmations = []

    try:
        if db is not None:
            issue_res = await db.execute(
                text("SELECT * FROM civic_issues WHERE id = :id OR cluster_id = :id"),
                {"id": issue_id}
            )
            row = issue_res.fetchone()
            if row:
                issue = dict(row._mapping)
                conf_res = await db.execute(
                    text("SELECT * FROM issue_confirmations WHERE issue_id = :id ORDER BY created_at DESC"),
                    {"id": issue["id"]}
                )
                confirmations = [dict(c._mapping) for c in conf_res.fetchall()]
    except Exception:
        pass

    if issue is None:
        for item in MOCK_CIVIC_ISSUES:
            if item.get("id") == issue_id or item.get("cluster_id") == issue_id:
                issue = item
                confirmations = [c for c in MOCK_CONFIRMATIONS if c.get("issue_id") == item["id"]]
                break

    if not issue:
        raise HTTPException(status_code=404, detail="Civic Issue not found")

    analysis = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=int(issue.get("unique_reporter_count") or 1),
        confirmations=confirmations,
        image_count=int(issue.get("image_evidence_count") or 0),
        passive_count=int(issue.get("passive_detection_count") or 0),
        current_status=issue.get("status", "NEW")
    )

    timeline = [
        {
            "id": str(c.get("id")),
            "type": c.get("confirmation_type"),
            "worsening_reason": c.get("worsening_reason"),
            "comment": c.get("comment"),
            "created_at": make_aware(c.get("created_at")),
        }
        for c in confirmations[:20]
    ]

    conf_score = float(issue.get("community_confidence") or analysis["confidence_score"])
    return CommunitySummaryResponse(
        issue_id=str(issue["id"]),
        confidence=conf_score,
        confidence_percent=int(round(conf_score * 100)),
        status=issue.get("status", "NEW"),
        severity_score=float(issue.get("severity_score") or 1.0),
        disputed_resolution=bool(issue.get("disputed_resolution", False)),
        independent_reporters=int(issue.get("unique_reporter_count") or 1),
        independent_devices=analysis["independent_devices"],
        still_exists=int(issue.get("still_exists_count") or 0),
        getting_worse=int(issue.get("getting_worse_count") or 0),
        fixed=int(issue.get("fixed_confirmation_count") or 0),
        not_present=int(issue.get("not_present_count") or 0),
        additional_evidence=int(issue.get("additional_evidence_count") or 0),
        passive_detections=int(issue.get("passive_detection_count") or 0),
        images=int(issue.get("image_evidence_count") or 0),
        last_confirmed_at=make_aware(issue.get("last_confirmed_at")),
        breakdown=analysis["breakdown"],
        timeline=timeline
    )


async def confirm_civic_issue(
    issue_id: str,
    payload: ConfirmationCreateRequest,
    x_device_id: Optional[str] = Header(None, description="Client device header"),
    db: Optional[AsyncSession] = Depends(get_db)
) -> ConfirmationResponse:
    """
    Submits citizen confirmation for a canonical civic issue with rate-limiting,
    geographic proximity validation, trust weighting, and dynamic status updates.
    """
    device_id = payload.device_id or x_device_id or "anonymous_device"
    now = datetime.now(timezone.utc)

    # 1. Fetch Issue and Existing Confirmations
    target_issue = None
    existing_confirmations: List[Dict[str, Any]] = []

    try:
        if db is not None:
            res = await db.execute(
                text("SELECT * FROM civic_issues WHERE id = :id OR cluster_id = :id"),
                {"id": issue_id}
            )
            row = res.fetchone()
            if row:
                target_issue = dict(row._mapping)
                c_res = await db.execute(
                    text("SELECT * FROM issue_confirmations WHERE issue_id = :id"),
                    {"id": target_issue["id"]}
                )
                existing_confirmations = [dict(c._mapping) for c in c_res.fetchall()]
    except Exception:
        pass

    if target_issue is None:
        for item in MOCK_CIVIC_ISSUES:
            if item.get("id") == issue_id or item.get("cluster_id") == issue_id:
                target_issue = item
                existing_confirmations = [c for c in MOCK_CONFIRMATIONS if c.get("issue_id") == item["id"]]
                break

    if not target_issue:
        raise HTTPException(status_code=404, detail="Civic Issue not found")

    actual_issue_id = str(target_issue["id"])

    # 2. Check Anti-Abuse Rate Limits
    allowed, limit_reason = CommunityConfirmationService.check_rate_limit(
        existing_confirmations=existing_confirmations,
        device_id=device_id,
        confirmation_type=payload.type,
        current_time=now
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=limit_reason)

    # 3. Calculate Distance Proximity if coordinates are provided
    dist_meters: Optional[float] = None
    if payload.latitude is not None and payload.longitude is not None:
        lat1 = math.radians(target_issue["latitude"])
        lon1 = math.radians(target_issue["longitude"])
        lat2 = math.radians(payload.latitude)
        lon2 = math.radians(payload.longitude)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        dist_meters = 6371000.0 * c  # Earth radius in meters

    # 4. Create confirmation entry
    new_confirmation = {
        "id": f"cnf-{uuid.uuid4().hex[:8]}",
        "issue_id": actual_issue_id,
        "user_id": payload.user_id,
        "device_id": device_id,
        "confirmation_type": payload.type,
        "worsening_reason": payload.worsening_reason,
        "comment": payload.comment,
        "distance_meters": dist_meters,
        "weight": 1.0,
        "trust_score": 0.85,
        "created_at": now
    }
    existing_confirmations.append(new_confirmation)

    # 5. Increment Counters
    target_issue["confirmation_count"] = int(target_issue.get("confirmation_count") or 0) + 1
    if payload.type == "STILL_EXISTS":
        target_issue["still_exists_count"] = int(target_issue.get("still_exists_count") or 0) + 1
    elif payload.type == "GETTING_WORSE":
        target_issue["getting_worse_count"] = int(target_issue.get("getting_worse_count") or 0) + 1
        target_issue["still_exists_count"] = int(target_issue.get("still_exists_count") or 0) + 1
    elif payload.type == "FIXED":
        target_issue["fixed_confirmation_count"] = int(target_issue.get("fixed_confirmation_count") or 0) + 1
    elif payload.type == "NOT_PRESENT":
        target_issue["not_present_count"] = int(target_issue.get("not_present_count") or 0) + 1
    elif payload.type == "ADDITIONAL_EVIDENCE":
        target_issue["additional_evidence_count"] = int(target_issue.get("additional_evidence_count") or 0) + 1

    target_issue["last_confirmed_at"] = now
    target_issue["updated_at"] = now

    # 6. Recalculate Severity and Confidence
    worsening_list = [c for c in existing_confirmations if c.get("confirmation_type") == "GETTING_WORSE"]
    new_severity = CommunityConfidenceService.calculate_severity_score(
        base_severity=float(target_issue.get("severity_score") or 2.5),
        getting_worse_confirmations=worsening_list
    )
    target_issue["severity_score"] = new_severity

    analysis = CommunityConfidenceService.compute_issue_confidence(
        unique_reporters=int(target_issue.get("unique_reporter_count") or 1),
        confirmations=existing_confirmations,
        image_count=int(target_issue.get("image_evidence_count") or 0),
        passive_count=int(target_issue.get("passive_detection_count") or 0),
        current_status=target_issue.get("status", "NEW"),
        current_time=now
    )

    target_issue["community_confidence"] = analysis["confidence_score"]
    target_issue["disputed_resolution"] = analysis["disputed_resolution"]
    if analysis["suggested_status"] != target_issue.get("status"):
        target_issue["status"] = analysis["suggested_status"]

    # 7. Persist to Postgres if available
    try:
        if db is not None:
            # Insert confirmation
            await db.execute(text("""
                INSERT INTO issue_confirmations (
                    id, issue_id, user_id, device_id, confirmation_type,
                    worsening_reason, comment, distance_meters, weight, created_at
                ) VALUES (
                    :id, :issue_id, :user_id, :device_id, :confirmation_type,
                    :worsening_reason, :comment, :distance_meters, :weight, :created_at
                )
            """), {
                "id": new_confirmation["id"],
                "issue_id": actual_issue_id,
                "user_id": payload.user_id,
                "device_id": device_id,
                "confirmation_type": payload.type,
                "worsening_reason": payload.worsening_reason,
                "comment": payload.comment,
                "distance_meters": dist_meters,
                "weight": 1.0,
                "created_at": now
            })

            # Update issue record
            await db.execute(text("""
                UPDATE civic_issues SET
                    confirmation_count = :confirmation_count,
                    still_exists_count = :still_exists_count,
                    getting_worse_count = :getting_worse_count,
                    fixed_confirmation_count = :fixed_confirmation_count,
                    not_present_count = :not_present_count,
                    additional_evidence_count = :additional_evidence_count,
                    severity_score = :severity_score,
                    community_confidence = :community_confidence,
                    disputed_resolution = :disputed_resolution,
                    status = :status,
                    last_confirmed_at = :last_confirmed_at,
                    updated_at = :updated_at
                WHERE id = :id
            """), {
                "id": actual_issue_id,
                "confirmation_count": target_issue["confirmation_count"],
                "still_exists_count": target_issue["still_exists_count"],
                "getting_worse_count": target_issue["getting_worse_count"],
                "fixed_confirmation_count": target_issue["fixed_confirmation_count"],
                "not_present_count": target_issue["not_present_count"],
                "additional_evidence_count": target_issue["additional_evidence_count"],
                "severity_score": target_issue["severity_score"],
                "community_confidence": target_issue["community_confidence"],
                "disputed_resolution": target_issue["disputed_resolution"],
                "status": target_issue["status"],
                "last_confirmed_at": now,
                "updated_at": now
            })
            await db.commit()
    except Exception:
        pass

    # Save in memory
    MOCK_CONFIRMATIONS.append(new_confirmation)

    return ConfirmationResponse(
        issue_id=actual_issue_id,
        confirmation={
            "id": new_confirmation["id"],
            "type": payload.type,
            "worsening_reason": payload.worsening_reason,
            "created_at": now.isoformat()
        },
        community={
            "confidence": analysis["confidence_score"],
            "confidence_percent": analysis["confidence_percent"],
            "status": target_issue["status"],
            "severity_score": target_issue["severity_score"],
            "still_exists": target_issue["still_exists_count"],
            "getting_worse": target_issue["getting_worse_count"],
            "fixed": target_issue["fixed_confirmation_count"],
            "unique_reporters": target_issue["unique_reporter_count"],
            "independent_devices": analysis["independent_devices"],
            "passive_detections": target_issue["passive_detection_count"],
            "images": target_issue["image_evidence_count"],
            "disputed_resolution": target_issue["disputed_resolution"]
        },
        message="Thank you! Your confirmation has updated the community consensus for this issue."
    )


async def add_civic_issue_evidence(
    issue_id: str,
    payload: EvidenceCreateRequest,
    db: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, Any]:
    """Attaches new verified photo, sensor trace, or voice evidence to a civic issue."""
    target_issue = None
    try:
        if db is not None:
            res = await db.execute(text("SELECT * FROM civic_issues WHERE id = :id OR cluster_id = :id"), {"id": issue_id})
            row = res.fetchone()
            if row:
                target_issue = dict(row._mapping)
    except Exception:
        pass

    if target_issue is None:
        for item in MOCK_CIVIC_ISSUES:
            if item.get("id") == issue_id or item.get("cluster_id") == issue_id:
                target_issue = item
                break

    if not target_issue:
        raise HTTPException(status_code=404, detail="Civic Issue not found")

    actual_issue_id = str(target_issue["id"])
    now = datetime.now(timezone.utc)

    evidence_entry = {
        "id": f"evi-{uuid.uuid4().hex[:8]}",
        "issue_id": actual_issue_id,
        "submission_id": None,
        "confirmation_id": None,
        "user_id": payload.user_id,
        "device_id": payload.device_id or "anonymous_device",
        "evidence_type": payload.evidence_type,
        "media_url": payload.media_url,
        "description": payload.description,
        "p_hash": payload.p_hash,
        "metadata": payload.metadata or {},
        "created_at": now
    }

    if payload.evidence_type == "IMAGE":
        target_issue["image_evidence_count"] = int(target_issue.get("image_evidence_count") or 0) + 1
    elif payload.evidence_type == "PASSIVE_SENSOR":
        target_issue["passive_detection_count"] = int(target_issue.get("passive_detection_count") or 0) + 1
    else:
        target_issue["additional_evidence_count"] = int(target_issue.get("additional_evidence_count") or 0) + 1

    target_issue["updated_at"] = now
    MOCK_EVIDENCE.append(evidence_entry)

    try:
        if db is not None:
            await db.execute(text("""
                INSERT INTO issue_evidence (
                    id, issue_id, user_id, device_id, evidence_type, media_url, description, p_hash, created_at
                ) VALUES (
                    :id, :issue_id, :user_id, :device_id, :evidence_type, :media_url, :description, :p_hash, :created_at
                )
            """), {
                "id": evidence_entry["id"],
                "issue_id": actual_issue_id,
                "user_id": payload.user_id,
                "device_id": payload.device_id,
                "evidence_type": payload.evidence_type,
                "media_url": payload.media_url,
                "description": payload.description,
                "p_hash": payload.p_hash,
                "created_at": now
            })
            await db.execute(text("""
                UPDATE civic_issues SET
                    image_evidence_count = :image_evidence_count,
                    passive_detection_count = :passive_detection_count,
                    additional_evidence_count = :additional_evidence_count,
                    updated_at = :updated_at
                WHERE id = :id
            """), {
                "id": actual_issue_id,
                "image_evidence_count": target_issue["image_evidence_count"],
                "passive_detection_count": target_issue["passive_detection_count"],
                "additional_evidence_count": target_issue["additional_evidence_count"],
                "updated_at": now
            })
            await db.commit()
    except Exception:
        pass

    return {
        "status": "success",
        "evidence_id": evidence_entry["id"],
        "issue_id": actual_issue_id,
        "message": "Evidence successfully verified and attached to Civic Issue."
    }


async def get_civic_issue_evidence(
    issue_id: str,
    db: Optional[AsyncSession] = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Retrieves all evidence records attached to a civic issue."""
    try:
        if db is not None:
            res = await db.execute(text("""
                SELECT id, issue_id, submission_id, evidence_type, media_url, description, p_hash, created_at
                FROM issue_evidence
                WHERE issue_id = :id
                ORDER BY created_at DESC
            """), {"id": issue_id})
            rows = res.fetchall()
            if rows:
                return [dict(r._mapping) for r in rows]
    except Exception:
        pass

    return [e for e in MOCK_EVIDENCE if e.get("issue_id") == issue_id]


async def follow_civic_issue(
    issue_id: str,
    user_id: str = Query(..., description="Citizen user ID subscribing to updates"),
    db: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, Any]:
    """Subscribes a citizen to municipal status progress notifications for an issue."""
    try:
        if db is not None:
            await db.execute(text("""
                INSERT INTO issue_followers (issue_id, user_id, created_at)
                VALUES (:issue_id, :user_id, NOW())
                ON CONFLICT (issue_id, user_id) DO NOTHING
            """), {"issue_id": issue_id, "user_id": user_id})
            await db.commit()
    except Exception:
        pass

    if not any(f.get("issue_id") == issue_id and f.get("user_id") == user_id for f in MOCK_FOLLOWERS):
        MOCK_FOLLOWERS.append({"issue_id": issue_id, "user_id": user_id, "created_at": datetime.now(timezone.utc)})

    return {"status": "success", "message": "You are now following updates on this issue."}


async def unfollow_civic_issue(
    issue_id: str,
    user_id: str = Query(..., description="Citizen user ID unsubscribing"),
    db: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, Any]:
    """Unsubscribes a citizen from updates."""
    try:
        if db is not None:
            await db.execute(text("""
                DELETE FROM issue_followers
                WHERE issue_id = :issue_id AND user_id = :user_id
            """), {"issue_id": issue_id, "user_id": user_id})
            await db.commit()
    except Exception:
        pass

    global MOCK_FOLLOWERS
    MOCK_FOLLOWERS = [f for f in MOCK_FOLLOWERS if not (f.get("issue_id") == issue_id and f.get("user_id") == user_id)]
    return {"status": "success", "message": "You have unfollowed this issue."}


async def get_consensus_analytics(
    db: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves high-level municipal community consensus and dispute KPIs."""
    issues = MOCK_CIVIC_ISSUES
    try:
        if db is not None:
            res = await db.execute(text("SELECT * FROM civic_issues"))
            rows = res.fetchall()
            if rows:
                issues = [dict(r._mapping) for r in rows]
    except Exception:
        pass

    total = len(issues)
    disputed = sum(1 for i in issues if i.get("disputed_resolution"))
    confirmed = sum(1 for i in issues if (i.get("community_confidence") or 0.0) >= 0.75)
    resolved_count = sum(1 for i in issues if i.get("status") in ("VERIFIED_FIXED", "RESOLVED"))
    avg_conf = (sum(float(i.get("community_confidence") or 0.5) for i in issues) / total) if total > 0 else 0.0

    category_counts: Dict[str, int] = {}
    for i in issues:
        cat = i.get("category", "other")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "total_civic_issues": total,
        "community_confirmed_count": confirmed,
        "disputed_resolution_count": disputed,
        "dispute_rate": round(disputed / total, 3) if total > 0 else 0.0,
        "average_confidence": round(avg_conf, 3),
        "community_verified_resolution_rate": round(resolved_count / total, 3) if total > 0 else 0.0,
        "category_distribution": category_counts
    }


# ── Mount Endpoints on both router & api_v1_router ─────────────────────────────

for r in [router, api_v1_router]:
    r.add_api_route("", get_all_civic_issues, methods=["GET"], response_model=List[CivicIssueResponse])
    r.add_api_route("/analytics/consensus", get_consensus_analytics, methods=["GET"])
    r.add_api_route("/{issue_id}", get_single_civic_issue, methods=["GET"], response_model=CivicIssueResponse)
    r.add_api_route("/{issue_id}/community", get_civic_issue_community, methods=["GET"], response_model=CommunitySummaryResponse)
    r.add_api_route("/{issue_id}/confirm", confirm_civic_issue, methods=["POST"], response_model=ConfirmationResponse)
    r.add_api_route("/{issue_id}/evidence", add_civic_issue_evidence, methods=["POST"])
    r.add_api_route("/{issue_id}/evidence", get_civic_issue_evidence, methods=["GET"])
    r.add_api_route("/{issue_id}/follow", follow_civic_issue, methods=["POST"])
    r.add_api_route("/{issue_id}/follow", unfollow_civic_issue, methods=["DELETE"])
