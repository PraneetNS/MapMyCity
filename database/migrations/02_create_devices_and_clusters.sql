-- Migration 02: Create Devices and Clusters Tables
-- Sets up the master tables for tracking devices and grouping geospatial reports

CREATE TABLE IF NOT EXISTS devices (
  device_id text PRIMARY KEY,
  total_submissions integer NOT NULL DEFAULT 0 CHECK (total_submissions >= 0),
  approved_count integer NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  trust_score double precision NOT NULL DEFAULT 0.5 CHECK (trust_score >= 0.0 AND trust_score <= 1.0),
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_type text NOT NULL CHECK (mission_type IN ('pothole', 'garbage', 'noise', 'accessibility', 'infrastructure')),
  centroid geography(point, 4326) NOT NULL,
  first_reported_at timestamp with time zone NOT NULL DEFAULT now(),
  last_reported_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'stale')),
  submission_count integer NOT NULL DEFAULT 0 CHECK (submission_count >= 0)
);
