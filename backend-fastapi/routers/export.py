"""
Civic Data Export Service Router
Provides spatial GeoJSON and tabular CSV data exports for municipal planners,
GIS analysts, ward officers, and researchers.
"""

import io
import csv
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

router = APIRouter(prefix="/api/v1/export", tags=["Data Export"])


@router.get("/geojson", summary="Export civic defect clusters in GeoJSON FeatureCollection format")
async def export_geojson(
    ward_id: Optional[str] = Query(default=None, description="Filter by Ward ID"),
    category: Optional[str] = Query(default=None, description="Filter by issue category"),
    status: Optional[str] = Query(default=None, description="Filter by status (open, in_progress, resolved)"),
    min_severity: Optional[float] = Query(default=None, description="Minimum severity threshold"),
    limit: int = Query(default=500, ge=1, le=5000, description="Max features to export"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports spatial clusters as a standard RFC 7946 GeoJSON FeatureCollection.
    Ready for import into QGIS, ArcGIS, Mapbox, or Leaflet.
    """
    filters = ["1=1"]
    params = {"limit": limit}

    if ward_id:
        filters.append("ward_id = :ward_id")
        params["ward_id"] = ward_id
    if category:
        filters.append("mission_type = :category")
        params["category"] = category
    if status:
        filters.append("status = :status")
        params["status"] = status
    if min_severity is not None:
        filters.append("avg_severity >= :min_severity")
        params["min_severity"] = min_severity

    where_clause = " AND ".join(filters)

    query_str = f"""
        SELECT 
            id,
            mission_type AS category,
            status,
            latitude,
            longitude,
            submission_count,
            upvotes_count,
            downvotes_count,
            severity,
            ward_id,
            created_at,
            updated_at
        FROM clusters
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT :limit;
    """

    try:
        res = await db.execute(text(query_str), params)
        rows = res.fetchall()

        features = []
        for r in rows:
            if r.latitude is None or r.longitude is None:
                continue
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(r.longitude), float(r.latitude)]
                },
                "properties": {
                    "cluster_id": str(r.id),
                    "category": r.category,
                    "status": r.status,
                    "submission_count": r.submission_count or 1,
                    "upvotes": r.upvotes_count or 0,
                    "downvotes": r.downvotes_count or 0,
                    "severity": float(r.severity) if r.severity is not None else None,
                    "ward_id": r.ward_id,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_features": len(features),
                "crs": "urn:ogc:def:crs:OGC:1.3:CRS84"
            },
            "features": features
        }
        return geojson

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GeoJSON export failed: {str(e)}")


@router.get("/csv", summary="Export civic issues as downloadable CSV spreadsheet")
async def export_csv(
    ward_id: Optional[str] = Query(default=None, description="Filter by Ward ID"),
    category: Optional[str] = Query(default=None, description="Filter by issue category"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Max rows"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports filtered civic issues to a streaming CSV file for municipal data audits.
    """
    filters = ["1=1"]
    params = {"limit": limit}

    if ward_id:
        filters.append("ward_id = :ward_id")
        params["ward_id"] = ward_id
    if category:
        filters.append("mission_type = :category")
        params["category"] = category
    if status:
        filters.append("status = :status")
        params["status"] = status

    where_clause = " AND ".join(filters)

    query_str = f"""
        SELECT 
            id,
            mission_type AS category,
            status,
            latitude,
            longitude,
            ward_id,
            submission_count,
            upvotes_count,
            created_at,
            updated_at
        FROM clusters
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT :limit;
    """

    try:
        res = await db.execute(text(query_str), params)
        rows = res.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "cluster_id", "category", "status", "latitude", "longitude",
            "ward_id", "report_count", "upvotes", "created_at", "updated_at"
        ])

        for r in rows:
            writer.writerow([
                str(r.id),
                r.category or "",
                r.status or "open",
                f"{r.latitude:.6f}" if r.latitude else "",
                f"{r.longitude:.6f}" if r.longitude else "",
                r.ward_id or "Unassigned",
                r.submission_count or 1,
                r.upvotes_count or 0,
                r.created_at.isoformat() if r.created_at else "",
                r.updated_at.isoformat() if r.updated_at else ""
            ])

        output.seek(0)
        filename = f"mapmycity_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV export failed: {str(e)}")
