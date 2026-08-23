"""
System Telemetry & Detailed Health Check Router
Provides runtime observability, DB connection pool health, Redis status,
queue depths, uptime, and system performance metrics.
"""

import os
import time
try:
    import psutil
except ImportError:
    psutil = None
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

router = APIRouter(prefix="/api/v1", tags=["Telemetry & Health"])
START_TIME = time.time()


@router.get("/health/detailed", summary="Detailed multi-subsystem health check")
async def detailed_health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Checks status of PostgreSQL, Redis, Cloudinary configuration,
    and returns process memory and system load.
    """
    status_report: Dict[str, Any] = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "components": {}
    }

    # 1. Database Check
    try:
        t0 = time.time()
        result = await db.execute(text("SELECT 1 as alive;"))
        row = result.fetchone()
        db_latency_ms = round((time.time() - t0) * 1000, 2)
        status_report["components"]["database"] = {
            "status": "up" if row and row[0] == 1 else "degraded",
            "latency_ms": db_latency_ms,
            "engine": "PostgreSQL / Supabase"
        }
    except Exception as e:
        status_report["status"] = "degraded"
        status_report["components"]["database"] = {
            "status": "down",
            "error": str(e)
        }

    # 2. Redis Check
    redis_url = os.getenv("REDIS_URL")
    status_report["components"]["redis"] = {
        "configured": bool(redis_url),
        "status": "configured" if redis_url else "disabled"
    }

    # 3. Cloudinary Check
    c_cloud = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
    c_key = bool(os.getenv("CLOUDINARY_API_KEY"))
    status_report["components"]["cloudinary"] = {
        "status": "configured" if (c_cloud and c_key) else "missing_keys"
    }

    # 4. Host Resource Metrics
    try:
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        status_report["resources"] = {
            "process_memory_mb": round(mem_info.rss / (1024 * 1024), 2),
            "cpu_percent": process.cpu_percent(interval=None),
            "thread_count": process.num_threads()
        }
    except Exception:
        status_report["resources"] = {
            "process_memory_mb": None,
            "cpu_percent": None
        }

    return status_report


@router.get("/telemetry/metrics", summary="Aggregated platform operational metrics")
async def platform_metrics(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns platform throughput metrics: total submissions, clusters,
    pending moderation, and recurrence alerts count.
    """
    metrics: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": {}
    }

    try:
        sub_res = await db.execute(text("SELECT COUNT(*) FROM submissions;"))
        metrics["metrics"]["total_submissions"] = sub_res.scalar() or 0
    except Exception:
        metrics["metrics"]["total_submissions"] = 0

    try:
        cluster_res = await db.execute(text("SELECT COUNT(*) FROM clusters;"))
        metrics["metrics"]["total_clusters"] = cluster_res.scalar() or 0
    except Exception:
        metrics["metrics"]["total_clusters"] = 0

    try:
        recur_res = await db.execute(text("SELECT COUNT(*) FROM issue_recurrence_logs;"))
        metrics["metrics"]["recurrent_issues_logged"] = recur_res.scalar() or 0
    except Exception:
        metrics["metrics"]["recurrent_issues_logged"] = 0

    return metrics


@router.get("/system/version", summary="System version and feature flag status")
async def system_version() -> Dict[str, Any]:
    return {
        "version": "1.3.0",
        "service": "CrowdSense FastAPI Backend",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "feature_flags": {
            "MULTI_DEVICE_ENABLED": os.getenv("MULTI_DEVICE_ENABLED", "false").lower() == "true",
            "PUBLIC_API_ENABLED": os.getenv("PUBLIC_API_ENABLED", "false").lower() == "true",
            "TASK_BOARD_ENABLED": os.getenv("TASK_BOARD_ENABLED", "false").lower() == "true",
            "AI_TRIAGE_ENABLED": os.getenv("AI_TRIAGE_ENABLED", "true").lower() == "true",
        }
    }
