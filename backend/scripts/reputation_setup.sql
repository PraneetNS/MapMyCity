-- SQL setup script for Reputation system in CrowdSense
-- Run this in the Supabase SQL editor

-- 1. Create devices table
create table if not exists devices (
  device_id text primary key,
  total_submissions integer not null default 0,
  approved_count integer not null default 0,
  rejected_count integer not null default 0,
  trust_score double precision not null default 0.5,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- 2. Create index on device_id in submissions for faster joins
create index if not exists submissions_device_id_idx on submissions (device_id);

-- 3. Trigger function to compute reputation
create or replace function handle_submission_reputation()
returns trigger as $$
declare
  d_total integer;
  d_approved integer;
  d_rejected integer;
  d_trust double precision;
begin
  -- 1. If it's a new submission insert
  if (TG_OP = 'INSERT') then
    insert into devices (device_id, total_submissions, approved_count, rejected_count, trust_score)
    values (new.device_id, 1, 0, 0, 0.5)
    on conflict (device_id) do update set
      total_submissions = devices.total_submissions + 1,
      trust_score = case 
        when (devices.total_submissions + 1) < 3 then 0.5
        else (devices.approved_count)::double precision / (devices.total_submissions + 1)::double precision
      end,
      updated_at = now();
  
  -- 2. If it's a status update on submissions
  elsif (TG_OP = 'UPDATE') then
    if (old.status <> new.status) then
      -- Get current counts from device
      select total_submissions, approved_count, rejected_count
      into d_total, d_approved, d_rejected
      from devices
      where device_id = new.device_id;

      -- If device doesn't exist for some reason, create it
      if not found then
        d_total := 1;
        d_approved := 0;
        d_rejected := 0;
      end if;

      -- Adjust approved/rejected counts based on state transition
      if (old.status = 'approved') then
        d_approved := d_approved - 1;
      elsif (old.status = 'rejected') then
        d_rejected := d_rejected - 1;
      end if;

      if (new.status = 'approved') then
        d_approved := d_approved + 1;
      elsif (new.status = 'rejected') then
        d_rejected := d_rejected + 1;
      end if;

      -- Compute new trust score
      if (d_total < 3) then
        d_trust := 0.5;
      else
        d_trust := d_approved::double precision / d_total::double precision;
      end if;

      -- Update the device reputation
      insert into devices (device_id, total_submissions, approved_count, rejected_count, trust_score)
      values (new.device_id, d_total, d_approved, d_rejected, d_trust)
      on conflict (device_id) do update set
        approved_count = d_approved,
        rejected_count = d_rejected,
        trust_score = d_trust,
        updated_at = now();
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- 4. Trigger creation
drop trigger if exists submission_reputation_trigger on submissions;
create trigger submission_reputation_trigger
after insert or update of status
on submissions
for each row
execute function handle_submission_reputation();
