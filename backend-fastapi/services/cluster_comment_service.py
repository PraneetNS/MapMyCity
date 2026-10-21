"""
ClusterCommentService — Hyper-local resident discussion thread manager for defect clusters.
Enforces:
1. Automated PII masking (phones, emails, citizen identifiers) via moderation pipeline.
2. Anonymity enforcement (anonymizes author when requested or under safety-critical contexts).
3. Peer-moderation lifecycle (auto-hides comments reaching 3+ community flags).
4. Upvoting and engagement verification.
"""

from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, timezone
import re
from moderation import check_text_content

# In-memory comment storage cache for demo/fast access, mirroring DB table
_COMMENT_REGISTRY: Dict[str, List[Dict[str, Any]]] = {}

FLAG_HIDE_THRESHOLD = 3

class ClusterCommentService:
    @staticmethod
    def post_comment(
        cluster_id: str,
        body: str,
        author_name: str = "Resident",
        user_id: Optional[str] = None,
        is_anonymous: bool = False,
        cluster_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Processes and stores a resident comment with automated PII redaction and content safety.
        """
        if not body or not body.strip():
            raise ValueError("Comment body cannot be empty.")

        # 1. Text moderation & PII redaction
        mod_result = check_text_content(body)
        if not mod_result["is_safe"]:
            raise ValueError("Comment contains excessive prohibited or abusive language.")

        sanitized_text = mod_result["sanitized_text"]

        # 2. Strict Anonymity & Safety enforcement
        effective_author = author_name
        effective_user_id = user_id
        if is_anonymous or cluster_category == "safety_concern":
            effective_author = "Anonymous Resident"
            effective_user_id = None
            is_anonymous = True

        comment_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        record = {
            "id": comment_id,
            "cluster_id": cluster_id,
            "user_id": effective_user_id,
            "author_name": effective_author,
            "body": sanitized_text,
            "is_anonymous": is_anonymous,
            "is_flagged": False,
            "flag_count": 0,
            "upvotes": 0,
            "status": "ACTIVE",
            "pii_redacted": mod_result.get("pii_redacted", False),
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        if cluster_id not in _COMMENT_REGISTRY:
            _COMMENT_REGISTRY[cluster_id] = []

        _COMMENT_REGISTRY[cluster_id].insert(0, record)
        return record

    @staticmethod
    def get_comments(
        cluster_id: str,
        include_hidden: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Retrieves active comments for a given cluster.
        """
        comments = _COMMENT_REGISTRY.get(cluster_id, [])
        if not include_hidden:
            return [c for c in comments if c["status"] == "ACTIVE"]
        return comments

    @staticmethod
    def flag_comment(cluster_id: str, comment_id: str, reason: str = "inappropriate") -> Dict[str, Any]:
        """
        Increments community flag count; automatically hides comment once threshold is reached.
        """
        comments = _COMMENT_REGISTRY.get(cluster_id, [])
        for c in comments:
            if c["id"] == comment_id:
                c["flag_count"] += 1
                c["is_flagged"] = True
                if c["flag_count"] >= FLAG_HIDE_THRESHOLD:
                    c["status"] = "HIDDEN"
                c["updated_at"] = datetime.now(timezone.utc).isoformat()
                return c
        raise KeyError(f"Comment {comment_id} not found in cluster {cluster_id}")

    @staticmethod
    def upvote_comment(cluster_id: str, comment_id: str) -> Dict[str, Any]:
        """
        Increments helpfulness/upvote score for a resident comment.
        """
        comments = _COMMENT_REGISTRY.get(cluster_id, [])
        for c in comments:
            if c["id"] == comment_id:
                c["upvotes"] += 1
                c["updated_at"] = datetime.now(timezone.utc).isoformat()
                return c
        raise KeyError(f"Comment {comment_id} not found in cluster {cluster_id}")

    @staticmethod
    def moderate_status(
        cluster_id: str,
        comment_id: str,
        new_status: str,
    ) -> Dict[str, Any]:
        """
        Allows municipal admins to moderate comment status ('ACTIVE', 'FLAGGED', 'HIDDEN', 'REMOVED').
        """
        allowed = {"ACTIVE", "FLAGGED", "HIDDEN", "REMOVED"}
        if new_status not in allowed:
            raise ValueError(f"Invalid status: {new_status}. Must be one of {allowed}")

        comments = _COMMENT_REGISTRY.get(cluster_id, [])
        for c in comments:
            if c["id"] == comment_id:
                c["status"] = new_status
                c["updated_at"] = datetime.now(timezone.utc).isoformat()
                return c
        raise KeyError(f"Comment {comment_id} not found in cluster {cluster_id}")

    @staticmethod
    def clear_cache():
        """Clears in-memory registry, primarily for unit testing."""
        _COMMENT_REGISTRY.clear()
