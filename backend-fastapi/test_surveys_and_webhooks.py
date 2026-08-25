"""
Unit & Integration Tests for Civic Surveys, Satisfaction Metrics, and Partner Webhook Dispatcher
"""

import pytest
import time
from fastapi.testclient import TestClient
from main import app
from services.webhook_service import (
    generate_webhook_signature,
    verify_webhook_signature,
    dispatch_webhook_event
)

client = TestClient(app)

def test_survey_submission_and_sentiment():
    """Tests citizen survey submission and sentiment scoring calculation."""
    payload = {
        "user_id": "citizen_pytest_001",
        "ward_id": "Ward 4",
        "category": "pothole",
        "rating": 5,
        "aspects": ["rapid_resolution", "high_quality_patch"],
        "feedback_text": "Great work! Pothole was repaired quickly and clean.",
        "resolution_speed_rating": 5,
        "workmanship_rating": 5
    }
    response = client.post("/api/v1/surveys/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "survey_id" in data
    assert data["ward_id"] == "Ward 4"
    assert data["rating"] == 5
    assert data["sentiment_score"] > 0.5


def test_ward_satisfaction_metrics():
    """Tests ward-level satisfaction aggregation endpoint."""
    response = client.get("/api/v1/surveys/ward/Ward%204")
    assert response.status_code == 200
    data = response.json()
    assert "ward_id" in data
    assert "average_rating" in data
    assert "aspect_breakdown" in data
    assert data["total_surveys"] >= 1


def test_citywide_survey_summary():
    """Tests summary aggregation across all wards."""
    response = client.get("/api/v1/surveys/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_surveys" in data
    assert "ward_rankings" in data
    assert isinstance(data["ward_rankings"], list)


def test_hmac_signature_generation_and_verification():
    """Tests cryptographic HMAC-SHA256 signature and tamper detection."""
    secret = "muni_secret_key_abcdef123456"
    payload_bytes = b'{"event":"cluster.resolved","data":{"cluster_id":"c-123"}}'
    timestamp = int(time.time())

    sig_header = generate_webhook_signature(secret, payload_bytes, timestamp)
    assert sig_header.startswith(f"t={timestamp},v1=")

    # Valid signature check
    is_valid = verify_webhook_signature(secret, payload_bytes, sig_header, max_age_seconds=60)
    assert is_valid is True

    # Tampered payload check
    tampered_bytes = b'{"event":"cluster.resolved","data":{"cluster_id":"c-999"}}'
    assert verify_webhook_signature(secret, tampered_bytes, sig_header, max_age_seconds=60) is False

    # Expired timestamp check
    expired_header = generate_webhook_signature(secret, payload_bytes, timestamp - 600)
    assert verify_webhook_signature(secret, payload_bytes, expired_header, max_age_seconds=60) is False


def test_webhook_registration_and_list():
    """Tests partner webhook registration and listing endpoints."""
    reg_payload = {
        "partner_name": "Department of Urban Development",
        "target_url": "https://muni.gov.in/webhooks/civic_events",
        "event_types": ["cluster.created", "cluster.resolved"]
    }
    response = client.post("/api/v1/webhooks/", json=reg_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] in ("registered", "registered_mock")
    assert "secret_token" in data["webhook"]

    list_response = client.get("/api/v1/webhooks/")
    assert list_response.status_code == 200
    webhooks = list_response.json()
    assert isinstance(webhooks, list)
