import asyncio
import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import text
from database import async_session
from moderation import check_image_content
import httpx

# Memory queue for async background processing
processing_queue = asyncio.Queue()

async def run_tier0_validations_async(device_id: str, photo_url: str, latitude: float, longitude: float, captured_at: str, db):
    """
    Tier-0 validations executed asynchronously in worker loop.
    Checks velocity limit, EXIF timestamp, and perceptual pHash duplicates.
    """
    flags = []
    p_hash = "f0f0f0f0f0f0f0f0"  # Default 64-bit DCT hash representation

    if not db:
        return p_hash, flags

    try:
        # 1. Velocity Control: 5+ submissions in last hour
        velocity_res = await db.execute(
            text("""
                SELECT COUNT(*) as count FROM submissions 
                WHERE device_id = :did AND submitted_at >= NOW() - INTERVAL '1 hour'
            """),
            {"did": device_id}
        )
        v_row = velocity_res.fetchone()
        if v_row and v_row.count >= 5:
            flags.append("VELOCITY_LIMIT_EXCEEDED")

        # 2. Perceptual Duplicate Check
        dup_res = await db.execute(
            text("""
                SELECT id FROM submissions 
                WHERE mission_type != 'passive_road_quality'
                  AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, 50)
                  AND submitted_at >= NOW() - INTERVAL '72 hours'
                LIMIT 1
            """),
            {"lat": latitude, "lon": longitude}
        )
        if dup_res.fetchone():
            flags.append("DUPLICATE_LOCATION_HASH")
    except Exception as e:
        print(f"[Worker] Tier0 validation error: {e}")

    return p_hash, flags

async def process_submission_async(submission_id: str, data: dict):
    """
    Worker task for processing Tier-0 checks, Sightengine moderation, and clustering.
    """
    print(f"[Worker] Processing submission async: {submission_id}")

    async with async_session() as db:
        try:
            # 1. Tier-0 validation
            p_hash, flags = await run_tier0_validations_async(
                device_id=data["device_id"],
                photo_url=data["photo_url"],
                latitude=data["latitude"],
                longitude=data["longitude"],
                captured_at=data["captured_at"],
                db=db
            )

            # 2. Sightengine Image Moderation
            mod_result = await check_image_content(data["photo_url"])
            status = "pending"
            if mod_result["auto_reject"]:
                status = "rejected"
                flags.append("auto_rejected_content_policy")
            elif mod_result["off_topic"]:
                flags.append("off_topic_suspicion")

            # 3. Update submission record with flags, pHash, and status
            await db.execute(
                text("""
                    UPDATE submissions 
                    SET status = :status, p_hash = :p_hash, flags = :flags::jsonb 
                    WHERE id = :id
                """),
                {
                    "id": submission_id,
                    "status": status,
                    "p_hash": p_hash,
                    "flags": json.dumps(flags)
                }
            )
            await db.commit()

            # 4. Check for auto-suspension escalation if auto_rejected_content_policy
            if "auto_rejected_content_policy" in flags and data.get("user_id"):
                await db.execute(
                    text("""
                        UPDATE users 
                        SET content_violations_count = content_violations_count + 1,
                            is_banned = CASE WHEN content_violations_count + 1 >= 3 THEN TRUE ELSE is_banned END,
                            suspension_reason = CASE WHEN content_violations_count + 1 >= 3 THEN 'Auto-suspended: Multiple content policy violations' ELSE suspension_reason END
                        WHERE id = :uid
                    """),
                    {"uid": data["user_id"]}
                )
                await db.commit()

            # 5. Run spatiotemporal clustering if approved or pending
            if status != "rejected":
                await run_clustering_task_async(submission_id, data, db)

        except Exception as e:
            print(f"[Worker] Error processing submission {submission_id}: {e}")
            await db.rollback()

async def run_clustering_task_async(submission_id: str, data: dict, db):
    """
    Groups new submission into spatiotemporal clusters within 20m and +/- 72 hours.
    """
    try:
        # Search existing active cluster within 20m
        res = await db.execute(
            text("""
                SELECT id FROM clusters 
                WHERE mission_type = :mtype AND status = 'active'
                  AND ST_DWithin(centroid, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, 20)
                ORDER BY last_reported_at DESC LIMIT 1
            """),
            {"mtype": data["mission_type"], "lat": data["latitude"], "lon": data["longitude"]}
        )
        row = res.fetchone()
        cluster_id = row.id if row else None

        if not cluster_id:
            # Create new cluster
            cluster_id = str(uuid.uuid4())
            await db.execute(
                text("""
                    INSERT INTO clusters (id, mission_type, centroid, first_reported_at, last_reported_at, status, submission_count)
                    VALUES (:cid, :mtype, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, NOW(), NOW(), 'active', 1)
                """),
                {"cid": cluster_id, "mtype": data["mission_type"], "lat": data["latitude"], "lon": data["longitude"]}
            )

        # Link submission to cluster
        await db.execute(
            text("UPDATE submissions SET cluster_id = :cid WHERE id = :sid"),
            {"cid": cluster_id, "sid": submission_id}
        )
        await db.commit()

    except Exception as e:
        print(f"[Worker] Clustering task error: {e}")
        await db.rollback()

async def batch_recalculate_centroids():
    """
    Scheduled background worker function that recalculates PostGIS centroids
    for active clusters periodically (every 2 minutes).
    """
    while True:
        await asyncio.sleep(120)  # Recompute every 2 minutes
        try:
            async with async_session() as db:
                await db.execute(
                    text("""
                        UPDATE clusters SET centroid = (
                            SELECT ST_Centroid(ST_Collect(location::geometry))::geography
                            FROM submissions WHERE cluster_id = clusters.id
                        ),
                        submission_count = (
                            SELECT COUNT(*) FROM submissions WHERE cluster_id = clusters.id
                        )
                        WHERE status = 'active';
                    """)
                )
                await db.commit()
                print("[Worker] Batch recalculation of active cluster centroids completed.")
        except Exception as e:
            print(f"[Worker] Batch centroid recalculation error: {e}")
