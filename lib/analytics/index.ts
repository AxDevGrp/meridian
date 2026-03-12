/**
 * Analytics module barrel export.
 * Re-exports all analytics sub-modules for clean imports.
 */

// Statistical computation library
export {
    mean,
    standardDeviation,
    variance,
    median,
    percentile,
    sma,
    ema,
    zScore,
    zScoreWithThreshold,
    linearRegression,
    trendDirection,
    rollingSentiment,
    rollingZScore,
    kernelDensityEstimate,
    eventFrequency,
    eventAcceleration,
} from "./stats";

// Monitored regions
export {
    MONITORED_REGIONS,
    findRegion,
    findNearestRegion,
} from "./regions";
export type { MonitoredRegion } from "./regions";

// Sample data generators
export {
    generateSampleAnomalies,
    generateSampleRiskScores,
    generateSamplePatterns,
} from "./sample-analytics-data";

// Anomaly detection engine
export {
    detectAnomalies,
} from "./anomaly-engine";
export type { AnomalyDataSnapshot } from "./anomaly-engine";

// Risk scoring engine
export {
    computeRiskScores,
    computeRegionRisk,
} from "./risk-engine";

// Pattern recognition engine
export {
    detectPatterns,
} from "./pattern-engine";
