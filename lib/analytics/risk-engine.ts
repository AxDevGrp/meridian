/**
 * Risk Scoring Engine.
 * Computes composite 0–100 risk scores for each monitored region
 * based on all data layers: conflicts, military activity, GPS jamming,
 * market volatility, social sentiment, vessel traffic, and historical baselines.
 */

import type {
    RiskScore,
    RiskFactors,
    RiskFactor,
    RiskTrend,
    TimeSeriesPoint,
} from "@/lib/types/analytics";
import { scoreToRiskLevel } from "@/lib/types/analytics";
import type { AnomalyDataSnapshot } from "./anomaly-engine";
import { MONITORED_REGIONS, type MonitoredRegion } from "./regions";
import { haversineKm } from "@/lib/correlation-engine";
import { trendDirection } from "./stats";

// ============================================
// Historical Baselines
// ============================================

const HISTORICAL_BASELINES: Record<string, number> = {
    "Strait of Hormuz": 65,
    "South China Sea": 55,
    "Black Sea": 70,
    "Eastern Mediterranean": 50,
    "Taiwan Strait": 60,
    "Red Sea / Gulf of Aden": 75,
    "Korean Peninsula": 50,
    "Sub-Saharan Africa": 60,
};

// ============================================
// Region-to-sector mapping for market correlation
// ============================================

const REGION_SECTOR_MAP: Record<string, string[]> = {
    "Strait of Hormuz": ["energy", "shipping"],
    "South China Sea": ["technology", "shipping", "defense"],
    "Black Sea": ["energy", "agriculture", "defense"],
    "Eastern Mediterranean": ["energy", "defense"],
    "Taiwan Strait": ["technology", "defense"],
    "Red Sea / Gulf of Aden": ["energy", "shipping"],
    "Korean Peninsula": ["technology", "defense"],
    "Sub-Saharan Africa": ["materials", "energy"],
};

// ============================================
// Public API
// ============================================

/**
 * Compute risk scores for all monitored regions.
 */
export function computeRiskScores(data: AnomalyDataSnapshot): RiskScore[] {
    return MONITORED_REGIONS.map((region) => computeRegionRisk(region, data));
}

/**
 * Compute the composite risk score for a single monitored region.
 */
export function computeRegionRisk(
    region: MonitoredRegion,
    data: AnomalyDataSnapshot,
): RiskScore {
    // 1. Compute each of the 7 risk factors
    const factors: RiskFactors = {
        conflictIntensity: computeConflictIntensity(region, data.conflicts),
        militaryActivity: computeMilitaryActivity(region, data.aircraft, data.vessels),
        gpsJamming: computeGpsJammingFactor(region, data.gpsJamming),
        marketVolatility: computeMarketVolatility(region, data.marketInstruments),
        socialSentiment: computeSocialSentiment(region, data.socialPosts),
        vesselTraffic: computeVesselTraffic(region, data.vessels),
        historicalBaseline: computeHistoricalBaseline(region),
    };

    // 2. Weighted sum → overall score 0-100
    const weights = region.defaultRiskWeights;
    const overallScore = Math.min(
        100,
        Math.max(
            0,
            Math.round(
                factors.conflictIntensity.score * weights.conflictIntensity +
                factors.militaryActivity.score * weights.militaryActivity +
                factors.gpsJamming.score * weights.gpsJamming +
                factors.marketVolatility.score * weights.marketVolatility +
                factors.socialSentiment.score * weights.socialSentiment +
                factors.vesselTraffic.score * weights.vesselTraffic +
                factors.historicalBaseline.score * weights.historicalBaseline,
            ),
        ),
    );

    // 3. Map to risk level
    const riskLevel = scoreToRiskLevel(overallScore);

    // 4. Generate sparkline history (24 synthetic points trending toward current score)
    const sparklineHistory = generateSparkline(region.name, overallScore);

    // 5. Determine trend from sparkline
    const sparklinePoints: TimeSeriesPoint[] = sparklineHistory.map((value, i) => ({
        timestamp: i,
        value,
    }));
    const trend = trendDirection(sparklinePoints);

    return {
        regionName: region.name,
        regionCenter: region.center,
        regionRadiusKm: region.radiusKm,
        overallScore,
        riskLevel,
        trend,
        factors,
        sparklineHistory,
        computedAt: new Date().toISOString(),
    };
}

// ============================================
// Factor Calculators
// ============================================

/**
 * Conflict intensity factor.
 * Score = min(100, count * 15 + maxSeverityBonus).
 */
function computeConflictIntensity(
    region: MonitoredRegion,
    conflicts: AnomalyDataSnapshot["conflicts"],
): RiskFactor {
    const nearby = conflicts.filter(
        (c) =>
            haversineKm(region.center.lat, region.center.lng, c.latitude, c.longitude) <=
            region.radiusKm,
    );

    const count = nearby.length;

    // Determine max severity from event types
    const severityOrder = [
        "battles",
        "explosions_remote_violence",
        "violence_against_civilians",
        "riots",
        "protests",
        "strategic_developments",
    ];
    let maxSeverityType = "strategic_developments";
    for (const conflict of nearby) {
        const idx = severityOrder.indexOf(conflict.eventType);
        const curIdx = severityOrder.indexOf(maxSeverityType);
        if (idx >= 0 && idx < curIdx) {
            maxSeverityType = conflict.eventType;
        }
    }

    let maxSeverityLabel: string;
    if (maxSeverityType === "battles" || maxSeverityType === "explosions_remote_violence") {
        maxSeverityLabel = "critical";
    } else if (
        maxSeverityType === "violence_against_civilians" ||
        maxSeverityType === "riots"
    ) {
        maxSeverityLabel = "high";
    } else {
        maxSeverityLabel = "medium";
    }

    let severityBonus = 0;
    if (maxSeverityLabel === "critical") severityBonus = 30;
    else if (maxSeverityLabel === "high") severityBonus = 20;
    else if (maxSeverityLabel === "medium") severityBonus = 10;

    const score = count === 0 ? 0 : Math.min(100, count * 15 + severityBonus);

    return {
        name: "Conflict Intensity",
        score,
        weight: region.defaultRiskWeights.conflictIntensity,
        trend: "stable" as RiskTrend,
        detail:
            count === 0
                ? "No conflicts detected"
                : `${count} conflicts, highest severity: ${maxSeverityLabel}`,
    };
}

/**
 * Military activity factor.
 * Counts aircraft < 15000ft altitude + vessels with military-like flags.
 * Score = min(100, (aircraftCount * 10) + (vesselCount * 15)).
 */
function computeMilitaryActivity(
    region: MonitoredRegion,
    aircraft: AnomalyDataSnapshot["aircraft"],
    vessels: AnomalyDataSnapshot["vessels"],
): RiskFactor {
    // Aircraft within region and altitude < 15000ft (~4572m)
    const nearbyAircraft = aircraft.filter((ac) => {
        if (ac.latitude == null || ac.longitude == null) return false;
        const alt = ac.baroAltitude ?? ac.geoAltitude ?? 99999;
        if (alt > 4572) return false; // 15000ft in meters
        return (
            haversineKm(region.center.lat, region.center.lng, ac.latitude, ac.longitude) <=
            region.radiusKm
        );
    });

    // Vessels with military-like characteristics
    const militaryFlags = new Set([
        "military",
        "navy",
        "coast guard",
        "coastguard",
    ]);
    const nearbyMilitaryVessels = vessels.filter((v) => {
        const inRegion =
            haversineKm(region.center.lat, region.center.lng, v.latitude, v.longitude) <=
            region.radiusKm;
        if (!inRegion) return false;
        // Check vessel type or flag for military indicators
        return (
            v.vesselType === "military" ||
            (v.flag != null && militaryFlags.has(v.flag.toLowerCase()))
        );
    });

    const aircraftCount = nearbyAircraft.length;
    const vesselCount = nearbyMilitaryVessels.length;
    const score = Math.min(100, aircraftCount * 10 + vesselCount * 15);

    return {
        name: "Military Activity",
        score,
        weight: region.defaultRiskWeights.militaryActivity,
        trend: "stable" as RiskTrend,
        detail: `${aircraftCount} aircraft, ${vesselCount} vessels detected`,
    };
}

/**
 * GPS jamming factor.
 * Score = min(100, count * 25 + severityBonus).
 */
function computeGpsJammingFactor(
    region: MonitoredRegion,
    gpsJamming: AnomalyDataSnapshot["gpsJamming"],
): RiskFactor {
    const nearby = gpsJamming.filter(
        (z) =>
            haversineKm(region.center.lat, region.center.lng, z.latitude, z.longitude) <=
            region.radiusKm,
    );

    const count = nearby.length;

    // Severity bonus from worst zone
    const severityOrder = ["critical", "high", "medium", "low", "info"];
    let worstSeverity = "info";
    for (const zone of nearby) {
        const idx = severityOrder.indexOf(zone.severity);
        const curIdx = severityOrder.indexOf(worstSeverity);
        if (idx >= 0 && idx < curIdx) {
            worstSeverity = zone.severity;
        }
    }

    let severityBonus = 0;
    if (worstSeverity === "critical") severityBonus = 30;
    else if (worstSeverity === "high") severityBonus = 20;
    else if (worstSeverity === "medium") severityBonus = 10;

    const score = count === 0 ? 0 : Math.min(100, count * 25 + severityBonus);

    return {
        name: "GPS Jamming",
        score,
        weight: region.defaultRiskWeights.gpsJamming,
        trend: "stable" as RiskTrend,
        detail:
            count === 0 ? "No jamming detected" : `${count} jamming zones detected`,
    };
}

/**
 * Market volatility factor.
 * Uses sector-matched instruments for the region.
 * Score = min(100, avgVolatility * 20).
 */
function computeMarketVolatility(
    region: MonitoredRegion,
    instruments: AnomalyDataSnapshot["marketInstruments"],
): RiskFactor {
    const sectors = REGION_SECTOR_MAP[region.name] ?? ["energy"];

    // Filter instruments by sector match
    const matched = instruments.filter(
        (inst) =>
            inst.sector != null &&
            sectors.includes(inst.sector) &&
            inst.changePercent != null,
    );

    if (matched.length === 0) {
        return {
            name: "Market Volatility",
            score: 0,
            weight: region.defaultRiskWeights.marketVolatility,
            trend: "stable" as RiskTrend,
            detail: "No correlated instruments",
        };
    }

    const volatilities = matched.map((inst) => Math.abs(inst.changePercent!));
    const avgVolatility =
        volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    const score = Math.min(100, Math.round(avgVolatility * 20));

    return {
        name: "Market Volatility",
        score,
        weight: region.defaultRiskWeights.marketVolatility,
        trend: "stable" as RiskTrend,
        detail: `Avg volatility: ${avgVolatility.toFixed(2)}%`,
    };
}

/**
 * Social sentiment factor.
 * Score = (1 - normalizedSentiment) * 50 (maps -1..+1 to 100..0).
 */
function computeSocialSentiment(
    region: MonitoredRegion,
    posts: AnomalyDataSnapshot["socialPosts"],
): RiskFactor {
    // Filter posts that reference the region
    const regionLower = region.name.toLowerCase();
    const regionWords = regionLower.split(/[\s/]+/).filter((w) => w.length > 2);

    const relevantPosts = posts.filter((post) => {
        // Check geoReferences
        const geoMatch = post.geoReferences.some((ref) =>
            regionWords.some((word) => ref.toLowerCase().includes(word)),
        );
        if (geoMatch) return true;
        // Check content for region name mention
        const contentLower = post.content.toLowerCase();
        return regionWords.some((word) => contentLower.includes(word));
    });

    if (relevantPosts.length === 0) {
        return {
            name: "Social Sentiment",
            score: 25, // neutral baseline
            weight: region.defaultRiskWeights.socialSentiment,
            trend: "stable" as RiskTrend,
            detail: "No relevant posts found",
        };
    }

    const sentiments = relevantPosts
        .map((p) => p.sentimentScore)
        .filter((s): s is number => s != null);

    if (sentiments.length === 0) {
        return {
            name: "Social Sentiment",
            score: 25,
            weight: region.defaultRiskWeights.socialSentiment,
            trend: "stable" as RiskTrend,
            detail: `${relevantPosts.length} posts, no sentiment data`,
        };
    }

    const avgSentiment =
        sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    // Map -1..+1 to 100..0
    const normalizedSentiment = (avgSentiment + 1) / 2; // 0..1
    const score = Math.round((1 - normalizedSentiment) * 50);

    return {
        name: "Social Sentiment",
        score: Math.min(100, Math.max(0, score)),
        weight: region.defaultRiskWeights.socialSentiment,
        trend: "stable" as RiskTrend,
        detail: `Avg sentiment: ${avgSentiment.toFixed(2)}, ${sentiments.length} posts analyzed`,
    };
}

/**
 * Vessel traffic factor.
 * Higher traffic = higher risk in contested regions.
 * Score = min(100, count * 8).
 */
function computeVesselTraffic(
    region: MonitoredRegion,
    vessels: AnomalyDataSnapshot["vessels"],
): RiskFactor {
    const nearby = vessels.filter(
        (v) =>
            haversineKm(region.center.lat, region.center.lng, v.latitude, v.longitude) <=
            region.radiusKm,
    );

    const count = nearby.length;
    const score = Math.min(100, count * 8);

    return {
        name: "Vessel Traffic",
        score,
        weight: region.defaultRiskWeights.vesselTraffic,
        trend: "stable" as RiskTrend,
        detail: count === 0 ? "No vessels in region" : `${count} vessels in region`,
    };
}

/**
 * Historical baseline factor.
 * Static per-region baseline representing long-term risk.
 */
function computeHistoricalBaseline(region: MonitoredRegion): RiskFactor {
    const score = HISTORICAL_BASELINES[region.name] ?? 50;

    return {
        name: "Historical Baseline",
        score,
        weight: region.defaultRiskWeights.historicalBaseline,
        trend: "stable" as RiskTrend,
        detail: `Historical baseline for ${region.name}`,
    };
}

// ============================================
// Sparkline Generation
// ============================================

/**
 * Simple deterministic hash from a string.
 * Used for seeding sparkline jitter per region.
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0;
    }
    return Math.abs(hash);
}

/**
 * Generate 24 sparkline points that trend toward the current score.
 * Uses a deterministic pattern based on region name hash.
 */
function generateSparkline(regionName: string, currentScore: number): number[] {
    const seed = hashString(regionName);
    const points: number[] = [];
    const jitterRange = 10;

    // Start from a score offset from current
    const startOffset = ((seed % 21) - 10); // -10 to +10
    let value = Math.max(0, Math.min(100, currentScore + startOffset));

    for (let i = 0; i < 24; i++) {
        // Deterministic pseudo-random jitter
        const jitterSeed = (seed * (i + 1) * 7919) % 10000;
        const jitter = ((jitterSeed / 10000) * jitterRange * 2 - jitterRange) * (1 - i / 24);

        // Trend toward current score
        const progress = i / 23;
        value = value + (currentScore - value) * 0.15 + jitter * (1 - progress);
        value = Math.max(0, Math.min(100, value));

        points.push(Math.round(value * 10) / 10);
    }

    return points;
}
