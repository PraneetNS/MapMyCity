-- Migration 05: Resolution Tracking Schema and Constraints
-- Modifies submissions table constraints and creates resolution photos table

-- 1. Alter submissions status check constraint to include all extended lifecycle states
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE submissions ADD CONSTRAINT submissions_status_check CHECK (
  status IN (
    'pending',
    'approved',
    'rejected',
    'acknowledged',
    'in_progress',
    'resolved_pending_verification',
    'verified_fixed',
    'reopened'
  )
);

-- 2. Create resolution_photos table linked to original submissions
CREATE TABLE IF NOT EXISTS resolution_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  device_id text NOT NULL REFERENCES devices(device_id) ON DELETE RESTRICT,
  photo_url text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  p_hash text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Create indices for performance
CREATE INDEX IF NOT EXISTS resolution_photos_submission_id_idx ON resolution_photos (submission_id);
