-- Migration 16: Municipal Analytics Rollup & Issue Recurrence Tracking
--
-- PURPOSE:
-- 1. Issue Recurrence Tracker: Detects and logs when a civic defect (e.g. pothole, broken streetlight)
--    re-emerges within 50 meters of a previously 'resolved' issue within a 90-day window.
--    This flags low-quality repairs and chronic civic failure points for audit.
-- 2. Daily Ward Performance Rollup: Pre-aggregates daily ward statistics (volume, SLA compliance,
--    mean time to resolve, active hazards) to power fast dashboard reporting without table scans.

-- 1. Issue Recurrence Logs
CREATE TABLE IF NOT EXISTS issue_recurrence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    new_submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    previous_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    days_since_resolution INTEGER NOT NULL,
    ward_id TEXT,
    recurrence_count INTEGER DEFAULT 1,
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contractor_audit_required BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_recurrence_ward_id ON issue_recurrence_logs(ward_id);
CREATE INDEX IF NOT EXISTS idx_recurrence_category ON issue_recurrence_logs(category);
CREATE INDEX IF NOT EXISTS idx_recurrence_flagged_at ON issue_recurrence_logs(flagged_at);

-- 2. Daily Ward Performance Rollup Table
CREATE TABLE IF NOT EXISTS ward_daily_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id TEXT NOT NULL,
    city TEXT DEFAULT 'Mumbai',
    stat_date DATE NOT NULL,
    total_submissions INTEGER DEFAULT 0,
    resolved_submissions INTEGER DEFAULT 0,
    critical_hazards INTEGER DEFAULT 0,
    avg_resolution_hours DOUBLE PRECISION DEFAULT 0.0,
    recurrent_issues_detected INTEGER DEFAULT 0,
    active_volunteers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (ward_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_ward_perf_ward_date ON ward_daily_performance(ward_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_ward_perf_city_date ON ward_daily_performance(city, stat_date DESC);

-- 3. Stored Procedure for Recurrence Detection
CREATE OR REPLACE FUNCTION detect_issue_recurrence()
RETURNS TRIGGER AS $$
DECLARE
    prev_sub RECORD;
    dist_m DOUBLE PRECISION;
    days_diff INTEGER;
BEGIN
    -- Check for resolved submissions in same category within 50m and last 90 days
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        SELECT s.id, s.ward_id, s.updated_at,
               ST_Distance(
                   ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography,
                   ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography
               ) AS dist,
               EXTRACT(DAY FROM (NOW() - s.updated_at))::INTEGER AS days_ago
        INTO prev_sub
        FROM submissions s
        WHERE s.id != NEW.id
          AND s.category = NEW.category
          AND s.status = 'resolved'
          AND s.updated_at >= NOW() - INTERVAL '90 days'
          AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
              50
          )
        ORDER BY s.updated_at DESC
        LIMIT 1;

        IF prev_sub.id IS NOT NULL THEN
            INSERT INTO issue_recurrence_logs (
                new_submission_id,
                previous_submission_id,
                category,
                distance_meters,
                days_since_resolution,
                ward_id,
                contractor_audit_required
            ) VALUES (
                NEW.id,
                prev_sub.id,
                NEW.category,
                ROUND(prev_sub.dist::numeric, 2),
                prev_sub.days_ago,
                COALESCE(NEW.ward_id, prev_sub.ward_id),
                TRUE
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger to Submissions
DROP TRIGGER IF EXISTS trg_detect_issue_recurrence ON submissions;
CREATE TRIGGER trg_detect_issue_recurrence
    AFTER INSERT ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION detect_issue_recurrence();
