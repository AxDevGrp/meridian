import { NextRequest, NextResponse } from "next/server";
import { generateSampleRiskScores } from "@/lib/analytics/sample-analytics-data";

/**
 * GET /api/analytics/risk-scores
 *
 * Returns risk scores for all monitored regions.
 * Falls back to sample data if no live data.
 * Supports ?region=Strait+of+Hormuz filter.
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const regionParam = url.searchParams.get("region");

        // Generate sample risk scores (live engine integration can replace this)
        let riskScores = generateSampleRiskScores();
        const isSampleData = true;

        // Apply region filter
        if (regionParam) {
            riskScores = riskScores.filter(
                (r) => r.regionName.toLowerCase() === regionParam.toLowerCase(),
            );
        }

        return NextResponse.json(
            {
                riskScores,
                isSampleData,
                computedAt: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-cache" },
            },
        );
    } catch (error) {
        console.error("Analytics risk-scores GET error:", error);
        return NextResponse.json(
            { error: "Failed to fetch risk scores" },
            { status: 500 },
        );
    }
}
