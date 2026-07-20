import os
import sys
import asyncio
import json
import uuid
import hashlib
import time

# Add parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis.asyncio as aioredis
from sqlalchemy import text
from database import async_session

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Optional YOLOv8 import
try:
    from ultralytics import YOLO
    HAS_YOLO = True
    print("CV Worker: ultralytics (YOLOv8) successfully imported.")
except ImportError:
    HAS_YOLO = False
    print("CV Worker: ultralytics not installed. Falling back to mockup inference.")

async def run_visual_inference(photo_url: str) -> tuple[float, str]:
    if not photo_url:
        return 0.0, "unknown"
        
    if HAS_YOLO:
        try:
            # YOLOv8 supports running directly on HTTP URLs
            loop = asyncio.get_running_loop()
            # Load a lightweight model
            model = YOLO("yolov8n.pt")
            results = await loop.run_in_executor(None, lambda: model(photo_url, verbose=False))
            
            if results and len(results) > 0:
                boxes = results[0].boxes
                if len(boxes) > 0:
                    avg_conf = sum([float(b.conf[0]) for b in boxes]) / len(boxes)
                    damage_type = "pothole"
                    return min(1.0, max(0.0, avg_conf)), damage_type
        except Exception as e:
            print(f"CV Worker: YOLO inference failed ({e}). Falling back to mockup inference.")
            
    # Mockup inference fallback (deterministic based on photo_url string)
    h = hashlib.md5(photo_url.encode('utf-8')).hexdigest()
    val = int(h[:4], 16) / 65535.0
    visual_severity = round(0.3 + (val * 0.6), 2) # normalize between 0.3 and 0.9
    
    damage_types = ["pothole", "crack", "waterlogging", "debris", "infrastructure"]
    damage_type = damage_types[int(h[4:6], 16) % len(damage_types)]
    
    return visual_severity, damage_type

async def update_database(submission_id: str, visual_severity: float, damage_type: str):
    async with async_session() as db:
        try:
            query = text("""
                UPDATE submissions
                SET visual_severity = :visual_severity,
                    damage_type = :damage_type
                WHERE id = :submission_id
            """)
            await db.execute(query, {
                "visual_severity": visual_severity,
                "damage_type": damage_type,
                "submission_id": submission_id
            })
            await db.commit()
            print(f"CV Worker: Successfully updated database for submission {submission_id}")
        except Exception as db_err:
            await db.rollback()
            print(f"CV Worker: Database update failed for submission {submission_id}: {db_err}")
            raise db_err

async def process_message(redis_client, message_id: str, data: dict):
    sub_id = data.get("submission_id")
    photo_url = data.get("photo_url")
    has_image = data.get("has_image") == "true"
    
    if not sub_id or not has_image:
        # Acknowledge and skip non-image events
        await redis_client.xack("submissions:events", "cv-severity-group", message_id)
        return

    print(f"CV Worker: Processing message {message_id} for submission {sub_id}...")
    
    try:
        # If photo URL is not in the message, fetch it from DB
        if not photo_url:
            async with async_session() as db:
                res = await db.execute(text("SELECT photo_url FROM submissions WHERE id = :id"), {"id": sub_id})
                row = res.fetchone()
                if row:
                    photo_url = row[0]
                    
        if not photo_url:
            raise ValueError(f"No photo_url available for submission {sub_id}")
            
        # 1. Run inference
        visual_severity, damage_type = await run_visual_inference(photo_url)
        print(f"CV Worker: Submission {sub_id} visual_severity={visual_severity}, damage_type={damage_type}")
        
        # 2. Update Database
        await update_database(sub_id, visual_severity, damage_type)
        
        # 3. Acknowledge message
        await redis_client.xack("submissions:events", "cv-severity-group", message_id)
        print(f"CV Worker: Acknowledged message {message_id}")
        
    except Exception as err:
        print(f"CV Worker: Error processing message {message_id}: {err}")
        # Log to DLQ stream
        try:
            dlq_event = {
                "message_id": message_id,
                "submission_id": sub_id or "",
                "worker": "cv_severity",
                "error": str(err),
                "timestamp": str(time.time())
            }
            await redis_client.xadd("submissions:events:dlq", dlq_event)
            # Acknowledge the original message so it doesn't block the stream forever
            await redis_client.xack("submissions:events", "cv-severity-group", message_id)
            print(f"CV Worker: Moved message {message_id} to DLQ.")
        except Exception as dlq_err:
            print(f"CV Worker: Critical failed to log to DLQ: {dlq_err}")

async def main():
    print("Starting CV Severity Worker...")
    redis_client = aioredis.Redis.from_url(REDIS_URL, decode_responses=True)
    
    # 1. Initialize consumer group
    try:
        await redis_client.xgroup_create("submissions:events", "cv-severity-group", id="$", mkstream=True)
        print("CV Worker: Created stream & consumer group 'cv-severity-group'.")
    except Exception as e:
        if "BUSYGROUP" in str(e):
            print("CV Worker: Consumer group 'cv-severity-group' already exists.")
        else:
            print(f"CV Worker: Error creating consumer group: {e}")

    # 2. Main consumer loop
    while True:
        try:
            # A. Process Pending Entries List (PEL) first on startup/crash-recovery
            pending_streams = await redis_client.xreadgroup(
                groupname="cv-severity-group",
                consumername="cv-consumer-1",
                streams={"submissions:events": "0"},
                count=5
            )
            
            messages_to_process = []
            if pending_streams:
                for _, messages in pending_streams:
                    messages_to_process.extend(messages)
                    
            # B. If no pending, read new messages
            if not messages_to_process:
                streams = await redis_client.xreadgroup(
                    groupname="cv-severity-group",
                    consumername="cv-consumer-1",
                    streams={"submissions:events": ">"},
                    count=1,
                    block=5000
                )
                if streams:
                    for _, messages in streams:
                        messages_to_process.extend(messages)
                        
            for message_id, data in messages_to_process:
                await process_message(redis_client, message_id, data)
                
        except asyncio.CancelledError:
            break
        except Exception as loop_err:
            print(f"CV Worker: Loop error: {loop_err}")
            await asyncio.sleep(1)
            
    await redis_client.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("CV Worker stopped by user.")
