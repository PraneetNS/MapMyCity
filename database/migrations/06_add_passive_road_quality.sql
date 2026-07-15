-- Migration 06: Add Passive Road Quality Category
-- Drops and recreates the check constraints on submissions and clusters to accept the 'passive_road_quality' mission type.

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_mission_type_check;

ALTER TABLE submissions ADD CONSTRAINT submissions_mission_type_check CHECK (
  mission_type IN (
    'pothole',
    'garbage',
    'noise',
    'accessibility',
    'infrastructure',
    'passive_road_quality'
  )
);

ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_mission_type_check;

ALTER TABLE clusters ADD CONSTRAINT clusters_mission_type_check CHECK (
  mission_type IN (
    'pothole',
    'garbage',
    'noise',
    'accessibility',
    'infrastructure',
    'passive_road_quality'
  )
);

-- Re-define handle_submission_reputation to exclude passive_road_quality from device reputation statistics
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
    IF (new.mission_type <> 'passive_road_quality') THEN
      UPDATE devices SET
        total_submissions = total_submissions + 1,
        approved_count = approved_count + (CASE WHEN new.status = 'approved' THEN 1 ELSE 0 END),
        rejected_count = rejected_count + (CASE WHEN new.status = 'rejected' THEN 1 ELSE 0 END),
        last_seen = now()
      WHERE device_id = new.device_id;
    ELSE
      UPDATE devices SET
        last_seen = now()
      WHERE device_id = new.device_id;
    END IF;
    
  -- B. If it's a status update on submissions
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (old.mission_type <> 'passive_road_quality' AND old.status <> new.status) THEN
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

  -- C. Recalculate trust_score for the device (only counting active photo submissions)
  SELECT COALESCE(COUNT(*), 0), COALESCE(COUNT(CASE WHEN status = 'approved' THEN 1 END), 0)
  INTO d_total, d_approved
  FROM submissions
  WHERE device_id = new.device_id
    AND mission_type <> 'passive_road_quality';

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
