"""
REST Router for Cluster Community Discussion Threads & Resident Comments.
Provides endpoints for:
- Retrieving sanitized comments per cluster
- Posting new comments with automated PII masking
- Upvoting helpful community comments
- Peer-moderation flagging with auto-hide logic
- Admin moderation overrides
"""

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from services.cluster_comment_service import ClusterCommentService

router = APIRouter(prefix="/api/v1/comments", tags=["Cluster Comments & Community Threads"])


class PostCommentRequest(BaseModel):
    body: str = Field(..., min_length=2, max_length=1500, description="Comment text")
    author_name: Optional[str] = Field("Resident", max_length=128, description="Display author name")
    user_id: Optional[str] = Field(None, description="Citizen user ID")
    is_anonymous: Optional[bool] = Field(False, description="Whether to anonymize author publicly")
    cluster_category: Optional[str] = Field(None, description="Category of the cluster")


class FlagCommentRequest(BaseModel):
    reason: Optional[str] = Field("inappropriate", description="Reason for flagging")


class ModerateStatusRequest(BaseModel):
    status: str = Field(..., description="Target status: ACTIVE, FLAGGED, HIDDEN, REMOVED")


@router.get("/{cluster_id}", response_model=List[Dict[str, Any]])
async def get_cluster_comments(
    cluster_id: str,
    include_hidden: bool = Query(False, description="Include hidden comments (moderators only)")
):
    """
    Returns resident discussion comments for a verified defect cluster.
    """
    return ClusterCommentService.get_comments(cluster_id, include_hidden=include_hidden)


@router.post("/{cluster_id}", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def post_cluster_comment(cluster_id: str, req: PostCommentRequest):
    """
    Posts a resident comment to a defect cluster, sanitizing PII and enforcing anonymity.
    """
    try:
        comment = ClusterCommentService.post_comment(
            cluster_id=cluster_id,
            body=req.body,
            author_name=req.author_name or "Resident",
            user_id=req.user_id,
            is_anonymous=bool(req.is_anonymous),
            cluster_category=req.cluster_category,
        )
        return comment
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{cluster_id}/{comment_id}/upvote", response_model=Dict[str, Any])
async def upvote_cluster_comment(cluster_id: str, comment_id: str):
    """
    Upvotes a helpful resident comment.
    """
    try:
        return ClusterCommentService.upvote_comment(cluster_id, comment_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{cluster_id}/{comment_id}/flag", response_model=Dict[str, Any])
async def flag_cluster_comment(cluster_id: str, comment_id: str, req: FlagCommentRequest = FlagCommentRequest()):
    """
    Flags an inappropriate or spam comment. Auto-hides when threshold is reached.
    """
    try:
        return ClusterCommentService.flag_comment(cluster_id, comment_id, reason=req.reason or "inappropriate")
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{cluster_id}/{comment_id}/status", response_model=Dict[str, Any])
async def moderate_comment_status(cluster_id: str, comment_id: str, req: ModerateStatusRequest):
    """
    Admin moderation endpoint to update comment status.
    """
    try:
        return ClusterCommentService.moderate_status(cluster_id, comment_id, req.status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
