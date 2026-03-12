import { NextRequest, NextResponse } from "next/server";
import { generateSamplePatterns } from "@/lib/analytics/sample-analytics-data";
import type { PatternKind } from "@/lib/types/analytics";

/**
 * GET /api/analytics/patterns
 *
 * Returns detected patterns. Falls back to sample data if no live data.
 * Supports ?kind=temporal_correlation filter.
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const kindParam = url.searchParams.get("kind") as PatternKind | null;

        // Generate sample patterns (live engine integration can replace this)
        let patterns = generateSamplePatterns();
        const isSampleData = true;

        // Apply filter
        if (kindParam) {
            patterns = patterns.filter((p) => p.kind === kindParam);
        }

        return NextResponse.json(
            {
                patterns,
                isSampleData,
                computedAt: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-cache" },
            },
        );
    } catch (error) {
        console.error("Analytics patterns GET error:", error);
        return NextResponse.json(
            { error: "Failed to fetch patterns" },
            { status: 500 },
        );
    }
}
