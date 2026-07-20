-- Migration 07: Create Road Health Index Schema
-- Implements database column changes to store visual severity, damage type, and accelerometer intensities
-- Deploys new columns for visual and jolt severity, table indexes, and dynamic RHI weight configurations

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS visual_severity double precision DEFAULT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS damage_type text DEFAULT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS jolt_intensity double precision DEFAULT NULL;

ALTER TABLE clusters ADD COLUMN IF NOT EXISTS avg_visual_severity double precision DEFAULT NULL;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS avg_jolt_intensity double precision DEFAULT NULL;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS road_health_index double precision DEFAULT NULL;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS rhi_updated_at timestamp DEFAULT NULL;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS rhi_confidence double precision DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clusters_rhi ON clusters (road_health_index) WHERE road_health_index IS NOT NULL;

CREATE TABLE IF NOT EXISTS rhi_weights (
  id serial PRIMARY KEY,
  visual_weight double precision NOT NULL DEFAULT 0.45,
  jolt_weight double precision NOT NULL DEFAULT 0.35,
  density_weight double precision NOT NULL DEFAULT 0.20,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed default weights if not present
INSERT INTO rhi_weights (visual_weight, jolt_weight, density_weight)
SELECT 0.45, 0.35, 0.20
WHERE NOT EXISTS (SELECT 1 FROM rhi_weights);
