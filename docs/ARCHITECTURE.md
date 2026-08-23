# MapMyCity (CrowdSense) — System Architecture

This document provides a comprehensive technical reference for the MapMyCity / CrowdSense platform architecture, data flows, subsystem boundaries, and security model.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph MobileApp["CrowdSense React Native Mobile App"]
        direction TB
        UI["Mobile UI (Screens & Theme)"]
        OfflineQueue["Offline Queue (AsyncStorage / SQLite)"]
        OnDeviceML["On-Device ML (MobileNet / LiteRT)"]
        VoicePipeline["Offline Voice Entity Extractor"]
        i18nEngine["i18n Engine (EN / HI / MR / KN)"]
        
        UI --> OfflineQueue
        UI --> OnDeviceML
        UI --> VoicePipeline
        UI --> i18nEngine
    end

    subgraph MunicipalAdmin["CrowdSense Admin Portal (Next.js 14)"]
        direction TB
        Dashboard["Ward Triage & SLA Dashboard"]
        LiveMap["Spatial Heatmap & Defect Cluster View"]
        ExportHub["Civic Data Export Hub (GeoJSON / CSV)"]
        Benchmarking["Cross-City Benchmarking Engine"]
    end

    subgraph IngestionBackend["FastAPI Backend Services"]
        direction TB
        API["FastAPI REST & WebSocket Gateway"]
        Moderation["Content & NSFW Moderation Filter"]
        AITriage["Grounded AI Triage & Recurrence Predictor"]
        Telemetry["Health & Observability Metrics"]
        ExportService["GeoJSON & CSV Export Engine"]
        
        API --> Moderation
        API --> AITriage
        API --> Telemetry
        API --> ExportService
    end

    subgraph DataLayer["Persistence & Geospatial Layer"]
        direction TB
        PostGIS[("PostgreSQL 16 + PostGIS / Supabase")]
        RedisQueue[("Redis 7 (Streams & Rate Limits)")]
        CloudinaryMedia[("Cloudinary CDN (Encrypted Storage)")]
    end

    MobileApp -->|HTTPS / WSS| API
    MunicipalAdmin -->|HTTPS / Next.js Server Actions| API
    API --> PostGIS
    API --> RedisQueue
    API --> CloudinaryMedia
```

---

## 2. End-to-End Submission Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen User
    participant App as Mobile App
    participant API as FastAPI Backend
    participant Moderation as Moderation Pipeline
    participant DB as PostgreSQL + PostGIS
    participant Admin as Municipal Admin

    Citizen->>App: Captures defect photo & notes (or voice)
    App->>App: On-device classification & quality check
    alt Device Offline
        App->>App: Enqueue to Local Storage
    else Device Online
        App->>API: POST /submissions/upload (multipart)
    end
    API->>Moderation: Automated NSFW & Text Content Check
    Moderation-->>API: Content Approved
    API->>DB: INSERT into submissions (PostGIS Geometry)
    DB->>DB: Execute spatial cluster trigger (50m radius)
    DB->>DB: Check issue recurrence trigger (90d window)
    API-->>App: HTTP 201 Created (submission_id, cluster_id)
    Admin->>API: GET /api/v1/clusters/active
    API-->>Admin: Returns clustered defects with AI summary
    Admin->>API: PATCH /clusters/{id}/resolve (Resolution proof)
    API->>DB: Record resolution_event
    DB-->>App: Push notification (Issue Fixed!)
```

---

## 3. Subsystem Breakdown

### 3.1 Mobile Client (`crowdsense-app`)
* **Framework**: React Native (Expo SDK 51+), TypeScript.
* **Offline-First Protocol**: Zero data loss guarantee. Captures are timestamped with high-accuracy GPS and preserved locally until network connectivity is restored.
* **On-Device Inference**: MobileNetV3 / quantized LiteRT models verify category relevance before network upload.
* **Multilingual Localization**: Native support for English, Hindi, Marathi, and Kannada (`i18n.ts`).

### 3.2 Backend Service (`backend-fastapi`)
* **Framework**: FastAPI with async SQLAlchemy and Pydantic v2.
* **Spatial Processing**: Direct PostGIS ST_DWithin and ST_Distance calculations for real-time spatial clustering.
* **AI Assistance Layer**: Non-hallucinatory grounded triage summarizer, recurrence risk scoring, and citizen note enhancement.
* **Telemetry & Health**: Comprehensive `/api/v1/health/detailed` and `/api/v1/telemetry/metrics` endpoints.

### 3.3 Database & GIS Layer (`database/migrations`)
* **PostGIS 3.3+**: Geospatial indexes (`GIST(location)`) on coordinates for sub-10ms spatial queries.
* **Recurrence Engine**: Trigger-based recurrence detector tracking temporary contractor patches and chronic defect hotspots.
* **Row-Level Security (RLS)**: Enforces citizen privacy and role-based municipal officer access.

---

## 4. API Precondition Gate Architecture
Speculative future features remain gated behind explicit precondition checks documented in `FUTURE_BACKLOG.md`:
* **Multi-Device Sessions**: Gated on `MULTI_DEVICE_ENABLED`.
* **Public Aggregate API**: Gated on `PUBLIC_API_ENABLED` (requires 500+ verified submissions across 3+ wards).
* **Volunteer/NGO Task Board**: Gated on `TASK_BOARD_ENABLED` (requires signed partner MoU).

---

## 5. Security & Privacy Safeguards
1. **Zero Citizen Identifiers in Public Exports**: All GeoJSON/CSV exports strip user and device IDs.
2. **Rate Limiting**: Sliding window token bucket algorithms prevent scraping and DDoS attacks.
3. **Automated Content Moderation**: Blocks malicious or abusive image and text uploads before insertion.
