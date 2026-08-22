# FUTURE_BACKLOG.md — Speculative Feature Registry

> **How to use this file**: Before starting any part below, re-read its precondition and
> confirm in writing (in the PR description or sprint brief) that the precondition is **actually
> met with real signal** — not assumed or approximated. These are menus to revisit, not a queue
> to execute end-to-end.

---

## Part 1 — Multi-device Sync

| Field | Detail |
|---|---|
| **Precondition** | Real user feedback (support tickets, app-store reviews, in-app feedback) showing people are actively losing history when switching between two devices — e.g. shared family phone + personal phone, or a lost/replaced handset. |
| **Currently met?** | NO — As of the current build, the user base is in early growth; no multi-device loss has been reported. |
| **Signal to watch** | 10+ distinct support contacts citing cross-device continuity loss within any 60-day window, or a structured NPS-style survey result where 15%+ of respondents flag this as a pain point. |
| **What was built** | DB migration 14 (user_device_sessions table) + /users/{id}/sessions CRUD API + DeviceSessionsScreen in Settings. All code is behind a MULTI_DEVICE_ENABLED feature flag defaulting to false. |
| **Risk of building early** | Near-zero benefit if users have only one device; adds auth surface area for no gain. |

---

## Part 2 — Public Read-Only Data API (Researchers / Journalists)

| Field | Detail |
|---|---|
| **Precondition** | Defensible, real data volume: at minimum 500 verified submissions spread across 3+ cities or wards, covering 6+ months of history. Publishing an API over a near-empty dataset signals the project is hollow rather than building credibility. |
| **Currently met?** | NO — The platform is in early rollout. Data volume and city breadth are not yet sufficient for a credible public dataset. |
| **Signal to watch** | Supabase dashboard: submissions table crosses 500 rows with at least 3 distinct ward_id values and a date range span of 180+ days. Run: SELECT COUNT(*), COUNT(DISTINCT ward_id), MAX(created_at) - MIN(created_at) AS span FROM submissions; |
| **What was built** | Rate-limited /api/v1/public/ aggregate endpoints (never row-level), API key registration flow, and docs/public_api_openapi.yaml OpenAPI spec. Endpoints return HTTP 503 {"detail": "Precondition not met"} while PUBLIC_API_ENABLED env flag is false. |
| **Risk of building early** | An exposed API over near-empty data actively undermines credibility; press/researchers who find nothing there won't return. |

---

## Part 3 — Seasonal / Event-Based Campaign Banners

| Field | Detail |
|---|---|
| **Precondition** | At least one full annual cycle (12 months) of real submission data, so campaigns can be timed against observed spikes in your own dataset rather than generic calendar guesses. |
| **Currently met?** | NO — The platform does not yet have 12 months of continuous data in production. |
| **Signal to watch** | MAX(created_at) - MIN(created_at) >= INTERVAL '365 days' in the submissions table, AND at least one identifiable seasonal spike visible in a rolling 4-week moving average query. |
| **What was built** | campaigns DB table (title, body, active_from, active_until, category_filter, cta_deep_link) + admin CRUD endpoints + CampaignBanner React Native component (dismissible, not takeover). Seeded with a placeholder Monsoon Prep row marked active_from = NULL until real timing data is available. |
| **Risk of building early** | Campaigns timed off generic calendar dates feel spammy and miss actual local patterns. The infrastructure is ready to activate; just don't activate it yet. |

---

## Part 4 — Public Municipal SLA Dashboard

| Field | Detail |
|---|---|
| **Precondition** | At least one real, signed municipal partner with genuine resolution-tracking data over a meaningful period (3+ months of closed-loop resolution events). The entire page's credibility rests on the data being real and current. |
| **Currently met?** | NO — No signed MoU/partnership with any municipal body exists yet. |
| **Signal to watch** | A signed partnership agreement (MoU or equivalent) with a municipal body AND at least 90 days of resolution_events rows attributed to that ward/city in the DB. Never show SLA stats for a ward without a confirmed partner. |
| **What was built** | Public-facing Next.js page (/public/sla) in the admin dashboard showing per-ward resolution %, average resolution time, and active/resolved counts. Hard-coded guard: only renders wards where municipal_partners.is_active = true. |
| **Risk of building early** | Displaying SLA stats without a real partner implies official engagement that doesn't exist — potential legal/reputational risk. |

---

## Part 5 — Volunteer / NGO Task Board

| Field | Detail |
|---|---|
| **Precondition** | At least one active NGO or CSR partner already consuming accessibility-audit export data (from migration 10) AND that partner has expressed a specific need for directed task assignment. |
| **Currently met?** | NO — No NGO partnership is currently active around the accessibility audit export. |
| **Signal to watch** | A signed NGO/CSR partner MoU referencing the accessibility audit data feed, AND a written request from that partner asking for task assignment tooling. |
| **What was built** | audit_tasks table (partner_org_id, location_hint, task_type, status, claimed_by_user_id) + task board API endpoints + NGOTaskBoardScreen in the app. Completed tasks feed directly into accessibility_audits. TASK_BOARD_ENABLED flag defaults false. Badge recognition reuses existing gamification flow. |
| **Risk of building early** | An empty task board with no partner posting tasks has zero engagement; the UI becomes dead weight. |

---

## Part 6 — Cross-City Benchmarking View

| Field | Detail |
|---|---|
| **Precondition** | Genuinely multiple cities onboarded with comparable data — minimum 2 cities each with 200+ submissions and 3+ months of history. Raw comparisons across cities of very different size and density are misleading without normalization. |
| **Currently met?** | NO — Only one city/ward context is currently active. |
| **Signal to watch** | SELECT city_id, COUNT(*) FROM submissions GROUP BY city_id HAVING COUNT(*) >= 200 returns 2+ rows, each with MIN(created_at) at least 90 days in the past. |
| **What was built** | Public comparison view in admin dashboard (/public/benchmarks) showing resolution speed, volume, and category breakdown across cities. All comparisons normalize by reports_per_1000_population. Visible methodology caveat rendered in the UI. Gated on cities.is_benchmark_eligible = true, requiring manual admin opt-in per city. |
| **Risk of building early** | A single-city benchmarking view is nonsensical; a two-city view with non-comparable data is actively misleading. |

---

## Reviewing This Document

This file should be reviewed at the start of every quarterly planning cycle. For each part, run the Signal to watch query/check and update the Currently met? row. Only move a part from backlog to sprint once its precondition row changes to YES.

Last reviewed: 2026-08-22 — all 6 preconditions unmet.
