-- Migration 23: Community Cluster Comments, Moderation & Physical Civic Asset QR Tagging
-- Enables hyper-local resident dialogue around verified defect clusters
-- and physical QR/NFC infrastructure asset registration and field inspection tracking.

-- 1. Cluster Community Comments table
CREATE TABLE IF NOT EXISTS cluster_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(128) NOT NULL DEFAULT 'Resident',
    body TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    flag_count INTEGER NOT NULL DEFAULT 0,
    upvotes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FLAGGED', 'HIDDEN', 'REMOVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Civic Asset Tags table (Physical QR / NFC municipal infrastructure registry)
CREATE TABLE IF NOT EXISTS civic_asset_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code VARCHAR(64) UNIQUE NOT NULL,
    asset_type VARCHAR(48) NOT NULL, -- 'streetlight', 'manhole', 'traffic_signal', 'transformer', 'water_hydrant', 'bus_shelter', 'storm_drain'
    ward_id VARCHAR(64) NOT NULL,
    location_description TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    qr_payload TEXT NOT NULL,
    qr_verification_token VARCHAR(64) NOT NULL,
    department VARCHAR(64) NOT NULL DEFAULT 'BBMP_CIVIC_WORKS',
    installation_year INTEGER DEFAULT 2022,
    last_inspected_at TIMESTAMPTZ,
    health_status VARCHAR(24) NOT NULL DEFAULT 'OPERATIONAL' CHECK (health_status IN ('OPERATIONAL', 'DEGRADED', 'FAULTY', 'HAZARDOUS', 'DECOMMISSIONED')),
    active_cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Civic Asset Inspections table
CREATE TABLE IF NOT EXISTS asset_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag_id UUID REFERENCES civic_asset_tags(id) ON DELETE CASCADE,
    inspector_id VARCHAR(64) NOT NULL DEFAULT 'citizen',
    inspector_role VARCHAR(32) NOT NULL DEFAULT 'citizen' CHECK (inspector_role IN ('citizen', 'contractor', 'ward_engineer', 'auditor')),
    condition_rating INTEGER NOT NULL CHECK (condition_rating BETWEEN 1 AND 5),
    reported_defect VARCHAR(64),
    notes TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid spatial queries and moderation lookup
CREATE INDEX IF NOT EXISTS idx_cluster_comments_cluster_id ON cluster_comments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_comments_created ON cluster_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cluster_comments_status ON cluster_comments(status);

CREATE INDEX IF NOT EXISTS idx_civic_asset_code ON civic_asset_tags(asset_code);
CREATE INDEX IF NOT EXISTS idx_civic_asset_ward ON civic_asset_tags(ward_id);
CREATE INDEX IF NOT EXISTS idx_civic_asset_type ON civic_asset_tags(asset_type);
CREATE INDEX IF NOT EXISTS idx_civic_asset_health ON civic_asset_tags(health_status);
CREATE INDEX IF NOT EXISTS idx_asset_inspections_tag ON asset_inspections(asset_tag_id);
