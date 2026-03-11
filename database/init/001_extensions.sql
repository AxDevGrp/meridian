-- Meridian Database Initialization
-- Enable required extensions

-- PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- TimescaleDB for time-series data
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
