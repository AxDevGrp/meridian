import { NextRequest, NextResponse } from "next/server";
import type { ACLEDRawEvent } from "@/lib/types/conflict";
import { transformACLEDEvent } from "@/lib/types/conflict";

/**
 * ACLED Conflict data API proxy
 * Fetches armed conflict events from ACLED API
 *
 * Note: ACLED requires a free API key for access.
 * Set ACLED_API_KEY and ACLED_EMAIL in environment variables.
 * Without credentials, this returns sample data for development.
 */

const ACLED_API_BASE = "https://api.acleddata.com/acled/read";

// Cache configuration
const CACHE_DURATION = 600; // 10 minutes
const REQUEST_TIMEOUT = 30000; // 30 seconds

// In-memory cache
let cachedResponse: {
    data: unknown;
    timestamp: number;
} | null = null;

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Sample conflict data for development (when no ACLED API key is available)
 * Based on real-world conflict patterns from publicly available ACLED reports
 */
function getSampleConflictData() {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 1); // Yesterday

    const sampleEvents: Array<{
        eventId: string;
        eventDate: string;
        eventType: string;
        subEventType: string;
        longitude: number;
        latitude: number;
        country: string;
        iso3: string;
        admin1: string;
        location: string;
        actor1: string;
        actor2: string | null;
        fatalities: { reported: number; isEstimate: boolean };
        notes: string;
        source: string;
    }> = [
            {
                eventId: "SAMPLE-UKR-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "battles",
                subEventType: "armed_clash",
                longitude: 37.8,
                latitude: 48.0,
                country: "Ukraine",
                iso3: "UKR",
                admin1: "Donetsk",
                location: "Bakhmut area",
                actor1: "Military Forces of Ukraine",
                actor2: "Military Forces of Russia",
                fatalities: { reported: 12, isEstimate: true },
                notes: "Armed clashes reported along the front line in Donetsk region.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-UKR-002",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "explosions_remote_violence",
                subEventType: "shelling_artillery",
                longitude: 36.3,
                latitude: 49.0,
                country: "Ukraine",
                iso3: "UKR",
                admin1: "Kharkiv",
                location: "Kharkiv",
                actor1: "Military Forces of Russia",
                actor2: null,
                fatalities: { reported: 3, isEstimate: false },
                notes: "Missile strike reported on civilian infrastructure in Kharkiv.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-SDN-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "battles",
                subEventType: "armed_clash",
                longitude: 32.5,
                latitude: 15.6,
                country: "Sudan",
                iso3: "SDN",
                admin1: "Khartoum",
                location: "Khartoum",
                actor1: "Sudanese Armed Forces",
                actor2: "Rapid Support Forces",
                fatalities: { reported: 25, isEstimate: true },
                notes: "Heavy fighting reported between SAF and RSF in the capital.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-SDN-002",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "violence_against_civilians",
                subEventType: "attack",
                longitude: 29.5,
                latitude: 13.1,
                country: "Sudan",
                iso3: "SDN",
                admin1: "West Darfur",
                location: "El Geneina area",
                actor1: "Rapid Support Forces",
                actor2: null,
                fatalities: { reported: 8, isEstimate: true },
                notes: "Attacks on civilian population in West Darfur.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-MMR-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "battles",
                subEventType: "armed_clash",
                longitude: 96.2,
                latitude: 22.0,
                country: "Myanmar",
                iso3: "MMR",
                admin1: "Shan",
                location: "Northern Shan State",
                actor1: "Myanmar National Democratic Alliance Army",
                actor2: "Military Forces of Myanmar",
                fatalities: { reported: 15, isEstimate: true },
                notes: "Fighting between resistance forces and military junta.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-SYR-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "explosions_remote_violence",
                subEventType: "air_drone_strike",
                longitude: 37.2,
                latitude: 36.2,
                country: "Syria",
                iso3: "SYR",
                admin1: "Aleppo",
                location: "Aleppo countryside",
                actor1: "Unidentified Armed Group",
                actor2: null,
                fatalities: { reported: 5, isEstimate: false },
                notes: "Drone strike reported in Aleppo countryside.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-NGA-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "violence_against_civilians",
                subEventType: "attack",
                longitude: 13.1,
                latitude: 11.8,
                country: "Nigeria",
                iso3: "NGA",
                admin1: "Borno",
                location: "Maiduguri area",
                actor1: "Boko Haram - Loss Party",
                actor2: null,
                fatalities: { reported: 6, isEstimate: false },
                notes: "Armed group attack on farming community in Borno.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-COD-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "battles",
                subEventType: "armed_clash",
                longitude: 28.8,
                latitude: -1.4,
                country: "Democratic Republic of Congo",
                iso3: "COD",
                admin1: "North Kivu",
                location: "Goma area",
                actor1: "M23",
                actor2: "Military Forces of DRC",
                fatalities: { reported: 18, isEstimate: true },
                notes: "M23 advances near Goma, clashing with FARDC forces.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-YEM-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "explosions_remote_violence",
                subEventType: "shelling_artillery",
                longitude: 44.2,
                latitude: 15.4,
                country: "Yemen",
                iso3: "YEM",
                admin1: "Taizz",
                location: "Taiz",
                actor1: "Houthi Armed Movement",
                actor2: null,
                fatalities: { reported: 4, isEstimate: false },
                notes: "Houthi shelling on government-held areas in Taiz.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-ISR-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "explosions_remote_violence",
                subEventType: "air_drone_strike",
                longitude: 34.4,
                latitude: 31.5,
                country: "Palestine",
                iso3: "PSE",
                admin1: "Gaza Strip",
                location: "Gaza",
                actor1: "Military Forces of Israel",
                actor2: null,
                fatalities: { reported: 20, isEstimate: true },
                notes: "Airstrikes reported across the Gaza Strip.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-SOM-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "battles",
                subEventType: "armed_clash",
                longitude: 45.3,
                latitude: 2.0,
                country: "Somalia",
                iso3: "SOM",
                admin1: "Middle Shabelle",
                location: "Central Somalia",
                actor1: "Al Shabaab",
                actor2: "Military Forces of Somalia",
                fatalities: { reported: 10, isEstimate: true },
                notes: "Al Shabaab attack on military outpost.",
                source: "ACLED (Sample)",
            },
            {
                eventId: "SAMPLE-ETH-001",
                eventDate: baseDate.toISOString().split("T")[0],
                eventType: "riots",
                subEventType: "violent_demonstration",
                longitude: 38.7,
                latitude: 9.0,
                country: "Ethiopia",
                iso3: "ETH",
                admin1: "Addis Ababa",
                location: "Addis Ababa",
                actor1: "Protesters",
                actor2: null,
                fatalities: { reported: 0, isEstimate: false },
                notes: "Violent protests in Addis Ababa over economic conditions.",
                source: "ACLED (Sample)",
            },
        ];

    return sampleEvents.map((event) => ({
        ...event,
        associatedActors: [],
        sourceScale: null,
        geoPrecision: 1 as const,
        timePrecision: 1 as const,
        interaction: 0,
        tags: ["sample-data"],
    }));
}

/**
 * GET /api/conflicts
 * Fetches conflict event data from ACLED
 *
 * Query parameters:
 * - country: Filter by country name
 * - event_type: Filter by event type
 * - limit: Maximum results (default: 100)
 * - days: Number of days to look back (default: 7)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get("country");
    const eventType = searchParams.get("event_type");
    const limit = parseInt(searchParams.get("limit") || "100");
    const days = parseInt(searchParams.get("days") || "7");

    const apiKey = process.env.ACLED_API_KEY;
    const apiEmail = process.env.ACLED_EMAIL;

    // Check cache
    const now = Date.now();
    if (cachedResponse && (now - cachedResponse.timestamp) < CACHE_DURATION * 1000) {
        return NextResponse.json(cachedResponse.data, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "HIT",
            },
        });
    }

    // If no ACLED credentials, return sample data
    if (!apiKey || !apiEmail) {
        const sampleData = getSampleConflictData();
        const responseData = {
            success: true,
            data: sampleData,
            count: sampleData.length,
            timestamp: new Date().toISOString(),
            isSampleData: true,
        };

        cachedResponse = { data: responseData, timestamp: now };

        return NextResponse.json(responseData, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Data-Source": "sample",
            },
        });
    }

    try {
        // Build ACLED API URL
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const fromDateStr = fromDate.toISOString().split("T")[0];

        const params = new URLSearchParams({
            key: apiKey,
            email: apiEmail,
            event_date: fromDateStr,
            event_date_where: ">=",
            limit: String(limit),
        });

        if (country) params.set("country", country);
        if (eventType) params.set("event_type", eventType);

        const url = `${ACLED_API_BASE}?${params.toString()}`;
        const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

        if (!response.ok) {
            if (cachedResponse) {
                return NextResponse.json(cachedResponse.data, {
                    headers: {
                        "Cache-Control": "public, max-age=60",
                        "X-Cache": "STALE",
                    },
                });
            }

            // Fall back to sample data
            const sampleData = getSampleConflictData();
            return NextResponse.json({
                success: true,
                data: sampleData,
                count: sampleData.length,
                timestamp: new Date().toISOString(),
                isSampleData: true,
                error: `ACLED API error: ${response.status}`,
            }, { status: 200 });
        }

        const rawResponse = await response.json();
        const rawEvents: ACLEDRawEvent[] = rawResponse.data || [];

        // Transform raw events
        const events = rawEvents.map(transformACLEDEvent);

        const responseData = {
            success: true,
            data: events,
            count: events.length,
            timestamp: new Date().toISOString(),
            isSampleData: false,
        };

        cachedResponse = { data: responseData, timestamp: now };

        return NextResponse.json(responseData, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "MISS",
            },
        });
    } catch (error) {
        console.error("Failed to fetch from ACLED:", error);

        if (cachedResponse) {
            return NextResponse.json(cachedResponse.data, {
                headers: {
                    "Cache-Control": "public, max-age=60",
                    "X-Cache": "STALE",
                },
            });
        }

        // Fall back to sample data
        const sampleData = getSampleConflictData();
        return NextResponse.json({
            success: true,
            data: sampleData,
            count: sampleData.length,
            timestamp: new Date().toISOString(),
            isSampleData: true,
            error: "Failed to fetch from ACLED API, using sample data",
        }, { status: 200 });
    }
}
