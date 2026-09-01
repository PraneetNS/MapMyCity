-- Migration 19: Weather + Civic Intelligence & Predictive Flood Risk Engine
--
-- PURPOSE:
-- 1. Establishes PostGIS spatial weather grid cells and normalized weather ingestion.
-- 2. Tracks explainable predictive flood/waterlogging risk instances with confidence scores.
-- 3. Identifies chronic civic weather hotspots and location-specific critical rainfall thresholds.
-- 4. Enables weather-aware issue prioritization and prediction outcome tracking.

-- 1. Create Spatial Weather Grid Cells Table
CREATE TABLE IF NOT EXISTS weather_grid_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_code TEXT UNIQUE NOT NULL,
    centroid geography(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    ward_id TEXT,
    zone_name TEXT,
    historical_waterlogging_count INTEGER DEFAULT 0,
    historical_drainage_issues INTEGER DEFAULT 0,
    critical_rainfall_threshold_mm DOUBLE PRECISION DEFAULT 35.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_grid_centroid ON weather_grid_cells USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_weather_grid_code ON weather_grid_cells(cell_code);
CREATE INDEX IF NOT EXISTS idx_weather_grid_ward ON weather_grid_cells(ward_id);

-- 2. Create Normalized Weather Observations Table
CREATE TABLE IF NOT EXISTS weather_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES weather_grid_cells(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    precipitation_mm DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    precipitation_probability DOUBLE PRECISION DEFAULT 0.0,
    rain_intensity TEXT DEFAULT 'none',
    humidity DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    weather_condition TEXT DEFAULT 'clear',
    observed_at TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'open-meteo'
);

CREATE INDEX IF NOT EXISTS idx_weather_obs_cell_time ON weather_observations(cell_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_obs_time ON weather_observations(observed_at DESC);

-- 3. Create Weather Forecasts Table
CREATE TABLE IF NOT EXISTS weather_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES weather_grid_cells(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    forecast_time TIMESTAMPTZ NOT NULL,
    precipitation_mm DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    precipitation_probability DOUBLE PRECISION DEFAULT 0.0,
    rain_intensity TEXT DEFAULT 'none',
    temperature DOUBLE PRECISION,
    source TEXT DEFAULT 'open-meteo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_cell_time ON weather_forecasts(cell_id, forecast_time);

-- 4. Create Civic Risk Predictions Table
CREATE TABLE IF NOT EXISTS civic_risk_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES weather_grid_cells(id) ON DELETE CASCADE,
    risk_type TEXT NOT NULL DEFAULT 'flood',
    location geography(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    forecast_rainfall_mm DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    actual_incident_count INTEGER DEFAULT 0,
    actual_waterlogged BOOLEAN DEFAULT FALSE,
    model_version TEXT NOT NULL DEFAULT 'flood-risk-v1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_predictions_location ON civic_risk_predictions USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_level ON civic_risk_predictions(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_expires ON civic_risk_predictions(expires_at);

-- 5. Create Chronic Civic Weather Hotspots Table
CREATE TABLE IF NOT EXISTS civic_weather_hotspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotspot_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'waterlogging',
    location geography(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    historical_event_count INTEGER NOT NULL DEFAULT 1,
    avg_preceding_rainfall_mm DOUBLE PRECISION DEFAULT 40.0,
    trigger_threshold_mm DOUBLE PRECISION DEFAULT 25.0,
    ward_id TEXT,
    severity_score DOUBLE PRECISION DEFAULT 4.0,
    last_event_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_hotspots_loc ON civic_weather_hotspots USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_weather_hotspots_ward ON civic_weather_hotspots(ward_id);

-- 6. Create Weather Alerts Table
CREATE TABLE IF NOT EXISTS weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('HEAVY_RAIN', 'FLOOD_RISK', 'WATERLOGGING_RISK', 'ROAD_DAMAGE_RISK')),
    cell_id UUID REFERENCES weather_grid_cells(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    affected_radius_meters DOUBLE PRECISION DEFAULT 1000.0,
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_active ON weather_alerts(is_active, expires_at);

-- 7. Seed Initial Weather Grid Cells and Hotspots (Idempotent)
INSERT INTO weather_grid_cells (cell_code, centroid, latitude, longitude, ward_id, zone_name, historical_waterlogging_count, historical_drainage_issues, critical_rainfall_threshold_mm)
VALUES 
('BLR_KORAMANGALA', ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography, 12.9352, 77.6245, 'Ward 151', 'Koramangala 4th Block', 8, 4, 25.0),
('BLR_HSR_LAYOUT', ST_SetSRID(ST_MakePoint(77.6387, 12.9121), 4326)::geography, 12.9121, 77.6387, 'Ward 174', 'HSR Sector 6', 5, 2, 30.0),
('BLR_BELLANDUR', ST_SetSRID(ST_MakePoint(77.6750, 12.9260), 4326)::geography, 12.9260, 77.6750, 'Ward 150', 'Bellandur ORR Junction', 12, 6, 20.0),
('BLR_INDIRANAGAR', ST_SetSRID(ST_MakePoint(77.6412, 12.9784), 4326)::geography, 12.9784, 77.6412, 'Ward 82', '100ft Road Indiranagar', 3, 1, 40.0),
('BOM_DADAR_TT', ST_SetSRID(ST_MakePoint(72.8427, 19.0178), 4326)::geography, 19.0178, 72.8427, 'Ward F/North', 'Dadar TT Circle', 15, 7, 25.0),
('BOM_HINDMATA', ST_SetSRID(ST_MakePoint(72.8405, 19.0065), 4326)::geography, 19.0065, 72.8405, 'Ward F/South', 'Hindmata Flyover Underpass', 22, 9, 18.0)
ON CONFLICT (cell_code) DO NOTHING;

INSERT INTO civic_weather_hotspots (hotspot_name, category, location, latitude, longitude, historical_event_count, avg_preceding_rainfall_mm, trigger_threshold_mm, ward_id, severity_score)
VALUES
('Koramangala 80ft Road Low Point', 'waterlogging', ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::geography, 12.9352, 77.6245, 8, 38.5, 22.0, 'Ward 151', 4.5),
('Bellandur EcoSpace Underpass', 'waterlogging', ST_SetSRID(ST_MakePoint(77.6750, 12.9260), 4326)::geography, 12.9260, 77.6750, 12, 32.0, 18.0, 'Ward 150', 4.8),
('Hindmata Cinema Junction', 'waterlogging', ST_SetSRID(ST_MakePoint(72.8405, 19.0065), 4326)::geography, 19.0065, 72.8405, 22, 28.0, 15.0, 'Ward F/South', 5.0),
('HSR Sector 6 Culvert 3', 'drainage', ST_SetSRID(ST_MakePoint(77.6387, 12.9121), 4326)::geography, 12.9121, 77.6387, 5, 42.0, 28.0, 'Ward 174', 3.8)
ON CONFLICT DO NOTHING;
