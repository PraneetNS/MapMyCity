import os
import sys
import asyncio
import json
import uuid
import time

# Add parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis.asyncio as aioredis
from sqlalchemy import text
from database import async_session

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Normalization constants
# Min intensity recorded by RideMode is 0.45G. 
# We define max threshold at 2.0G for standard roads.
JOLT_MIN = 0.45
JOLT_MAX = 2.0

# Helper to normalize vertical G-force acceleration values to a normalized 0-1 scale
def normalize_jolt(raw_intensity: float) -> float:
    """
    Normalizes the raw vertical acceleration spike to a [0.0, 1.0] range.
    Uses JOLT_MIN (0.45G) and JOLT_MAX (2.0G) bounds.
    """
    if raw_intensity <= JOLT_MIN:
        return 0.0
    if raw_intensity >= JOLT_MAX:
        return 1.0
    return round((raw_intensity - JOLT_MIN) / (JOLT_MAX - JOLT_MIN), 4)

async def update_database(submission_id: str, jolt_intensity: float):
    async with async_session() as db:
        try:
            query = text("""
                UPDATE submissions
                SET jolt_intensity = :jolt_intensity
                WHERE id = :submission_id
            """)
            await db.execute(query, {
                "jolt_intensity": jolt_intensity,
                "submission_id": submission_id
            })
            await db.commit()
            print(f"Fusion Worker: Successfully updated database for submission {submission_id} with intensity {jolt_intensity}")
        except Exception as db_err:
            await db.rollback()
            print(f"Fusion Worker: Database update failed for submission {submission_id}: {db_err}")
            raise db_err

async def process_message(redis_client, message_id: str, data: dict):
    sub_id = data.get("submission_id")
    has_jolt = data.get("has_jolt") == "true"
    raw_intensity_str = data.get("raw_jolt_intensity")
    
    if not sub_id or not has_jolt:
        # Acknowledge and skip non-jolt events
        await redis_client.xack("submissions:events", "sensor-fusion-group", message_id)
        return

    print(f"Fusion Worker: Processing message {message_id} for submission {sub_id}...")
    
    try:
        raw_intensity = None
        if raw_intensity_str:
            try:
                raw_intensity = float(raw_intensity_str)
            except ValueError:
                pass
                
        # If raw intensity is not in the message payload, check the DB notes
        if raw_intensity is None:
            async with async_session() as db:
                res = await db.execute(text("SELECT notes FROM submissions WHERE id = :id"), {"id": sub_id})
                row = res.fetchone()
                if row and row[0]:
                    # Extract from notes string like: "Accelerometer spike intensity: 1.25G"
                    import re
                    match = re.search(r"intensity:\s*([\d\.]+)", row[0])
                    if match:
                        raw_intensity = float(match.group(1))

        if raw_intensity is None:
            # Fallback default value if no intensity is available
            raw_intensity = 0.5
            print(f"Fusion Worker: Warning, no jolt intensity found for submission {sub_id}. Using default {raw_intensity}")

        # 1. Normalize
        normalized_intensity = normalize_jolt(raw_intensity)
        print(f"Fusion Worker: Submission {sub_id} raw_jolt={raw_intensity}G -> normalized={normalized_intensity}")
        
        # 2. Update Database
        await update_database(sub_id, normalized_intensity)
        
        # 3. Acknowledge message
        await redis_client.xack("submissions:events", "sensor-fusion-group", message_id)
        print(f"Fusion Worker: Acknowledged message {message_id}")
        
    except Exception as err:
        print(f"Fusion Worker: Error processing message {message_id}: {err}")
        # Log to DLQ stream
        try:
            dlq_event = {
                "message_id": message_id,
                "submission_id": sub_id or "",
                "worker": "sensor_fusion",
                "error": str(err),
                "timestamp": str(time.time())
            }
            await redis_client.xadd("submissions:events:dlq", dlq_event)
            # Acknowledge the original message so it doesn't block the stream forever
            await redis_client.xack("submissions:events", "sensor-fusion-group", message_id)
            print(f"Fusion Worker: Moved message {message_id} to DLQ.")
        except Exception as dlq_err:
            print(f"Fusion Worker: Critical failed to log to DLQ: {dlq_err}")

async def main():
    print("Starting Sensor Fusion Worker...")
    redis_client = aioredis.Redis.from_url(REDIS_URL, decode_responses=True)
    
    # 1. Initialize consumer group
    try:
        await redis_client.xgroup_create("submissions:events", "sensor-fusion-group", id="$", mkstream=True)
        print("Fusion Worker: Created stream & consumer group 'sensor-fusion-group'.")
    except Exception as e:
        if "BUSYGROUP" in str(e):
            print("Fusion Worker: Consumer group 'sensor-fusion-group' already exists.")
        else:
            print(f"Fusion Worker: Error creating consumer group: {e}")

    # 2. Main consumer loop
    while True:
        try:
            # A. Process Pending Entries List (PEL) first on startup/crash-recovery
            pending_streams = await redis_client.xreadgroup(
                groupname="sensor-fusion-group",
                consumername="fusion-consumer-1",
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
                    groupname="sensor-fusion-group",
                    consumername="fusion-consumer-1",
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
            print(f"Fusion Worker: Loop error: {loop_err}")
            await asyncio.sleep(1)
            
    await redis_client.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Sensor Fusion Worker stopped by user.")
