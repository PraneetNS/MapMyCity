# AI-Assisted Features Reference: Architecture, Compute Profiles & Municipal B2G Differentiation

MapMyCity layers specialized artificial intelligence across both edge devices (citizen smartphones) and the municipal administrative cloud. The architecture strictly enforces a **hybrid edge/cloud tiering strategy**: zero-cost on-device tiny models and deterministic heuristics run on every single capture without server overhead, while lightweight server-side AI calls and statistical batch jobs are reserved for high-leverage municipal intelligence.

---

## 1. Feature Architecture & Cost / Frequency Matrix

| Feature | Execution Tier | Engine / Model | Cost / Compute Profile | Frequency | B2G Sales Relevant? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. AI Moderator Triage Summaries** | Server-side | Structured LLM / Grounded NLP | Minimal (Cached Batch Job) | On cluster change / hourly sweep | 🌟 **Yes (Core B2G)** |
| **2. Issue Recurrence & Reopening Risk** | Server-side / Edge | Statistical Logistic Regression | Zero server LLM cost | On cluster change & at resolution | 🌟 **Yes (Core B2G)** |
| **3. Report Quality Assist** | On-Device (Edge) | Fast CV Heuristics (Laplacian / Luminance) | **Zero ($0.00)** | Every photo capture & category pick | No (Citizen UX) |
| **4. Low-Light Photo Enhancement** | On-Device (Edge) | Image Normalization / Contrast Equalizer | **Zero ($0.00)** | Automatic on dark / evening captures | Yes (Data Quality) |
| **5. Smart Activity Digest** | Server-side / Client | Deterministic Templated Natural Language | **Zero ($0.00)** | Weekly per active user | No (Engagement) |
| **6. Scoped FAQ Help Assistant** | On-Device / Client | Retrieval-Based Vector / Keyword Matching | **Zero ($0.00)** | On-demand in Help section | No (Support Deflection) |
| **7. Note Improvement Suggestion** | Server-side | Civic Domain Prompt / Phrasing Map | Low (Rate limited: max 10/hr/user) | Optional (Citizen taps "Improve") | Yes (Report Clarity) |
| **8. Community Consensus & Independence Scoring** | Server-side | Explainable Multi-Signal Recency Half-Life Model | **Zero ($0.00)** (Deterministic) | On confirmation / evidence intake | 🌟 **Yes (Core B2G)** |
| **9. Weather + Civic Flood Risk Engine** | Server-side | Open-Meteo + PostGIS Spatial Correlation | **Zero ($0.00)** (Free API + SQL) | Hourly forecast refresh, On-demand | 🌟 **Yes (Core B2G)** |
| **10. Civic Reputation & Gamification Engine** | Server-side | Append-only Ledger + Anti-Gaming Rules Engine | **Zero ($0.00)** (Deterministic SQL) | On verified civic event | 🌟 **Yes (Citizen Retention)** |

---

## 2. Deep Dive: High-Leverage Municipal B2G Features

### Part 1 — AI-Assisted Moderator Triage Summaries
- **Municipal Problem**: Municipal engineers and ward officers are overwhelmed by hundreds of raw photo submissions, making triage slow and error-prone.
- **How It Works**:
  - Automatically synthesizes cluster metadata into an authoritative, dense single sentence:
    - *Example*: `"Pothole: 12 reports (active for ~3 weeks), mostly night-time, near Indiranagar Metro school zone."`
  - **Zero Hallucination Guarantee**: Strictly grounded in verified cluster attributes (submission count, timestamps, category, night/day distribution, ward, and flagged anomalies).
  - **Batch Execution Architecture**: Runs as a background scheduled job with in-memory cluster caching (`_TRIAGE_SUMMARY_CACHE`). Never executes per-page-load, keeping cloud infrastructure costs constant regardless of dashboard traffic.
  - **Queue List Integration**: Surfaced directly in the main `crowdsense-admin` table view next to the Priority Score, allowing moderators to triage entire queues at a glance without opening tickets individually.

### Part 2 — Predictive "Issue Likely to Recur" Flag
- **Municipal Problem**: Municipalities waste millions patching the same pothole or clearing the same garbage blackspot 4–5 times a year because underlying structural causes (e.g. monsoon waterlogging or heavy axle loads) are ignored.
- **How It Works**:
  - Evaluates the reopening probability ($P \in [0.0, 1.0]$) using a statistical logistic regression scoring model combining:
    1. Historical reopen count in the same 20m spatial centroid
    2. Category-specific degradation baseline (e.g., asphalt vs. tactile paving)
    3. Spatial proximity to monsoon waterlogging corridors or heavy traffic corridors
    4. Vehicle jolt impact intensity from crowdsourced accelerometer sensors
  - **Resolution-Time Nudge**: When an administrator marks a cluster resolved, the system evaluates recurrence risk. If high risk ($\ge 65\%$), a prominent warning modal appears:
    - *"⚠️ Monitor this one — high recurrence risk (78% probability). Key factor: Active monsoon waterlogging corridor & heavy vehicle impact."*
  - **B2G Value Proposition**: Empowers city commissioners to audit contractor patch quality and mandate permanent engineering fixes rather than temporary superficial repairs.

---

## 3. On-Device Tiny AI & Computer Vision (Edge Tier)

### Part 3 — On-Device Report Quality Assist
- **Lightweight Edge Heuristics**: Runs immediately upon camera capture in `crowdsense-app/src/services/qualityAssist.ts`.
- **Checks Performed**:
  - **Darkness / Low-Light**: Fast luminance analysis detecting underexposed night captures.
  - **Blur & Distortion**: Aspect ratio and edge variance heuristics detecting rushed captures.
  - **Context Gaps**: Detects ambiguous broad categories (e.g., `"infrastructure"` or `"accessibility"`) submitted without explanatory notes.
- **Gentle UX Philosophy**: Always soft-suggests improvements with a clear **"Submit Anyway"** override. Never acts as a blocking gate that prevents urgent citizen reporting.

### Part 7 — On-Device Low-Light Photo Enhancement
- **Automatic Image Processing**: Implemented in `crowdsense-app/src/services/imageEnhancer.ts`.
- **Zero-Latency Pass**: Dark captures automatically undergo local contrast balancing and brightness normalization before being added to the local SQLite draft queue.
- **Benefits**: Ensures clear visibility for municipal field workers and eliminates unusable black photo submissions.

---

## 4. Engagement & Support Deflection AI

### Part 4 — Smart Activity Digest
- **Instant Natural Language Generation**: Upgrades raw event logs into a human-readable activity line in `backend-fastapi/services/smart_digest.py`.
- **Example Output**: `"2 reports fixed & resolved • 1 moved to in-progress in Ward 12 - Indiranagar. Top 5% active reporter • 6-week streak 🔥"`.
- **Cost**: $0.00 server cost using deterministic sentence templating.

### Part 5 — Optional Server-Side Note Improvement
- **Citizen Experience**: When typing short or fragmented descriptions, citizens can tap **"✨ Improve wording?"**.
- **Transformation**: Refines fragmented notes into standard municipal terminology (e.g. `"big hole in road"` $\rightarrow$ `"Road damage: deep crater approximately 2ft wide on main road causing severe traffic hazard"`).
- **Safety & Consent**: Shows an interactive popover where the user reviews and clicks **"Use This Phrasing"**; never auto-replaces text without consent.
- **Rate-Limiting**: Capped at 10 requests/hour/user to prevent abuse.

### Part 6 — Scoped FAQ Help Assistant
- **Retrieval-Based Architecture**: Implemented in `crowdsense-app/src/services/faqAssistant.ts`.
- **Curated Knowledge Base**: Pre-loaded with verified answers regarding clustering algorithms, DPDP Act 2023 compliance, offline syncing, and trust scores.
### Part 7 — Community Consensus & Evidence Independence Scoring
- **Municipal Problem**: Citizen issue reporting often suffers from either duplicate fatigue or single-user button spamming, making it difficult for city managers to discern actual severity and whether a defect is still present.
- **Explainable Multi-Signal Engine**: Computes canonical issue confidence ($0.0 \to 1.0$) combining:
  1. Independent reporter count (logarithmic saturation)
  2. Independent device confirmations with diminishing marginal returns per hardware ID
  3. Exponential recency decay with a 14-day half-life: $w(t) = \exp(-\frac{\ln 2}{14} \cdot \Delta t_{\text{days}})$
  4. Photo and accelerometer sensor corroboration
  5. Contradictory negative signal penalties (`NOT_PRESENT` / active `FIXED`)
- **Resolution Dispute Detection**: When an issue is marked resolved, subsequent citizen `STILL_EXISTS` confirmations trigger automated dispute flags and reopen the issue for verification.

### Part 8 — Weather + Civic Intelligence & Predictive Flood Risk
- **Civic Problem**: Weather forecasts alone do not tell city managers or citizens *which specific streets and underpasses* will fail during rainfall.
- **Explainable Multi-Layer Correlation**:
  1. Live Open-Meteo precipitation forecast (volume and hourly peak intensity).
  2. PostGIS spatial historical defect records (past waterlogging and open drainage bottlenecks).
  3. Dynamic location-specific critical rainfall thresholds (18–25mm for chronic low points).
  4. Explainable composite risk formula ($0.0 \to 1.0$) with discrete levels (`LOW`, `MEDIUM`, `HIGH`, `EXTREME`).
  5. AI-generated municipal preventive action recommendations (pump pre-positioning, culvert desilting, traffic diversions).
  6. Citizen Route Risk checking overlay simulating travel path crossings with chronic flood hotspots.

---

## 5. Security, Privacy & DPDP Act 2023 Compliance

- **No PII Sent to External AI**: User identifiers, phone hashes, and exact home coordinates are stripped before any server AI or summary task.
- **Women's Safety Reports**: Anonymized at capture time; excluded from external indexing.
- **Local-First Processing**: Image quality checks, NSFW filtering, and category validation execute 100% on-device before any network transmission.

---

## Part 9 — Civic Reputation, Contribution Score & Gamification System

- **Municipal Problem**: Citizens submit reports but receive no feedback on their real-world impact, leading to disengagement and declining long-term platform retention.
- **Core Design Principle** — Strict Score Separation:
  - **Trust Score** (`0.0 → 1.0`): Reflects submission *accuracy and reliability* (EXIF validity, pHash deduplication, moderation history). Existing system, unchanged.
  - **Civic Contribution Score** (`Integer Points + Level 1–8`): Reflects *verified civic value created* (confirmed pothole fixes, resolved water outages, accepted photo evidence). Entirely new system.
  - A user can have high trust with low contribution (accurate but rare submitter) or high contribution with moderate trust (active verified volunteer). These scores must never be merged or substituted.
- **How It Works**:
  - All point events are recorded in an **append-only `civic_contribution_events` ledger** — points are never mutated directly.
  - Idempotency key (`event_type:ref_type:ref_id:user_id`) prevents double-rewarding the same verified action.
  - Daily caps (500 pts/day) and trust gating (≥ 0.50 minimum trust) prevent gaming.
  - Reversals (`POINT_REVERSAL`) and admin corrections (`ADMIN_ADJUSTMENT`) are recorded as new ledger entries preserving full audit history.
  - 8-badge registry with Bronze → Silver → Gold tier progression unlocked by category-specific verified action thresholds.
- **Point Economy** (configurable via `contribution_point_rules` table):
  - `REPORT_VERIFIED` → +100 pts
  - `ISSUE_CONFIRMED` → +20 pts (community corroboration)
  - `EVIDENCE_ACCEPTED` → +30 pts (photo evidence validated)
  - `ISSUE_RESOLUTION_VERIFIED` → +50 pts (closed issue confirmed resolved)
  - `VOLUNTEER_TASK_COMPLETED` → +100 pts (NGO mission)
  - `SURVEY_COMPLETED` → +10 pts
  - `FALSE_REPORT` → −100 pts (anti-gaming)
- **Compute Profile**: Zero external AI cost. Entirely deterministic SQL + Python rules engine.
- **Admin Governance**: Dedicated dashboard tab with economy health KPIs, point rules configuration table, and auditable reward reversal tooling.
- **Citizen UX**: Full `CivicProfileScreen` with Trust vs Civic score cards, badge showcase, real-world impact milestones, and filterable ledger history.
