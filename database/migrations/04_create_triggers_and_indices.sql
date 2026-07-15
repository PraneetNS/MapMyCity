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
