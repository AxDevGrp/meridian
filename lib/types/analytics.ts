/**
 * Analytics subsystem domain types.
 * Anomalies, risk scores, patterns, statistical primitives, and dashboard types.
 */

// ============================================
// Anomaly Types
// ============================================

export type AnomalyKind =
    | "vessel_deviation"
    | "aircraft_loitering"
    | "gps_jamming_cluster"
    | "market_anomaly"
    | "sentiment_shift"
    | "conflict_escalation";

export type AnomalySeverity = "critical" | "high" | "medium" | "low";

export interface BaseAnomaly {
    id: string;
    kind: AnomalyKind;
    severity: AnomalySeverity;
    title: string;
    description: string;
    detectedAt: string;
    location?: { lat: number; lng: number };
    regionName?: string;
    /** Confidence/magnitude score: 0.0–1.0 */
    score: number;
    metadata: Record<string, unknown>;
}

export interface VesselDeviationAnomaly extends BaseAnomaly {
    kind: "vessel_deviation";
    metadata: {
        vesselId: string;
        vesselName: string;
        expectedLane: string;
        deviationKm: number;
        heading: number;
        speed: number;
    };
}

export interface AircraftLoiteringAnomaly extends BaseAnomaly {
    kind: "aircraft_loitering";
    metadata: {
        aircraftId: string;
        callsign: string;
        circleCount: number;
        durationMinutes: number;
        radiusKm: number;
        altitude: number;
    };
}

export interface GpsJammingClusterAnomaly extends BaseAnomaly {
    kind: "gps_jamming_cluster";
    metadata: {
        zoneCount: number;
        clusterRadiusKm: number;
        peakSeverity: string;
        affectedRegion: string;
        timeSpanMinutes: number;
    };
}

export interface MarketAnomaly extends BaseAnomaly {
    kind: "market_anomaly";
    metadata: {
        symbol: string;
        instrumentName: string;
        zScore: number;
        changePercent: number;
        historicalAvgChange: number;
        volume: number;
    };
}

export interface SentimentShiftAnomaly extends BaseAnomaly {
    kind: "sentiment_shift";
    metadata: {
        platform: string;
        previousSentiment: number;
        currentSentiment: number;
        shiftMagnitude: number;
        postCount: number;
        triggerPosts: string[];
    };
}

export interface ConflictEscalationAnomaly extends BaseAnomaly {
    kind: "conflict_escalation";
    metadata: {
        regionName: string;
        previousCount: number;
        currentCount: number;
        escalationRate: number;
        maxSeverity: string;
        timeWindowHours: number;
    };
}

export type Anomaly =
    | VesselDeviationAnomaly
    | AircraftLoiteringAnomaly
    | GpsJammingClusterAnomaly
    | MarketAnomaly
    | SentimentShiftAnomaly
    | ConflictEscalationAnomaly;

// ============================================
// Risk Score Types
// ============================================

export type RiskLevel = "critical" | "high" | "elevated" | "moderate" | "low";
export type RiskTrend = "deteriorating" | "stable" | "improving";

export interface RiskScore {
    regionName: string;
    regionCenter: { lat: number; lng: number };
    regionRadiusKm: number;
    /** Overall risk score: 0–100 */
    overallScore: number;
    riskLevel: RiskLevel;
    trend: RiskTrend;
    factors: RiskFactors;
    /** Last 24 data points for sparkline rendering */
    sparklineHistory: number[];
    computedAt: string;
}

export interface RiskFactors {
    conflictIntensity: RiskFactor;
    militaryActivity: RiskFactor;
    gpsJamming: RiskFactor;
    marketVolatility: RiskFactor;
    socialSentiment: RiskFactor;
    vesselTraffic: RiskFactor;
    historicalBaseline: RiskFactor;
}

export interface RiskFactor {
    name: string;
    /** Factor score: 0–100 */
    score: number;
    /** Weight in the composite: 0.0–1.0, all weights sum to 1.0 */
    weight: number;
    trend: RiskTrend;
    detail: string;
}

// ============================================
// Pattern Types
// ============================================

export type PatternKind =
    | "temporal_correlation"
    | "spatial_cluster"
    | "sequence_detection"
    | "entity_cooccurrence";

export interface BasePattern {
    id: string;
    kind: PatternKind;
    title: string;
    description: string;
    /** Confidence: 0.0–1.0 */
    confidence: number;
    detectedAt: string;
    involvedLayers: string[];
    metadata: Record<string, unknown>;
}

export interface TemporalCorrelation extends BasePattern {
    kind: "temporal_correlation";
    metadata: {
        events: { layer: string; id: string; title: string; timestamp: string }[];
        timeWindowMinutes: number;
        correlationStrength: number;
    };
}

export interface SpatialCluster extends BasePattern {
    kind: "spatial_cluster";
    metadata: {
        center: { lat: number; lng: number };
        radiusKm: number;
        entityCount: number;
        layers: string[];
        density: number;
    };
}

export interface SequenceDetection extends BasePattern {
    kind: "sequence_detection";
    metadata: {
        steps: { order: number; layer: string; description: string; timestamp: string }[];
        patternName: string;
        recurrenceCount: number;
    };
}

export interface EntityCooccurrence extends BasePattern {
    kind: "entity_cooccurrence";
    metadata: {
        entities: { type: string; id: string; name: string }[];
        incidentCount: number;
        regions: string[];
        firstSeen: string;
        lastSeen: string;
    };
}

export type Pattern =
    | TemporalCorrelation
    | SpatialCluster
    | SequenceDetection
    | EntityCooccurrence;

// ============================================
// Statistical Primitives
// ============================================

export interface TimeSeriesPoint {
    timestamp: number;
    value: number;
}

export interface MovingAverageResult {
    values: number[];
    period: number;
}

export interface ZScoreResult {
    zScore: number;
    mean: number;
    stdDev: number;
    isAnomaly: boolean;
    threshold: number;
}

export interface TrendResult {
    slope: number;
    direction: RiskTrend;
    rSquared: number;
    prediction: number;
}

export interface KernelDensityResult {
    center: { lat: number; lng: number };
    density: number;
    bandwidth: number;
}

// ============================================
// Analytics Dashboard Types
// ============================================

export interface AnalyticsSnapshot {
    anomalies: Anomaly[];
    riskScores: RiskScore[];
    patterns: Pattern[];
    computedAt: string;
    isSampleData: boolean;
}

export type AnalyticsFilterKind = "all" | AnomalyKind;
export type AnalyticsSortBy = "severity" | "time" | "score";

// ============================================
// Helper Functions
// ============================================

/** Tailwind-compatible color classes for anomaly severity badges */
export function getAnomalySeverityColor(severity: AnomalySeverity): string {
    switch (severity) {
        case "critical":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "high":
            return "text-orange-400 bg-orange-950/50 border-orange-800";
        case "medium":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "low":
            return "text-green-400 bg-green-950/50 border-green-800";
    }
}

/** Lucide icon name for an anomaly kind */
export function getAnomalyKindIcon(kind: AnomalyKind): string {
    switch (kind) {
        case "vessel_deviation":
            return "Ship";
        case "aircraft_loitering":
            return "Plane";
        case "gps_jamming_cluster":
            return "Radio";
        case "market_anomaly":
            return "TrendingUp";
        case "sentiment_shift":
            return "MessageSquare";
        case "conflict_escalation":
            return "Swords";
    }
}

/** Human-readable label for an anomaly kind */
export function getAnomalyKindLabel(kind: AnomalyKind): string {
    switch (kind) {
        case "vessel_deviation":
            return "Vessel Deviation";
        case "aircraft_loitering":
            return "Aircraft Loitering";
        case "gps_jamming_cluster":
            return "GPS Jamming Cluster";
        case "market_anomaly":
            return "Market Anomaly";
        case "sentiment_shift":
            return "Sentiment Shift";
        case "conflict_escalation":
            return "Conflict Escalation";
    }
}

/** Tailwind-compatible color classes for risk level badges */
export function getRiskLevelColor(level: RiskLevel): string {
    switch (level) {
        case "critical":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "high":
            return "text-orange-400 bg-orange-950/50 border-orange-800";
        case "elevated":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "moderate":
            return "text-yellow-400 bg-yellow-950/50 border-yellow-800";
        case "low":
            return "text-green-400 bg-green-950/50 border-green-800";
    }
}

/** Lucide icon name for a risk trend */
export function getRiskTrendIcon(trend: RiskTrend): string {
    switch (trend) {
        case "deteriorating":
            return "TrendingUp";
        case "stable":
            return "Minus";
        case "improving":
            return "TrendingDown";
    }
}

/** Lucide icon name for a pattern kind */
export function getPatternKindIcon(kind: PatternKind): string {
    switch (kind) {
        case "temporal_correlation":
            return "Clock";
        case "spatial_cluster":
            return "MapPin";
        case "sequence_detection":
            return "ListOrdered";
        case "entity_cooccurrence":
            return "Users";
    }
}

/** Human-readable label for a pattern kind */
export function getPatternKindLabel(kind: PatternKind): string {
    switch (kind) {
        case "temporal_correlation":
            return "Temporal Correlation";
        case "spatial_cluster":
            return "Spatial Cluster";
        case "sequence_detection":
            return "Sequence Detection";
        case "entity_cooccurrence":
            return "Entity Co-occurrence";
    }
}

/** Convert a 0–100 numeric score to a RiskLevel */
export function scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 40) return "elevated";
    if (score >= 20) return "moderate";
    return "low";
}
