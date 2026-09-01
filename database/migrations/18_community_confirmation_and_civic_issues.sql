-- Migration 18: Community Confirmation, Civic Issue Consensus & Evidence System
--
-- PURPOSE:
-- 1. Introduces canonical 'civic_issues' representing consolidated real-world defects.
-- 2. Tracks citizen confirmations (STILL_EXISTS, GETTING_WORSE, FIXED, NOT_PRESENT, ADDITIONAL_EVIDENCE).
-- 3. Implements independence-weighted community evidence and resolution dispute flags.
-- 4. Provides backward-compatible links to submissions, clusters, and sensor records.

-- 1. Create Canonical Civic Issues Table
CREATE TABLE IF NOT EXISTS civic_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    canonical_location geography(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'COMMUNITY_CONFIRMED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED_PENDING_VERIFICATION', 'VERIFIED_FIXED', 'REOPENED', 'RESOLVED')),
    severity_score DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (severity_score >= 1.0 AND severity_score <= 5.0),
    community_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (community_confidence >= 0.0 AND community_confidence <= 1.0),
    report_count INTEGER NOT NULL DEFAULT 1,
    unique_reporter_count INTEGER NOT NULL DEFAULT 1,
    confirmation_count INTEGER NOT NULL DEFAULT 0,
    still_exists_count INTEGER NOT NULL DEFAULT 0,
    getting_worse_count INTEGER NOT NULL DEFAULT 0,
    fixed_confirmation_count INTEGER NOT NULL DEFAULT 0,
    not_present_count INTEGER NOT NULL DEFAULT 0,
    additional_evidence_count INTEGER NOT NULL DEFAULT 0,
    passive_detection_count INTEGER NOT NULL DEFAULT 0,
    image_evidence_count INTEGER NOT NULL DEFAULT 0,
    disputed_resolution BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_count INTEGER NOT NULL DEFAULT 0,
    last_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial & Filter Indexes for Civic Issues
CREATE INDEX IF NOT EXISTS idx_civic_issues_location ON civic_issues USING GIST (canonical_location);
CREATE INDEX IF NOT EXISTS idx_civic_issues_category ON civic_issues(category);
CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON civic_issues(status);
CREATE INDEX IF NOT EXISTS idx_civic_issues_confidence ON civic_issues(community_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_civic_issues_disputed ON civic_issues(disputed_resolution);
CREATE INDEX IF NOT EXISTS idx_civic_issues_cluster_id ON civic_issues(cluster_id);
CREATE INDEX IF NOT EXISTS idx_civic_issues_updated_at ON civic_issues(updated_at DESC);

-- 2. Create Issue Reports Junction Table
CREATE TABLE IF NOT EXISTS issue_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    attached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (issue_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_submission_id ON issue_reports(submission_id);

-- 3. Create Community Confirmations Table
CREATE TABLE IF NOT EXISTS issue_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id TEXT NOT NULL,
    confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('STILL_EXISTS', 'GETTING_WORSE', 'FIXED', 'NOT_PRESENT', 'ADDITIONAL_EVIDENCE')),
    worsening_reason TEXT,
    comment TEXT,
    location geography(Point, 4326),
    distance_meters DOUBLE PRECISION,
    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_confirmations_issue_id ON issue_confirmations(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_confirmations_user_issue ON issue_confirmations(issue_id, user_id);
CREATE INDEX IF NOT EXISTS idx_issue_confirmations_device_issue ON issue_confirmations(issue_id, device_id);
CREATE INDEX IF NOT EXISTS idx_issue_confirmations_type ON issue_confirmations(confirmation_type);
CREATE INDEX IF NOT EXISTS idx_issue_confirmations_created_at ON issue_confirmations(created_at DESC);

-- 4. Create Issue Evidence Table
CREATE TABLE IF NOT EXISTS issue_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    confirmation_id UUID REFERENCES issue_confirmations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id TEXT,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('IMAGE', 'VIDEO', 'VOICE', 'PASSIVE_SENSOR', 'TEXT', 'CONFIRMATION')),
    media_url TEXT,
    description TEXT,
    location geography(Point, 4326),
    p_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_evidence_issue_id ON issue_evidence(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_evidence_type ON issue_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_issue_evidence_submission ON issue_evidence(submission_id);

-- 5. Create Issue Followers Table (Subscription / Notifications)
CREATE TABLE IF NOT EXISTS issue_followers (
    issue_id UUID NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_followers_user_id ON issue_followers(user_id);

-- 6. Backfill existing clusters into civic_issues (Idempotent initial population)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clusters') THEN
        INSERT INTO civic_issues (
            cluster_id,
            category,
            canonical_location,
            latitude,
            longitude,
            status,
            report_count,
            unique_reporter_count,
            created_at,
            updated_at
        )
        SELECT 
            c.id AS cluster_id,
            c.mission_type AS category,
            c.centroid AS canonical_location,
            ST_Y(c.centroid::geometry) AS latitude,
            ST_X(c.centroid::geometry) AS longitude,
            CASE 
                WHEN c.status = 'resolved' THEN 'VERIFIED_FIXED'
                WHEN c.submission_count >= 3 THEN 'COMMUNITY_CONFIRMED'
                ELSE 'NEW'
            END AS status,
            COALESCE(c.submission_count, 1) AS report_count,
            GREATEST(1, COALESCE(c.submission_count, 1)) AS unique_reporter_count,
            c.first_reported_at AS created_at,
            c.last_reported_at AS updated_at
        FROM clusters c
        WHERE NOT EXISTS (
            SELECT 1 FROM civic_issues ci WHERE ci.cluster_id = c.id
        );

        -- Map submissions into issue_reports and issue_evidence
        INSERT INTO issue_reports (issue_id, submission_id, attached_at)
        SELECT ci.id, s.id, s.submitted_at
        FROM submissions s
        JOIN civic_issues ci ON ci.cluster_id = s.cluster_id
        WHERE NOT EXISTS (
            SELECT 1 FROM issue_reports ir WHERE ir.submission_id = s.id
        );

        -- Populate initial image evidence
        INSERT INTO issue_evidence (issue_id, submission_id, device_id, evidence_type, media_url, p_hash, created_at)
        SELECT ci.id, s.id, s.device_id, 'IMAGE', s.photo_url, s.p_hash, s.submitted_at
        FROM submissions s
        JOIN civic_issues ci ON ci.cluster_id = s.cluster_id
        WHERE s.photo_url IS NOT NULL AND s.photo_url != ''
        AND NOT EXISTS (
            SELECT 1 FROM issue_evidence ie WHERE ie.submission_id = s.id
        );
    END IF;
END $$;
