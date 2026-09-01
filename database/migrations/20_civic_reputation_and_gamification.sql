-- Migration 20: Civic Reputation, Contribution Score & Gamification System
--
-- PURPOSE:
-- 1. Introduces an append-only transaction ledger (civic_contribution_events) for verified civic value.
-- 2. Maintains independent separation between Trust Score (reliability) and Civic Score (participation value).
-- 3. Establishes configurable point rules, anti-gaming safeguards, and idempotency guarantees.
-- 4. Creates multi-tier badge progression (Bronze, Silver, Gold) and civic impact tracking.

-- 1. Create Contribution Point Rules Table
CREATE TABLE IF NOT EXISTS contribution_point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT UNIQUE NOT NULL,
    base_points INTEGER NOT NULL,
    daily_limit INTEGER DEFAULT 500,
    weekly_limit INTEGER DEFAULT 2500,
    minimum_trust DOUBLE PRECISION DEFAULT 0.50,
    verification_required BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Civic Contribution Events (Append-Only Ledger) Table
CREATE TABLE IF NOT EXISTS civic_contribution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    points INTEGER NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'REVERSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contrib_user_time ON civic_contribution_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_user_event ON civic_contribution_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_contrib_idempotency ON civic_contribution_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_contrib_status ON civic_contribution_events(status);

-- 3. Create Badges Registry Table
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    criteria_type TEXT NOT NULL,
    criteria_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create User Badges Table
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
    tier TEXT DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD')),
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, badge_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- 5. Create User Civic Profiles (Denormalized Rollup) Table
CREATE TABLE IF NOT EXISTS user_civic_profiles (
    user_id TEXT PRIMARY KEY,
    civic_score INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    reports_verified INTEGER DEFAULT 0,
    issues_confirmed INTEGER DEFAULT 0,
    evidence_accepted INTEGER DEFAULT 0,
    volunteer_tasks_completed INTEGER DEFAULT 0,
    surveys_completed INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    display_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_civic_score ON user_civic_profiles(civic_score DESC);

-- 6. Seed Point Economy Rules (Idempotent)
INSERT INTO contribution_point_rules (event_type, base_points, daily_limit, weekly_limit, minimum_trust, verification_required, enabled)
VALUES
('REPORT_VERIFIED', 100, 500, 2500, 0.50, TRUE, TRUE),
('ISSUE_CONFIRMED', 20, 200, 1000, 0.40, TRUE, TRUE),
('EVIDENCE_ACCEPTED', 30, 300, 1500, 0.50, TRUE, TRUE),
('ISSUE_RESOLUTION_VERIFIED', 50, 250, 1000, 0.60, TRUE, TRUE),
('VOLUNTEER_TASK_COMPLETED', 100, 400, 1500, 0.50, TRUE, TRUE),
('SURVEY_COMPLETED', 10, 50, 200, 0.30, TRUE, TRUE),
('FALSE_REPORT', -100, 1000, 5000, 0.0, FALSE, TRUE),
('POLICY_VIOLATION', -200, 1000, 5000, 0.0, FALSE, TRUE)
ON CONFLICT (event_type) DO NOTHING;

-- 7. Seed 8 Foundational Badges (Idempotent)
INSERT INTO badges (id, name, description, icon, category, criteria_type, criteria_config, active)
VALUES
('neighborhood_watch', 'Neighborhood Watch', 'Submit 10+ verified civic reports', '🏅', 'reporting', 'count_threshold', '{"metric": "reports_verified", "bronze": 10, "silver": 50, "gold": 100}'::jsonb, TRUE),
('road_guardian', 'Road Guardian', 'Submit 10+ verified road quality & pothole issues', '🛣', 'roads', 'count_threshold', '{"metric": "road_issues_verified", "bronze": 10, "silver": 50, "gold": 100}'::jsonb, TRUE),
('accessibility_champion', 'Accessibility Champion', 'Document 5+ verified accessibility audits & ramps', '♿', 'accessibility', 'count_threshold', '{"metric": "accessibility_verified", "bronze": 5, "silver": 25, "gold": 50}'::jsonb, TRUE),
('clean_city_champion', 'Clean City Champion', 'Resolve 10+ verified garbage & sanitation hazards', '🌱', 'cleanliness', 'count_threshold', '{"metric": "cleanliness_verified", "bronze": 10, "silver": 50, "gold": 100}'::jsonb, TRUE),
('evidence_expert', 'Evidence Expert', 'Provide 10+ accepted photo & sensor evidence logs', '📸', 'evidence', 'count_threshold', '{"metric": "evidence_accepted", "bronze": 10, "silver": 30, "gold": 60}'::jsonb, TRUE),
('community_helper', 'Community Helper', 'Provide 25+ validated community confirmations', '🤝', 'community', 'count_threshold', '{"metric": "issues_confirmed", "bronze": 25, "silver": 75, "gold": 150}'::jsonb, TRUE),
('resolution_verifier', 'Resolution Verifier', 'Perform 10+ verified resolution confirmation checks', '🔧', 'verification', 'count_threshold', '{"metric": "resolutions_verified", "bronze": 10, "silver": 30, "gold": 60}'::jsonb, TRUE),
('volunteer', 'Civic Volunteer', 'Complete 5+ verified NGO community missions', '🧹', 'volunteering', 'count_threshold', '{"metric": "volunteer_tasks_completed", "bronze": 5, "silver": 15, "gold": 30}'::jsonb, TRUE)
ON CONFLICT (id) DO NOTHING;
