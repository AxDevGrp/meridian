import { NextRequest, NextResponse } from "next/server";

/**
 * OpenSky Network API proxy route
 * This acts as a proxy to avoid CORS issues when calling OpenSky from the browser
 * Also adds caching to reduce load on OpenSky's servers
 */

const OPENSKY_API_BASE = "https://opensky-network.org/api";

// Cache configuration
const CACHE_DURATION = 10; // seconds - conservative for free tier
const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

// In-memory cache (note: this will reset on serverless function cold starts)
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
            headers: {
                "Accept": "application/json",
            },
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * GET /api/aircraft
 * Fetches aircraft states from OpenSky Network API
 *
 * Query parameters:
 * - lamin: Minimum latitude (south boundary)
 * - lomin: Minimum longitude (west boundary)
 * - lamax: Maximum latitude (north boundary)
 * - lomax: Maximum longitude (east boundary)
 *
 * If no bounds are provided, fetches all aircraft (slower)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    // Check if bounds are provided
    const lamin = searchParams.get("lamin");
    const lomin = searchParams.get("lomin");
    const lamax = searchParams.get("lamax");
    const lomax = searchParams.get("lomax");

    // Build OpenSky API URL
    let openskyUrl: string;

    if (lamin && lomin && lamax && lomax) {
        // Use bounding box query
        openskyUrl = `${OPENSKY_API_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    } else {
        // Fetch all aircraft
        openskyUrl = `${OPENSKY_API_BASE}/states/all`;
    }

    // Check cache (only for full requests, not bounded)
    const now = Date.now();

    if (cachedResponse && (now - cachedResponse.timestamp) < CACHE_DURATION * 1000) {
        // Return cached data with appropriate headers
        return NextResponse.json(cachedResponse.data, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "HIT",
            },
        });
    }

    try {
        const response = await fetchWithTimeout(openskyUrl, REQUEST_TIMEOUT);

        if (!response.ok) {
            // Handle rate limiting
            if (response.status === 429) {
                // Return cached data if available during rate limiting
                if (cachedResponse) {
                    return NextResponse.json(cachedResponse.data, {
                        headers: {
                            "Cache-Control": "public, max-age=60",
                            "X-Cache": "STALE",
                            "X-Stale": "true",
                            "X-Rate-Limited": "true",
                        },
                    });
                }
                return NextResponse.json(
                    { error: "Rate limit exceeded. Please try again later.", states: [], time: Math.floor(now / 1000) },
                    { status: 200 } // Return 200 with empty data to avoid breaking the client
                );
            }

            // Handle other errors
            const errorText = await response.text();
            console.error(`OpenSky API error: ${response.status} - ${errorText}`);

            // Return cached data if available
            if (cachedResponse) {
                return NextResponse.json(cachedResponse.data, {
                    headers: {
                        "Cache-Control": "public, max-age=60",
                        "X-Cache": "STALE",
                        "X-Stale": "true",
                    },
                });
            }

            // Return empty data instead of error to avoid breaking the UI
            return NextResponse.json(
                { states: [], time: Math.floor(now / 1000), error: `OpenSky API error: ${response.status}` },
                { status: 200 }
            );
        }

        const data = await response.json();

        // Cache the response (only for full requests)
        if (!lamin) {
            cachedResponse = {
                data,
                timestamp: now,
            };
        }

        // Return the data with caching headers
        return NextResponse.json(data, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "MISS",
            },
        });
    } catch (error) {
        console.error("Failed to fetch from OpenSky:", error);

        // Return cached data if available, even if stale
        if (cachedResponse) {
            return NextResponse.json(cachedResponse.data, {
                headers: {
                    "Cache-Control": "public, max-age=60",
                    "X-Cache": "STALE",
                    "X-Stale": "true",
                },
            });
        }

        // Return empty data with error message instead of 502
        // This prevents the UI from breaking
        return NextResponse.json(
            {
                states: [],
                time: Math.floor(now / 1000),
                error: error instanceof Error && error.name === "AbortError"
                    ? "Request timed out"
                    : "Failed to fetch aircraft data from OpenSky Network"
            },
            { status: 200 } // Return 200 with empty data to avoid breaking the client
        );
    }
}

/**
 * HEAD /api/aircraft
 * Health check endpoint
 */
export async function HEAD() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Cache-Control": "no-cache",
        },
    });
}