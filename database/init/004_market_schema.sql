-- Market Data Intelligence Schema
-- Financial instruments, price history, and geospatial correlation mappings

-- ============================================
-- Enum Types
-- ============================================

CREATE TYPE asset_class AS ENUM ('equity', 'commodity', 'currency', 'crypto', 'index', 'etf', 'bond', 'future');
CREATE TYPE market_sector AS ENUM ('energy', 'shipping', 'defense', 'agriculture', 'technology', 'finance', 'materials', 'industrials', 'utilities', 'other');
CREATE TYPE price_interval AS ENUM ('1m', '5m', '15m', '1h', '1d', '1w', '1mo');

-- ============================================
-- Instruments
-- ============================================

CREATE TABLE market_instruments (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    asset_class asset_class NOT NULL,
    sector market_sector,
    exchange VARCHAR(50),
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Price History (TimescaleDB hypertable)
-- ============================================

CREATE TABLE market_prices (
    symbol VARCHAR(20) NOT NULL REFERENCES market_instruments(symbol),
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION NOT NULL,
    volume BIGINT,
    interval price_interval NOT NULL DEFAULT '1d',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (symbol, recorded_at)
);

SELECT create_hypertable('market_prices', 'recorded_at');

-- ============================================
-- Instrument-to-Region Correlation Mapping
-- ============================================

CREATE TABLE instrument_region_map (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL REFERENCES market_instruments(symbol),
    region_name VARCHAR(200) NOT NULL,
    region_center GEOGRAPHY(Point, 4326),
    region_radius_km DOUBLE PRECISION,
    sensitivity DOUBLE PRECISION DEFAULT 0.5,
    direction VARCHAR(10) DEFAULT 'negative',
    event_types TEXT[] DEFAULT '{}',
    rationale TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Watchlists
-- ============================================

CREATE TABLE watchlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id VARCHAR(255),
    name VARCHAR(200) NOT NULL DEFAULT 'Default',
    symbols TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Price indexes
CREATE INDEX idx_prices_symbol ON market_prices (symbol);
CREATE INDEX idx_prices_interval ON market_prices (interval);

-- Region correlation indexes
CREATE INDEX idx_region_map_symbol ON instrument_region_map (symbol);
CREATE INDEX idx_region_map_region ON instrument_region_map (region_name);
CREATE INDEX idx_region_map_center ON instrument_region_map USING GIST (region_center) WHERE region_center IS NOT NULL;

-- Instrument indexes
CREATE INDEX idx_instruments_class ON market_instruments (asset_class);
CREATE INDEX idx_instruments_sector ON market_instruments (sector);
CREATE INDEX idx_instruments_active ON market_instruments (is_active) WHERE is_active = TRUE;
