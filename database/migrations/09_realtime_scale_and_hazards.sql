-- Migration 09: Real-Time Engagement, Cluster Timeline, Social Layer, Live Hazards & Feature Flags

-- 1. Cluster Status Events Table (Status History Timeline)
CREATE TABLE IF NOT EXISTS cluster_status_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by_role TEXT DEFAULT 'moderator' CHECK (changed_by_role IN ('citizen', 'moderator', 'municipal_partner'))
);

CREATE INDEX IF NOT EXISTS idx_cluster_status_events_cluster_id ON cluster_status_events(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_status_events_changed_at ON cluster_status_events(changed_at);

-- 2. Cluster Subscriptions Table ("Notify me" Notifications)
CREATE TABLE IF NOT EXISTS cluster_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_cluster_sub UNIQUE(user_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_subs_user_id ON cluster_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_cluster_subs_cluster_id ON cluster_subscriptions(cluster_id);

-- 3. Cluster Upvotes Table ("Me too, still an issue" Button)
CREATE TABLE IF NOT EXISTS cluster_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_cluster_upvote UNIQUE(user_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_upvotes_cluster_id ON cluster_upvotes(cluster_id);

-- 4. Live Hazards Table (Fast Photo-Free Flood & Public Safety Layer)
CREATE TABLE IF NOT EXISTS live_hazards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hazard_type TEXT NOT NULL CHECK (hazard_type IN ('waterlogging', 'road_closure', 'signal_down', 'fallen_tree', 'other')),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    reported_count INTEGER DEFAULT 1,
    first_reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 hours'),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_live_hazards_location ON live_hazards USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_live_hazards_expires_at ON live_hazards(expires_at);
CREATE INDEX IF NOT EXISTS idx_live_hazards_status ON live_hazards(status);

-- 5. Feature Flags Table (Staged Geographic & Ward Rollouts)
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    ward_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default feature flags
INSERT INTO feature_flags (flag_name, is_enabled) VALUES
    ('live_hazard_layer', true),
    ('status_timeline_v1', true),
    ('social_upvotes', true),
    ('presence_channels', true)
ON CONFLICT (flag_name) DO NOTHING;
