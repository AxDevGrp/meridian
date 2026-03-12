-- Intelligence Reports & Alerting Schema
-- Intel reports, alert rules, and alert history

-- ============================================
-- Enum Types
-- ============================================

CREATE TYPE report_classification AS ENUM ('unclassified', 'internal', 'confidential', 'restricted');
CREATE TYPE threat_level AS ENUM ('critical', 'high', 'elevated', 'guarded', 'low');
CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE alert_condition_type AS ENUM ('threshold', 'correlation', 'sentiment', 'proximity', 'count', 'absence');

-- ============================================
-- Intel Reports
-- ============================================

CREATE TABLE intel_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    region_name VARCHAR(200) NOT NULL,
    region_center GEOGRAPHY(Point, 4326),
    region_radius_km DOUBLE PRECISION,
    classification report_classification NOT NULL DEFAULT 'unclassified',
    threat_level threat_level NOT NULL DEFAULT 'low',
    executive_summary TEXT,
    key_findings JSONB DEFAULT '[]',
    sections JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Alert Rules
-- ============================================

CREATE TABLE alert_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    severity alert_severity NOT NULL DEFAULT 'medium',
    condition_type alert_condition_type NOT NULL,
    condition_config JSONB NOT NULL DEFAULT '{}',
    region_name VARCHAR(200),
    region_center GEOGRAPHY(Point, 4326),
    region_radius_km DOUBLE PRECISION,
    cooldown_minutes INTEGER DEFAULT 60,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Alert History
-- ============================================

CREATE TABLE alert_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    severity alert_severity NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Intel report indexes
CREATE INDEX idx_intel_reports_region_generated ON intel_reports (region_name, generated_at DESC);
CREATE INDEX idx_intel_reports_classification ON intel_reports (classification);
CREATE INDEX idx_intel_reports_threat_level ON intel_reports (threat_level);
CREATE INDEX idx_intel_reports_center ON intel_reports USING GIST (region_center) WHERE region_center IS NOT NULL;

-- Alert rule indexes
CREATE INDEX idx_alert_rules_enabled ON alert_rules (enabled) WHERE enabled = TRUE;
CREATE INDEX idx_alert_rules_severity ON alert_rules (severity);
CREATE INDEX idx_alert_rules_condition_type ON alert_rules (condition_type);
CREATE INDEX idx_alert_rules_center ON alert_rules USING GIST (region_center) WHERE region_center IS NOT NULL;

-- Alert history indexes
CREATE INDEX idx_alert_history_triggered ON alert_history (triggered_at DESC, acknowledged);
CREATE INDEX idx_alert_history_rule ON alert_history (rule_id);
CREATE INDEX idx_alert_history_severity ON alert_history (severity);
