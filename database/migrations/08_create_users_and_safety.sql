-- Migration 08: Create users, consent tracking, and peer safety tables

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (Phone-based Auth & Reputation)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_hash TEXT UNIQUE NOT NULL,
    device_id TEXT REFERENCES devices(device_id) ON DELETE SET NULL,
    is_banned BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    suspended_until TIMESTAMP WITH TIME ZONE,
    trust_score DOUBLE PRECISION DEFAULT 0.5,
    content_violations_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- 2. User Consent Tracking Table (India IT Rules 2021 Compliance)
CREATE TABLE IF NOT EXISTS user_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tos_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id);

-- 3. Peer Reports Table (Community Flagging & Safety Net)
CREATE TABLE IF NOT EXISTS peer_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('not_real', 'inappropriate', 'duplicate', 'targets_person_property')),
    flag_credibility_weight DOUBLE PRECISION DEFAULT 1.0,
    status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'actioned', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_reports_submission_id ON peer_reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_peer_reports_status ON peer_reports(status);

-- Add user_id reference column to submissions table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE submissions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        CREATE INDEX idx_submissions_user_id ON submissions(user_id);
    END IF;
END $$;
