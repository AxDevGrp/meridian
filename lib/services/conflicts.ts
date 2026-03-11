import type { ConflictEvent } from "@/lib/types/conflict";

/**
 * Conflict event data service
 * Fetches ACLED conflict data from our API proxy
 */

const API_BASE = "/api/conflicts";

/**
 * Conflict API response shape
 */
interface ConflictAPIResponse {
    success: boolean;
    data: ConflictEvent[];
    count: number;
    timestamp: string;
    isSampleData: boolean;
    error?: string;
}

/**
 * Fetch conflict events
 */
export async function fetchConflicts(options?: {
    country?: string;
    eventType?: string;
    limit?: number;
    days?: number;
}): Promise<{ events: ConflictEvent[]; isSampleData: boolean }> {
    const params = new URLSearchParams();

    if (options?.country) params.set("country", options.country);
    if (options?.eventType) params.set("event_type", options.eventType);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.days) params.set("days", String(options.days));

    const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch conflicts: ${response.status}`);
    }

    const data: ConflictAPIResponse = await response.json();
    return {
        events: data.data,
        isSampleData: data.isSampleData,
    };
}

/**
 * Polling intervals for conflict data
 */
export const CONFLICT_POLLING = {
    /** Standard polling interval (10 minutes) */
    STANDARD: 600_000,
    /** Fast polling (2 minutes) */
    FAST: 120_000,
} as const;
