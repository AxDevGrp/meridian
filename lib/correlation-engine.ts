/**
 * Correlation scoring engine.
 * Computes how strongly a geospatial event should be associated with
 * a financial instrument based on severity, sensitivity, proximity,
 * and event-type matching.
 */

import type { InstrumentCorrelation } from "@/lib/types/market";

// ============================================
// Types
// ============================================

export interface CorrelationInput {
    eventType: string;                          // "conflict" | "gps-jamming" | "vessel" | "social"
    eventSeverity: string;                      // "critical" | "high" | "medium" | "low" | "info"
    eventLocation: { lat: number; lng: number };
    correlation: InstrumentCorrelation;
}

export interface CorrelationResult {
    symbol: string;
    score: number;              // 0.0–1.0 composite score
    severityFactor: number;     // 0.0–1.0
    sensitivityFactor: number;  // from correlation mapping
    proximityFactor: number;    // 0.0–1.0 based on distance
    eventTypeMatch: boolean;
}

// ============================================
// Haversine distance (km)
// ============================================

const EARTH_RADIUS_KM = 6_371;

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 */
export function haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================
// Severity mapping
// ============================================

const SEVERITY_MAP: Record<string, number> = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    info: 0.1,
};

function severityToFactor(severity: string): number {
    return SEVERITY_MAP[severity.toLowerCase()] ?? 0.3;
}

// ============================================
// Proximity scoring
// ============================================

/**
 * Compute a 0–1 proximity factor.
 * - 1.0 if distance ≤ regionRadius
 * - Linear decay to 0.0 at 2× regionRadius
 * - 0.0 beyond 2× regionRadius
 *
 * If the correlation has no region center / radius, returns a
 * low default (0.2) — the mapping still applies but weakly.
 */
function computeProximityFactor(
    eventLat: number,
    eventLng: number,
    regionCenter: { lat: number; lng: number } | null,
    regionRadiusKm: number | null,
): number {
    if (!regionCenter || !regionRadiusKm || regionRadiusKm <= 0) {
        return 0.2; // weak default when no geofence is defined
    }

    const distance = haversineKm(eventLat, eventLng, regionCenter.lat, regionCenter.lng);

    if (distance <= regionRadiusKm) return 1.0;
    if (distance >= regionRadiusKm * 2) return 0.0;

    // Linear decay between radius and 2× radius
    return 1.0 - (distance - regionRadiusKm) / regionRadiusKm;
}

// ============================================
// Public API
// ============================================

/**
 * Compute a composite correlation score for a single event–instrument pair.
 */
export function computeCorrelationScore(input: CorrelationInput): CorrelationResult {
    const { eventType, eventSeverity, eventLocation, correlation } = input;

    const severityFactor = severityToFactor(eventSeverity);
    const sensitivityFactor = Math.max(0, Math.min(1, correlation.sensitivity));
    const proximityFactor = computeProximityFactor(
        eventLocation.lat,
        eventLocation.lng,
        correlation.regionCenter,
        correlation.regionRadiusKm,
    );

    const eventTypeMatch = correlation.eventTypes.some(
        (et) => et.toLowerCase() === eventType.toLowerCase(),
    );

    const eventTypeMultiplier = eventTypeMatch ? 1.0 : 0.3;

    const score = severityFactor * sensitivityFactor * proximityFactor * eventTypeMultiplier;

    return {
        symbol: correlation.symbol,
        score: Math.round(score * 1000) / 1000, // 3 decimal places
        severityFactor,
        sensitivityFactor,
        proximityFactor: Math.round(proximityFactor * 1000) / 1000,
        eventTypeMatch,
    };
}

/**
 * Rank a set of correlation inputs by composite score (descending).
 * Filters out results with score ≤ 0.
 */
export function rankCorrelations(inputs: CorrelationInput[]): CorrelationResult[] {
    return inputs
        .map(computeCorrelationScore)
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
}
