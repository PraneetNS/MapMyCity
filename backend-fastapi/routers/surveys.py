"""
Civic Satisfaction Surveys & Citizen Sentiment Router.
Captures citizen resolution feedback, rating metrics (1-5 stars),
workmanship scores, and provides ward-level satisfaction aggregation.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
import datetime

from database import get_db

router = APIRouter(
    prefix="/api/v1/surveys",
    tags=["Civic Surveys"]
)

class CivicSurveyCreateRequest(BaseModel):
    user_id: Optional[str] = Field(default=None, description="Optional anonymous or authenticated citizen ID")
    cluster_id: Optional[str] = Field(default=None, description="ID of resolved cluster if feedback pertains to a fix")
    ward_id: str = Field(..., min_length=1, max_length=50, description="Ward or administrative area ID")
    category: str = Field(..., description="Civic category e.g. pothole, streetlight, sanitation, drainage")
    rating: int = Field(..., ge=1, le=5, description="Overall satisfaction rating from 1 to 5")
    aspects: List[str] = Field(default=[], description="Aspect tags: ['rapid_resolution', 'high_quality_patch', 'clean_site']")
    feedback_text: Optional[str] = Field(default=None, max_length=1000, description="Detailed comment")
    resolution_speed_rating: Optional[int] = Field(default=None, ge=1, le=5)
    workmanship_rating: Optional[int] = Field(default=None, ge=1, le=5)

# In-memory mock survey store for when DB is in mock mode or fallback
MOCK_SURVEYS = [
    {
        "id": "srv-001",
        "user_id": "usr-1",
        "cluster_id": None,
        "ward_id": "Ward 4",
        "category": "pothole",
        "rating": 5,
        "aspects": ["rapid_resolution", "high_quality_patch"],
        "feedback_text": "Pothole filled within 24 hours of report! Very impressed.",
        "resolution_speed_rating": 5,
        "workmanship_rating": 5,
        "sentiment_score": 0.85,
        "created_at": "2026-08-20T10:00:00Z"
    },
    {
        "id": "srv-002",
        "user_id": "usr-2",
        "cluster_id": None,
        "ward_id": "Ward 4",
        "category": "streetlight",
        "rating": 4,
        "aspects": ["rapid_resolution"],
        "feedback_text": "Streetlight working again. Good communication.",
        "resolution_speed_rating": 4,
        "workmanship_rating": 4,
        "sentiment_score": 0.60,
        "created_at": "2026-08-21T14:30:00Z"
    },
    {
        "id": "srv-003",
        "user_id": "usr-3",
        "cluster_id": None,
        "ward_id": "Ward 7",
        "category": "drainage",
        "rating": 3,
        "aspects": ["partial_fix"],
        "feedback_text": "Drain cleared but debris left on pavement.",
        "resolution_speed_rating": 3,
        "workmanship_rating": 2,
        "sentiment_score": 0.05,
        "created_at": "2026-08-22T09:15:00Z"
    }
]

def calculate_simple_sentiment(text: Optional[str], rating: int) -> float:
    """Calculates normalized sentiment score from -1.0 to 1.0."""
    base_sentiment = (rating - 3) / 2.0  # 1 -> -1.0, 3 -> 0.0, 5 -> 1.0
    if not text:
        return round(base_sentiment, 2)
    positive_words = ["great", "fast", "clean", "impressed", "good", "quick", "thanks", "excellent"]
    negative_words = ["slow", "dirty", "debris", "poor", "broken", "unresolved", "terrible", "bad"]
    lower = text.lower()
    pos_count = sum(1 for w in positive_words if w in lower)
    neg_count = sum(1 for w in negative_words if w in lower)
    adjusted = base_sentiment + (pos_count * 0.1) - (neg_count * 0.1)
    return round(max(-1.0, min(1.0, adjusted)), 2)

@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def submit_civic_survey(req: CivicSurveyCreateRequest, db=Depends(get_db)):
    """
    Submits citizen feedback and satisfaction score for a ward or resolved cluster.
    """
    survey_id = str(uuid.uuid4())
    sentiment = calculate_simple_sentiment(req.feedback_text, req.rating)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        query = """
            INSERT INTO civic_surveys (
                id, user_id, cluster_id, ward_id, category, rating, aspects,
                feedback_text, resolution_speed_rating, workmanship_rating, sentiment_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, ward_id, category, rating, sentiment_score, created_at;
        """
        cluster_uuid = uuid.UUID(req.cluster_id) if req.cluster_id else None
        row = await db.fetchrow(
            query,
            uuid.UUID(survey_id), req.user_id, cluster_uuid, req.ward_id, req.category,
            req.rating, req.aspects, req.feedback_text, req.resolution_speed_rating,
            req.workmanship_rating, sentiment
        )
        return {
            "status": "recorded",
            "survey_id": str(row["id"]),
            "ward_id": row["ward_id"],
            "rating": row["rating"],
            "sentiment_score": row["sentiment_score"],
            "created_at": row["created_at"].isoformat() if row.get("created_at") else created_at
        }
    except Exception:
        # Fallback to in-memory store
        record = {
            "id": survey_id,
            "user_id": req.user_id,
            "cluster_id": req.cluster_id,
            "ward_id": req.ward_id,
            "category": req.category,
            "rating": req.rating,
            "aspects": req.aspects,
            "feedback_text": req.feedback_text,
            "resolution_speed_rating": req.resolution_speed_rating,
            "workmanship_rating": req.workmanship_rating,
            "sentiment_score": sentiment,
            "created_at": created_at
        }
        MOCK_SURVEYS.append(record)
        return {
            "status": "recorded_mock",
            "survey_id": survey_id,
            "ward_id": req.ward_id,
            "rating": req.rating,
            "sentiment_score": sentiment,
            "created_at": created_at
        }

@router.get("/ward/{ward_id}", response_model=Dict[str, Any])
async def get_ward_satisfaction_metrics(ward_id: str, db=Depends(get_db)):
    """
    Returns aggregated satisfaction metrics, sentiment index, and aspect breakdown for a specific ward.
    """
    ward_surveys = [s for s in MOCK_SURVEYS if s["ward_id"].lower() == ward_id.lower()]

    try:
        rows = await db.fetch("""
            SELECT rating, resolution_speed_rating, workmanship_rating, sentiment_score, aspects, category
            FROM civic_surveys
            WHERE LOWER(ward_id) = LOWER($1)
        """, ward_id)
        if rows:
            ward_surveys = [dict(r) for r in rows]
    except Exception:
        pass

    if not ward_surveys:
        return {
            "ward_id": ward_id,
            "total_surveys": 0,
            "average_rating": 0.0,
            "average_speed_rating": 0.0,
            "average_workmanship_rating": 0.0,
            "average_sentiment": 0.0,
            "aspect_breakdown": {},
            "category_ratings": {}
        }

    total = len(ward_surveys)
    avg_rating = sum(s["rating"] for s in ward_surveys) / total
    speed_ratings = [s["resolution_speed_rating"] for s in ward_surveys if s.get("resolution_speed_rating")]
    work_ratings = [s["workmanship_rating"] for s in ward_surveys if s.get("workmanship_rating")]
    avg_speed = sum(speed_ratings) / len(speed_ratings) if speed_ratings else avg_rating
    avg_work = sum(work_ratings) / len(work_ratings) if work_ratings else avg_rating
    avg_sentiment = sum(s.get("sentiment_score", 0.0) for s in ward_surveys) / total

    # Aspect tag frequencies
    aspect_counts: Dict[str, int] = {}
    for s in ward_surveys:
        for tag in (s.get("aspects") or []):
            aspect_counts[tag] = aspect_counts.get(tag, 0) + 1

    return {
        "ward_id": ward_id,
        "total_surveys": total,
        "average_rating": round(avg_rating, 2),
        "average_speed_rating": round(avg_speed, 2),
        "average_workmanship_rating": round(avg_work, 2),
        "average_sentiment": round(avg_sentiment, 2),
        "aspect_breakdown": aspect_counts,
        "sample_responses": [
            {
                "id": s.get("id"),
                "rating": s.get("rating"),
                "category": s.get("category"),
                "feedback": s.get("feedback_text")
            }
            for s in ward_surveys[-5:]
        ]
    }

@router.get("/summary", response_model=Dict[str, Any])
async def get_citywide_survey_summary(db=Depends(get_db)):
    """
    Returns city-wide satisfaction summary and top/bottom ranked wards.
    """
    surveys = list(MOCK_SURVEYS)
    try:
        rows = await db.fetch("SELECT * FROM civic_surveys ORDER BY created_at DESC LIMIT 100")
        if rows:
            surveys = [dict(r) for r in rows]
    except Exception:
        pass

    if not surveys:
        return {
            "total_surveys": 0,
            "overall_satisfaction": 0.0,
            "ward_rankings": [],
            "top_categories": {}
        }

    total = len(surveys)
    overall_rating = sum(s["rating"] for s in surveys) / total

    # Group by ward
    ward_map: Dict[str, List[int]] = {}
    for s in surveys:
        w = s["ward_id"]
        ward_map.setdefault(w, []).append(s["rating"])

    ward_rankings = [
        {
            "ward_id": w,
            "average_rating": round(sum(ratings) / len(ratings), 2),
            "response_count": len(ratings)
        }
        for w, ratings in ward_map.items()
    ]
    ward_rankings.sort(key=lambda x: x["average_rating"], reverse=True)

    return {
        "total_surveys": total,
        "overall_satisfaction": round(overall_rating, 2),
        "ward_rankings": ward_rankings,
        "latest_feedback_count": min(10, total)
    }
