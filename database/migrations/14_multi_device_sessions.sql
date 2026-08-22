-- Migration 14: Multi-device session management (Part 1 — Multi-device Sync)
--
-- PRECONDITION GATE: This migration is safe to run at any time — tables are
-- additive. However the feature endpoints are gated behind MULTI_DEVICE_ENABLED
-- env flag which defaults to FALSE until the precondition in FUTURE_BACKLOG.md
-- Part 1 is confirmed met.

-- 1. User Device Sessions table: one row per active session across all devices.
--    A single user can have multiple concurrent sessions on different devices.
CREATE TABLE IF NOT EXISTS user_device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,            -- SHA-256 of (device_model + os_version + install_id)
    device_label TEXT,                           -- User-friendly label e.g. "Praneet's Pixel 7"
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    app_version TEXT,
    push_token TEXT,                             -- FCM / APNs token for this session
    session_token TEXT UNIQUE NOT NULL,          -- Opaque session token stored in device keychain
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE          -- Set on remote sign-out
);

CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user_id ON user_device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_sessions_session_token ON user_device_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_device_sessions_is_active ON user_device_sessions(is_active);

-- 2. Synced history mirror: completed/synced drafts stored server-side so they
--    are visible across devices. Drafts in-progress remain device-local (SQLite
--    queue) — only synced status submissions reach this table.
CREATE TABLE IF NOT EXISTS user_synced_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    local_draft_id TEXT NOT NULL,               -- Device-local SQLite rowid
    mission_type TEXT NOT NULL,
    summary TEXT,                               -- Human-readable short description
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    origin_device_fingerprint TEXT              -- Which device originated the submission
);

CREATE INDEX IF NOT EXISTS idx_user_synced_history_user_id ON user_synced_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_synced_history_synced_at ON user_synced_history(synced_at);

-- 3. Helper: automatically mark session as seen on any activity
CREATE OR REPLACE FUNCTION touch_device_session(p_session_token TEXT)
RETURNS VOID AS \$\$
BEGIN
    UPDATE user_device_sessions
    SET last_seen_at = NOW()
    WHERE session_token = p_session_token AND is_active = TRUE;
END;
\$\$ LANGUAGE plpgsql;
