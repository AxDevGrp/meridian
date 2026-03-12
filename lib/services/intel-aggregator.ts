/**
 * Intel Data Aggregator — server-side module.
 * Fetches data from all existing API routes in parallel and filters
 * by region proximity using haversine distance.
 *
 * Used exclusively by API routes (not browser).
 */

import { haversineKm } from "@/lib/correlation-engine";

// ============================================
// Types
// ============================================

export interface AggregationRequest {
    regionCenter: { lat: number; lng: number };
    regionRadiusKm: number;
    timeframeHours: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataItem = Record<string, any>;

export interface AggregatedData {
    conflicts: DataItem[];
    gpsJamming: DataItem[];
    vessels: DataItem[];
    aircraft: DataItem[];
    socialPosts: DataItem[];
    marketInstruments: DataItem[];
    correlations: DataItem[];
    fetchTimestamps: Record<string, string>;
    errors: string[];
}

// ============================================
// Helpers
// ============================================

function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Check if a point (with lat/lng fields) is within the specified region.
 */
function isWithinRegion(
    entityLat: number | null | undefined,
    entityLng: number | null | undefined,
    center: { lat: number; lng: number },
    radiusKm: number,
): boolean {
    if (entityLat == null || entityLng == null) return false;
    if (!isFinite(entityLat) || !isFinite(entityLng)) return false;
    return haversineKm(entityLat, entityLng, center.lat, center.lng) <= radiusKm;
}

/**
 * Extract the `data` array from a standard API response envelope.
 */
function extractDataArray(json: unknown): DataItem[] {
    if (json && typeof json === "object" && "data" in json) {
        const arr = (json as { data: unknown }).data;
        if (Array.isArray(arr)) return arr as DataItem[];
    }
    return [];
}

// ============================================
// Fetch helper
// ============================================

async function fetchJson(url: string): Promise<{ json: unknown; timestamp: string }> {
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
    }
    const json = await response.json();
    return { json, timestamp: new Date().toISOString() };
}

// ============================================
// Public API
// ============================================

/**
 * Aggregate data from all platform API routes, filtered by geographic region.
 */
export async function aggregateRegionData(
    request: AggregationRequest,
): Promise<AggregatedData> {
    const base = getBaseUrl();
    const { regionCenter, regionRadiusKm } = request;

    const result: AggregatedData = {
        conflicts: [],
        gpsJamming: [],
        vessels: [],
        aircraft: [],
        socialPosts: [],
        marketInstruments: [],
        correlations: [],
        fetchTimestamps: {},
        errors: [],
    };

    // Fetch all data sources in parallel
    const [
        conflictsResult,
        gpsResult,
        vesselsResult,
        aircraftResult,
        socialResult,
        instrumentsResult,
        correlationsResult,
    ] = await Promise.allSettled([
        fetchJson(`${base}/api/conflicts?limit=200`),
        fetchJson(`${base}/api/gps-jamming`),
        fetchJson(`${base}/api/vessels`),
        fetchJson(`${base}/api/aircraft`),
        fetchJson(`${base}/api/social-feed?limit=100`),
        fetchJson(`${base}/api/market/instruments`),
        fetchJson(`${base}/api/market/correlations`),
    ]);

    // --- Conflicts (filter by proximity) ---
    if (conflictsResult.status === "fulfilled") {
        const items = extractDataArray(conflictsResult.value.json);
        result.conflicts = items.filter((c) =>
            isWithinRegion(c.latitude, c.longitude, regionCenter, regionRadiusKm),
        );
        result.fetchTimestamps.conflicts = conflictsResult.value.timestamp;
    } else {
        result.errors.push(`conflicts: ${conflictsResult.reason}`);
    }

    // --- GPS Jamming (filter by proximity) ---
    if (gpsResult.status === "fulfilled") {
        const items = extractDataArray(gpsResult.value.json);
        result.gpsJamming = items.filter((z) =>
            isWithinRegion(z.latitude, z.longitude, regionCenter, regionRadiusKm),
        );
        result.fetchTimestamps.gpsJamming = gpsResult.value.timestamp;
    } else {
        result.errors.push(`gpsJamming: ${gpsResult.reason}`);
    }

    // --- Vessels (filter by proximity) ---
    if (vesselsResult.status === "fulfilled") {
        const items = extractDataArray(vesselsResult.value.json);
        result.vessels = items.filter((v) =>
            isWithinRegion(v.latitude, v.longitude, regionCenter, regionRadiusKm),
        );
        result.fetchTimestamps.vessels = vesselsResult.value.timestamp;
    } else {
        result.errors.push(`vessels: ${vesselsResult.reason}`);
    }

    // --- Aircraft (filter by proximity) ---
    if (aircraftResult.status === "fulfilled") {
        const items = extractDataArray(aircraftResult.value.json);
        result.aircraft = items.filter((a) =>
            isWithinRegion(a.latitude, a.longitude, regionCenter, regionRadiusKm),
        );
        result.fetchTimestamps.aircraft = aircraftResult.value.timestamp;
    } else {
        result.errors.push(`aircraft: ${aircraftResult.reason}`);
    }

    // --- Social Posts (include all — they don't reliably have geo) ---
    if (socialResult.status === "fulfilled") {
        result.socialPosts = extractDataArray(socialResult.value.json);
        result.fetchTimestamps.socialPosts = socialResult.value.timestamp;
    } else {
        result.errors.push(`socialPosts: ${socialResult.reason}`);
    }

    // --- Market Instruments (include all) ---
    if (instrumentsResult.status === "fulfilled") {
        result.marketInstruments = extractDataArray(instrumentsResult.value.json);
        result.fetchTimestamps.marketInstruments = instrumentsResult.value.timestamp;
    } else {
        result.errors.push(`marketInstruments: ${instrumentsResult.reason}`);
    }

    // --- Correlations (filter by region overlap) ---
    if (correlationsResult.status === "fulfilled") {
        const items = extractDataArray(correlationsResult.value.json);
        result.correlations = items.filter((c) => {
            const center = c.regionCenter as { lat: number; lng: number } | null;
            if (!center) return true; // global correlations apply everywhere
            return (
                haversineKm(center.lat, center.lng, regionCenter.lat, regionCenter.lng) <=
                regionRadiusKm + ((c.regionRadiusKm as number) || 0)
            );
        });
        result.fetchTimestamps.correlations = correlationsResult.value.timestamp;
    } else {
        result.errors.push(`correlations: ${correlationsResult.reason}`);
    }

    return result;
}
