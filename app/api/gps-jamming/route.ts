import { NextRequest, NextResponse } from "next/server";
import { KNOWN_JAMMING_HOTSPOTS, type GPSJammingZone } from "@/lib/types/gps-jamming";

/**
 * GPS Jamming zone data API
 *
 * GPSJam.org doesn't provide a public API, so this endpoint provides:
 * 1. Curated data from known jamming hotspots (based on OSINT reports)
 * 2. Dynamic confidence scoring based on time
 *
 * For production, integrate with:
 * - GPSJam.org scraping (with permission)
 * - ADS-B Exchange GPS quality data
 * - EUROCONTROL GPS interference reports
 */

// Cache configuration
const CACHE_DURATION = 600; // 10 minutes - jamming zones don't change rapidly

// In-memory cache
let cachedResponse: {
    data: unknown;
    timestamp: number;
} | null = null;

/**
 * Generate GPS jamming zone data with dynamic confidence scores
 */
function generateJammingZones(): GPSJammingZone[] {
    const now = new Date();

    return KNOWN_JAMMING_HOTSPOTS.map((hotspot, index) => {
        // Generate dynamic confidence based on time (simulates activity patterns)
        const hourOfDay = now.getUTCHours();
        const baseConfidence = 0.6 + Math.random() * 0.3;

        // Some zones are more active during certain hours
        const timeMultiplier = hotspot.severity === "critical"
            ? 1.0 // Always active
            : 0.5 + 0.5 * Math.abs(Math.sin((hourOfDay / 24) * Math.PI));

        const confidence = Math.min(1, baseConfidence * timeMultiplier);

        // Simulate report count variation
        const baseReports = hotspot.severity === "critical" ? 200 : hotspot.severity === "high" ? 100 : 50;
        const reportCount = Math.floor(baseReports * (0.7 + Math.random() * 0.6));

        // Affected aircraft - correlated with confidence and location
        const affectedAircraftCount = Math.floor(reportCount * (0.3 + Math.random() * 0.4));

        // Determine active status
        const isActive = confidence > 0.4;

        // Generate timestamps
        const firstDetected = new Date(now);
        firstDetected.setDate(firstDetected.getDate() - Math.floor(30 + Math.random() * 180));

        const lastDetected = new Date(now);
        lastDetected.setMinutes(lastDetected.getMinutes() - Math.floor(Math.random() * 120));

        return {
            id: `gpsjam-${index + 1}-${hotspot.name.toLowerCase().replace(/\s+/g, "-")}`,
            ...hotspot,
            confidence,
            reportCount,
            affectedAircraftCount,
            isActive,
            firstDetected: firstDetected.toISOString(),
            lastDetected: lastDetected.toISOString(),
        };
    });
}

/**
 * GET /api/gps-jamming
 * Fetches GPS jamming zone data
 *
 * Query parameters:
 * - active_only: Filter to only active zones (default: true)
 * - min_severity: Minimum severity level to include
 * - region: Filter by region name
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active_only") !== "false";
    const minSeverity = searchParams.get("min_severity");
    const region = searchParams.get("region");

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

    let zones = generateJammingZones();

    // Apply filters
    if (activeOnly) {
        zones = zones.filter((z) => z.isActive);
    }

    if (minSeverity) {
        const severityOrder = ["info", "low", "medium", "high", "critical"];
        const minIndex = severityOrder.indexOf(minSeverity);
        if (minIndex >= 0) {
            zones = zones.filter((z) => severityOrder.indexOf(z.severity) >= minIndex);
        }
    }

    if (region) {
        zones = zones.filter((z) =>
            z.region.toLowerCase().includes(region.toLowerCase())
        );
    }

    const responseData = {
        zones,
        activeCount: zones.filter((z) => z.isActive).length,
        timestamp: new Date().toISOString(),
        isSampleData: true,
    };

    cachedResponse = { data: responseData, timestamp: now };

    return NextResponse.json(responseData, {
        headers: {
            "Cache-Control": `public, max-age=${CACHE_DURATION}`,
            "X-Data-Source": "osint-curated",
        },
    });
}
