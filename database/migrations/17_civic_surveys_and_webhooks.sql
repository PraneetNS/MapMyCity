-- Migration 17: Civic Satisfaction Surveys, Sentiment Tracking & Municipal Partner Webhooks

-- 1. Civic Surveys & Resolution Feedback Table
CREATE TABLE IF NOT EXISTS civic_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    ward_id TEXT NOT NULL,
    category TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    aspects TEXT[] DEFAULT '{}',
    feedback_text TEXT,
    resolution_speed_rating INTEGER CHECK (resolution_speed_rating >= 1 AND resolution_speed_rating <= 5),
    workmanship_rating INTEGER CHECK (workmanship_rating >= 1 AND workmanship_rating <= 5),
    sentiment_score REAL CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Partner Webhooks Table
CREATE TABLE IF NOT EXISTS partner_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    secret_token TEXT NOT NULL,
    event_types TEXT[] NOT NULL DEFAULT '{"cluster.created", "cluster.resolved", "hazard.critical"}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    last_response_status INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Webhook Delivery Logs Table
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES partner_webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for Fast Filtering & Aggregations
CREATE INDEX IF NOT EXISTS idx_civic_surveys_ward ON civic_surveys(ward_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_surveys_cluster ON civic_surveys(cluster_id);
CREATE INDEX IF NOT EXISTS idx_civic_surveys_rating ON civic_surveys(rating);
CREATE INDEX IF NOT EXISTS idx_partner_webhooks_active ON partner_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook ON webhook_delivery_logs(webhook_id, created_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE civic_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated read access for survey aggregations
CREATE POLICY "Allow public read access to civic surveys"
    ON civic_surveys FOR SELECT USING (true);

CREATE POLICY "Allow authenticated or anon insertion of civic surveys"
    ON civic_surveys FOR INSERT WITH CHECK (true);

-- Partner webhooks restricted to service role or admin
CREATE POLICY "Service role full access on partner webhooks"
    ON partner_webhooks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on webhook delivery logs"
    ON webhook_delivery_logs FOR ALL USING (true) WITH CHECK (true);
