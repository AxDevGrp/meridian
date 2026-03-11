-- Meridian Database Schema
-- Geospatial event storage for all data sources

-- ============================================
-- Enum Types
-- ============================================

CREATE TYPE layer_type AS ENUM ('aircraft', 'vessel', 'satellite', 'conflict', 'gps_jamming');
CREATE TYPE severity_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE vessel_type AS ENUM ('cargo', 'tanker', 'passenger', 'fishing', 'military', 'sailing', 'pleasure_craft', 'tug', 'pilot_vessel', 'search_rescue', 'other', 'unknown');
CREATE TYPE conflict_event_type AS ENUM ('battles', 'violence_against_civilians', 'explosions_remote_violence', 'riots', 'protests', 'strategic_developments');
CREATE TYPE interference_type AS ENUM ('jamming', 'spoofing', 'interference', 'unknown');

-- ============================================
-- Core Tables
-- ============================================

-- Unified geo_events table (time-series)
CREATE TABLE geo_events (
    id UUID DEFAULT uuid_generate_v4(),
    layer layer_type NOT NULL,
    source_id VARCHAR(255) NOT NULL,  -- Source-specific ID (ICAO24, MMSI, NORAD ID, etc.)
    name VARCHAR(500),
    description TEXT,
    severity severity_level,
    location GEOGRAPHY(Point, 4326) NOT NULL,  -- PostGIS point
    altitude_m DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}',
    source VARCHAR(100) NOT NULL,  -- Data source name
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
);

-- Convert to TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable('geo_events', 'created_at');

-- ============================================
-- Aircraft Tracking
-- ============================================

CREATE TABLE aircraft_positions (
    icao24 VARCHAR(6) NOT NULL,
    callsign VARCHAR(8),
    origin_country VARCHAR(100),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    baro_altitude_m DOUBLE PRECISION,
    geo_altitude_m DOUBLE PRECISION,
    velocity_ms DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    vertical_rate DOUBLE PRECISION,
    on_ground BOOLEAN DEFAULT FALSE,
    squawk VARCHAR(4),
    spi BOOLEAN DEFAULT FALSE,
    position_source SMALLINT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (icao24, recorded_at)
);

SELECT create_hypertable('aircraft_positions', 'recorded_at');

-- ============================================
-- Vessel Tracking
-- ============================================

CREATE TABLE vessel_positions (
    mmsi VARCHAR(9) NOT NULL,
    name VARCHAR(200),
    imo VARCHAR(10),
    callsign VARCHAR(20),
    vessel_type vessel_type DEFAULT 'unknown',
    flag VARCHAR(100),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    course DOUBLE PRECISION,
    speed_knots DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    navigation_status VARCHAR(50),
    destination VARCHAR(200),
    draught_m DOUBLE PRECISION,
    length_m DOUBLE PRECISION,
    width_m DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (mmsi, recorded_at)
);

SELECT create_hypertable('vessel_positions', 'recorded_at');

-- ============================================
-- Satellite Tracking
-- ============================================

CREATE TABLE satellite_positions (
    norad_id VARCHAR(10) NOT NULL,
    name VARCHAR(200),
    intl_designator VARCHAR(20),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    altitude_km DOUBLE PRECISION,
    velocity_kms DOUBLE PRECISION,
    inclination DOUBLE PRECISION,
    eccentricity DOUBLE PRECISION,
    mean_motion DOUBLE PRECISION,
    tle_epoch TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (norad_id, recorded_at)
);

SELECT create_hypertable('satellite_positions', 'recorded_at');

-- ============================================
-- Conflict Events
-- ============================================

CREATE TABLE conflict_events (
    event_id VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    event_type conflict_event_type NOT NULL,
    sub_event_type VARCHAR(100),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    country VARCHAR(100) NOT NULL,
    iso3 VARCHAR(3),
    admin1 VARCHAR(200),
    admin2 VARCHAR(200),
    location_name VARCHAR(500),
    actor1 VARCHAR(500),
    actor2 VARCHAR(500),
    fatalities INTEGER DEFAULT 0,
    notes TEXT,
    source_name VARCHAR(200),
    geo_precision SMALLINT,
    severity severity_level,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (event_id, recorded_at)
);

SELECT create_hypertable('conflict_events', 'recorded_at');

-- ============================================
-- GPS Jamming Zones
-- ============================================

CREATE TABLE gps_jamming_zones (
    zone_id VARCHAR(100) NOT NULL,
    name VARCHAR(200),
    description TEXT,
    center GEOGRAPHY(Point, 4326) NOT NULL,
    radius_km DOUBLE PRECISION NOT NULL,
    interference_type interference_type DEFAULT 'unknown',
    severity severity_level,
    confidence DOUBLE PRECISION,
    report_count INTEGER DEFAULT 0,
    affected_aircraft INTEGER DEFAULT 0,
    region VARCHAR(200),
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    first_detected TIMESTAMPTZ,
    last_detected TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (zone_id, recorded_at)
);

SELECT create_hypertable('gps_jamming_zones', 'recorded_at');

-- ============================================
-- Indexes
-- ============================================

-- Spatial indexes on all position tables
CREATE INDEX idx_geo_events_location ON geo_events USING GIST (location);
CREATE INDEX idx_geo_events_layer ON geo_events (layer);
CREATE INDEX idx_geo_events_severity ON geo_events (severity) WHERE severity IS NOT NULL;

CREATE INDEX idx_aircraft_location ON aircraft_positions USING GIST (location);
CREATE INDEX idx_aircraft_icao24 ON aircraft_positions (icao24);

CREATE INDEX idx_vessel_location ON vessel_positions USING GIST (location);
CREATE INDEX idx_vessel_mmsi ON vessel_positions (mmsi);
CREATE INDEX idx_vessel_type ON vessel_positions (vessel_type);

CREATE INDEX idx_satellite_location ON satellite_positions USING GIST (location);
CREATE INDEX idx_satellite_norad ON satellite_positions (norad_id);

CREATE INDEX idx_conflict_location ON conflict_events USING GIST (location);
CREATE INDEX idx_conflict_type ON conflict_events (event_type);
CREATE INDEX idx_conflict_country ON conflict_events (country);
CREATE INDEX idx_conflict_date ON conflict_events (event_date);

CREATE INDEX idx_jamming_center ON gps_jamming_zones USING GIST (center);
CREATE INDEX idx_jamming_active ON gps_jamming_zones (is_active) WHERE is_active = TRUE;

-- ============================================
-- Continuous Aggregates (for dashboard stats)
-- ============================================

-- Hourly aircraft count aggregate
CREATE MATERIALIZED VIEW aircraft_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', recorded_at) AS bucket,
    COUNT(DISTINCT icao24) AS unique_aircraft,
    COUNT(*) AS total_positions,
    AVG(velocity_ms) AS avg_velocity
FROM aircraft_positions
GROUP BY bucket;

-- Daily conflict event aggregate
CREATE MATERIALIZED VIEW conflict_daily_stats
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', recorded_at) AS bucket,
    event_type,
    country,
    COUNT(*) AS event_count,
    SUM(fatalities) AS total_fatalities
FROM conflict_events
GROUP BY bucket, event_type, country;
