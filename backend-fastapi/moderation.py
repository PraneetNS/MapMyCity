import os
import httpx
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any

# Configure a separate logger for moderation audits
audit_logger = logging.getLogger("moderation_audit")
audit_logger.setLevel(logging.INFO)

# Avoid duplicate handlers in reloading environments
if not audit_logger.handlers:
    log_file = os.path.join(os.path.dirname(__file__), "moderation_audit.log")
    handler = logging.FileHandler(log_file, encoding="utf-8")
    formatter = logging.Formatter('%(asctime)s - %(message)s')
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)

# Load Sightengine credentials from env
SIGHTENGINE_API_USER = os.getenv("SIGHTENGINE_API_USER")
SIGHTENGINE_API_SECRET = os.getenv("SIGHTENGINE_API_SECRET")

async def check_image_content(photo_url: str) -> Dict[str, Any]:
    """
    Calls Sightengine's API with the photo_url to check for:
    - Nudity, offensive gestures, gore/violence, weapons (triggers immediate rejection)
    - Off-topic indicators: memes/illustrations, recapture/screenshots, faces/selfies (triggers manual review flag)
    
    Returns a dictionary indicating if the image is auto_rejected or off_topic,
    a list of reasons, and the raw Sightengine response dictionary.
    """
    # Graceful fallback if credentials are not configured or are placeholders
    if (not SIGHTENGINE_API_USER or not SIGHTENGINE_API_SECRET or 
            "your_sightengine" in SIGHTENGINE_API_USER or "your_sightengine" in SIGHTENGINE_API_SECRET):
        print("FastAPI Backend [Moderation]: Sightengine credentials not configured, skipping moderation checks.")
        return {
            "auto_reject": False,
            "off_topic": False,
            "reasons": [],
            "raw_response": {"warning": "Sightengine credentials missing or placeholder"}
        }

    url = "https://api.sightengine.com/1.0/check.json"
    params = {
        "url": photo_url,
        "models": "nudity-2.1,weapon,offensive,gore,type,recapture,face-attributes",
        "api_user": SIGHTENGINE_API_USER,
        "api_secret": SIGHTENGINE_API_SECRET,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=12.0)
            
            if response.status_code != 200:
                print(f"FastAPI Backend [Moderation]: Sightengine API HTTP {response.status_code} error.")
                return {
                    "auto_reject": False,
                    "off_topic": False,
                    "reasons": [],
                    "raw_response": {"error": f"HTTP error {response.status_code}", "body": response.text}
                }
                
            data = response.json()
            
            if data.get("status") != "success":
                print(f"FastAPI Backend [Moderation]: Sightengine API returned status: {data.get('status')}")
                return {
                    "auto_reject": False,
                    "off_topic": False,
                    "reasons": [],
                    "raw_response": data
                }
            
            # --- 1. Evaluate Auto-Reject Criteria (Threshold > 0.5) ---
            reasons = []
            
            # Nudity check
            nudity_data = data.get("nudity", {})
            raw_n = nudity_data.get("raw", 0.0)
            sexual_act = nudity_data.get("sexual_activity", 0.0)
            sexual_disp = nudity_data.get("sexual_display", 0.0)
            erotica = nudity_data.get("erotica", 0.0)
            max_nudity = max(raw_n, sexual_act, sexual_disp, erotica)
            if max_nudity > 0.5:
                reasons.append(f"nudity_detected (max_score={max_nudity})")
                
            # Weapon check
            weapon_prob = data.get("weapon", {}).get("prob", 0.0)
            if weapon_prob > 0.5:
                reasons.append(f"weapon_detected (prob={weapon_prob})")
                
            # Offensive gesture check
            offensive_prob = data.get("offensive", {}).get("prob", 0.0)
            if offensive_prob > 0.5:
                reasons.append(f"offensive_gesture_detected (prob={offensive_prob})")
                
            # Gore check
            gore_prob = data.get("gore", {}).get("prob", 0.0)
            if gore_prob > 0.5:
                reasons.append(f"gore_detected (prob={gore_prob})")
                
            auto_reject = len(reasons) > 0

            # --- 2. Evaluate Off-Topic/Suspicion Criteria (Threshold > 0.5) ---
            off_topic_reasons = []
            
            # Illustration check (meme, digital art)
            illustration_score = data.get("type", {}).get("illustration", 0.0)
            if illustration_score > 0.5:
                off_topic_reasons.append(f"illustration_detected (score={illustration_score})")
                
            # Recapture check (screenshot, photo of screen)
            recapture_score = data.get("recapture", {}).get("score", 0.0)
            if recapture_score > 0.5:
                off_topic_reasons.append(f"recapture_detected (score={recapture_score})")
                
            # Face attributes check (selfie, face visible)
            faces = data.get("faces", [])
            if len(faces) > 0:
                off_topic_reasons.append(f"face_detected (count={len(faces)})")
                
            off_topic = len(off_topic_reasons) > 0 and not auto_reject

            # --- 3. Audit trail Logging for Auto-Rejections ---
            if auto_reject:
                audit_entry = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "photo_url": photo_url,
                    "reasons": reasons,
                    "sightengine_response": data
                }
                audit_logger.info(json.dumps(audit_entry))
                print(f"FastAPI Backend [Moderation]: Photo {photo_url} AUTO-REJECTED due to content policy: {reasons}")
            elif off_topic:
                print(f"FastAPI Backend [Moderation]: Photo {photo_url} flagged as OFF-TOPIC for manual review: {off_topic_reasons}")

            return {
                "auto_reject": auto_reject,
                "off_topic": off_topic,
                "reasons": reasons if auto_reject else off_topic_reasons,
                "raw_response": data
            }

    except Exception as e:
        print(f"FastAPI Backend [Moderation]: Error executing Sightengine API check: {e}")
        return {
            "auto_reject": False,
            "off_topic": False,
            "reasons": [],
            "raw_response": {"error": str(e)}
        }
