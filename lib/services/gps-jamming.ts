import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import type { Severity } from "@/lib/types/geo-event";

/**
 * GPS Jamming zone data service
 * Fetches GPS interference data from our API
 */

const API_BASE = "/api/gps-jamming";

/**
 * GPS Jamming API response shape
 */
interface GPSJammingAPIResponse {
    zones: GPSJammingZone[];
    activeCount: number;
    timestamp: string;
    isSampleData: boolean;
}

/**
 * Fetch GPS jamming zones
 */
export async function fetchGPSJammingZones(options?: {
    activeOnly?: boolean;
    minSeverity?: Severity;
    region?: string;
}): Promise<{ zones: GPSJammingZone[]; isSampleData: boolean }> {
    const params = new URLSearchParams();

    if (options?.activeOnly !== undefined) params.set("active_only", String(options.activeOnly));
    if (options?.minSeverity) params.set("min_severity", options.minSeverity);
    if (options?.region) params.set("region", options.region);

    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch GPS jamming zones: ${response.status}`);
    }

    const data: GPSJammingAPIResponse = await response.json();
    return {
        zones: data.zones,
        isSampleData: data.isSampleData,
    };
}

/**
 * Polling intervals for GPS jamming data
 */
export const GPS_JAMMING_POLLING = {
    /** Standard polling interval (10 minutes) */
    STANDARD: 600_000,
    /** Fast polling (2 minutes) */
    FAST: 120_000,
} as const;
