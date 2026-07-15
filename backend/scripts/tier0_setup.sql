-- SQL setup script for Tier 0 Validation layer
-- Run this script in the Supabase SQL editor

-- 1. Add p_hash and flags columns to submissions table
alter table submissions 
add column if not exists p_hash text,
add column if not exists flags jsonb default '[]'::jsonb;

-- 2. Create the RPC function to find nearby submissions with p_hashes
create or replace function get_nearby_submissions(
  target_lon double precision,
  target_lat double precision,
  max_distance_meters double precision,
  exclude_id uuid
)
returns table (
  id uuid,
  p_hash text
)
language sql security definer as $$
  select id, p_hash
  from submissions
  where ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(target_lon, target_lat), 4326)::geography,
    max_distance_meters
  )
  and id <> exclude_id
  and p_hash is not null;
$$;
