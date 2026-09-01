import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple


def make_aware(dt: Optional[datetime]) -> datetime:
    """Helper to ensure datetime is timezone-aware UTC."""
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CommunityConfidenceService:
    """
    Calculates explainable, independence-weighted community confidence,
    recency decay, severity adjustments, and resolution dispute detection.
    """

    HALF_LIFE_DAYS = 14.0  # 14-day exponential half-life for confirmations
    DECAY_LAMBDA = math.log(2) / HALF_LIFE_DAYS

    @classmethod
    def calculate_recency_weight(cls, event_time: Optional[datetime], current_time: Optional[datetime] = None) -> float:
        """
        Calculates exponential time-decay weight: w(t) = exp(-lambda * delta_days).
        """
        now = make_aware(current_time)
        t = make_aware(event_time)
        delta_days = max(0.0, (now - t).total_seconds() / 86400.0)
        return math.exp(-cls.DECAY_LAMBDA * delta_days)

    @classmethod
    def calculate_proximity_weight(cls, distance_meters: Optional[float]) -> float:
        """
        Weights confirmation validity based on geographic proximity.
        <= 150m: 1.0, 150m-500m: 0.6, > 500m: 0.2, Unknown: 0.8.
        """
        if distance_meters is None:
            return 0.8
        if distance_meters <= 150.0:
            return 1.0
        elif distance_meters <= 500.0:
            return 0.6
        else:
            return 0.2

    @classmethod
    def compute_issue_confidence(
        cls,
        unique_reporters: int,
        confirmations: List[Dict[str, Any]],
        image_count: int,
        passive_count: int,
        current_status: str = "NEW",
        current_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Computes composite explainable community confidence score (0.0 to 1.0)
        taking into account device independence, temporal decay, and opposing signals.
        """
        now = make_aware(current_time)

        # 1. Deduplicate confirmations per device to enforce independence
        # Structure: device_id -> List of confirmation dicts
        device_confirmations: Dict[str, List[Dict[str, Any]]] = {}
        for c in confirmations:
            dev = c.get("device_id") or "anonymous_device"
            device_confirmations.setdefault(dev, []).append(c)

        weighted_still_exists = 0.0
        weighted_getting_worse = 0.0
        weighted_fixed = 0.0
        weighted_not_present = 0.0
        independent_devices = len(device_confirmations)

        for dev, items in device_confirmations.items():
            # For multiple confirmations from the same device, take the most recent with diminishing marginal weight
            sorted_items = sorted(items, key=lambda x: make_aware(x.get("created_at")), reverse=True)
            for idx, item in enumerate(sorted_items):
                marginal_multiplier = 1.0 / (idx + 1.0)  # 1st = 1.0, 2nd = 0.5, 3rd = 0.33
                
                c_type = item.get("confirmation_type", "STILL_EXISTS")
                c_time = item.get("created_at")
                dist = item.get("distance_meters")
                trust = float(item.get("trust_score", 0.8) or 0.8)

                # Bound trust between 0.4 and 1.2
                trust_weight = max(0.4, min(1.2, trust))
                recency_w = cls.calculate_recency_weight(c_time, now)
                proximity_w = cls.calculate_proximity_weight(dist)

                effective_weight = marginal_multiplier * recency_w * proximity_w * trust_weight

                if c_type in ("STILL_EXISTS", "ADDITIONAL_EVIDENCE"):
                    weighted_still_exists += effective_weight
                elif c_type == "GETTING_WORSE":
                    weighted_getting_worse += effective_weight
                    weighted_still_exists += effective_weight  # Getting worse implies still exists
                elif c_type == "FIXED":
                    weighted_fixed += effective_weight
                elif c_type == "NOT_PRESENT":
                    weighted_not_present += effective_weight

        # 2. Positive Signal Components
        # Independent Reporters: Up to 0.35
        reporter_signal = min(0.35, 0.15 * (unique_reporters ** 0.65))

        # Still Exists / Getting Worse Confirmations: Up to 0.40
        confirmation_signal = min(0.40, 0.12 * (weighted_still_exists ** 0.75))

        # Media & Sensor Corroboration: Up to 0.25
        evidence_signal = min(0.25, (0.05 * min(image_count, 3)) + (0.04 * min(passive_count, 3)))

        # 3. Negative Signal Components
        negative_signal = (0.15 * min(weighted_not_present, 2.0))
        if current_status in ("RESOLVED", "RESOLVED_PENDING_VERIFICATION", "VERIFIED_FIXED"):
            # If resolved, fixed confirmations reinforce resolution, still exists challenges it
            pass
        else:
            # If active, fixed confirmations create uncertainty
            negative_signal += (0.10 * min(weighted_fixed, 2.0))

        # Composite score calculation
        raw_score = reporter_signal + confirmation_signal + evidence_signal - negative_signal

        # Normalize bounded between 0.05 and 0.99
        confidence = max(0.05, min(0.99, raw_score))

        # Determine suggested status
        suggested_status = current_status
        disputed_resolution = False

        if current_status in ("RESOLVED", "RESOLVED_PENDING_VERIFICATION", "VERIFIED_FIXED"):
            if weighted_still_exists >= 1.5 or (weighted_getting_worse >= 1.0):
                disputed_resolution = True
                suggested_status = "REOPENED"
        elif current_status in ("NEW", "UNDER_REVIEW"):
            if confidence >= 0.70 and (unique_reporters >= 2 or independent_devices >= 2 or image_count >= 1):
                suggested_status = "COMMUNITY_CONFIRMED"

        return {
            "confidence_score": round(confidence, 3),
            "confidence_percent": int(round(confidence * 100)),
            "independent_devices": independent_devices,
            "weighted_still_exists": round(weighted_still_exists, 2),
            "weighted_getting_worse": round(weighted_getting_worse, 2),
            "weighted_fixed": round(weighted_fixed, 2),
            "weighted_not_present": round(weighted_not_present, 2),
            "disputed_resolution": disputed_resolution,
            "suggested_status": suggested_status,
            "breakdown": {
                "reporter_signal": round(reporter_signal, 3),
                "confirmation_signal": round(confirmation_signal, 3),
                "evidence_signal": round(evidence_signal, 3),
                "negative_signal": round(negative_signal, 3),
            }
        }

    @classmethod
    def calculate_severity_score(
        cls,
        base_severity: float,
        getting_worse_confirmations: List[Dict[str, Any]]
    ) -> float:
        """
        Escalates issue severity (1.0 - 5.0) based on structured worsening observations.
        """
        severity = float(base_severity or 2.5)

        reason_weights = {
            "more_dangerous": 0.4,
            "larger": 0.3,
            "affecting_more_people": 0.3,
            "more_frequent": 0.25,
            "other": 0.15
        }

        # Deduplicate per device for worsening reasons
        seen_devices = set()
        for gw in getting_worse_confirmations:
            dev = gw.get("device_id")
            if dev and dev in seen_devices:
                continue
            if dev:
                seen_devices.add(dev)

            reason = (gw.get("worsening_reason") or "other").lower()
            increment = reason_weights.get(reason, 0.2)
            severity += increment

        return round(min(5.0, max(1.0, severity)), 2)


class CommunityConfirmationService:
    """
    Handles user confirmation submissions, anti-abuse checks, and updates
    canonical CivicIssue records.
    """

    COOLDOWN_MINUTES = 30  # Cooldown between duplicate button presses on same issue

    @classmethod
    def check_rate_limit(
        cls,
        existing_confirmations: List[Dict[str, Any]],
        device_id: str,
        confirmation_type: str,
        current_time: Optional[datetime] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Ensures a device does not spam the exact same confirmation button within cooldown.
        """
        now = make_aware(current_time)
        cutoff = now - timedelta(minutes=cls.COOLDOWN_MINUTES)

        recent_matches = [
            c for c in existing_confirmations
            if c.get("device_id") == device_id
            and c.get("confirmation_type") == confirmation_type
            and make_aware(c.get("created_at")) >= cutoff
        ]

        if recent_matches:
            return False, f"You recently confirmed this issue. Please wait {cls.COOLDOWN_MINUTES} minutes before submitting another update."

        return True, None
