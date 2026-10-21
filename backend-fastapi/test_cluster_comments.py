"""
Unit tests for ClusterCommentService:
Tests PII redaction, anonymity rules, peer-flagging auto-hide, and upvoting lifecycle.
"""

import pytest
from services.cluster_comment_service import ClusterCommentService

@pytest.fixture(autouse=True)
def clean_registry():
    ClusterCommentService.clear_cache()
    yield
    ClusterCommentService.clear_cache()

def test_post_valid_comment():
    cluster_id = "cluster-blr-101"
    comment = ClusterCommentService.post_comment(
        cluster_id=cluster_id,
        body="Waterlogging receded after the drain clearance this afternoon.",
        author_name="Ramesh Kumar",
        user_id="user-123",
        is_anonymous=False
    )
    assert comment["id"] is not None
    assert comment["cluster_id"] == cluster_id
    assert comment["author_name"] == "Ramesh Kumar"
    assert comment["user_id"] == "user-123"
    assert comment["status"] == "ACTIVE"
    assert comment["upvotes"] == 0
    assert comment["is_flagged"] is False

    comments = ClusterCommentService.get_comments(cluster_id)
    assert len(comments) == 1
    assert comments[0]["id"] == comment["id"]

def test_pii_redaction_in_comment():
    cluster_id = "cluster-blr-102"
    raw_body = "Call contractor at 9876543210 or email civic@ward12.org for updates."
    comment = ClusterCommentService.post_comment(
        cluster_id=cluster_id,
        body=raw_body,
        author_name="Citizen"
    )
    assert "[PHONE REDACTED]" in comment["body"]
    assert "[EMAIL REDACTED]" in comment["body"]
    assert "9876543210" not in comment["body"]
    assert comment["pii_redacted"] is True

def test_anonymity_enforcement_and_safety_concern():
    cluster_id = "cluster-blr-safety-1"
    # Case 1: user explicitly opts for anonymity
    c1 = ClusterCommentService.post_comment(
        cluster_id=cluster_id,
        body="The dark alley has no streetlights working.",
        author_name="Pooja Sharma",
        user_id="user-pooja",
        is_anonymous=True
    )
    assert c1["author_name"] == "Anonymous Resident"
    assert c1["user_id"] is None
    assert c1["is_anonymous"] is True

    # Case 2: cluster is safety_concern -> forced anonymous
    c2 = ClusterCommentService.post_comment(
        cluster_id=cluster_id,
        body="Suspicious wiring exposed on low pole.",
        author_name="Anil Kumar",
        user_id="user-anil",
        is_anonymous=False,
        cluster_category="safety_concern"
    )
    assert c2["author_name"] == "Anonymous Resident"
    assert c2["user_id"] is None
    assert c2["is_anonymous"] is True

def test_empty_or_abusive_comment_rejection():
    with pytest.raises(ValueError, match="cannot be empty"):
        ClusterCommentService.post_comment("c-1", "   ")

    with pytest.raises(ValueError, match="prohibited or abusive"):
        ClusterCommentService.post_comment("c-1", "hate abuse idiot kill attack attack fake scam stupid")

def test_upvote_and_flag_auto_hide_lifecycle():
    cluster_id = "cluster-blr-flags"
    comment = ClusterCommentService.post_comment(
        cluster_id=cluster_id,
        body="Road barricades placed incorrectly blocking traffic.",
        author_name="Driver"
    )
    comment_id = comment["id"]

    # Upvoting
    upvoted = ClusterCommentService.upvote_comment(cluster_id, comment_id)
    assert upvoted["upvotes"] == 1
    upvoted_again = ClusterCommentService.upvote_comment(cluster_id, comment_id)
    assert upvoted_again["upvotes"] == 2

    # Flagging 1 & 2: still ACTIVE
    f1 = ClusterCommentService.flag_comment(cluster_id, comment_id)
    assert f1["flag_count"] == 1
    assert f1["status"] == "ACTIVE"

    f2 = ClusterCommentService.flag_comment(cluster_id, comment_id)
    assert f2["flag_count"] == 2
    assert f2["status"] == "ACTIVE"

    # Flagging 3: Auto-hides comment
    f3 = ClusterCommentService.flag_comment(cluster_id, comment_id)
    assert f3["flag_count"] == 3
    assert f3["status"] == "HIDDEN"

    # Should no longer appear in standard active list
    active_comments = ClusterCommentService.get_comments(cluster_id, include_hidden=False)
    assert len(active_comments) == 0

    # Retrievable with include_hidden=True
    all_comments = ClusterCommentService.get_comments(cluster_id, include_hidden=True)
    assert len(all_comments) == 1
    assert all_comments[0]["status"] == "HIDDEN"

    # Admin unhides/moderates
    restored = ClusterCommentService.moderate_status(cluster_id, comment_id, "ACTIVE")
    assert restored["status"] == "ACTIVE"
