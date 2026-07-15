# CrowdSense phase 0

This Expo app implements the phase-0 pothole reporting flow with three screens:

- Capture: take a photo, capture GPS coordinates, and submit to Supabase
- Map: show approved submissions as map pins
- My submissions: view the current device's submissions and statuses

## Setup

1. Create a Supabase project.
2. Run the SQL below in the SQL editor:

```sql
create extension if not exists postgis;

create table submissions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  mission_type text not null default 'pothole',
  photo_url text not null,
  location geography(point, 4326) not null,
  latitude float not null,
  longitude float not null,
  captured_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  status text not null default 'pending',
  notes text
);

create index submissions_location_idx on submissions using gist (location);
```

3. Create a public storage bucket named `submission-photos`.
4. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key.
5. Start the app with `npm start`.

## Notes

This implementation uses a simple device ID stored locally with AsyncStorage so you can submit without building auth yet. Admin approval can be done directly in the Supabase table editor for the first batch of submissions.
