-- Migration 15: Campaigns, Partner Orgs, and NGO Audit Tasks (Parts 3 & 5)
--
-- PRECONDITION GATES:
--   Part 3 (campaigns): Activate only after 12 months of real submission data.
--     Seed rows have active_from = NULL as a hard off-switch.
--   Part 5 (audit_tasks): Activate only once an NGO partner has signed an MoU
--     referencing the accessibility audit data and requested task assignment.
--     Gated behind TASK_BOARD_ENABLED env flag in the API layer.
--
-- Both tables are additive and safe to migrate at any time.

-- 1. Partner Organisations registry (shared by Parts 4, 5, 6)
CREATE TABLE IF NOT EXISTS partner_organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    org_type TEXT NOT NULL CHECK (org_type IN ('municipal', 'ngo', 'csr', 'research')),
    city TEXT,
    ward_ids TEXT[],                              -- wards this partner covers
    contact_email TEXT,
    is_active BOOLEAN DEFAULT FALSE,             -- must be manually set TRUE per FUTURE_BACKLOG Part 4
    is_benchmark_eligible BOOLEAN DEFAULT FALSE, -- Part 6 opt-in per city
    signed_mou_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_orgs_city ON partner_organisations(city);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_is_active ON partner_organisations(is_active);

-- 2. Campaigns table (Part 3 — seasonal/event-based in-app banners)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    -- active_from / active_until NULL means "not yet scheduled — precondition not met"
    active_from TIMESTAMP WITH TIME ZONE,
    active_until TIMESTAMP WITH TIME ZONE,
    -- category_filter: only show to users who submitted this category recently, NULL = show all
    category_filter TEXT CHECK (
        category_filter IS NULL OR
        category_filter IN ('pothole','garbage','noise','accessibility',
                           'infrastructure','passive_road_quality','safety_concern')
    ),
    cta_deep_link TEXT,                          -- e.g. "mapmycity://capture?category=infrastructure"
    is_dismissible BOOLEAN DEFAULT TRUE,         -- always true; full-screen takeovers reserved for hazard alerts
    target_ward_ids TEXT[],                      -- NULL = platform-wide
    created_by_admin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active_from ON campaigns(active_from);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_until ON campaigns(active_until);

-- Seed: placeholder Monsoon Prep campaign with NULL dates as hard off-switch.
-- Enable once 12 months of data confirms the timing (FUTURE_BACKLOG.md Part 3).
INSERT INTO campaigns (title, body, active_from, active_until, category_filter, cta_deep_link, created_by_admin)
VALUES (
    'Monsoon Prep — Report Before the Rains',
    'Help your ward get ahead of the monsoon. Report waterlogging spots, blocked drains, and broken roads now so civic teams can act before the season starts.',
    NULL,   -- Set once historical data confirms timing
    NULL,   -- Set once historical data confirms timing
    'infrastructure',
    'mapmycity://capture?category=infrastructure&hint=monsoon',
    'system_seed'
) ON CONFLICT DO NOTHING;

-- 3. NGO Audit Tasks table (Part 5 — Volunteer/NGO Task Board)
CREATE TABLE IF NOT EXISTS audit_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organisations(id) ON DELETE CASCADE,
    location_hint TEXT NOT NULL,                 -- Human-readable area e.g. "Near Andheri Station Gate 3"
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    task_type TEXT NOT NULL CHECK (
        task_type IN ('accessibility_audit', 'safety_audit', 'utility_check', 'road_quality_spot')
    ),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'cancelled')),
    claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- Links directly into accessibility_audits once completed:
    resulting_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    notes TEXT,                                  -- Partner instructions for the volunteer
    badge_awarded BOOLEAN DEFAULT FALSE,         -- Whether the completion badge was issued
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tasks_partner_org ON audit_tasks(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_status ON audit_tasks(status);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_claimed_by ON audit_tasks(claimed_by_user_id);

-- 4. User badges table (shared gamification — reused by Part 5 task completion)
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL CHECK (
        badge_type IN (
            'first_report', 'ten_reports', 'fifty_reports',
            'accessibility_champion',  -- 5+ accessibility audits
            'ngo_task_completer',      -- Completed a partner-posted task
            'monsoon_reporter',        -- Campaign badge
            'safety_guardian'          -- 3+ safety concern reports
        )
    ),
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_task_id UUID REFERENCES audit_tasks(id) ON DELETE SET NULL,
    UNIQUE (user_id, badge_type)       -- One badge per type per user
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_type ON user_badges(badge_type);
