# New Issue Categories & Data Models (`NEW_CATEGORIES.md`)

This document details the three specialized reporting domains added to **MapMyCity (CrowdSense)** beyond physical infra: **Women's Safety Mapping**, **Structured Accessibility Audits**, and **Live Utility Outage Tracking**.

---

## 🛡️ Domain Models & Privacy Comparison

| Category | Mission Type | Photo Policy | Privacy Model | Moderation Pipeline | Output View |
|---|---|---|---|---|---|
| **Women's Safety** | `safety_concern` | **Optional** | **Anonymous by Default** (Server stores identity for abuse check only; stripped from APIs) | Standard Tier-0 | Heatmap Layer + Municipal Safety Queue |
| **Accessibility Audits** | `accessibility` | **Required** | Public Audit | Standard Tier-0 + Sightengine | Accessibility Map + NGO/CSR Export Endpoint |
| **Utility Outages** | N/A (`utility_status_reports`) | **Photo-Free** | Public Zone Level | **Lightweight Fast Path** (Bypasses Tier-0 & Sightengine) | Ward Overlay Widget (Red/Yellow/Green) |

---

## 1. Women's Safety Mapping (`safety_concern`)

### Privacy & Anonymity Architecture
- **No Identity Leakage**: Public API responses (`GET /submissions`, `GET /clusters`) run through strict anonymization filters ([`serialize_row`](file:///d:/MapMyCity/backend-fastapi/main.py)), converting `device_id` and `user_id` to `"ANONYMOUS_REPORTER"`.
- **Photo-Optional**: Requiring photos of dark or unsafe stretches places citizens at physical risk. Citizens can file reports with GPS location, safety sub-type (`poor_lighting`, `broken_streetlight`, `isolated_stretch`, `harassment_hotspot`), and optional text/voice note.
- **Heatmap Layer Rendering**: Rather than pinpointing exact coordinates (which could reveal a citizen's personal daily route), safety concerns render as a density **Heatmap Layer** on the public map.
- **Municipal Priority Dispatch**: Safety concerns are surfaced in a dedicated priority queue in [`crowdsense-admin`](file:///d:/MapMyCity/crowdsense-admin/src/app/page.tsx) routing directly to street lighting & safety departments.

---

## 2. Structured Accessibility Audits (`accessibility_audits`)

### Data Schema & NGO/CSR Export
The flat `accessibility` category is converted into a structured audit dataset:
- `location_type`: `public_building`, `transit_stop`, `footpath`, `public_toilet`, `other`.
- `issue_type`: `missing_ramp`, `broken_ramp`, `broken_lift`, `no_accessible_toilet`, `blocked_pathway`, `no_tactile_paving`, `other`.
- `severity`: `blocks_access_entirely` / `makes_access_difficult`.

### Standalone Export Endpoint for Partner Organizations
Advocacy groups and NGO partners can download the full structured audit dataset directly via the export endpoint:
- **CSV Format**: `GET http://127.0.0.1:8000/exports/accessibility-audit?format=csv`
- **JSON Format**: `GET http://127.0.0.1:8000/exports/accessibility-audit?format=json`

---

## 3. Utility Disruption Tracking (`utility_status_reports`)

### Live Service Status Layer
- **Zone-Level Aggregation**: Service status (`water`, `power`) is aggregated by ward/pincode rather than discrete point pins.
- **Fast, Photo-Free Pipeline**: Outage reports bypass image moderation and Tier-0 pipelines, returning sub-50ms HTTP responses.
- **Auto-Expiry & Community Closing**: Outages automatically decay after 3 hours unless re-confirmed. A `restored` status report closes active outage alerts.
- **Live Ward Overlay**: Rendered on the map as a status widget (Red = Outage, Yellow = Scheduled Disruption, Green = Normal).
