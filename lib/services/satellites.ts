import type { Satellite } from "@/lib/types/satellite";
import { classifyOrbit, classifySatellitePurpose } from "@/lib/types/satellite";

/**
 * Satellite data service
 * Fetches satellite orbital data from our API proxy to CelesTrak
 */

const API_BASE = "/api/satellites";

/**
 * Satellite API response shape
 */
interface SatelliteAPIResponse {
    satellites: Array<{
        noradId: string;
        name: string;
        intlDesignator: string | null;
        position: {
            longitude: number;
            latitude: number;
            altitude: number;
            velocity: number;
        };
        orbitalElements: {
            inclination: number;
            raan: number;
            eccentricity: number;
            argOfPerigee: number;
            meanAnomaly: number;
            meanMotion: number;
            epoch: string;
        };
        epoch: string;
    }>;
    count: number;
    totalAvailable: number;
    group: string;
    timestamp: string;
    error?: string;
}

/**
 * Transform API response to Satellite type
 */
function transformSatellite(raw: SatelliteAPIResponse["satellites"][0]): Satellite {
    const orbitType = classifyOrbit(
        raw.position.altitude,
        raw.orbitalElements.inclination,
        raw.orbitalElements.eccentricity
    );

    return {
        noradId: raw.noradId,
        name: raw.name,
        intlDesignator: raw.intlDesignator,
        tle: { line1: "", line2: "" }, // TLE lines not included in simplified response
        orbitalElements: raw.orbitalElements,
        position: raw.position,
        orbitType,
        purpose: classifySatellitePurpose(raw.name),
        launchDate: null,
        country: null,
        lastUpdate: raw.epoch,
    };
}

/**
 * Fetch satellites from a specific group
 */
export async function fetchSatellites(
    group: string = "stations",
    limit: number = 100
): Promise<Satellite[]> {
    const params = new URLSearchParams({ group, limit: String(limit) });
    const response = await fetch(`${API_BASE}?${params}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch satellites: ${response.status}`);
    }

    const data: SatelliteAPIResponse = await response.json();
    return data.satellites.map(transformSatellite);
}

/**
 * Fetch multiple satellite groups at once
 */
export async function fetchMultipleSatelliteGroups(
    groups: string[] = ["stations", "visual", "gps-ops"],
    limitPerGroup: number = 50
): Promise<Satellite[]> {
    const results = await Promise.allSettled(
        groups.map((group) => fetchSatellites(group, limitPerGroup))
    );

    const allSatellites: Satellite[] = [];
    const seen = new Set<string>();

    for (const result of results) {
        if (result.status === "fulfilled") {
            for (const sat of result.value) {
                if (!seen.has(sat.noradId)) {
                    seen.add(sat.noradId);
                    allSatellites.push(sat);
                }
            }
        }
    }

    return allSatellites;
}

/**
 * Polling intervals for satellite data
 */
export const SATELLITE_POLLING = {
    /** Standard polling interval (5 minutes) */
    STANDARD: 300_000,
    /** Fast polling (1 minute) for real-time tracking */
    FAST: 60_000,
} as const;
