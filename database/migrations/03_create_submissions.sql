-- Migration 03: Create Submissions Table
-- Deploys the submissions table representing user reports with foreign key relationships

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES devices(device_id) ON DELETE RESTRICT,
  mission_type text NOT NULL CHECK (mission_type IN ('pothole', 'garbage', 'noise', 'accessibility', 'infrastructure')),
  photo_url text NOT NULL,
  location geography(point, 4326) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  captured_at timestamp with time zone NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  p_hash text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cluster_id uuid REFERENCES clusters(id) ON DELETE SET NULL
);
