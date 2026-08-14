-- Migration 10: New Issue Categories - Women's Safety, Accessibility Audits & Utility Outages

-- 1. Update submissions.mission_type CHECK constraint to include safety_concern
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_mission_type_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_mission_type_check 
    CHECK (mission_type IN ('pothole', 'garbage', 'noise', 'accessibility', 'infrastructure', 'passive_road_quality', 'safety_concern'));

-- 2. Accessibility Audits Table (Structured NGO/CSR Audit Data)
CREATE TABLE IF NOT EXISTS accessibility_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    location_type TEXT NOT NULL CHECK (location_type IN ('public_building', 'transit_stop', 'footpath', 'public_toilet', 'other')),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('missing_ramp', 'broken_ramp', 'broken_lift', 'no_accessible_toilet', 'blocked_pathway', 'no_tactile_paving', 'other')),
    severity TEXT NOT NULL CHECK (severity IN ('blocks_access_entirely', 'makes_access_difficult')),
    audit_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_audits_submission_id ON accessibility_audits(submission_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_audits_location_type ON accessibility_audits(location_type);
CREATE INDEX IF NOT EXISTS idx_accessibility_audits_issue_type ON accessibility_audits(issue_type);

-- 3. Utility Status Reports Table (Live Service Disruption Overlay)
CREATE TABLE IF NOT EXISTS utility_status_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    utility_type TEXT NOT NULL CHECK (utility_type IN ('water', 'power')),
    status TEXT NOT NULL CHECK (status IN ('outage', 'restored', 'scheduled_disruption')),
    ward_id TEXT DEFAULT 'ward_12',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 hours')
);

CREATE INDEX IF NOT EXISTS idx_utility_reports_ward_id ON utility_status_reports(ward_id);
CREATE INDEX IF NOT EXISTS idx_utility_reports_utility_type ON utility_status_reports(utility_type);
CREATE INDEX IF NOT EXISTS idx_utility_reports_expires_at ON utility_status_reports(expires_at);
