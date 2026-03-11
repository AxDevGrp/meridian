import { NextRequest, NextResponse } from "next/server";
import type { CelesTrakGPData } from "@/lib/types/satellite";

/**
 * CelesTrak satellite data API proxy
 * Fetches TLE / GP data from CelesTrak and transforms it
 */

const CELESTRAK_API_BASE = "https://celestrak.org/NORAD/elements/gp.php";

// Cache configuration
const CACHE_DURATION = 300; // 5 minutes - TLE data doesn't change that frequently
const REQUEST_TIMEOUT = 30000; // 30 seconds

// In-memory cache
let cachedResponse: {
    data: unknown;
    timestamp: number;
    group: string;
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
 * Simplified SGP4-like satellite position calculation
 * For accurate results, use a proper SGP4 library (satellite.js)
 * This provides approximate positions for visualization purposes
 */
function computeSatellitePosition(gp: CelesTrakGPData): {
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
} {
    const epoch = new Date(gp.EPOCH);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - epoch.getTime()) / 60000;

    // Mean motion in radians per minute
    const meanMotionRadPerMin = (gp.MEAN_MOTION * 2 * Math.PI) / 1440;

    // Current mean anomaly
    const currentMeanAnomaly = (gp.MEAN_ANOMALY + (meanMotionRadPerMin * timeDiffMinutes * 180) / Math.PI) % 360;

    // Approximate true anomaly (simplified, ignoring eccentricity correction for speed)
    const trueAnomaly = currentMeanAnomaly * (Math.PI / 180);

    // Semi-major axis from mean motion (km)
    const mu = 398600.4418; // Earth's gravitational parameter (km³/s²)
    const n = gp.MEAN_MOTION * (2 * Math.PI) / 86400; // rad/s
    const semiMajorAxis = Math.pow(mu / (n * n), 1 / 3);

    // Altitude above Earth's surface
    const earthRadius = 6371; // km
    const altitude = semiMajorAxis * (1 - gp.ECCENTRICITY * Math.cos(trueAnomaly)) - earthRadius;

    // Compute position in orbital plane
    const inclination = gp.INCLINATION * (Math.PI / 180);
    const raan = gp.RA_OF_ASC_NODE * (Math.PI / 180);
    const argPerigee = gp.ARG_OF_PERICENTER * (Math.PI / 180);

    // Earth's rotation adjustment
    const earthRotationRate = 7.2921159e-5; // rad/s
    const adjustedRaan = raan - earthRotationRate * (timeDiffMinutes * 60);

    // Argument of latitude
    const u = argPerigee + trueAnomaly;

    // Geographic coordinates (simplified)
    const latitude = Math.asin(Math.sin(inclination) * Math.sin(u)) * (180 / Math.PI);
    const longitude = (Math.atan2(
        Math.cos(inclination) * Math.sin(u),
        Math.cos(u)
    ) + adjustedRaan) * (180 / Math.PI);

    // Normalize longitude to [-180, 180]
    const normalizedLong = ((longitude + 540) % 360) - 180;

    // Orbital velocity (vis-viva equation, simplified)
    const r = semiMajorAxis * (1 - gp.ECCENTRICITY * Math.cos(trueAnomaly));
    const velocity = Math.sqrt(mu * (2 / r - 1 / semiMajorAxis));

    return {
        longitude: normalizedLong,
        latitude: Math.max(-90, Math.min(90, latitude)),
        altitude: Math.max(0, altitude),
        velocity,
    };
}

/**
 * Satellite groups available from CelesTrak
 */
const SATELLITE_GROUPS: Record<string, string> = {
    stations: "stations",     // Space Stations (ISS, Tiangong, etc.)
    active: "active",         // Active satellites
    "visual": "visual",      // Brightest / visible satellites
    "gps-ops": "gps-ops",    // GPS operational
    "galileo": "galileo",    // Galileo navigation
    "weather": "weather",    // Weather satellites
    "resource": "resource",  // Earth resources
    "starlink": "starlink",  // Starlink constellation
    "last-30-days": "last-30-days", // Recently launched
};

/**
 * GET /api/satellites
 * Fetches satellite data from CelesTrak
 *
 * Query parameters:
 * - group: Satellite group to fetch (default: "stations")
 * - limit: Maximum number of satellites to return (default: 100)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const group = searchParams.get("group") || "stations";
    const limit = parseInt(searchParams.get("limit") || "100");

    // Validate group
    if (!SATELLITE_GROUPS[group]) {
        return NextResponse.json(
            { error: `Invalid satellite group. Available: ${Object.keys(SATELLITE_GROUPS).join(", ")}` },
            { status: 400 }
        );
    }

    // Check cache
    const now = Date.now();
    if (cachedResponse && cachedResponse.group === group && (now - cachedResponse.timestamp) < CACHE_DURATION * 1000) {
        return NextResponse.json(cachedResponse.data, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "HIT",
            },
        });
    }

    try {
        const url = `${CELESTRAK_API_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
        const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

        if (!response.ok) {
            // Return cached data if available
            if (cachedResponse && cachedResponse.group === group) {
                return NextResponse.json(cachedResponse.data, {
                    headers: {
                        "Cache-Control": "public, max-age=60",
                        "X-Cache": "STALE",
                    },
                });
            }
            return NextResponse.json(
                { satellites: [], count: 0, timestamp: new Date().toISOString(), error: `CelesTrak error: ${response.status}` },
                { status: 200 }
            );
        }

        const gpData: CelesTrakGPData[] = await response.json();

        // Transform and compute positions
        const satellites = gpData.slice(0, limit).map((gp) => {
            const position = computeSatellitePosition(gp);
            return {
                noradId: String(gp.NORAD_CAT_ID),
                name: gp.OBJECT_NAME,
                intlDesignator: gp.OBJECT_ID || null,
                position,
                orbitalElements: {
                    inclination: gp.INCLINATION,
                    raan: gp.RA_OF_ASC_NODE,
                    eccentricity: gp.ECCENTRICITY,
                    argOfPerigee: gp.ARG_OF_PERICENTER,
                    meanAnomaly: gp.MEAN_ANOMALY,
                    meanMotion: gp.MEAN_MOTION,
                    epoch: gp.EPOCH,
                },
                epoch: gp.EPOCH,
            };
        });

        const responseData = {
            satellites,
            count: satellites.length,
            totalAvailable: gpData.length,
            group,
            timestamp: new Date().toISOString(),
        };

        // Cache the response
        cachedResponse = {
            data: responseData,
            timestamp: now,
            group,
        };

        return NextResponse.json(responseData, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "MISS",
            },
        });
    } catch (error) {
        console.error("Failed to fetch from CelesTrak:", error);

        if (cachedResponse && cachedResponse.group === group) {
            return NextResponse.json(cachedResponse.data, {
                headers: {
                    "Cache-Control": "public, max-age=60",
                    "X-Cache": "STALE",
                },
            });
        }

        return NextResponse.json(
            {
                satellites: [],
                count: 0,
                timestamp: new Date().toISOString(),
                error: error instanceof Error && error.name === "AbortError"
                    ? "Request timed out"
                    : "Failed to fetch satellite data",
            },
            { status: 200 }
        );
    }
}
