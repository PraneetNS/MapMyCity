#!/usr/bin/env python3
"""
scripts/benchmark_spatial_queries.py
====================================
Spatial query latency and throughput benchmarking tool.
Evaluates ST_DWithin clustering proximity queries, spatial grid lookups,
and calculates p50, p95, and p99 latency percentiles across synthetic point distributions.
"""

import sys
import os
import time
import math
import random
import statistics
import json
import argparse
from typing import Dict, Any, List, Tuple


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in meters."""
    r = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class SpatialGridIndex:
    """Fast spatial hash grid index approximating PostGIS spatial index."""
    def __init__(self, cell_size_deg: float = 0.005):
        self.cell_size = cell_size_deg
        self.grid: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}

    def _cell_key(self, lat: float, lng: float) -> Tuple[int, int]:
        return (int(lat / self.cell_size), int(lng / self.cell_size))

    def insert(self, point: Dict[str, Any]):
        key = self._cell_key(point["lat"], point["lng"])
        if key not in self.grid:
            self.grid[key] = []
        self.grid[key].append(point)

    def query_radius(self, lat: float, lng: float, radius_m: float) -> List[Dict[str, Any]]:
        # Approximate delta in degrees for search box
        delta_deg = (radius_m / 111320.0)
        min_key = self._cell_key(lat - delta_deg, lng - delta_deg)
        max_key = self._cell_key(lat + delta_deg, lng + delta_deg)

        candidates = []
        for gx in range(min_key[0], max_key[0] + 1):
            for gy in range(min_key[1], max_key[1] + 1):
                candidates.extend(self.grid.get((gx, gy), []))

        results = []
        for p in candidates:
            if haversine_distance_m(lat, lng, p["lat"], p["lng"]) <= radius_m:
                results.append(p)
        return results


def run_benchmark(dataset_size: int = 5000, num_queries: int = 500, radius_m: float = 100.0) -> Dict[str, Any]:
    base_lat, base_lng = 12.9716, 77.5946

    # Generate synthetic defect points
    points = []
    index = SpatialGridIndex(cell_size_deg=0.005)

    for i in range(dataset_size):
        pt = {
            "id": f"pt-{i}",
            "lat": base_lat + random.uniform(-0.08, 0.08),
            "lng": base_lng + random.uniform(-0.08, 0.08),
            "type": random.choice(["pothole", "garbage", "drainage"])
        }
        points.append(pt)
        index.insert(pt)

    # Benchmark spatial queries
    latencies_ms = []
    matched_counts = []

    for _ in range(num_queries):
        q_lat = base_lat + random.uniform(-0.07, 0.07)
        q_lng = base_lng + random.uniform(-0.07, 0.07)

        t0 = time.perf_counter()
        matches = index.query_radius(q_lat, q_lng, radius_m)
        t1 = time.perf_counter()

        latencies_ms.append((t1 - t0) * 1000.0)
        matched_counts.append(len(matches))

    latencies_sorted = sorted(latencies_ms)
    p50 = latencies_sorted[int(len(latencies_sorted) * 0.50)]
    p95 = latencies_sorted[int(len(latencies_sorted) * 0.95)]
    p99 = latencies_sorted[int(len(latencies_sorted) * 0.99)]
    avg_latency = statistics.mean(latencies_ms)
    throughput = round(num_queries / (sum(latencies_ms) / 1000.0), 1) if sum(latencies_ms) > 0 else 0

    return {
        "dataset_size": dataset_size,
        "query_radius_m": radius_m,
        "queries_executed": num_queries,
        "avg_matches_per_query": round(statistics.mean(matched_counts), 2),
        "latencies_ms": {
            "mean": round(avg_latency, 3),
            "p50": round(p50, 3),
            "p95": round(p95, 3),
            "p99": round(p99, 3)
        },
        "throughput_qps": throughput
    }


def main():
    parser = argparse.ArgumentParser(description="Benchmark spatial clustering queries")
    parser.add_argument("--samples", "-s", type=int, default=2000, help="Number of spatial points in index")
    parser.add_argument("--queries", "-q", type=int, default=200, help="Number of queries to benchmark")
    parser.add_argument("--radius-m", "-r", type=float, default=100.0, help="Proximity search radius in meters")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    args = parser.parse_args()

    results = run_benchmark(dataset_size=args.samples, num_queries=args.queries, radius_m=args.radius_m)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print("==================================================")
        print("MapMyCity Spatial Query Performance Benchmark")
        print("==================================================")
        print(f"Index Size:       {results['dataset_size']} points")
        print(f"Search Radius:    {results['query_radius_m']} meters")
        print(f"Queries Tested:   {results['queries_executed']}")
        print(f"Avg Matches:      {results['avg_matches_per_query']} points/query")
        print(f"Mean Latency:     {results['latencies_ms']['mean']} ms")
        print(f"p50 Latency:      {results['latencies_ms']['p50']} ms")
        print(f"p95 Latency:      {results['latencies_ms']['p95']} ms")
        print(f"p99 Latency:      {results['latencies_ms']['p99']} ms")
        print(f"Throughput:       {results['throughput_qps']} QPS")
        print("==================================================")


if __name__ == "__main__":
    main()
