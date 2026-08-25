"""
Webhook Dispatcher & Signature Verification Service.
Provides secure webhook delivery with HMAC-SHA256 signatures,
timestamping, and retry logging for municipal partner integrations.
"""

import hmac
import hashlib
import time
import json
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

def generate_webhook_signature(secret_token: str, payload_bytes: bytes, timestamp: int) -> str:
    """
    Generates HMAC-SHA256 signature formatted as t={timestamp},v1={hex_signature}
    """
    signed_payload = f"t={timestamp}.".encode("utf-8") + payload_bytes
    signature = hmac.new(
        key=secret_token.encode("utf-8"),
        msg=signed_payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"


def verify_webhook_signature(secret_token: str, payload_bytes: bytes, header_signature: str, max_age_seconds: int = 300) -> bool:
    """
    Verifies incoming webhook signature and checks timestamp freshness.
    """
    try:
        parts = dict(item.split("=", 1) for item in header_signature.split(","))
        timestamp = int(parts.get("t", 0))
        expected_sig = parts.get("v1", "")

        # Check replay tolerance
        if abs(int(time.time()) - timestamp) > max_age_seconds:
            return False

        calculated_sig = hmac.new(
            key=secret_token.encode("utf-8"),
            msg=f"t={timestamp}.".encode("utf-8") + payload_bytes,
            digestmod=hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(calculated_sig, expected_sig)
    except Exception as e:
        logger.error(f"Error validating webhook signature: {e}")
        return False


async def dispatch_webhook_event(
    target_url: str,
    secret_token: str,
    event_type: str,
    data: Dict[str, Any],
    timeout_seconds: float = 8.0
) -> Dict[str, Any]:
    """
    Asynchronously delivers a signed JSON webhook payload to a municipal endpoint.
    """
    timestamp = int(time.time())
    payload = {
        "event": event_type,
        "timestamp": timestamp,
        "data": data
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_bytes = payload_json.encode("utf-8")
    signature = generate_webhook_signature(secret_token, payload_bytes, timestamp)

    headers = {
        "Content-Type": "application/json",
        "X-Civic-Signature": signature,
        "User-Agent": "MapMyCity-Webhook-Dispatcher/1.0"
    }

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(target_url, content=payload_bytes, headers=headers)
            duration_ms = int((time.time() - start_time) * 1000)
            return {
                "success": 200 <= response.status_code < 300,
                "status_code": response.status_code,
                "response_body": response.text[:500],
                "execution_time_ms": duration_ms
            }
    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "status_code": 0,
            "response_body": str(exc)[:500],
            "execution_time_ms": duration_ms
        }
