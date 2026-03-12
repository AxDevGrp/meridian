/**
 * Monitored regions for the analytics subsystem.
 * Derives from PREDEFINED_REGIONS with region-specific risk weight tuning.
 */

import { PREDEFINED_REGIONS } from "@/lib/types/intel-report";

// ============================================
// Types
// ============================================

export interface MonitoredRegion {
    name: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    defaultRiskWeights: {
        conflictIntensity: number;
        militaryActivity: number;
        gpsJamming: number;
        marketVolatility: number;
        socialSentiment: number;
        vesselTraffic: number;
        historicalBaseline: number;
    };
}

// ============================================
// Weight Profiles
// ============================================

/**
 * Region-specific weight tuning based on each region's primary risk profile.
 * All weights within a region sum to 1.0.
 */
const WEIGHT_PROFILES: Record<string, MonitoredRegion["defaultRiskWeights"]> = {
    // Oil/energy chokepoint — heavy vessel and market weights
    "Strait of Hormuz": {
        conflictIntensity: 0.15,
        militaryActivity: 0.10,
        gpsJamming: 0.10,
        marketVolatility: 0.25,
        socialSentiment: 0.05,
        vesselTraffic: 0.25,
        historicalBaseline: 0.10,
    },
    // Territorial disputes, military posturing
    "South China Sea": {
        conflictIntensity: 0.10,
        militaryActivity: 0.25,
        gpsJamming: 0.10,
        marketVolatility: 0.15,
        socialSentiment: 0.10,
        vesselTraffic: 0.20,
        historicalBaseline: 0.10,
    },
    // Active conflict zone — Russia/Ukraine
    "Black Sea": {
        conflictIntensity: 0.25,
        militaryActivity: 0.20,
        gpsJamming: 0.15,
        marketVolatility: 0.10,
        socialSentiment: 0.10,
        vesselTraffic: 0.10,
        historicalBaseline: 0.10,
    },
    // Geopolitical tension, Hezbollah/Israel dynamics
    "Eastern Mediterranean": {
        conflictIntensity: 0.20,
        militaryActivity: 0.15,
        gpsJamming: 0.15,
        marketVolatility: 0.10,
        socialSentiment: 0.15,
        vesselTraffic: 0.10,
        historicalBaseline: 0.15,
    },
    // Cross-strait military buildup, defense stocks
    "Taiwan Strait": {
        conflictIntensity: 0.10,
        militaryActivity: 0.30,
        gpsJamming: 0.10,
        marketVolatility: 0.20,
        socialSentiment: 0.10,
        vesselTraffic: 0.10,
        historicalBaseline: 0.10,
    },
    // Houthi attacks on shipping, energy corridor
    "Red Sea / Gulf of Aden": {
        conflictIntensity: 0.20,
        militaryActivity: 0.10,
        gpsJamming: 0.05,
        marketVolatility: 0.20,
        socialSentiment: 0.05,
        vesselTraffic: 0.30,
        historicalBaseline: 0.10,
    },
    // Nuclear/missile threat, DMZ tensions
    "Korean Peninsula": {
        conflictIntensity: 0.10,
        militaryActivity: 0.30,
        gpsJamming: 0.10,
        marketVolatility: 0.15,
        socialSentiment: 0.15,
        vesselTraffic: 0.05,
        historicalBaseline: 0.15,
    },
    // Widespread conflict, humanitarian crises
    "Sub-Saharan Africa": {
        conflictIntensity: 0.30,
        militaryActivity: 0.10,
        gpsJamming: 0.05,
        marketVolatility: 0.10,
        socialSentiment: 0.15,
        vesselTraffic: 0.05,
        historicalBaseline: 0.25,
    },
};

/** Default balanced weights for regions without a specific profile. */
const DEFAULT_WEIGHTS: MonitoredRegion["defaultRiskWeights"] = {
    conflictIntensity: 0.20,
    militaryActivity: 0.15,
    gpsJamming: 0.10,
    marketVolatility: 0.15,
    socialSentiment: 0.10,
    vesselTraffic: 0.15,
    historicalBaseline: 0.15,
};

// ============================================
// Monitored Regions
// ============================================

/**
 * The 8 monitored regions, derived from PREDEFINED_REGIONS
 * in intel-report.ts with analytics-specific weight tuning.
 */
export const MONITORED_REGIONS: MonitoredRegion[] = PREDEFINED_REGIONS.map((region) => ({
    name: region.regionName,
    center: region.regionCenter,
    radiusKm: region.regionRadiusKm,
    defaultRiskWeights: WEIGHT_PROFILES[region.regionName] ?? DEFAULT_WEIGHTS,
}));

/**
 * Look up a monitored region by name.
 * Case-insensitive partial matching.
 */
export function findRegion(name: string): MonitoredRegion | undefined {
    const lower = name.toLowerCase();
    return MONITORED_REGIONS.find((r) => r.name.toLowerCase().includes(lower));
}

/**
 * Find the nearest monitored region to a given coordinate.
 * Uses haversine distance comparison against region centers.
 */
export function findNearestRegion(
    lat: number,
    lng: number,
): MonitoredRegion | undefined {
    if (MONITORED_REGIONS.length === 0) return undefined;

    // Inline haversine to avoid circular import; lightweight
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6_371;

    let nearest: MonitoredRegion | undefined;
    let minDist = Infinity;

    for (const region of MONITORED_REGIONS) {
        const dLat = toRad(region.center.lat - lat);
        const dLng = toRad(region.center.lng - lng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) * Math.cos(toRad(region.center.lat)) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (dist < minDist) {
            minDist = dist;
            nearest = region;
        }
    }

    return nearest;
}
