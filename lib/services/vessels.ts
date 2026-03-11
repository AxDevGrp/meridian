import type { Vessel } from "@/lib/types/vessel";

/**
 * Maritime vessel data service
 * Fetches AIS vessel data from our API proxy
 */

const API_BASE = "/api/vessels";

/**
 * Vessel API response shape
 */
interface VesselAPIResponse {
    vessels: Vessel[];
    count: number;
    timestamp: number;
    isSampleData: boolean;
}

/**
 * Fetch vessels
 */
export async function fetchVessels(options?: {
    type?: string;
    limit?: number;
}): Promise<{ vessels: Vessel[]; isSampleData: boolean }> {
    const params = new URLSearchParams();

    if (options?.type) params.set("type", options.type);
    if (options?.limit) params.set("limit", String(options.limit));

    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch vessels: ${response.status}`);
    }

    const data: VesselAPIResponse = await response.json();
    return {
        vessels: data.vessels,
        isSampleData: data.isSampleData,
    };
}

/**
 * Polling intervals for vessel data
 */
export const VESSEL_POLLING = {
    /** Standard polling interval (1 minute) */
    STANDARD: 60_000,
    /** Fast polling (30 seconds) */
    FAST: 30_000,
} as const;
