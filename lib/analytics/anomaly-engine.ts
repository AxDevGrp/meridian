/**
 * Anomaly Detection Engine.
 * Analyzes current data snapshots and identifies anomalies across
 * vessels, aircraft, GPS jamming, markets, social sentiment, and conflicts.
 */

import type {
    Anomaly,
    AnomalySeverity,
    VesselDeviationAnomaly,
    AircraftLoiteringAnomaly,
    GpsJammingClusterAnomaly,
    MarketAnomaly,
    SentimentShiftAnomaly,
    ConflictEscalationAnomaly,
} from "@/lib/types/analytics";
import type { Vessel } from "@/lib/types/vessel";
import type { Aircraft } from "@/lib/types/aircraft";
import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import type { MarketInstrument } from "@/lib/types/market";
import type { SocialPost } from "@/lib/types/social-post";
import type { ConflictEvent } from "@/lib/types/conflict";

import { zScoreWithThreshold, kernelDensityEstimate, mean, standardDeviation } from "./stats";
import { haversineKm } from "@/lib/correlation-engine";
import { MONITORED_REGIONS, findNearestRegion } from "./regions";

// ============================================
// Data Snapshot Interface
// ============================================

export interface AnomalyDataSnapshot {
    conflicts: ConflictEvent[];
    gpsJamming: GPSJammingZone[];
    vessels: Vessel[];
    aircraft: Aircraft[];
    socialPosts: SocialPost[];
    marketInstruments: MarketInstrument[];
}

// ============================================
// Shipping Lanes
// ============================================

interface ShippingLane {
    name: string;
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
    normalWidthKm: number;
}

const SHIPPING_LANES: ShippingLane[] = [
    {
        name: "Hormuz VLCC Inbound",
        start: { lat: 26.2, lng: 56.0 },
        end: { lat: 26.9, lng: 56.5 },
        normalWidthKm: 10,
    },
    {
        name: "Suez Approach (South)",
        start: { lat: 29.8, lng: 32.5 },
        end: { lat: 30.0, lng: 32.6 },
        normalWidthKm: 5,
    },
    {
        name: "Malacca Strait TSS",
        start: { lat: 1.2, lng: 103.5 },
        end: { lat: 4.0, lng: 100.0 },
        normalWidthKm: 8,
    },
    {
        name: "English Channel TSS",
        start: { lat: 50.5, lng: -1.5 },
        end: { lat: 51.0, lng: 1.5 },
        normalWidthKm: 6,
    },
    {
        name: "Taiwan Strait Median",
        start: { lat: 23.0, lng: 118.5 },
        end: { lat: 25.5, lng: 119.5 },
        normalWidthKm: 15,
    },
    {
        name: "Bab el-Mandeb Transit",
        start: { lat: 12.4, lng: 43.2 },
        end: { lat: 12.8, lng: 43.5 },
        normalWidthKm: 8,
    },
];

/**
 * Calculate the minimum distance from a point to a line segment (great-circle approximation).
 * Uses perpendicular distance to the line, clamped to segment endpoints.
 */
function distanceToLane(
    lat: number,
    lng: number,
    lane: ShippingLane,
): number {
    const dTotal = haversineKm(lane.start.lat, lane.start.lng, lane.end.lat, lane.end.lng);
    if (dTotal === 0) return haversineKm(lat, lng, lane.start.lat, lane.start.lng);

    const dStart = haversineKm(lat, lng, lane.start.lat, lane.start.lng);
    const dEnd = haversineKm(lat, lng, lane.end.lat, lane.end.lng);

    // Project the point onto the line segment using dot-product approximation
    // Vector from start to end (approximate in lat/lng space)
    const dx = lane.end.lng - lane.start.lng;
    const dy = lane.end.lat - lane.start.lat;
    const px = lng - lane.start.lng;
    const py = lat - lane.start.lat;

    const dot = px * dx + py * dy;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? dot / lenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projLat = lane.start.lat + t * dy;
    const projLng = lane.start.lng + t * dx;

    return haversineKm(lat, lng, projLat, projLng);
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Run all anomaly detectors on the provided data snapshot.
 * Returns a combined array of all detected anomalies.
 */
export function detectAnomalies(data: AnomalyDataSnapshot): Anomaly[] {
    const anomalies: Anomaly[] = [];

    anomalies.push(...detectVesselDeviations(data.vessels));
    anomalies.push(...detectAircraftLoitering(data.aircraft, data.conflicts, data.gpsJamming));
    anomalies.push(...detectGpsJammingClusters(data.gpsJamming));
    anomalies.push(...detectMarketAnomalies(data.marketInstruments));
    anomalies.push(...detectSentimentShifts(data.socialPosts));
    anomalies.push(...detectConflictEscalation(data.conflicts));

    return anomalies;
}

// ============================================
// Vessel Deviations
// ============================================

/**
 * Detect vessels that have deviated significantly from known shipping lanes.
 * Thresholds: >50km = critical, >30km = high, >20km = medium, else low.
 */
function detectVesselDeviations(vessels: Vessel[]): VesselDeviationAnomaly[] {
    const anomalies: VesselDeviationAnomaly[] = [];

    for (const vessel of vessels) {
        if (!vessel.latitude || !vessel.longitude) continue;

        // Find the nearest shipping lane
        let minDistance = Infinity;
        let nearestLane: ShippingLane | null = null;

        for (const lane of SHIPPING_LANES) {
            const distance = distanceToLane(vessel.latitude, vessel.longitude, lane);
            if (distance < minDistance) {
                minDistance = distance;
                nearestLane = lane;
            }
        }

        if (!nearestLane) continue;

        // Only flag if beyond 2x the lane's normal width
        const deviationThreshold = nearestLane.normalWidthKm * 2;
        if (minDistance <= deviationThreshold) continue;

        const deviationKm = Math.round(minDistance * 10) / 10;

        let severity: AnomalySeverity;
        if (deviationKm > 50) severity = "critical";
        else if (deviationKm > 30) severity = "high";
        else if (deviationKm > 20) severity = "medium";
        else severity = "low";

        const score = Math.min(1.0, deviationKm / (nearestLane.normalWidthKm * 4));
        const region = findNearestRegion(vessel.latitude, vessel.longitude);

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "vessel_deviation",
            severity,
            title: `${vessel.name || "Unknown vessel"} deviating from ${nearestLane.name}`,
            description: `Vessel ${vessel.name || vessel.mmsi} has deviated ${deviationKm}km from the ${nearestLane.name} shipping lane.`,
            detectedAt: new Date().toISOString(),
            location: { lat: vessel.latitude, lng: vessel.longitude },
            regionName: region?.name,
            score: Math.round(score * 100) / 100,
            metadata: {
                vesselId: vessel.mmsi,
                vesselName: vessel.name || "Unknown",
                expectedLane: nearestLane.name,
                deviationKm,
                heading: vessel.course ?? 0,
                speed: vessel.speed ?? 0,
            },
        });
    }

    return anomalies;
}

// ============================================
// Aircraft Loitering
// ============================================

/**
 * Detect aircraft that appear to be loitering over sensitive areas.
 * Heuristics: slow speed, low altitude, near a conflict or GPS jamming zone.
 */
function detectAircraftLoitering(
    aircraft: Aircraft[],
    conflicts: ConflictEvent[],
    gpsJamming: GPSJammingZone[],
): AircraftLoiteringAnomaly[] {
    const anomalies: AircraftLoiteringAnomaly[] = [];

    // Build set of conflict/jamming hot zones
    const hotZones: { lat: number; lng: number; radiusKm: number }[] = [];
    for (const conflict of conflicts) {
        hotZones.push({ lat: conflict.latitude, lng: conflict.longitude, radiusKm: 50 });
    }
    for (const zone of gpsJamming) {
        hotZones.push({ lat: zone.latitude, lng: zone.longitude, radiusKm: zone.radiusKm });
    }

    for (const ac of aircraft) {
        if (!ac.latitude || !ac.longitude || ac.onGround) continue;

        // Convert m/s to knots (1 m/s ≈ 1.944 knots)
        const speedKnots = (ac.velocity ?? 0) * 1.944;
        // Convert meters to feet (1 m ≈ 3.281 ft)
        const altitudeFt = (ac.baroAltitude ?? ac.geoAltitude ?? 50000) * 3.281;

        // Loitering heuristic: slow and low
        const isSlow = speedKnots < 200;
        const isLow = altitudeFt < 10000;

        // Check heading changes as proxy for circling
        // Since we don't have track history, use heading presence as secondary indicator
        const hasHeadingData = ac.heading !== null;

        // Check proximity to hot zones
        let nearHotZone = false;
        let hotZoneDistance = Infinity;
        for (const zone of hotZones) {
            const dist = haversineKm(ac.latitude, ac.longitude, zone.lat, zone.lng);
            if (dist < zone.radiusKm * 1.5) {
                nearHotZone = true;
                hotZoneDistance = Math.min(hotZoneDistance, dist);
            }
        }

        // Must be near a hot zone AND exhibit suspicious behavior
        if (!nearHotZone) continue;
        if (!isSlow && !isLow) continue;

        // Score based on composite factors
        const speedScore = isSlow ? 0.4 : 0.1;
        const altitudeScore = isLow ? 0.3 : 0.1;
        const proximityScore = Math.max(0, 0.3 * (1 - hotZoneDistance / 100));
        const rawScore = speedScore + altitudeScore + proximityScore;
        const score = Math.min(1.0, Math.round(rawScore * 100) / 100);

        let severity: AnomalySeverity;
        if (score > 0.8) severity = "critical";
        else if (score > 0.6) severity = "high";
        else if (score > 0.4) severity = "medium";
        else severity = "low";

        const region = findNearestRegion(ac.latitude, ac.longitude);

        // Estimate circle count and duration from heuristics
        const estimatedCircles = isSlow && isLow ? 3 : 1;
        const estimatedDuration = isSlow ? 60 : 30;
        const estimatedRadius = isSlow ? 25 : 50;

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "aircraft_loitering",
            severity,
            title: `Aircraft ${ac.callsign?.trim() || ac.icao24} loitering near ${region?.name || "conflict zone"}`,
            description: `Aircraft ${ac.callsign?.trim() || ac.icao24} from ${ac.originCountry} detected at ${Math.round(altitudeFt)}ft, ${Math.round(speedKnots)}kts near a conflict/jamming zone.`,
            detectedAt: new Date().toISOString(),
            location: { lat: ac.latitude, lng: ac.longitude },
            regionName: region?.name,
            score,
            metadata: {
                aircraftId: ac.icao24,
                callsign: ac.callsign?.trim() || "UNKNOWN",
                circleCount: estimatedCircles,
                durationMinutes: estimatedDuration,
                radiusKm: estimatedRadius,
                altitude: Math.round(altitudeFt),
            },
        });
    }

    return anomalies;
}

// ============================================
// GPS Jamming Clusters
// ============================================

/**
 * Detect clusters of GPS jamming zones within monitored regions.
 * Flags when 2+ zones appear within a region's radius.
 * Severity: >=5 = critical, >=3 = high, >=2 = medium.
 */
function detectGpsJammingClusters(gpsJamming: GPSJammingZone[]): GpsJammingClusterAnomaly[] {
    const anomalies: GpsJammingClusterAnomaly[] = [];
    if (gpsJamming.length < 2) return anomalies;

    for (const region of MONITORED_REGIONS) {
        const zonesInRegion = gpsJamming.filter((zone) => {
            const dist = haversineKm(zone.latitude, zone.longitude, region.center.lat, region.center.lng);
            return dist <= region.radiusKm;
        });

        if (zonesInRegion.length < 2) continue;

        const count = zonesInRegion.length;
        let severity: AnomalySeverity;
        if (count >= 5) severity = "critical";
        else if (count >= 3) severity = "high";
        else severity = "medium";

        // Find cluster center using kernel density
        const points = zonesInRegion.map((z) => ({ lat: z.latitude, lng: z.longitude }));
        const kde = kernelDensityEstimate(points, 50);
        const densestPoint = kde.reduce((a, b) => (a.density > b.density ? a : b), kde[0]);

        // Determine cluster radius (max distance from center to any zone)
        let maxRadius = 0;
        for (const zone of zonesInRegion) {
            const dist = haversineKm(zone.latitude, zone.longitude, densestPoint.center.lat, densestPoint.center.lng);
            maxRadius = Math.max(maxRadius, dist);
        }

        // Determine peak severity from zones
        const severityOrder = ["critical", "high", "medium", "low"];
        const peakSeverity = zonesInRegion.reduce((best, zone) => {
            const bestIdx = severityOrder.indexOf(best);
            const zoneIdx = severityOrder.indexOf(zone.severity);
            return zoneIdx < bestIdx ? zone.severity : best;
        }, "low");

        // Time span between earliest and latest detection
        const timestamps = zonesInRegion
            .map((z) => new Date(z.firstDetected).getTime())
            .filter((t) => !isNaN(t));
        const timeSpanMinutes = timestamps.length >= 2
            ? Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60_000)
            : 0;

        const score = Math.min(1.0, count / 6);

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "gps_jamming_cluster",
            severity,
            title: `GPS jamming cluster — ${region.name}`,
            description: `${count} GPS jamming zones detected within ${Math.round(maxRadius)}km radius in the ${region.name} region.`,
            detectedAt: new Date().toISOString(),
            location: densestPoint.center,
            regionName: region.name,
            score: Math.round(score * 100) / 100,
            metadata: {
                zoneCount: count,
                clusterRadiusKm: Math.round(maxRadius),
                peakSeverity,
                affectedRegion: region.name,
                timeSpanMinutes,
            },
        });
    }

    return anomalies;
}

// ============================================
// Market Anomalies
// ============================================

/**
 * Detect market anomalies using z-score analysis on price changes.
 * Synthetic baselines: stocks mean=0.1 stdDev=1.5, commodities mean=0.2 stdDev=2.0.
 * Flags when |zScore| > 2.0.
 */
function detectMarketAnomalies(instruments: MarketInstrument[]): MarketAnomaly[] {
    const anomalies: MarketAnomaly[] = [];

    for (const inst of instruments) {
        if (inst.changePercent === null || inst.changePercent === undefined) continue;

        // Synthetic historical baseline based on asset class
        const isCommodity = inst.assetClass === "commodity" || inst.assetClass === "future";
        const baselineMean = isCommodity ? 0.2 : 0.1;
        const baselineStdDev = isCommodity ? 2.0 : 1.5;

        // Generate a synthetic baseline array for zScoreWithThreshold
        // 30-day baseline centered on mean with given stdDev
        const syntheticBaseline: number[] = [];
        for (let i = 0; i < 30; i++) {
            syntheticBaseline.push(baselineMean + (i % 3 - 1) * baselineStdDev * 0.5);
        }

        const result = zScoreWithThreshold(inst.changePercent, syntheticBaseline, 2.0);

        if (!result.isAnomaly) continue;

        const absZ = Math.abs(result.zScore);
        let severity: AnomalySeverity;
        if (absZ > 3.5) severity = "critical";
        else if (absZ > 2.5) severity = "high";
        else severity = "medium";

        const direction = inst.changePercent > 0 ? "surge" : "decline";
        const score = Math.min(1.0, absZ / 4.0);

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "market_anomaly",
            severity,
            title: `${inst.name} ${direction} (${inst.changePercent > 0 ? "+" : ""}${inst.changePercent.toFixed(2)}%)`,
            description: `${inst.name} (${inst.symbol}) experienced a ${Math.abs(inst.changePercent).toFixed(2)}% ${direction} with a z-score of ${absZ.toFixed(2)} against the 30-day baseline.`,
            detectedAt: new Date().toISOString(),
            location: undefined,
            regionName: undefined,
            score: Math.round(score * 100) / 100,
            metadata: {
                symbol: inst.symbol,
                instrumentName: inst.name,
                zScore: Math.round(result.zScore * 100) / 100,
                changePercent: inst.changePercent,
                historicalAvgChange: baselineMean,
                volume: inst.volume ?? 0,
            },
        });
    }

    return anomalies;
}

// ============================================
// Sentiment Shifts
// ============================================

/**
 * Detect negative sentiment shifts in social media posts.
 * Groups posts by platform, flags platforms with avg sentiment < -0.3.
 */
function detectSentimentShifts(posts: SocialPost[]): SentimentShiftAnomaly[] {
    const anomalies: SentimentShiftAnomaly[] = [];
    if (posts.length === 0) return anomalies;

    // Group posts by platform
    const byPlatform = new Map<string, SocialPost[]>();
    for (const post of posts) {
        const existing = byPlatform.get(post.platform) ?? [];
        existing.push(post);
        byPlatform.set(post.platform, existing);
    }

    for (const [platform, platformPosts] of byPlatform) {
        const scores = platformPosts
            .map((p) => p.sentimentScore)
            .filter((s): s is number => s !== null && s !== undefined);

        if (scores.length === 0) continue;

        const avgSentiment = mean(scores);

        // Only flag if average sentiment is significantly negative
        if (avgSentiment >= -0.3) continue;

        const previousSentiment = 0.0; // neutral baseline
        const shiftMagnitude = Math.abs(avgSentiment - previousSentiment);
        const score = Math.min(1.0, shiftMagnitude);

        let severity: AnomalySeverity;
        if (avgSentiment < -0.7) severity = "critical";
        else if (avgSentiment < -0.5) severity = "high";
        else severity = "medium";

        // Pick the most negative posts as triggers (up to 3)
        const sortedPosts = [...platformPosts]
            .filter((p) => p.sentimentScore !== null)
            .sort((a, b) => (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0))
            .slice(0, 3);

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "sentiment_shift",
            severity,
            title: `Negative sentiment surge on ${platform}`,
            description: `Average sentiment on ${platform} dropped to ${avgSentiment.toFixed(2)} across ${scores.length} posts, a significant shift from the neutral baseline.`,
            detectedAt: new Date().toISOString(),
            location: undefined,
            regionName: undefined,
            score: Math.round(score * 100) / 100,
            metadata: {
                platform,
                previousSentiment,
                currentSentiment: Math.round(avgSentiment * 100) / 100,
                shiftMagnitude: Math.round(shiftMagnitude * 100) / 100,
                postCount: scores.length,
                triggerPosts: sortedPosts.map((p) => p.id),
            },
        });
    }

    return anomalies;
}

// ============================================
// Conflict Escalation
// ============================================

/** Severity weight map for conflict escalation scoring. */
const CONFLICT_SEVERITY_WEIGHT: Record<string, number> = {
    battles: 1.0,
    explosions_remote_violence: 0.9,
    violence_against_civilians: 0.8,
    riots: 0.5,
    protests: 0.3,
    strategic_developments: 0.2,
};

/**
 * Detect conflict escalation by grouping conflicts per monitored region.
 * Flags when count >= 3 in a region with high-severity events.
 */
function detectConflictEscalation(conflicts: ConflictEvent[]): ConflictEscalationAnomaly[] {
    const anomalies: ConflictEscalationAnomaly[] = [];
    if (conflicts.length < 3) return anomalies;

    // Group conflicts by nearest monitored region
    const byRegion = new Map<string, ConflictEvent[]>();
    for (const conflict of conflicts) {
        const region = findNearestRegion(conflict.latitude, conflict.longitude);
        if (!region) continue;
        // Only count if within 2x the region radius
        const dist = haversineKm(conflict.latitude, conflict.longitude, region.center.lat, region.center.lng);
        if (dist > region.radiusKm * 2) continue;

        const existing = byRegion.get(region.name) ?? [];
        existing.push(conflict);
        byRegion.set(region.name, existing);
    }

    for (const [regionName, regionConflicts] of byRegion) {
        if (regionConflicts.length < 3) continue;

        const count = regionConflicts.length;

        // Determine max severity from event types
        const severityOrder = ["battles", "explosions_remote_violence", "violence_against_civilians", "riots", "protests", "strategic_developments"];
        let maxSeverityType = "strategic_developments";
        for (const conflict of regionConflicts) {
            const idx = severityOrder.indexOf(conflict.eventType);
            const curIdx = severityOrder.indexOf(maxSeverityType);
            if (idx >= 0 && idx < curIdx) {
                maxSeverityType = conflict.eventType;
            }
        }

        // Map to severity label
        let maxSeverity: string;
        const maxWeight = CONFLICT_SEVERITY_WEIGHT[maxSeverityType] ?? 0.3;
        if (maxWeight >= 0.9) maxSeverity = "critical";
        else if (maxWeight >= 0.7) maxSeverity = "high";
        else if (maxWeight >= 0.4) maxSeverity = "medium";
        else maxSeverity = "low";

        // Compute escalation rate (compared to a baseline of 2)
        const baselineCount = 2;
        const escalationRate = count / baselineCount;

        // Determine anomaly severity
        let severity: AnomalySeverity;
        if (maxSeverity === "critical" && count >= 5) severity = "critical";
        else if (maxSeverity === "critical" || count >= 5) severity = "high";
        else if (count >= 3) severity = "medium";
        else severity = "low";

        // Score: count * maxSeverityWeight, normalized
        const rawScore = (count * maxWeight) / 10;
        const score = Math.min(1.0, Math.round(rawScore * 100) / 100);

        // Calculate time window from conflict dates
        const timestamps = regionConflicts
            .map((c) => new Date(c.eventDate).getTime())
            .filter((t) => !isNaN(t));
        const timeWindowHours = timestamps.length >= 2
            ? Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 3_600_000)
            : 24;

        const region = MONITORED_REGIONS.find((r) => r.name === regionName);

        anomalies.push({
            id: crypto.randomUUID(),
            kind: "conflict_escalation",
            severity,
            title: `Conflict escalation — ${regionName}`,
            description: `${count} conflict events detected in the ${regionName} region (baseline: ${baselineCount}). Escalation rate: ${escalationRate.toFixed(1)}x. Peak severity: ${maxSeverity}.`,
            detectedAt: new Date().toISOString(),
            location: region?.center,
            regionName,
            score,
            metadata: {
                regionName,
                previousCount: baselineCount,
                currentCount: count,
                escalationRate: Math.round(escalationRate * 100) / 100,
                maxSeverity,
                timeWindowHours,
            },
        });
    }

    return anomalies;
}
