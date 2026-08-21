-- Migration 13: Cluster Comments, Social Auth Providers, and Municipal QR Asset Tagging

-- 1. Extend Users table for Social Sign-In (Google & Apple)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'auth_provider'
    ) THEN
        ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'phone_otp';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE users ADD COLUMN external_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email TEXT;
    END IF;

    -- Make phone_hash nullable for social sign-in users
    ALTER TABLE users ALTER COLUMN phone_hash DROP NOT NULL;
END $$;

-- 2. Extend Submissions table for Asset Tagging (QR Code physical tag support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' AND column_name = 'asset_id'
    ) THEN
        ALTER TABLE submissions ADD COLUMN asset_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_submissions_asset_id ON submissions(asset_id);
    END IF;
END $$;

-- 3. Create Municipal Assets Registry Table
CREATE TABLE IF NOT EXISTS municipal_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT UNIQUE NOT NULL,
    asset_type TEXT NOT NULL, -- 'streetlight', 'waste_bin', 'bus_shelter', 'storm_drain', 'transformer'
    ward_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    category_preset TEXT NOT NULL, -- 'street_lighting', 'garbage_dump', 'accessibility', 'utility_outage'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_municipal_assets_code ON municipal_assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_municipal_assets_ward ON municipal_assets(ward_name);

-- 4. Create Cluster Comments Table (Discussion Thread on Clusters)
CREATE TABLE IF NOT EXISTS cluster_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Civic Resident',
    body TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_comments_cluster_id ON cluster_comments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_comments_created_at ON cluster_comments(created_at);

-- 5. Create Comment Flagging Table (Peer Moderation)
CREATE TABLE IF NOT EXISTS comment_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID REFERENCES cluster_comments(id) ON DELETE CASCADE,
    reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'misinformation', 'harassment', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_flags_comment_id ON comment_flags(comment_id);
