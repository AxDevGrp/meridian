-- Market Data Seed: Instruments and Region Correlation Mappings
-- Idempotent — safe to re-run via ON CONFLICT DO NOTHING

-- ============================================
-- Instruments
-- ============================================

-- Energy
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('CL=F',  'WTI Crude Oil Futures',       'future',    'energy',   'NYMEX',   'USD', 'West Texas Intermediate crude oil continuous contract'),
    ('BZ=F',  'Brent Crude Oil Futures',      'future',    'energy',   'ICE',     'USD', 'Brent crude oil continuous contract'),
    ('NG=F',  'Natural Gas Futures',          'future',    'energy',   'NYMEX',   'USD', 'Henry Hub natural gas continuous contract'),
    ('XOM',   'Exxon Mobil Corporation',      'equity',    'energy',   'NYSE',    'USD', 'Integrated oil and gas major'),
    ('CVX',   'Chevron Corporation',          'equity',    'energy',   'NYSE',    'USD', 'Integrated oil and gas major'),
    ('BP',    'BP plc',                       'equity',    'energy',   'NYSE',    'USD', 'British integrated oil and gas major (ADR)'),
    ('SHEL',  'Shell plc',                    'equity',    'energy',   'NYSE',    'USD', 'Anglo-Dutch integrated oil and gas major (ADR)')
ON CONFLICT DO NOTHING;

-- Shipping
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('FRO',   'Frontline plc',               'equity',    'shipping', 'NYSE',    'USD', 'International seaborne transportation of crude oil'),
    ('STNG',  'Scorpio Tankers Inc.',         'equity',    'shipping', 'NYSE',    'USD', 'Product tanker shipping company'),
    ('TNK',   'Teekay Tankers Ltd.',          'equity',    'shipping', 'NYSE',    'USD', 'Crude oil and product tanker company'),
    ('ZIM',   'ZIM Integrated Shipping',      'equity',    'shipping', 'NYSE',    'USD', 'Container shipping and logistics'),
    ('MATX',  'Matson Inc.',                  'equity',    'shipping', 'NYSE',    'USD', 'Ocean transportation and logistics'),
    ('BDRY',  'Breakwave Dry Bulk Shipping ETF', 'etf',   'shipping', 'NYSE',    'USD', 'Tracks the Baltic Dry Index via freight futures')
ON CONFLICT DO NOTHING;

-- Defense
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('LMT',   'Lockheed Martin Corporation',  'equity',    'defense',  'NYSE',    'USD', 'Aerospace, defense, and security'),
    ('RTX',   'RTX Corporation',              'equity',    'defense',  'NYSE',    'USD', 'Aerospace and defense conglomerate (Raytheon)'),
    ('NOC',   'Northrop Grumman Corporation', 'equity',    'defense',  'NYSE',    'USD', 'Aerospace and defense technology'),
    ('GD',    'General Dynamics Corporation', 'equity',    'defense',  'NYSE',    'USD', 'Aerospace and defense systems'),
    ('BA',    'The Boeing Company',           'equity',    'defense',  'NYSE',    'USD', 'Aerospace manufacturer and defense contractor'),
    ('ITA',   'iShares U.S. Aerospace & Defense ETF', 'etf', 'defense', 'BATS', 'USD', 'US aerospace and defense sector ETF')
ON CONFLICT DO NOTHING;

-- Agriculture
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('ZW=F',  'Wheat Futures',                'future',    'agriculture', 'CBOT', 'USD', 'Chicago wheat continuous contract'),
    ('ZC=F',  'Corn Futures',                 'future',    'agriculture', 'CBOT', 'USD', 'Chicago corn continuous contract'),
    ('ZS=F',  'Soybean Futures',              'future',    'agriculture', 'CBOT', 'USD', 'Chicago soybean continuous contract'),
    ('DBA',   'Invesco DB Agriculture Fund',  'etf',       'agriculture', 'NYSE', 'USD', 'Broad agricultural commodity ETF')
ON CONFLICT DO NOTHING;

-- Technology / Semiconductors
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('TSM',   'Taiwan Semiconductor Manufacturing', 'equity', 'technology', 'NYSE',   'USD', 'World''s largest semiconductor foundry (ADR)'),
    ('NVDA',  'NVIDIA Corporation',           'equity',    'technology', 'NASDAQ', 'USD', 'GPU and AI chip leader'),
    ('ASML',  'ASML Holding N.V.',            'equity',    'technology', 'NASDAQ', 'USD', 'Semiconductor lithography equipment monopoly (ADR)'),
    ('INTC',  'Intel Corporation',            'equity',    'technology', 'NASDAQ', 'USD', 'Semiconductor manufacturing and design'),
    ('AAPL',  'Apple Inc.',                   'equity',    'technology', 'NASDAQ', 'USD', 'Consumer electronics and technology giant'),
    ('SOXX',  'iShares Semiconductor ETF',    'etf',       'technology', 'NASDAQ', 'USD', 'Philadelphia Semiconductor Index ETF'),
    ('SMH',   'VanEck Semiconductor ETF',     'etf',       'technology', 'NASDAQ', 'USD', 'Semiconductor sector ETF')
ON CONFLICT DO NOTHING;

-- Finance / Safe Havens
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('GLD',   'SPDR Gold Shares',             'etf',       'finance',  'NYSE',    'USD', 'Gold bullion ETF — primary safe-haven proxy'),
    ('SLV',   'iShares Silver Trust',         'etf',       'finance',  'NYSE',    'USD', 'Silver bullion ETF'),
    ('UUP',   'Invesco DB US Dollar Index Bullish Fund', 'etf', 'finance', 'NYSE', 'USD', 'US Dollar index ETF'),
    ('TLT',   'iShares 20+ Year Treasury Bond ETF', 'etf', 'finance', 'NASDAQ', 'USD', 'Long-term US Treasury bond ETF')
ON CONFLICT DO NOTHING;

-- Indices
INSERT INTO market_instruments (symbol, name, asset_class, sector, exchange, currency, description) VALUES
    ('^GSPC', 'S&P 500',                     'index',     'finance',  'SNP',     'USD', 'Standard & Poor''s 500 broad market index'),
    ('^DJI',  'Dow Jones Industrial Average', 'index',     'finance',  'DJI',     'USD', 'Blue-chip 30-stock index'),
    ('^VIX',  'CBOE Volatility Index',        'index',     'finance',  'CBOE',    'USD', 'Market fear gauge — spikes on geopolitical shocks')
ON CONFLICT DO NOTHING;


-- ============================================
-- Region Correlation Mappings
-- ============================================

-- Strait of Hormuz — critical oil chokepoint
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('CL=F',  'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', '20% of global oil transits Hormuz; disruption spikes crude prices'),
    ('BZ=F',  'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', 'Brent directly tied to Middle-East supply routes'),
    ('XOM',   'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', 'Major oil producer with Gulf exposure'),
    ('CVX',   'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', 'Major oil producer with Gulf exposure'),
    ('STNG',  'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', 'Product tankers transiting Hormuz daily'),
    ('FRO',   'Strait of Hormuz', ST_SetSRID(ST_MakePoint(56.25, 26.57), 4326)::geography, 200, 0.9, 'negative', '{conflict,gps-jamming,vessel}', 'Crude tankers heavily exposed to Hormuz disruption')
ON CONFLICT DO NOTHING;

-- Suez Canal — Europe-Asia trade chokepoint
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('ZIM',   'Suez Canal', ST_SetSRID(ST_MakePoint(32.35, 30.46), 4326)::geography, 100, 0.8, 'negative', '{conflict,vessel}', 'Container shipping rerouted around Africa when Suez disrupted'),
    ('MATX',  'Suez Canal', ST_SetSRID(ST_MakePoint(32.35, 30.46), 4326)::geography, 100, 0.8, 'negative', '{conflict,vessel}', 'Ocean logistics impacted by canal closures'),
    ('BDRY',  'Suez Canal', ST_SetSRID(ST_MakePoint(32.35, 30.46), 4326)::geography, 100, 0.8, 'negative', '{conflict,vessel}', 'Baltic Dry proxy rises on shipping disruption'),
    ('CL=F',  'Suez Canal', ST_SetSRID(ST_MakePoint(32.35, 30.46), 4326)::geography, 100, 0.8, 'negative', '{conflict,vessel}', 'Oil supply chain transits Suez')
ON CONFLICT DO NOTHING;

-- South China Sea — semiconductor supply chain and trade
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('TSM',   'South China Sea', ST_SetSRID(ST_MakePoint(115.0, 14.0), 4326)::geography, 800, 0.7, 'negative', '{conflict,vessel,gps-jamming}', 'TSMC supply chain transits South China Sea'),
    ('NVDA',  'South China Sea', ST_SetSRID(ST_MakePoint(115.0, 14.0), 4326)::geography, 800, 0.7, 'negative', '{conflict,vessel,gps-jamming}', 'NVIDIA chips fabbed by TSMC, supply chain exposure'),
    ('ASML',  'South China Sea', ST_SetSRID(ST_MakePoint(115.0, 14.0), 4326)::geography, 800, 0.7, 'negative', '{conflict,vessel,gps-jamming}', 'ASML equipment shipments transit the region'),
    ('SOXX',  'South China Sea', ST_SetSRID(ST_MakePoint(115.0, 14.0), 4326)::geography, 800, 0.7, 'negative', '{conflict,vessel,gps-jamming}', 'Broad semiconductor sector exposure'),
    ('SMH',   'South China Sea', ST_SetSRID(ST_MakePoint(115.0, 14.0), 4326)::geography, 800, 0.7, 'negative', '{conflict,vessel,gps-jamming}', 'Semiconductor ETF with Asia-Pacific exposure')
ON CONFLICT DO NOTHING;

-- Taiwan Strait — existential risk to chip supply
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('TSM',   'Taiwan Strait', ST_SetSRID(ST_MakePoint(119.5, 24.0), 4326)::geography, 300, 0.95, 'negative', '{conflict,vessel}', 'TSMC headquartered in Taiwan; invasion scenario = total disruption'),
    ('AAPL',  'Taiwan Strait', ST_SetSRID(ST_MakePoint(119.5, 24.0), 4326)::geography, 300, 0.95, 'negative', '{conflict,vessel}', 'Apple chips entirely fabbed by TSMC in Taiwan'),
    ('SOXX',  'Taiwan Strait', ST_SetSRID(ST_MakePoint(119.5, 24.0), 4326)::geography, 300, 0.95, 'negative', '{conflict,vessel}', 'Semiconductor index would collapse on Taiwan conflict'),
    ('NVDA',  'Taiwan Strait', ST_SetSRID(ST_MakePoint(119.5, 24.0), 4326)::geography, 300, 0.95, 'negative', '{conflict,vessel}', 'NVIDIA entirely dependent on TSMC fabrication'),
    ('ASML',  'Taiwan Strait', ST_SetSRID(ST_MakePoint(119.5, 24.0), 4326)::geography, 300, 0.95, 'negative', '{conflict,vessel}', 'ASML equipment installed at TSMC fabs in Taiwan')
ON CONFLICT DO NOTHING;

-- Black Sea — grain corridor
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('ZW=F',  'Black Sea', ST_SetSRID(ST_MakePoint(34.0, 43.5), 4326)::geography, 500, 0.8, 'negative', '{conflict,vessel,gps-jamming}', 'Ukraine/Russia account for ~30% of global wheat exports'),
    ('ZC=F',  'Black Sea', ST_SetSRID(ST_MakePoint(34.0, 43.5), 4326)::geography, 500, 0.8, 'negative', '{conflict,vessel,gps-jamming}', 'Ukraine is a major corn exporter via Black Sea ports'),
    ('DBA',   'Black Sea', ST_SetSRID(ST_MakePoint(34.0, 43.5), 4326)::geography, 500, 0.8, 'negative', '{conflict,vessel,gps-jamming}', 'Broad agriculture ETF exposed to grain supply shocks')
ON CONFLICT DO NOTHING;

-- Red Sea / Gulf of Aden — Houthi disruption zone
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('ZIM',   'Red Sea / Gulf of Aden', ST_SetSRID(ST_MakePoint(43.0, 14.0), 4326)::geography, 400, 0.85, 'negative', '{conflict,vessel}', 'Container shipping directly threatened by Houthi attacks'),
    ('MATX',  'Red Sea / Gulf of Aden', ST_SetSRID(ST_MakePoint(43.0, 14.0), 4326)::geography, 400, 0.85, 'negative', '{conflict,vessel}', 'Ocean logistics disrupted by Red Sea rerouting'),
    ('BDRY',  'Red Sea / Gulf of Aden', ST_SetSRID(ST_MakePoint(43.0, 14.0), 4326)::geography, 400, 0.85, 'negative', '{conflict,vessel}', 'Shipping rates spike on Red Sea disruption'),
    ('CL=F',  'Red Sea / Gulf of Aden', ST_SetSRID(ST_MakePoint(43.0, 14.0), 4326)::geography, 400, 0.85, 'negative', '{conflict,vessel}', 'Oil tanker routes through Bab el-Mandeb strait'),
    ('BZ=F',  'Red Sea / Gulf of Aden', ST_SetSRID(ST_MakePoint(43.0, 14.0), 4326)::geography, 400, 0.85, 'negative', '{conflict,vessel}', 'Brent supply chain transits Red Sea')
ON CONFLICT DO NOTHING;

-- Baltic Sea — energy infrastructure
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('NG=F',  'Baltic Sea', ST_SetSRID(ST_MakePoint(20.0, 58.0), 4326)::geography, 400, 0.5, 'negative', '{conflict,gps-jamming}', 'Nord Stream and Baltic Pipe gas infrastructure'),
    ('BDRY',  'Baltic Sea', ST_SetSRID(ST_MakePoint(20.0, 58.0), 4326)::geography, 400, 0.5, 'negative', '{conflict,gps-jamming}', 'Baltic shipping lanes for dry bulk')
ON CONFLICT DO NOTHING;

-- Persian Gulf — broader oil region
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('CL=F',  'Persian Gulf', ST_SetSRID(ST_MakePoint(51.0, 27.0), 4326)::geography, 500, 0.85, 'negative', '{conflict,vessel}', 'Heart of OPEC production — Saudi, UAE, Kuwait, Iraq'),
    ('BZ=F',  'Persian Gulf', ST_SetSRID(ST_MakePoint(51.0, 27.0), 4326)::geography, 500, 0.85, 'negative', '{conflict,vessel}', 'Brent benchmark directly tied to Gulf supply'),
    ('NG=F',  'Persian Gulf', ST_SetSRID(ST_MakePoint(51.0, 27.0), 4326)::geography, 500, 0.85, 'negative', '{conflict,vessel}', 'Qatar is world''s largest LNG exporter'),
    ('XOM',   'Persian Gulf', ST_SetSRID(ST_MakePoint(51.0, 27.0), 4326)::geography, 500, 0.85, 'negative', '{conflict,vessel}', 'Exxon has significant Gulf production assets'),
    ('SHEL',  'Persian Gulf', ST_SetSRID(ST_MakePoint(51.0, 27.0), 4326)::geography, 500, 0.85, 'negative', '{conflict,vessel}', 'Shell has major LNG and upstream Gulf operations')
ON CONFLICT DO NOTHING;

-- Eastern Mediterranean — gas fields and cables
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('NG=F',  'Eastern Mediterranean', ST_SetSRID(ST_MakePoint(33.0, 34.0), 4326)::geography, 300, 0.6, 'negative', '{conflict,gps-jamming}', 'Leviathan and Tamar gas fields; subsea cables'),
    ('CL=F',  'Eastern Mediterranean', ST_SetSRID(ST_MakePoint(33.0, 34.0), 4326)::geography, 300, 0.6, 'negative', '{conflict,gps-jamming}', 'Regional instability affects broader oil sentiment')
ON CONFLICT DO NOTHING;

-- Korean Peninsula — global risk escalation
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('^GSPC', 'Korean Peninsula', ST_SetSRID(ST_MakePoint(127.0, 38.0), 4326)::geography, 300, 0.7, 'mixed', '{conflict}', 'S&P 500 sells off on North Korea escalation'),
    ('GLD',   'Korean Peninsula', ST_SetSRID(ST_MakePoint(127.0, 38.0), 4326)::geography, 300, 0.7, 'mixed', '{conflict}', 'Gold rallies as safe haven during Korea tensions'),
    ('^VIX',  'Korean Peninsula', ST_SetSRID(ST_MakePoint(127.0, 38.0), 4326)::geography, 300, 0.7, 'mixed', '{conflict}', 'Volatility spikes on geopolitical fear'),
    ('LMT',   'Korean Peninsula', ST_SetSRID(ST_MakePoint(127.0, 38.0), 4326)::geography, 300, 0.7, 'mixed', '{conflict}', 'Defense contractor benefits from Korean tension'),
    ('RTX',   'Korean Peninsula', ST_SetSRID(ST_MakePoint(127.0, 38.0), 4326)::geography, 300, 0.7, 'mixed', '{conflict}', 'Raytheon missile defense systems deployed in Korea')
ON CONFLICT DO NOTHING;

-- Middle East (general) — broad geopolitical zone
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('CL=F',  'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Broad Middle-East instability elevates oil risk premium'),
    ('BZ=F',  'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Brent premium rises on regional conflict'),
    ('GLD',   'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Gold safe-haven bid on Middle East escalation'),
    ('LMT',   'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Lockheed defense contracts increase with ME conflict'),
    ('RTX',   'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Raytheon missile systems deployed across Middle East'),
    ('^VIX',  'Middle East (general)', ST_SetSRID(ST_MakePoint(47.0, 29.0), 4326)::geography, 1000, 0.6, 'mixed', '{conflict}', 'Volatility index spikes on geopolitical escalation')
ON CONFLICT DO NOTHING;

-- Ukraine / Eastern Europe — energy and grain
INSERT INTO instrument_region_map (symbol, region_name, region_center, region_radius_km, sensitivity, direction, event_types, rationale) VALUES
    ('ZW=F',  'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Ukraine is a top-5 global wheat exporter'),
    ('NG=F',  'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Russian gas transit through Ukraine to Europe'),
    ('GLD',   'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Gold safe-haven demand rises on European conflict'),
    ('^VIX',  'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Market volatility elevated during Eastern European conflict'),
    ('LMT',   'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Lockheed arms exports increase with NATO spending'),
    ('NOC',   'Ukraine / Eastern Europe', ST_SetSRID(ST_MakePoint(32.0, 49.0), 4326)::geography, 600, 0.75, 'mixed', '{conflict}', 'Northrop Grumman benefits from European defense buildup')
ON CONFLICT DO NOTHING;
