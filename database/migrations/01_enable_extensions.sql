-- Migration 01: Enable Extensions
-- Enforces PostGIS geographic support and UUID generation functions

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
