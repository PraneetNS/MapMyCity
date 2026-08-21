# Market-Standard Engagement & Growth Features Specification

## Executive Summary

This document specifies the implementation of 9 market-standard consumer and civic engagement features across the **MapMyCity CrowdSense** platform (`crowdsense-app/`, `backend-fastapi/`, `crowdsense-admin/`, `database/migrations/`). These features adopt proven patterns from top consumer products (Google Maps, Duolingo, Strava, Swiggy) to increase reporting speed, viral civic loops, and offline accessibility without introducing unnecessary foundational complexity.

---

## Feature Architecture & System Extension Map

| Feature Part | Feature Name | Primary Layer | Existing Infrastructure Extended | Partner Dependency |
|---|---|---|---|---|
| **Part 1** | Home Screen Widgets | Mobile / Native Bridge | Local stale-while-revalidate cluster cache | None (Pure Engineering) |
| **Part 2** | App Icon Quick Actions | Mobile Client | Deep-link routing & category dispatcher | None (Pure Engineering) |
| **Part 3** | Shareable Social Impact Cards | Client / Canvas UI | User stats, trust scores, resolution photos, DPDP anonymizer | None (Pure Engineering) |
| **Part 4** | Offline Map Area Download | Storage & Sync | Lite Mode storage manager, RHI tiles, local SQLite queue | None (Pure Engineering) |
| **Part 5** | Social Sign-In (Google & Apple) | Auth & FastAPI | `users` table, phone-hash coexistence, capability flags | None (Pure Engineering) |
| **Part 6** | Contextual In-App Review Prompts | Mobile Client | Milestone triggers & issue resolution event stream | None (Pure Engineering) |
| **Part 7** | Physical QR-Code Asset Tagging | Admin & Submissions | `submissions` table, Cloudinary ingest, Admin portal | ⚠️ **Requires Municipal Partner Pilot** |
| **Part 8** | Explicit Low-Data / Data Saver Mode | Network & Settings | `expo-network`, image quality pipeline, Lite Mode settings | None (Pure Engineering) |
| **Part 9** | Cluster Comments & Local Discussion | DB, API & Client | `clusters` audit trail, text moderation, peer flagging | None (Pure Engineering) |

---

## Detailed Specifications

### Part 8 — Explicit Low-Data / Data Saver Mode

**Motivation**: Distinct from Lite Mode (which targets low RAM/CPU and device rendering), **Data Saver Mode** specifically protects citizens on metered mobile data plans from excessive bandwidth usage.

- **Storage Key**: `CROWDSENSE_DATA_SAVER_ENABLED`
- **Core Rules**:
  1. **Compressed Thumbnail Previews**: Map pin callouts and submission list photos render low-res versions.
  2. **Wi-Fi-Only Sync**: Heavy background tasks (offline map pre-fetching, model cache warming) are deferred when on cellular data.
  3. **No Media Autoplay**: Skips animated previews or video demos.
- **Intelligent Auto-Suggestion**:
  - Automatically queries `expo-network` on launch.
  - If sustained cellular network is detected and the user has not configured Data Saver, presents a one-time non-intrusive prompt: *"Would you like to turn on Data Saver Mode to compress map photo thumbnails and defer heavy background syncs to Wi-Fi?"*
- **Settings Independence**: Data Saver and Lite Mode remain independent, combinable toggles in [ProfileSettingsScreen.tsx](file:///d:/MapMyCity/crowdsense-app/src/screens/ProfileSettingsScreen.tsx).

---

### Part 9 — Cluster Comments & Community Discussion Threads

**Motivation**: Allows residents to supply live context (*"repaired yesterday,"* *"still waterlogged after rain"*) without cluttering municipal databases with duplicate reports.

- **Database Table (`cluster_comments`)**:
  - `id`: UUID PRIMARY KEY
  - `cluster_id`: UUID REFERENCES clusters(id)
  - `user_id`: UUID REFERENCES users(id) ON DELETE SET NULL
  - `author_name`: TEXT
  - `body`: TEXT (sanitized and PII-redacted)
  - `is_anonymous`: BOOLEAN
  - `is_flagged`: BOOLEAN DEFAULT FALSE
  - `flag_count`: INTEGER DEFAULT 0
  - `created_at`: TIMESTAMPTZ DEFAULT NOW()
- **Content Moderation & PII Redaction**:
  - Text passes through `check_text_content()` in [moderation.py](file:///d:/MapMyCity/backend-fastapi/moderation.py).
  - Phone numbers (`\b\d{10}\b`) and email addresses are automatically masked with `[PHONE REDACTED]` and `[EMAIL REDACTED]`.
  - Abusive or profanity-heavy comments are rejected with HTTP 400.
- **Peer Moderation**:
  - Citizens can flag comments via `POST /comments/{comment_id}/flag`.
  - Comments receiving 3+ flags are automatically hidden from public view.
- **Anonymity Rule Enforcement**:
  - If a cluster belongs to `safety_concern` or the comment has `is_anonymous: true`, the author is strictly output as `"Anonymous Resident"` and `user_id` is stripped.

---

### Part 6 — Contextual In-App Store Review Prompts

**Motivation**: Elicits organic 5-star app store ratings at genuine positive moments rather than annoying users arbitrarily.

- **Implementation**: [storeReview.ts](file:///d:/MapMyCity/crowdsense-app/src/services/storeReview.ts) using standard platform In-App Review APIs (`expo-store-review`).
- **Strict Throttling & Rate Limits**:
  - **No First/Second Session Prompts**: Requires minimum 3 distinct app sessions (`sessionCount >= 3`).
  - **90-Day Hard Cooldown**: Maximum once every 90 days.
- **Trigger Moments**:
  1. `report_resolved`: Triggered in [ClusterDetailScreen.tsx](file:///d:/MapMyCity/crowdsense-app/src/screens/ClusterDetailScreen.tsx) when viewing an issue marked resolved.
  2. `impact_milestone`: Triggered when reaching key milestones on the impact screen.

---

### Part 5 — Social Sign-In (Google & Apple) Coexistence

**Motivation**: Lowers sign-up friction for smartphone users while preserving the phone-OTP flow as the primary option for broad demographic reach.

- **Schema Evolution**:
  - `users.auth_provider`: `'phone_otp' | 'google' | 'apple'`
  - `users.external_id`: Provider-specific unique subject identifier.
  - `users.display_name` & `users.email`: Social profile metadata.
  - `users.phone_hash`: Set to nullable for pure social sign-ins.
- **Graceful Capability Gaps**:
  - Social accounts without a linked phone number carry `has_sms_alerts: false`.
  - In-app civic reporting, voting, and discussion work seamlessly; SMS-fallback hazard broadcast alerts explain that a phone number is required for SMS delivery.

---

### Part 3 — Shareable Social Impact Cards

**Motivation**: Drives viral organic user growth via WhatsApp Status and Instagram Stories (9:16 aspect ratio), where Indian consumer sharing predominantly occurs.

- **Component**: [SocialImpactShareModal.tsx](file:///d:/MapMyCity/crowdsense-app/src/components/SocialImpactShareModal.tsx) & [impactCardGenerator.ts](file:///d:/MapMyCity/crowdsense-app/src/services/impactCardGenerator.ts).
- **Two Sharing Moments**:
  1. **Resolved Issue**: Highlighting municipal action (*"This pothole got fixed! 🎉 BBMP Action Verified"*).
  2. **Monthly Civic Digest**: Highlighting citizen contribution (*"I helped resolve 14 issues this month • 94% Trust Score • 6 Week Streak"*).
- **Native Share Sheet**:
  - Generates pre-formatted captions and deep links to `https://mapmycity.org/c/{clusterId}`.
  - Strictly respects safety anonymity by redacting exact coordinates and names for safety reports.

---

### Part 4 — Offline Map Area Download

**Motivation**: Enables citizens with unstable connectivity or limited data to inspect and navigate neighborhood road issues entirely offline.

- **Implementation**: [offlineMapManager.ts](file:///d:/MapMyCity/crowdsense-app/src/services/offlineMapManager.ts).
- **Neighborhood Packages**:
  - Pre-packaged ward footprints (e.g., Bengaluru East Ward 12, Indiranagar Ward 80, Koramangala Ward 151, Whitefield Ward 84) with visible size estimates (9.8 MB – 16.5 MB).
- **Storage Lifecycle & Transparency**:
  - Integrated directly into the storage usage section of [ProfileSettingsScreen.tsx](file:///d:/MapMyCity/crowdsense-app/src/screens/ProfileSettingsScreen.tsx).
  - Displays visible "Last updated" timestamps, manual one-tap refresh actions, and immediate delete actions to reclaim storage.

---

### Part 1 & Part 2 — Home Screen Widgets & App Icon Shortcuts

**Motivation**: Cuts reporting latency to under 3 seconds by bypassing home tabs.

- **App Icon Long-Press Shortcuts** ([quickActions.ts](file:///d:/MapMyCity/crowdsense-app/src/services/quickActions.ts)):
  1. **Report an issue** (`crowdsense://report` -> camera capture flow)
  2. **Explore Map** (`crowdsense://map` -> map tab)
  3. **My Reports** (`crowdsense://my_reports` -> submissions tab)
- **Home Screen Widgets** ([widgetBridge.ts](file:///d:/MapMyCity/crowdsense-app/src/services/widgetBridge.ts)):
  1. **Quick-Launch Widget**: 1x1 single-tap camera launcher.
  2. **Nearby Issues Glance Widget**: 2x2 or 4x2 widget displaying open hazard count in the user's ward. Reads from local cache without making unrequested network calls.
- **Expo SDK 54 Workflow Notes**:
  - iOS Widgets utilize `@bacons/apple-targets` with Swift SwiftUI widget definitions sharing `group.com.crowdsense.app` AppGroup UserDefaults.
  - Android Widgets utilize native `AppWidgetProvider` via config plugin.

---

### Part 7 — Physical QR-Code Municipal Asset Tagging

**Motivation**: Allows municipal field workers to affix durable QR stickers to physical street furniture (streetlights, waste bins, bus shelters, storm drains). Citizens scanning the tag skip manual location pinning entirely.

- **Admin Portal**:
  - New **"Municipal QR Asset Tags"** tab in [crowdsense-admin/src/app/page.tsx](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx).
  - Register new municipal assets with stable identifier code (e.g., `SL-BLR-5402`), ward, coordinates, and category preset (`street_lighting`, `garbage_dump`, `accessibility`, `utility_outage`).
  - Printable QR sticker preview and batch generator with standard municipal branding.
  - Per-asset report history audit trail to monitor maintenance history over time.
- **Client App Deep Link & Capture Ingest**:
  - Scans parse `https://mapmycity.org/report?asset_id=SL-BLR-5402&category=street_lighting&lat=12.9716&lng=77.5946`.
  - [CaptureScreen.tsx](file:///d:/MapMyCity/crowdsense-app/src/screens/CaptureScreen.tsx) automatically pre-fills category, coordinates, and stores `asset_id`.
  - [localQueue.ts](file:///d:/MapMyCity/crowdsense-app/src/services/localQueue.ts) and backend `/submissions` record `asset_id` against the report.

> [!WARNING]
> ### Rollout & Real-World Pilot Dependency: Physical QR Tagging
> While the software implementation (admin generator, API contracts, client scanner, and submission database tracking) is 100% complete and tested in code, **real-world deployment of Part 7 requires a Municipal Partnership Pilot**. Physical outdoor weather-proof stickers must be printed, geo-tagged, and affixed to physical assets by municipal field maintenance staff before citizen scans can occur in the physical world.

---

## Verification & Test Matrix

1. **Backend FastAPI Endpoints**:
   - `POST /auth/social/verify`: Verified with Google and Apple mock providers.
   - `GET /clusters/{cluster_id}/comments`: Verified anonymity masking and PII sanitization.
   - `POST /clusters/{cluster_id}/comments`: Verified text profanity filter and auto-redaction.
   - `POST /comments/{comment_id}/flag`: Verified auto-hiding after 3 flags.
   - `GET /admin/assets` & `POST /admin/assets`: Verified asset registration and report history queries.
2. **Client React Native Modules**:
   - Data Saver toggle and cellular auto-suggestion verified.
   - Offline area download, refresh, and storage calculation verified.
   - SocialImpactShareModal 9:16 story rendering verified.
   - Quick actions and widget cache synchronization verified.
