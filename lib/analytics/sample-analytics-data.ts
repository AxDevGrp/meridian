/**
 * Deterministic sample data generators for the analytics subsystem.
 * Uses seeded Mulberry32 PRNG — no Math.random(), fully reproducible.
 */

import type {
    Anomaly,
    VesselDeviationAnomaly,
    AircraftLoiteringAnomaly,
    GpsJammingClusterAnomaly,
    MarketAnomaly,
    SentimentShiftAnomaly,
    ConflictEscalationAnomaly,
    RiskScore,
    RiskFactors,
    RiskFactor,
    RiskLevel,
    RiskTrend,
    Pattern,
    TemporalCorrelation,
    SpatialCluster,
    SequenceDetection,
    EntityCooccurrence,
    AnomalySeverity,
} from "@/lib/types/analytics";
import { scoreToRiskLevel } from "@/lib/types/analytics";
import { MONITORED_REGIONS } from "./regions";

// ============================================
// Seeded PRNG (Mulberry32)
// ============================================

function mulberry32(seed: number): () => number {
    let state = seed | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Deterministic UUID from seeded PRNG */
function seededUUID(rng: () => number): string {
    const hex = (n: number) => Math.floor(n * 16).toString(16);
    let uuid = "";
    for (let i = 0; i < 32; i++) {
        if (i === 8 || i === 12 || i === 16 || i === 20) uuid += "-";
        if (i === 12) {
            uuid += "4"; // version 4
        } else if (i === 16) {
            uuid += (8 + Math.floor(rng() * 4)).toString(16); // variant
        } else {
            uuid += hex(rng());
        }
    }
    return uuid;
}

/** Pick a random item from an array deterministically */
function pick<T>(arr: T[], rng: () => number): T {
    return arr[Math.floor(rng() * arr.length)];
}

/** Generate a deterministic ISO timestamp offset from base */
function offsetTimestamp(baseMs: number, offsetMinutes: number): string {
    return new Date(baseMs + offsetMinutes * 60_000).toISOString();
}

// Fixed base time for deterministic output (2026-03-12T00:00:00Z)
const BASE_TIME = new Date("2026-03-12T00:00:00Z").getTime();

// ============================================
// Sample Anomalies
// ============================================

/**
 * Generate 12 sample anomalies — 2 per kind — with realistic geospatial data.
 */
export function generateSampleAnomalies(): Anomaly[] {
    const rng = mulberry32(42_001);
    const anomalies: Anomaly[] = [];

    // --- Vessel Deviations (2) ---
    const vesselDeviations: VesselDeviationAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "vessel_deviation",
            severity: "high",
            title: "Tanker deviation near Strait of Hormuz",
            description: "Oil tanker NORDIC AURORA has deviated 34km from the standard VLCC lane approaching the Strait of Hormuz, heading toward Iranian territorial waters.",
            detectedAt: offsetTimestamp(BASE_TIME, -45),
            location: { lat: 26.2, lng: 56.8 },
            regionName: "Strait of Hormuz",
            score: 0.72,
            metadata: {
                vesselId: "MMSI-211334120",
                vesselName: "NORDIC AURORA",
                expectedLane: "Hormuz VLCC Inbound",
                deviationKm: 34,
                heading: 315,
                speed: 8.2,
            },
        },
        {
            id: seededUUID(rng),
            kind: "vessel_deviation",
            severity: "medium",
            title: "Cargo vessel off-course in Malacca Strait",
            description: "Container ship EVER FORTUNE deviating 22km from the Traffic Separation Scheme in the Strait of Malacca.",
            detectedAt: offsetTimestamp(BASE_TIME, -120),
            location: { lat: 2.5, lng: 101.8 },
            regionName: "South China Sea",
            score: 0.48,
            metadata: {
                vesselId: "MMSI-477998300",
                vesselName: "EVER FORTUNE",
                expectedLane: "Malacca TSS Westbound",
                deviationKm: 22,
                heading: 245,
                speed: 12.1,
            },
        },
    ];
    anomalies.push(...vesselDeviations);

    // --- Aircraft Loitering (2) ---
    const aircraftLoitering: AircraftLoiteringAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "aircraft_loitering",
            severity: "high",
            title: "Surveillance aircraft circling over Black Sea",
            description: "NATO reconnaissance aircraft conducting persistent orbit patterns near Crimean coastline at 28,000ft.",
            detectedAt: offsetTimestamp(BASE_TIME, -30),
            location: { lat: 44.2, lng: 33.8 },
            regionName: "Black Sea",
            score: 0.81,
            metadata: {
                aircraftId: "ICAO-AE0412",
                callsign: "FORTE12",
                circleCount: 7,
                durationMinutes: 240,
                radiusKm: 45,
                altitude: 28000,
            },
        },
        {
            id: seededUUID(rng),
            kind: "aircraft_loitering",
            severity: "medium",
            title: "Unidentified aircraft loitering near Taiwan Strait",
            description: "Low-altitude aircraft executing repeated passes along the Taiwan Strait median line.",
            detectedAt: offsetTimestamp(BASE_TIME, -90),
            location: { lat: 24.3, lng: 118.8 },
            regionName: "Taiwan Strait",
            score: 0.63,
            metadata: {
                aircraftId: "ICAO-780C45",
                callsign: "UNKNOWN",
                circleCount: 4,
                durationMinutes: 95,
                radiusKm: 30,
                altitude: 5000,
            },
        },
    ];
    anomalies.push(...aircraftLoitering);

    // --- GPS Jamming Clusters (2) ---
    const gpsJamming: GpsJammingClusterAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "gps_jamming_cluster",
            severity: "critical",
            title: "Intense GPS jamming cluster — Eastern Mediterranean",
            description: "5 GPS jamming zones detected within 120km radius near the Cyprus-Lebanon corridor. Peak severity critical, affecting commercial aviation.",
            detectedAt: offsetTimestamp(BASE_TIME, -15),
            location: { lat: 34.5, lng: 33.5 },
            regionName: "Eastern Mediterranean",
            score: 0.92,
            metadata: {
                zoneCount: 5,
                clusterRadiusKm: 120,
                peakSeverity: "critical",
                affectedRegion: "Eastern Mediterranean",
                timeSpanMinutes: 180,
            },
        },
        {
            id: seededUUID(rng),
            kind: "gps_jamming_cluster",
            severity: "high",
            title: "GPS interference cluster — Black Sea western basin",
            description: "3 GPS interference zones forming a cluster in the western Black Sea, likely related to electronic warfare activity.",
            detectedAt: offsetTimestamp(BASE_TIME, -60),
            location: { lat: 43.5, lng: 30.2 },
            regionName: "Black Sea",
            score: 0.74,
            metadata: {
                zoneCount: 3,
                clusterRadiusKm: 85,
                peakSeverity: "high",
                affectedRegion: "Black Sea",
                timeSpanMinutes: 120,
            },
        },
    ];
    anomalies.push(...gpsJamming);

    // --- Market Anomalies (2) ---
    const marketAnomalies: MarketAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "market_anomaly",
            severity: "high",
            title: "Brent crude oil price spike",
            description: "Brent crude futures surged 4.8% in a single session, z-score of 2.9 against 30-day baseline. Correlated with Strait of Hormuz tensions.",
            detectedAt: offsetTimestamp(BASE_TIME, -50),
            location: undefined,
            regionName: "Strait of Hormuz",
            score: 0.78,
            metadata: {
                symbol: "BZ=F",
                instrumentName: "Brent Crude Oil",
                zScore: 2.9,
                changePercent: 4.8,
                historicalAvgChange: 0.3,
                volume: 485000,
            },
        },
        {
            id: seededUUID(rng),
            kind: "market_anomaly",
            severity: "critical",
            title: "Taiwan semiconductor ETF crash",
            description: "TSMC-heavy semiconductor ETF dropped 6.2% amid escalating Taiwan Strait military exercises. Z-score exceeds 3.5.",
            detectedAt: offsetTimestamp(BASE_TIME, -25),
            location: undefined,
            regionName: "Taiwan Strait",
            score: 0.91,
            metadata: {
                symbol: "SOXX",
                instrumentName: "iShares Semiconductor ETF",
                zScore: -3.7,
                changePercent: -6.2,
                historicalAvgChange: 0.1,
                volume: 1_230_000,
            },
        },
    ];
    anomalies.push(...marketAnomalies);

    // --- Sentiment Shifts (2) ---
    const sentimentShifts: SentimentShiftAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "sentiment_shift",
            severity: "medium",
            title: "Negative sentiment surge on X — Red Sea conflict",
            description: "Social media sentiment on X plummeted to -0.45 average regarding Red Sea shipping attacks, a significant shift from the -0.1 baseline.",
            detectedAt: offsetTimestamp(BASE_TIME, -40),
            location: undefined,
            regionName: "Red Sea / Gulf of Aden",
            score: 0.55,
            metadata: {
                platform: "x",
                previousSentiment: -0.1,
                currentSentiment: -0.45,
                shiftMagnitude: 0.35,
                postCount: 142,
                triggerPosts: ["post-9821", "post-9834", "post-9851"],
            },
        },
        {
            id: seededUUID(rng),
            kind: "sentiment_shift",
            severity: "high",
            title: "Aggressive policy rhetoric — Korean Peninsula",
            description: "WhiteHouse announcements shifted to aggressive tone regarding North Korean missile tests, sentiment dropped to -0.62.",
            detectedAt: offsetTimestamp(BASE_TIME, -70),
            location: undefined,
            regionName: "Korean Peninsula",
            score: 0.68,
            metadata: {
                platform: "whitehouse",
                previousSentiment: 0.0,
                currentSentiment: -0.62,
                shiftMagnitude: 0.62,
                postCount: 8,
                triggerPosts: ["wh-2451", "wh-2453"],
            },
        },
    ];
    anomalies.push(...sentimentShifts);

    // --- Conflict Escalation (2) ---
    const conflictEscalation: ConflictEscalationAnomaly[] = [
        {
            id: seededUUID(rng),
            kind: "conflict_escalation",
            severity: "critical",
            title: "Rapid conflict escalation — Sub-Saharan Africa",
            description: "Armed clashes in the Sahel region surged from 4 to 11 incidents in the last 48 hours, with 2 critical-severity events.",
            detectedAt: offsetTimestamp(BASE_TIME, -20),
            location: { lat: 5.8, lng: 18.5 },
            regionName: "Sub-Saharan Africa",
            score: 0.88,
            metadata: {
                regionName: "Sub-Saharan Africa",
                previousCount: 4,
                currentCount: 11,
                escalationRate: 2.75,
                maxSeverity: "critical",
                timeWindowHours: 48,
            },
        },
        {
            id: seededUUID(rng),
            kind: "conflict_escalation",
            severity: "high",
            title: "Escalating violence — Eastern Mediterranean",
            description: "Cross-border conflict events increased from 2 to 6 in the Lebanon-Israel border region over 24 hours.",
            detectedAt: offsetTimestamp(BASE_TIME, -55),
            location: { lat: 33.2, lng: 35.5 },
            regionName: "Eastern Mediterranean",
            score: 0.73,
            metadata: {
                regionName: "Eastern Mediterranean",
                previousCount: 2,
                currentCount: 6,
                escalationRate: 3.0,
                maxSeverity: "high",
                timeWindowHours: 24,
            },
        },
    ];
    anomalies.push(...conflictEscalation);

    return anomalies;
}

// ============================================
// Sample Risk Scores
// ============================================

/** Deterministic sparkline generator */
function generateSparkline(rng: () => number, base: number, volatility: number, count: number): number[] {
    const points: number[] = [];
    let current = base;
    for (let i = 0; i < count; i++) {
        const delta = (rng() - 0.5) * 2 * volatility;
        current = Math.max(0, Math.min(100, current + delta));
        points.push(Math.round(current * 10) / 10);
    }
    return points;
}

function makeFactor(
    name: string,
    score: number,
    weight: number,
    trend: RiskTrend,
    detail: string,
): RiskFactor {
    return { name, score, weight, trend, detail };
}

/**
 * Generate risk scores for all 8 monitored regions.
 */
export function generateSampleRiskScores(): RiskScore[] {
    const rng = mulberry32(42_002);

    const regionProfiles: {
        name: string;
        score: number;
        trend: RiskTrend;
        factors: RiskFactors;
    }[] = [
            {
                name: "Strait of Hormuz",
                score: 78,
                trend: "deteriorating",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 65, 0.15, "stable", "Moderate tension from regional proxy conflicts"),
                    militaryActivity: makeFactor("Military Activity", 72, 0.10, "deteriorating", "Increased naval patrol activity"),
                    gpsJamming: makeFactor("GPS Jamming", 45, 0.10, "stable", "Sporadic interference reported"),
                    marketVolatility: makeFactor("Market Volatility", 85, 0.25, "deteriorating", "Oil futures surging on supply concerns"),
                    socialSentiment: makeFactor("Social Sentiment", 60, 0.05, "deteriorating", "Negative media coverage increasing"),
                    vesselTraffic: makeFactor("Vessel Traffic", 90, 0.25, "deteriorating", "Multiple vessels deviating from standard lanes"),
                    historicalBaseline: makeFactor("Historical Baseline", 70, 0.10, "stable", "Region historically volatile"),
                },
            },
            {
                name: "South China Sea",
                score: 65,
                trend: "stable",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 40, 0.10, "stable", "Low-level territorial incidents"),
                    militaryActivity: makeFactor("Military Activity", 82, 0.25, "deteriorating", "Increased PLA Navy exercises"),
                    gpsJamming: makeFactor("GPS Jamming", 35, 0.10, "stable", "Minimal interference"),
                    marketVolatility: makeFactor("Market Volatility", 55, 0.15, "stable", "Shipping stocks slightly elevated"),
                    socialSentiment: makeFactor("Social Sentiment", 50, 0.10, "stable", "Neutral media coverage"),
                    vesselTraffic: makeFactor("Vessel Traffic", 75, 0.20, "stable", "Heavy commercial traffic as usual"),
                    historicalBaseline: makeFactor("Historical Baseline", 60, 0.10, "stable", "Persistent baseline tension"),
                },
            },
            {
                name: "Black Sea",
                score: 85,
                trend: "deteriorating",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 92, 0.25, "deteriorating", "Active hostilities along coastline"),
                    militaryActivity: makeFactor("Military Activity", 88, 0.20, "deteriorating", "Naval mine threats and drone attacks"),
                    gpsJamming: makeFactor("GPS Jamming", 78, 0.15, "deteriorating", "Widespread electronic warfare"),
                    marketVolatility: makeFactor("Market Volatility", 70, 0.10, "stable", "Grain futures elevated"),
                    socialSentiment: makeFactor("Social Sentiment", 82, 0.10, "deteriorating", "Strongly negative sentiment"),
                    vesselTraffic: makeFactor("Vessel Traffic", 65, 0.10, "improving", "Reduced commercial traffic"),
                    historicalBaseline: makeFactor("Historical Baseline", 90, 0.10, "deteriorating", "Highest risk since 2022"),
                },
            },
            {
                name: "Eastern Mediterranean",
                score: 72,
                trend: "deteriorating",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 80, 0.20, "deteriorating", "Cross-border escalation events"),
                    militaryActivity: makeFactor("Military Activity", 68, 0.15, "stable", "Standard military posturing"),
                    gpsJamming: makeFactor("GPS Jamming", 85, 0.15, "deteriorating", "Critical GPS jamming cluster detected"),
                    marketVolatility: makeFactor("Market Volatility", 55, 0.10, "stable", "Defense stocks slightly up"),
                    socialSentiment: makeFactor("Social Sentiment", 72, 0.15, "deteriorating", "Negative media surge"),
                    vesselTraffic: makeFactor("Vessel Traffic", 50, 0.10, "stable", "Normal shipping patterns"),
                    historicalBaseline: makeFactor("Historical Baseline", 75, 0.15, "stable", "Chronically elevated baseline"),
                },
            },
            {
                name: "Taiwan Strait",
                score: 68,
                trend: "deteriorating",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 30, 0.10, "stable", "No direct conflict"),
                    militaryActivity: makeFactor("Military Activity", 90, 0.30, "deteriorating", "Largest military exercises in months"),
                    gpsJamming: makeFactor("GPS Jamming", 40, 0.10, "stable", "Minor interference reports"),
                    marketVolatility: makeFactor("Market Volatility", 82, 0.20, "deteriorating", "Semiconductor stocks plunging"),
                    socialSentiment: makeFactor("Social Sentiment", 55, 0.10, "deteriorating", "Rising anxiety in media"),
                    vesselTraffic: makeFactor("Vessel Traffic", 48, 0.10, "stable", "Commercial lanes still open"),
                    historicalBaseline: makeFactor("Historical Baseline", 60, 0.10, "stable", "Periodic tension cycles"),
                },
            },
            {
                name: "Red Sea / Gulf of Aden",
                score: 74,
                trend: "stable",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 75, 0.20, "stable", "Ongoing Houthi attack pattern"),
                    militaryActivity: makeFactor("Military Activity", 60, 0.10, "stable", "Coalition patrols active"),
                    gpsJamming: makeFactor("GPS Jamming", 25, 0.05, "stable", "Minimal interference"),
                    marketVolatility: makeFactor("Market Volatility", 72, 0.20, "stable", "Shipping insurance costs elevated"),
                    socialSentiment: makeFactor("Social Sentiment", 55, 0.05, "stable", "Moderate concern"),
                    vesselTraffic: makeFactor("Vessel Traffic", 88, 0.30, "stable", "Many vessels rerouting around Cape"),
                    historicalBaseline: makeFactor("Historical Baseline", 70, 0.10, "stable", "Sustained high risk"),
                },
            },
            {
                name: "Korean Peninsula",
                score: 52,
                trend: "stable",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 20, 0.10, "stable", "No active conflict"),
                    militaryActivity: makeFactor("Military Activity", 75, 0.30, "stable", "Routine military posturing"),
                    gpsJamming: makeFactor("GPS Jamming", 30, 0.10, "stable", "Sporadic North Korean jamming"),
                    marketVolatility: makeFactor("Market Volatility", 45, 0.15, "stable", "Markets calm"),
                    socialSentiment: makeFactor("Social Sentiment", 58, 0.15, "deteriorating", "Rhetoric escalating"),
                    vesselTraffic: makeFactor("Vessel Traffic", 20, 0.05, "stable", "Normal maritime activity"),
                    historicalBaseline: makeFactor("Historical Baseline", 55, 0.15, "stable", "Perpetual standoff baseline"),
                },
            },
            {
                name: "Sub-Saharan Africa",
                score: 81,
                trend: "deteriorating",
                factors: {
                    conflictIntensity: makeFactor("Conflict Intensity", 95, 0.30, "deteriorating", "Sahel region conflict surge"),
                    militaryActivity: makeFactor("Military Activity", 55, 0.10, "stable", "Scattered military operations"),
                    gpsJamming: makeFactor("GPS Jamming", 15, 0.05, "stable", "No significant interference"),
                    marketVolatility: makeFactor("Market Volatility", 40, 0.10, "stable", "Local markets affected"),
                    socialSentiment: makeFactor("Social Sentiment", 78, 0.15, "deteriorating", "Humanitarian crisis coverage"),
                    vesselTraffic: makeFactor("Vessel Traffic", 25, 0.05, "stable", "Low maritime relevance"),
                    historicalBaseline: makeFactor("Historical Baseline", 88, 0.25, "deteriorating", "Worst period in recent years"),
                },
            },
        ];

    return regionProfiles.map((profile) => {
        const region = MONITORED_REGIONS.find((r) => r.name === profile.name);
        return {
            regionName: profile.name,
            regionCenter: region?.center ?? { lat: 0, lng: 0 },
            regionRadiusKm: region?.radiusKm ?? 200,
            overallScore: profile.score,
            riskLevel: scoreToRiskLevel(profile.score) as RiskLevel,
            trend: profile.trend,
            factors: profile.factors,
            sparklineHistory: generateSparkline(rng, profile.score, 5, 24),
            computedAt: new Date(BASE_TIME).toISOString(),
        };
    });
}

// ============================================
// Sample Patterns
// ============================================

/**
 * Generate 8 sample patterns across all 4 pattern kinds.
 */
export function generateSamplePatterns(): Pattern[] {
    const rng = mulberry32(42_003);
    const patterns: Pattern[] = [];

    // --- Temporal Correlations (2) ---
    const temporalCorrelations: TemporalCorrelation[] = [
        {
            id: seededUUID(rng),
            kind: "temporal_correlation",
            title: "Hormuz vessel deviation → oil price spike",
            description: "Vessel deviation in the Strait of Hormuz preceded a Brent crude price surge by 23 minutes. Strong temporal correlation detected.",
            confidence: 0.87,
            detectedAt: offsetTimestamp(BASE_TIME, -35),
            involvedLayers: ["vessels", "market"],
            metadata: {
                events: [
                    { layer: "vessels", id: "v-9921", title: "Tanker NORDIC AURORA deviation", timestamp: offsetTimestamp(BASE_TIME, -58) },
                    { layer: "market", id: "m-4401", title: "BZ=F +4.8% spike", timestamp: offsetTimestamp(BASE_TIME, -35) },
                ],
                timeWindowMinutes: 23,
                correlationStrength: 0.87,
            },
        },
        {
            id: seededUUID(rng),
            kind: "temporal_correlation",
            title: "GPS jamming cluster → military aircraft deployment",
            description: "GPS jamming in the Eastern Mediterranean was followed by increased military aircraft activity within 45 minutes.",
            confidence: 0.72,
            detectedAt: offsetTimestamp(BASE_TIME, -20),
            involvedLayers: ["gps-jamming", "aircraft"],
            metadata: {
                events: [
                    { layer: "gps-jamming", id: "gps-1104", title: "Critical jamming cluster detected", timestamp: offsetTimestamp(BASE_TIME, -65) },
                    { layer: "aircraft", id: "ac-7782", title: "FORTE12 reconnaissance orbit", timestamp: offsetTimestamp(BASE_TIME, -20) },
                ],
                timeWindowMinutes: 45,
                correlationStrength: 0.72,
            },
        },
    ];
    patterns.push(...temporalCorrelations);

    // --- Spatial Clusters (2) ---
    const spatialClusters: SpatialCluster[] = [
        {
            id: seededUUID(rng),
            kind: "spatial_cluster",
            title: "Multi-layer hotspot — Black Sea western basin",
            description: "Conflict events, GPS jamming zones, and military aircraft converging in a 90km radius in the western Black Sea.",
            confidence: 0.91,
            detectedAt: offsetTimestamp(BASE_TIME, -25),
            involvedLayers: ["conflicts", "gps-jamming", "aircraft"],
            metadata: {
                center: { lat: 43.5, lng: 30.5 },
                radiusKm: 90,
                entityCount: 12,
                layers: ["conflicts", "gps-jamming", "aircraft"],
                density: 0.14,
            },
        },
        {
            id: seededUUID(rng),
            kind: "spatial_cluster",
            title: "Vessel and conflict cluster — Red Sea",
            description: "High density of vessel rerouting events and conflict reports concentrated near the Bab el-Mandeb strait.",
            confidence: 0.84,
            detectedAt: offsetTimestamp(BASE_TIME, -40),
            involvedLayers: ["vessels", "conflicts"],
            metadata: {
                center: { lat: 12.6, lng: 43.3 },
                radiusKm: 65,
                entityCount: 8,
                layers: ["vessels", "conflicts"],
                density: 0.19,
            },
        },
    ];
    patterns.push(...spatialClusters);

    // --- Sequence Detections (2) ---
    const sequenceDetections: SequenceDetection[] = [
        {
            id: seededUUID(rng),
            kind: "sequence_detection",
            title: "Escalation sequence — military buildup → conflict → market impact",
            description: "Detected recurring 3-step escalation pattern: increased military activity followed by conflict events and subsequent market volatility.",
            confidence: 0.78,
            detectedAt: offsetTimestamp(BASE_TIME, -10),
            involvedLayers: ["aircraft", "conflicts", "market"],
            metadata: {
                steps: [
                    { order: 1, layer: "aircraft", description: "Military aircraft surge detected", timestamp: offsetTimestamp(BASE_TIME, -180) },
                    { order: 2, layer: "conflicts", description: "Armed clash reported", timestamp: offsetTimestamp(BASE_TIME, -120) },
                    { order: 3, layer: "market", description: "Defense stocks surge", timestamp: offsetTimestamp(BASE_TIME, -60) },
                ],
                patternName: "Military Escalation Cascade",
                recurrenceCount: 3,
            },
        },
        {
            id: seededUUID(rng),
            kind: "sequence_detection",
            title: "Information warfare sequence — social → jamming → vessel disruption",
            description: "Pattern detected: social media disinformation surge precedes GPS jamming activity, followed by vessel lane deviations.",
            confidence: 0.65,
            detectedAt: offsetTimestamp(BASE_TIME, -15),
            involvedLayers: ["social", "gps-jamming", "vessels"],
            metadata: {
                steps: [
                    { order: 1, layer: "social", description: "Coordinated negative sentiment spike", timestamp: offsetTimestamp(BASE_TIME, -300) },
                    { order: 2, layer: "gps-jamming", description: "GPS jamming cluster activated", timestamp: offsetTimestamp(BASE_TIME, -240) },
                    { order: 3, layer: "vessels", description: "Vessel lane deviations reported", timestamp: offsetTimestamp(BASE_TIME, -180) },
                ],
                patternName: "Information Warfare Cascade",
                recurrenceCount: 2,
            },
        },
    ];
    patterns.push(...sequenceDetections);

    // --- Entity Co-occurrences (2) ---
    const entityCooccurrences: EntityCooccurrence[] = [
        {
            id: seededUUID(rng),
            kind: "entity_cooccurrence",
            title: "FORTE reconnaissance linked to conflict zones",
            description: "FORTE12 reconnaissance aircraft repeatedly appears in regions experiencing conflict escalation within the same 24-hour windows.",
            confidence: 0.82,
            detectedAt: offsetTimestamp(BASE_TIME, -5),
            involvedLayers: ["aircraft", "conflicts"],
            metadata: {
                entities: [
                    { type: "aircraft", id: "ICAO-AE0412", name: "FORTE12" },
                    { type: "conflict", id: "ACL-88241", name: "Crimea coastal clash" },
                    { type: "conflict", id: "ACL-88245", name: "Odesa drone strike" },
                ],
                incidentCount: 5,
                regions: ["Black Sea", "Eastern Mediterranean"],
                firstSeen: offsetTimestamp(BASE_TIME, -7200),
                lastSeen: offsetTimestamp(BASE_TIME, -30),
            },
        },
        {
            id: seededUUID(rng),
            kind: "entity_cooccurrence",
            title: "Oil tankers co-located with jamming zones",
            description: "VLCC tankers NORDIC AURORA and PERSIAN STAR repeatedly encountered GPS jamming zones during Strait of Hormuz transits.",
            confidence: 0.76,
            detectedAt: offsetTimestamp(BASE_TIME, -8),
            involvedLayers: ["vessels", "gps-jamming"],
            metadata: {
                entities: [
                    { type: "vessel", id: "MMSI-211334120", name: "NORDIC AURORA" },
                    { type: "vessel", id: "MMSI-636019501", name: "PERSIAN STAR" },
                    { type: "gps-jamming", id: "gps-1098", name: "Hormuz East interference zone" },
                ],
                incidentCount: 4,
                regions: ["Strait of Hormuz"],
                firstSeen: offsetTimestamp(BASE_TIME, -4320),
                lastSeen: offsetTimestamp(BASE_TIME, -45),
            },
        },
    ];
    patterns.push(...entityCooccurrences);

    return patterns;
}
