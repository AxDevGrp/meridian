import { NextResponse } from "next/server";
import {
    generateSampleAnomalies,
    generateSampleRiskScores,
    generateSamplePatterns,
} from "@/lib/analytics/sample-analytics-data";
import type { AnalyticsSnapshot } from "@/lib/types/analytics";

/**
 * GET /api/analytics/snapshot
 *
 * Returns a complete AnalyticsSnapshot (anomalies + riskScores + patterns).
 * This is the primary endpoint the client polling provider uses.
 */
export async function GET() {
    try {
        const snapshot: AnalyticsSnapshot = {
            anomalies: generateSampleAnomalies(),
            riskScores: generateSampleRiskScores(),
            patterns: generateSamplePatterns(),
            computedAt: new Date().toISOString(),
            isSampleData: true,
        };

        return NextResponse.json(snapshot, {
            headers: { "Cache-Control": "no-cache" },
        });
    } catch (error) {
        console.error("Analytics snapshot GET error:", error);
        return NextResponse.json(
            { error: "Failed to compute analytics snapshot" },
            { status: 500 },
        );
    }
}
