const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

let pool = null;
let useMock = false;
try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Test connection eagerly
  pool.query('select 1').catch((err) => {
    console.error('Postgres test query failed, switching to mock mode:', err.message || err);
    useMock = true;
    pool = null;
  });
} catch (err) {
  console.error('Postgres pool init failed, switching to mock mode:', err.message || err);
  useMock = true;
  pool = null;
}

// In-memory fallback for development when Postgres is unavailable
const mockSubmissions = [];
const { v4: uuidv4 } = require('uuid');
if (useMock) {
  // seed a sample submission
  mockSubmissions.push({
    id: uuidv4(),
    device_id: 'seed-device',
    mission_type: 'pothole',
    photo_url: 'https://example.com/seed.jpg',
    latitude: 40.7128,
    longitude: -74.006,
    captured_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    status: 'pending',
    notes: null,
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/submissions', async (req, res) => {
  const {
    device_id,
    photo_url,
    latitude,
    longitude,
    captured_at,
    mission_type = 'pothole',
    notes = null,
    status = 'pending',
  } = req.body;

  if (!device_id || !photo_url || latitude == null || longitude == null || !captured_at) {
    return res.status(400).json({ error: 'device_id, photo_url, latitude, longitude, and captured_at are required.' });
  }

  try {
    if (useMock || !pool) {
      const row = {
        id: uuidv4(),
        device_id,
        mission_type,
        photo_url,
        latitude,
        longitude,
        location: `POINT(${longitude} ${latitude})`,
        captured_at,
        submitted_at: new Date().toISOString(),
        status,
        notes,
      };
      mockSubmissions.push(row);
      return res.status(201).json(row);
    }

    const result = await pool.query(
      `
        insert into submissions (
          device_id,
          mission_type,
          photo_url,
          latitude,
          longitude,
          location,
          captured_at,
          submitted_at,
          status,
          notes
        )
        values ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, now(), $7, $8)
        returning *
      `,
      [device_id, mission_type, photo_url, latitude, longitude, captured_at, status, notes],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Insertion error:', error && error.message ? error.message : error);
    return res.status(500).json({ error: 'Failed to create submission.' });
  }
});

app.get('/submissions', async (_req, res) => {
  try {
    if (useMock || !pool) {
      return res.json(mockSubmissions.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at)));
    }

    const result = await pool.query(`
      select s.*, coalesce(d.trust_score, 0.5) as trust_score
      from submissions s
      left join devices d on s.device_id = d.device_id
      order by s.captured_at desc
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load submissions.' });
  }
});

app.get('/submissions/device/:deviceId', async (req, res) => {
  try {
    if (useMock || !pool) {
      const rows = mockSubmissions.filter((s) => s.device_id === req.params.deviceId).sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
      return res.json(rows);
    }

    const result = await pool.query(`
      select s.*, coalesce(d.trust_score, 0.5) as trust_score
      from submissions s
      left join devices d on s.device_id = d.device_id
      where s.device_id = $1
      order by s.captured_at desc
    `, [req.params.deviceId]);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load device submissions.' });
  }
});

app.patch('/submissions/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'status is required.' });
  }

  try {
    if (useMock || !pool) {
      const idx = mockSubmissions.findIndex((s) => s.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Submission not found.' });
      mockSubmissions[idx].status = status;
      return res.json(mockSubmissions[idx]);
    }

    const result = await pool.query('update submissions set status = $1 where id = $2 returning *', [status, req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update submission status.' });
  }
});

app.listen(port, () => {
  console.log(`CrowdSense backend listening on port ${port}`);
});
