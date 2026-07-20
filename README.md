# MapMyCity (CrowdSense)

MapMyCity (CrowdSense) is an advanced, crowd-sourced road quality and urban issue reporting platform. Citizens capture road issues (such as potholes, garbage, noise, accessibility obstacles, and infrastructure damage) via a mobile app, which are then validated, moderated, clustered, and visualized on interactive maps for administrators and the public. 

The platform supports both **active reporting** (user-submitted photos with metadata) and **passive sensing** (accelerometer-based road quality logging).

---

## 🏗️ Architecture & Component Overview

The system is structured as a multi-service monorepo:

```mermaid
graph TD
    classDef mobile fill:#f9f,stroke:#333,stroke-width:2px;
    classDef backend fill:#bbf,stroke:#333,stroke-width:2px;
    classDef db fill:#bfb,stroke:#333,stroke-width:2px;
    
    A[crowdsense-app<br/>Expo / React Native]:::mobile -->|Active Reports / Photos| B[backend-fastapi<br/>FastAPI / Python]:::backend
    A -->|Passive Sensings / Batch Jolts| B
    A -->|Direct Safe Upload| C[Cloudinary CDN]
    B -->|Signed Upload Request| C
    B -->|Image Analysis| D[Sightengine API]
    B -->|PostGIS Spatial Queries| E[PostgreSQL / PostGIS]:::db
    F[crowdsense-admin<br/>Next.js Dashboard]:::mobile -->|Monitor / Review / Moderate| B
    G[Supabase Edge Functions]:::backend -->|Alternative Serverless Validation| E
    H[backend<br/>Express legacy API]:::backend -->|Legacy DB Operations| E
```

### Main Directories
*   **[crowdsense-app/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app)**: Expo (React Native) mobile application featuring active camera capture, offline passive road jolt tracking, interactive maps, and localized light/dark theme settings.
*   **[backend-fastapi/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/backend-fastapi)**: FastAPI backend containing image parsing, metadata validations (Tier-0), spatiotemporal clustering algorithms, and third-party moderation/storage hooks.
*   **[crowdsense-admin/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin)**: Next.js administration portal with Leaflet map visualization, detailed metric graphs, password-gate security, and status controllers.
*   **[database/migrations/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations)**: PostgreSQL database migrations deploying PostGIS structures, tables, indexes, and reputation triggers.
*   **[supabase/functions/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/supabase/functions)**: Deno edge functions offering a serverless validation pipeline parallel to FastAPI.
*   **[backend/](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/backend)**: Legacy Node.js Express server with baseline endpoints and mocked DB fallbacks.

---

## 🗄️ Database Schema & Pl/pgSQL Triggers

The schema uses **PostGIS** for high-performance spatial search. Submissions utilize the `geography(point, 4326)` type to track spatial locations on Earth.

### Table Schema Definition

1.  **`devices`**: Tracks user devices, statistics, and scores:
    *   `device_id` (text, Primary Key): Unique device identifier.
    *   `total_submissions` (integer): Count of active photo submissions.
    *   `approved_count` / `rejected_count` (integer): Counts of moderated submissions.
    *   `trust_score` (double precision): Calculated device reputation [0.0 - 1.0].
    *   `first_seen` / `last_seen` (timestamp).
2.  **`submissions`**: Core issue report registry:
    *   `id` (uuid, Primary Key).
    *   `device_id` (text, Foreign Key -> `devices`).
    *   `mission_type` (text): Checked against `pothole`, `garbage`, `noise`, `accessibility`, `infrastructure`, or `passive_road_quality`.
    *   `photo_url` (text): URL to photo assets.
    *   `location` (geography(point, 4326)): PostGIS point coordinate.
    *   `latitude` / `longitude` (double precision).
    *   `captured_at` / `submitted_at` (timestamp).
    *   `status` (text): Checked against lifecycle states (`pending`, `approved`, `rejected`, `acknowledged`, `in_progress`, `resolved_pending_verification`, `verified_fixed`, `reopened`).
    *   `notes` (text) / `p_hash` (text).
    *   `flags` (jsonb): Flag metadata tags.
    *   `cluster_id` (uuid, Foreign Key -> `clusters`).
3.  **`clusters`**: Geospatial groups of matching reports:
    *   `id` (uuid, Primary Key).
    *   `mission_type` (text).
    *   `centroid` (geography(point, 4326)): Geometrical center point of grouped submissions.
    *   `first_reported_at` / `last_reported_at` (timestamp).
    *   `status` (text): `active`, `resolved`, or `stale`.
    *   `submission_count` (integer).
4.  **`resolution_photos`**: Tracks verifying reports confirming that an issue is resolved:
    *   `id` (uuid, Primary Key).
    *   `submission_id` (uuid, Foreign Key -> `submissions`).
    *   `device_id` (text, Foreign Key -> `devices`).
    *   `photo_url` (text), `latitude`/`longitude` (double precision), `p_hash` (text), `flags` (jsonb), `submitted_at` (timestamp).

### Database Triggers & Reputation Calculation

The file [04_create_triggers_and_indices.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/04_create_triggers_and_indices.sql) manages device profiles and computes scores:

*   **`ensure_device_exists()`**: A `BEFORE INSERT` trigger on `submissions` that automatically creates a profile in the `devices` table if it is the first time a device makes a report.
*   **`handle_submission_reputation()`**: An `AFTER INSERT OR UPDATE` trigger on `submissions` that:
    1.  Ignores `passive_road_quality` missions, as passive sensor streams should not impact or penalize user-facing reputations.
    2.  Aggregates the device's total, approved, and rejected submissions.
    3.  Computes the baseline trust score:
        *   If the device has completed **less than 3 submissions**, its score defaults to `0.5`.
        *   If it has completed 3 or more submissions, the score is:
            $$\text{trust\_score} = \frac{\text{approved\_count}}{\text{total\_submissions}}$$
    4.  Applies content policy violation penalties: deducts `0.3` from the final score for each submission flagged with `"auto_rejected_content_policy"`. The floor score is bounded at `0.0`.

---

## 📱 Mobile Client (`crowdsense-app`)

Built using Expo and React Native, the mobile client serves as the data collection node.

### 🚴 Ride Mode (Passive Road Quality Sensing Loop)

The highlight of the mobile app is the passive sensing page: [RideModeScreen.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-app/src/screens/RideModeScreen.tsx). It enables hands-free logging using built-in sensors:

1.  **Sensor Sampling**: Listens to the device's `Accelerometer` (from `expo-sensors`) configured to sample at **20Hz** (every 50ms).
2.  **Rolling Window**: Maintains a rolling buffer of the last 20 readings ($1\text{ second}$ of motion history).
3.  **Noise/Handling Filtering**:
    *   To prevent false-positives caused by handling the phone (e.g., locking it, rotating, picking it up), the algorithm calculates the variance on the $X$ and $Y$ axes.
    *   The standard deviation $\sigma_{xy}$ is calculated as:
        $$\sigma_{xy} = \sqrt{\text{Variance}(X) + \text{Variance}(Y)}$$
    *   If $\sigma_{xy} > 0.12G$, it indicates active device handling. The sensing engine silently discards the current window.
4.  **Jolt Detection**:
    *   If $\sigma_{xy} \leq 0.12G$ (the phone is stable, mounted in a holder/dashboard), the engine calculates the absolute deviation of the vertical acceleration $Z$ relative to its rolling mean:
        $$\text{Deviation} = |Z_i - \mu_z|$$
    *   If the vertical acceleration spikes beyond **0.45G** ($\text{Deviation} > 0.45$), it identifies a genuine road anomaly (jolt/pothole).
5.  **Feedback & Log**:
    *   Triggers physical device vibration feedback (`Haptics.impactAsync(Heavy)`).
    *   Saves the GPS coordinates (captured at High accuracy via `expo-location`) along with the intensity value and timestamp.
6.  **Batch Upload**: At the end of the ride, the list of road jolts is compiled and uploaded as a bulk batch to `/submissions/passive-batch` under the `passive_road_quality` mission type.

---

## ⚡ FastAPI Server (`backend-fastapi`)

The Python FastAPI backend manages core data processing, safety guardrails, and spatial categorization.

### 🛡️ Sightengine Image Moderation

Implemented in [moderation.py](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/backend-fastapi/moderation.py), this pipeline filters images to maintain a clean platform:
*   **Auto-Rejection Model**: Checks for `nudity`, `weapon`, `offensive` (gestures), and `gore`. If the probability score of any category exceeds **0.5**, the submission's status is automatically set to `rejected` with the flag `auto_rejected_content_policy`. Detailed JSON payloads are logged to [moderation_audit.log](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/backend-fastapi/moderation_audit.log).
*   **Off-Topic Flags**: Checks for `illustration` (memes/text), `recapture` (photos of screens), and `faces` (selfies). If these exceed **0.5**, the submission is accepted but flagged for manual review with corresponding flags.

### 🔍 Tier-0 Validation Pipeline

Executed in background tasks when submissions are uploaded:
1.  **EXIF Integrity Check**: Downloads the uploaded image and extracts the EXIF metadata header. It compares the EXIF datetime stamp against the user-asserted `captured_at` timestamp. If the discrepancy exceeds **10 minutes** ($600\text{ seconds}$), it appends `EXIF_TIMESTAMP_MISMATCH`.
2.  **Perceptual Duplicate Check**:
    *   Computes an image **Perceptual Hash (pHash)** using the 64-bit DCT frequency-based image hashing algorithm.
    *   Performs a spatial lookup to locate nearby reports of the same category within **50 meters** and a time frame of **+/- 72 hours**.
    *   Computes the Hamming distance between the new image's pHash and existing hashes.
    *   If the Hamming distance $\leq 10$, the image is flagged with `DUPLICATE_LOCATION_HASH`.
3.  **Velocity Control**: Checks the database logs. If a single `device_id` makes **5 or more submissions in the last hour**, it flags subsequent reports with `VELOCITY_LIMIT_EXCEEDED` to defend against spam.

### 📍 Spatiotemporal Clustering Algorithm

To prevent cluttering map interfaces with duplicate pins for the same pothole, the server clusters submissions:
1.  **Cheap Lookup**: When a new submission arrives, it searches for an existing `active` cluster of the same `mission_type` within a **20-meter radius** and a time window of **+/- 72 hours**.
    *   If found, it links the submission to the cluster, increments the count, updates the min/max reporting times, and recalculates the cluster's physical centroid coordinates:
        ```sql
        UPDATE clusters SET centroid = (
            SELECT ST_Centroid(ST_Collect(location::geometry))::geography
            FROM submissions WHERE cluster_id = :cluster_id
        )
        ```
2.  **Fallback Creation**: If no active cluster is found nearby, the algorithm checks for other unclustered submissions within **20 meters** and **+/- 72 hours**.
    *   It creates a new cluster, links the current and neighboring unclustered submissions to it, and computes its initial centroid.

---

## 🖥️ Administration Dashboard (`crowdsense-admin`)

A Next.js 14 dashboard ([page.tsx](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/crowdsense-admin/src/app/page.tsx)) providing tools for city moderators.

*   **Security Gate**: Simple administrator login authenticated via the client-side credential password `admin123`.
*   **Geospatial Visualization**: Features an interactive OpenStreetMap loaded dynamically via Leaflet.js. Renders clusters and coordinates as custom SVG circle icons color-coded by lifecycle status:
    *   🔴 **Active Cluster**: Rose red.
    *   🟢 **Resolved Cluster**: Emerald green.
    *   ⚪ **Stale Cluster**: Slate grey.
*   **Metric Computations**: Computes running stats including total active submissions, approval rates, pending queue counts, active device logs, and system health checks.
*   **Moderation Panel**: Provides table filters (by category, anomalies, or flags) where admins can review user-submitted photos side-by-side with device trust scores, and either **approve** or **reject** submissions instantly.

---

## 🚀 Getting Started

### 1. Database Setup (Postgres & PostGIS)
To initialize the PostGIS tables, execute the database migration scripts against your PostgreSQL or Supabase instance in alphabetical order:
1.  [01_enable_extensions.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/01_enable_extensions.sql)
2.  [02_create_devices_and_clusters.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/02_create_devices_and_clusters.sql)
3.  [03_create_submissions.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/03_create_submissions.sql)
4.  [04_create_triggers_and_indices.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/04_create_triggers_and_indices.sql)
5.  [05_create_resolution_tracking.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/05_create_resolution_tracking.sql)
6.  [06_add_passive_road_quality.sql](file:///c:/Users/savan/OneDrive/Desktop/MapMyCity/MapMyCity/database/migrations/06_add_passive_road_quality.sql)

### 2. Run the FastAPI Backend
```bash
cd backend-fastapi
# Create and fill out .env with database and api credentials
cp .env.example .env
# Install python packages
pip install -r requirements.txt
# Start the web service
uvicorn main:app --reload
```

### 3. Run the Admin Dashboard
```bash
cd crowdsense-admin
# Install react dependencies
npm install
# Start local development server
npm run dev
```
Navigate to `http://localhost:3000` and use the password `admin123` to enter the dashboard.

### 4. Run the Mobile App (Expo)
```bash
cd crowdsense-app
# Configure the local backend API server URL and Supabase targets
cp .env.example .env
# Install native dependencies
npm install
# Start expo framework
npm start
```

---

## ⚙️ Environment Configurations

### FastAPI Backend (`backend-fastapi/.env`)
| Key | Example Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-name.neon.tech/db?sslmode=require` | PgBouncer/Supabase connections. |
| `CLOUDINARY_CLOUD_NAME` | `my-cloud` | Cloudinary target bucket. |
| `CLOUDINARY_API_KEY` | `1234567` | Cloudinary access key. |
| `CLOUDINARY_API_SECRET` | `secret123` | Cloudinary API secret. |
| `SIGHTENGINE_API_USER` | `987654` | Sightengine API User. |
| `SIGHTENGINE_API_SECRET` | `sightsecret` | Sightengine API Key. |

### Mobile Client App (`crowdsense-app/.env`)
| Key | Example Value | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://project.supabase.co` | Target Supabase project. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `anon_key_string` | Client database security token. |
| `EXPO_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Target URL of the FastAPI server. |
| `EXPO_PUBLIC_ENABLE_ADMIN` | `true` | Exposes the Admin navigation tab when true. |
