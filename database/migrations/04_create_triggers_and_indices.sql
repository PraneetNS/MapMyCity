-- Migration 04: Create Triggers and Indices
-- Configures database indexes and triggers for device reputation tracking

-- 1. Create Spatial and Relational Indices
CREATE INDEX IF NOT EXISTS submissions_location_idx ON submissions USING gist (location);
CREATE INDEX IF NOT EXISTS clusters_centroid_idx ON clusters USING gist (centroid);
CREATE INDEX IF NOT EXISTS submissions_device_id_idx ON submissions (device_id);
CREATE INDEX IF NOT EXISTS submissions_cluster_id_idx ON submissions (cluster_id);

-- 2. BEFORE INSERT Trigger: Ensure Device Exists
-- Provision a blank device profile if a device_id is not already present, ensuring foreign key safety
CREATE OR REPLACE FUNCTION ensure_device_exists()
RETURNS trigger AS $$
BEGIN
  INSERT INTO devices (device_id, total_submissions, approved_count, rejected_count, trust_score, first_seen, last_seen)
  VALUES (new.device_id, 0, 0, 0, 0.5, now(), now())
  ON CONFLICT (device_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_device_exists_trigger ON submissions;
CREATE TRIGGER ensure_device_exists_trigger
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE FUNCTION ensure_device_exists();

-- 3. AFTER INSERT OR UPDATE Trigger: Manage Device Reputation and Trust Score
-- Aggregates submission counts and computes the running reputation score dynamically
CREATE OR REPLACE FUNCTION handle_submission_reputation()
RETURNS trigger AS $$
DECLARE
  d_total integer;
  d_approved integer;
  d_rejected integer;
  d_trust double precision;
  d_violations integer;
BEGIN
  -- A. If it's a new submission insert
  IF (TG_OP = 'INSERT') THEN
    UPDATE devices SET
      total_submissions = total_submissions + 1,
      approved_count = approved_count + (CASE WHEN new.status = 'approved' THEN 1 ELSE 0 END),
      rejected_count = rejected_count + (CASE WHEN new.status = 'rejected' THEN 1 ELSE 0 END),
      last_seen = now()
    WHERE device_id = new.device_id;
    
  -- B. If it's a status update on submissions
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (old.status <> new.status) THEN
      -- Get current counts from device
      SELECT total_submissions, approved_count, rejected_count
      INTO d_total, d_approved, d_rejected
      FROM devices
      WHERE device_id = new.device_id;

      -- Adjust approved/rejected counts based on state transition
      IF (old.status = 'approved') THEN
        d_approved := d_approved - 1;
      ELSIF (old.status = 'rejected') THEN
        d_rejected := d_rejected - 1;
      END IF;

      IF (new.status = 'approved') THEN
        d_approved := d_approved + 1;
      ELSIF (new.status = 'rejected') THEN
        d_rejected := d_rejected + 1;
      END IF;

      -- Update the device reputation counts
      UPDATE devices SET
        approved_count = d_approved,
        rejected_count = d_rejected,
        last_seen = now()
      WHERE device_id = new.device_id;
    END IF;
  END IF;

  -- C. Recalculate trust_score for the device
  SELECT total_submissions, approved_count
  INTO d_total, d_approved
  FROM devices
  WHERE device_id = new.device_id;

  IF (d_total < 3) THEN
    d_trust := 0.5;
  ELSE
    d_trust := d_approved::double precision / d_total::double precision;
  END IF;

  -- Apply content policy violation penalties: deduct 0.3 per violation
  SELECT COUNT(*)
  INTO d_violations
  FROM submissions
  WHERE device_id = new.device_id
    AND flags ? 'auto_rejected_content_policy';

  IF (d_violations > 0) THEN
    d_trust := d_trust - (d_violations * 0.3);
    IF (d_trust < 0.0) THEN
      d_trust := 0.0;
    END IF;
  END IF;

  UPDATE devices SET
    trust_score = d_trust
  WHERE device_id = new.device_id;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submission_reputation_trigger ON submissions;
CREATE TRIGGER submission_reputation_trigger
AFTER INSERT OR UPDATE OF status
ON submissions
FOR EACH ROW
EXECUTE FUNCTION handle_submission_reputation();

-- 4. AFTER INSERT OR UPDATE Trigger: Recompute Cluster Road Health Index (RHI)
-- Automatically triggers RHI re-calculations when severity metrics or cluster assignments change
-- Core function invoked by database triggers to aggregate visual severity, G-force jolts, and density
CREATE OR REPLACE FUNCTION recompute_cluster_rhi()
RETURNS TRIGGER AS $$
DECLARE
  v_avg_visual double precision;
  v_avg_jolt double precision;
  v_count int;
  v_rhi double precision;
  v_w_visual double precision;
  v_w_jolt double precision;
  v_w_density double precision;
BEGIN
  -- Load weights from configuration table, fallback to default parameters if missing
  SELECT visual_weight, jolt_weight, density_weight
  INTO v_w_visual, v_w_jolt, v_w_density
  FROM rhi_weights
  ORDER BY id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_w_visual := 0.45;
    v_w_jolt := 0.35;
    v_w_density := 0.20;
  END IF;

  -- A. Recompute for NEW cluster assignment
  IF NEW.cluster_id IS NOT NULL THEN
    SELECT AVG(visual_severity), AVG(jolt_intensity), COUNT(*)
    INTO v_avg_visual, v_avg_jolt, v_count
    FROM submissions
    WHERE cluster_id = NEW.cluster_id
      AND (visual_severity IS NOT NULL OR jolt_intensity IS NOT NULL);

    IF v_count > 0 THEN
      v_rhi := 100 - 100 * (
        v_w_visual * COALESCE(v_avg_visual, 0)
        + v_w_jolt * COALESCE(v_avg_jolt, 0)
        + v_w_density * LEAST(v_count / 10.0, 1)
      );

      UPDATE clusters
      SET avg_visual_severity = v_avg_visual,
          avg_jolt_intensity = v_avg_jolt,
          road_health_index = GREATEST(0, LEAST(100, v_rhi)),
          rhi_confidence = LEAST(v_count / 10.0, 1),
          rhi_updated_at = now()
      WHERE id = NEW.cluster_id;
    ELSE
      UPDATE clusters
      SET avg_visual_severity = NULL,
          avg_jolt_intensity = NULL,
          road_health_index = NULL,
          rhi_confidence = NULL,
          rhi_updated_at = now()
      WHERE id = NEW.cluster_id;
    END IF;
  END IF;

  -- B. Recompute for OLD cluster assignment if the submission was moved or unlinked
  IF (TG_OP = 'UPDATE') AND OLD.cluster_id IS NOT NULL AND (NEW.cluster_id IS NULL OR OLD.cluster_id <> NEW.cluster_id) THEN
    SELECT AVG(visual_severity), AVG(jolt_intensity), COUNT(*)
    INTO v_avg_visual, v_avg_jolt, v_count
    FROM submissions
    WHERE cluster_id = OLD.cluster_id
      AND (visual_severity IS NOT NULL OR jolt_intensity IS NOT NULL);

    IF v_count > 0 THEN
      v_rhi := 100 - 100 * (
        v_w_visual * COALESCE(v_avg_visual, 0)
        + v_w_jolt * COALESCE(v_avg_jolt, 0)
        + v_w_density * LEAST(v_count / 10.0, 1)
      );

      UPDATE clusters
      SET avg_visual_severity = v_avg_visual,
          avg_jolt_intensity = v_avg_jolt,
          road_health_index = GREATEST(0, LEAST(100, v_rhi)),
          rhi_confidence = LEAST(v_count / 10.0, 1),
          rhi_updated_at = now()
      WHERE id = OLD.cluster_id;
    ELSE
      UPDATE clusters
      SET avg_visual_severity = NULL,
          avg_jolt_intensity = NULL,
          road_health_index = NULL,
          rhi_confidence = NULL,
          rhi_updated_at = now()
      WHERE id = OLD.cluster_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_cluster_rhi ON submissions;
CREATE TRIGGER trg_recompute_cluster_rhi
AFTER INSERT OR UPDATE OF visual_severity, jolt_intensity, cluster_id ON submissions
FOR EACH ROW
EXECUTE FUNCTION recompute_cluster_rhi();
