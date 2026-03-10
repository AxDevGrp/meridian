import type { Aircraft, BoundingBox, OpenSkyResponse } from "@/lib/types/aircraft";
import { transformOpenSkyResponse } from "@/lib/types/aircraft";

/**
 * OpenSky Network API configuration
 * Using our internal API route as a proxy to avoid CORS issues
 */
const API_BASE = "/api/aircraft";

/**
 * Rate limiting configuration
 * OpenSky has rate limits for anonymous users (approx 400 requests per day)
 * We'll use conservative polling intervals
 */
export const POLLING_INTERVALS = {
    /** Minimum recommended polling interval (10 seconds) */
    MINIMUM: 10_000,
    /** Recommended polling interval for anonymous users (15 seconds) */
    RECOMMENDED: 15_000,
    /** Conservative polling interval (30 seconds) */
    CONSERVATIVE: 30_000,
} as const;

/**
 * Fetch all aircraft from OpenSky Network
 * Note: This can be slow and return a lot of data
 * @returns Array of aircraft
 */
export async function fetchAllAircraft(): Promise<Aircraft[]> {
    const response = await fetch(API_BASE);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `Failed to fetch aircraft: ${response.status}`);
    }

    const data: OpenSkyResponse = await response.json();
    return transformOpenSkyResponse(data);
}

/**
 * Fetch aircraft within a geographic bounding box
 * More efficient than fetching all aircraft
 * @param bounds - Geographic bounding box
 * @returns Array of aircraft within the bounds
 */
export async function fetchAircraftInBounds(bounds: BoundingBox): Promise<Aircraft[]> {
    const params = new URLSearchParams({
        lamin: bounds.lamin.toString(),
        lomin: bounds.lomin.toString(),
        lamax: bounds.lamax.toString(),
        lomax: bounds.lomax.toString(),
    });

    const response = await fetch(`${API_BASE}?${params}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `Failed to fetch aircraft: ${response.status}`);
    }

    const data: OpenSkyResponse = await response.json();
    return transformOpenSkyResponse(data);
}

/**
 * Fetch aircraft from OpenSky Network with optional bounds
 * @param bounds - Optional geographic bounding box
 * @returns Array of aircraft
 */
export async function fetchAircraft(bounds?: BoundingBox): Promise<Aircraft[]> {
    if (bounds) {
        return fetchAircraftInBounds(bounds);
    }
    return fetchAllAircraft();
}

/**
 * Get the count of aircraft currently being tracked
 * Useful for displaying stats without fetching all data
 */
export async function getAircraftCount(): Promise<number> {
    const response = await fetch(`${API_BASE}/count`);

    if (!response.ok) {
        throw new Error("Failed to fetch aircraft count");
    }

    const data = await response.json();
    return data.count;
}

/**
 * Check if the OpenSky API is accessible
 * @returns True if API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
    try {
        const response = await fetch(API_BASE, { method: "HEAD" });
        return response.ok;
    } catch {
        return false;
    }
}