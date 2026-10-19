# MapMyCity (CrowdSense) — Operational & Developer Scripts Suite

This directory contains utility scripts, CLI automation tools, synthetic test generators, and operational maintenance routines for the **MapMyCity (CrowdSense)** civic intelligence platform.

All scripts support standalone execution with `--help`, graceful fallback to offline/mock data when external databases are unreachable, and strict POSIX exit codes (`0` for success, non-zero for failure).

---

## 📋 Script Catalog Overview

| Script | Category | Purpose | CLI Flags |
|---|---|---|---|
| `seed_demo_data.py` | Data Seeding | Generates realistic mock defect clusters and citizen feedback surveys. | `--count`, `--output-dir` |
| `verify_environment.py` | Diagnostics | Validates Python runtime, Node environment, DB connection, and external API keys. | `--strict`, `--json` |
| `export_geojson.py` | GIS / Spatial | Exports active defect clusters and road roughness data to standard GeoJSON FeatureCollections. | `--output`, `--category`, `--min-reports` |
| `import_shapefile_wards.py` | GIS / Spatial | Parses GeoJSON/Shapefile administrative boundary definitions and indexes them in PostGIS. | `--file`, `--city`, `--dry-run` |
| `simulate_road_telemetry.py` | Sensor Sim | Simulates accelerometer (`ax`, `ay`, `az`, speed) vehicle streams detecting bumps and potholes. | `--duration`, `--frequency`, `--potholes` |
| `benchmark_spatial_queries.py` | Performance | Benchmarks PostGIS `ST_DWithin` spatial searches versus bounding box indexing under load. | `--samples`, `--radius-m`, `--concurrency` |
| `sync_weather_forecasts.py` | Environmental | Ingests live Open-Meteo precipitation data and updates flood risk grid cell predictions. | `--lat`, `--lon`, `--dry-run` |
| `compute_ward_sla_metrics.py` | Municipal Ops | Computes per-ward resolution turnaround time, pending defect backlog, and SLA compliance rates. | `--days`, `--ward`, `--export-csv` |
| `anonymize_submission_media.py` | Privacy & Safety | Strips EXIF GPS metadata and blurs simulated faces/license plates for open data exports. | `--input-dir`, `--output-dir`, `--blur-faces` |
| `generate_synthetic_potholes.py` | AI / Training | Generates synthetic road defect images with labeled bounding boxes and varying lighting conditions. | `--count`, `--output-dir`, `--augment` |
| `simulate_work_order_dispatch.py` | Dispatch / Ops | Simulates batch defect cluster triage, tests automated department routing, and benchmarks SLA latency. | `--batch`, `--storm`, `--out` |
| `export_road_health_kml.py` | GIS / Roughness | Exports road segment roughness (IRI) and Road Health Index (RHI) traces into GIS-compatible KML or GeoJSON. | `--format`, `--out` |
| `sla_breach_watchdog.py` | SLA Watchdog | Scans active contractor work orders, issues early breach warnings, and triggers automated executive escalations. | `--once`, `--auto-escalate`, `--interval-sec` |
| `check_database_migrations.py` | Database CI | Lints migration SQL scripts for transaction safety, foreign key indexes, and idempotency. | `--dir`, `--strict` |
| `evaluate_consensus_quorum.py` | Consensus AI | Evaluates community confirmation consensus scores, evidence independence, and dispute risk flags. | `--cluster-id`, `--min-evidence` |
| `simulate_webhook_dispatcher.py` | Integrations | Emulates municipal partner webhook dispatching with HMAC-SHA256 signature verification. | `--endpoint`, `--secret`, `--events` |
| `export_civic_opendata.py` | Governance | Packages sanitized, k-anonymized defect records into CSV/JSON packages for researchers. | `--k-anon`, `--format`, `--output` |
| `recalculate_civic_reputation.py` | Reputation AI | Recomputes user trust scores, badges, and civic reputation scores from raw contribution events. | `--user-id`, `--rebuild-all`, `--dry-run` |
| `inspect_duplicate_reports.py` | Deduplication | Detects duplicate submissions using spatial proximity and Perceptual Hash (pHash) Hamming distance. | `--threshold-m`, `--hamming-max` |
| `run_load_test_submissions.py` | Load Testing | Stresses the FastAPI submission ingest pipeline with concurrent simulated mobile clients. | `--rps`, `--duration-sec`, `--workers` |
| `generate_municipal_pdf_report.py` | Reporting | Compiles an executive civic health report in Markdown/HTML with resolution stats and priority wards. | `--ward`, `--period-days`, `--output` |
| `backup_spatial_snapshot.py` | Operations | Creates a self-contained portable JSON snapshot of active clusters and telemetry for quick staging restore. | `--action`, `--file` |
| `validate_api_contracts.py` | API Contracts | Validates consistency between FastAPI OpenAPI schema and frontend mobile TypeScript interfaces. | `--check-routes`, `--output` |
| `test_scripts_suite.py` | Automated CI | Runs unit verification on all 20 operational scripts ensuring `--help` and basic execution pass. | `--verbose`, `--fail-fast` |
| `run_all_diagnostics.py` | Orchestration | High-level orchestration script running environment verification, migration linting, and data sanity checks. | `--quick`, `--report` |

---

## 🚀 Quick Start Guide

### 1. Verify Development Environment
```bash
python scripts/verify_environment.py
```

### 2. Seed Mock Data for Local Development
```bash
python scripts/seed_demo_data.py
```

### 3. Run All Operations Diagnostics
```bash
python scripts/run_all_diagnostics.py --quick
```

### 4. Run Scripts Test Suite
```bash
python scripts/test_scripts_suite.py
```
