import { NextRequest, NextResponse } from "next/server";
import { generateSampleAnomalies } from "@/lib/analytics/sample-analytics-data";
import type { AnomalyKind, AnomalySeverity } from "@/lib/types/analytics";

/**
 * GET /api/analytics/anomalies
 *
 * Returns anomalies array. Falls back to sample data if no live data.
 * Supports ?kind=vessel_deviation and ?severity=high filters.
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const kindParam = url.searchParams.get("kind") as AnomalyKind | null;
        const severityParam = url.searchParams.get("severity") as AnomalySeverity | null;

        // Generate sample anomalies (live engine integration can replace this)
        let anomalies = generateSampleAnomalies();
        const isSampleData = true;

        // Apply filters
        if (kindParam) {
            anomalies = anomalies.filter((a) => a.kind === kindParam);
        }
        if (severityParam) {
            anomalies = anomalies.filter((a) => a.severity === severityParam);
        }

        return NextResponse.json(
            {
                anomalies,
                isSampleData,
                computedAt: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-cache" },
            },
        );
    } catch (error) {
        console.error("Analytics anomalies GET error:", error);
        return NextResponse.json(
            { error: "Failed to fetch anomalies" },
            { status: 500 },
        );
    }
}
