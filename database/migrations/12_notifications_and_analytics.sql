-- Migration 12: In-App Notifications and Personal Analytics
-- Creates notifications table to guarantee reliable in-app alert delivery across all Android OEM skins.

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'status_change', 'reply', 'digest', 'hazard_alert', 'system'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    related_cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indices for instant unread badge count and chronological inbox feeds
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
