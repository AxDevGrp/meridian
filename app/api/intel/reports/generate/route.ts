import { NextRequest, NextResponse } from "next/server";
import type { ReportGenerationRequest } from "@/lib/types/intel-report";
import { aggregateRegionData } from "@/lib/services/intel-aggregator";
import { formatIntelReport } from "@/lib/services/intel-formatter";
import { storeReport } from "@/lib/stores/report-store-server";

/**
 * POST /api/intel/reports/generate
 *
 * Accepts a ReportGenerationRequest in the body, aggregates all data
 * sources for the region, formats a structured intel report, stores it
 * in the in-memory store, and returns the full report.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const { regionName, regionCenter, regionRadiusKm } = body as Partial<ReportGenerationRequest>;

        if (!regionName || !regionCenter || !regionRadiusKm) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: regionName, regionCenter, regionRadiusKm",
                },
                { status: 400 },
            );
        }

        if (
            typeof regionCenter.lat !== "number" ||
            typeof regionCenter.lng !== "number" ||
            !isFinite(regionCenter.lat) ||
            !isFinite(regionCenter.lng)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "regionCenter must have numeric lat and lng fields",
                },
                { status: 400 },
            );
        }

        const generationRequest: ReportGenerationRequest = {
            regionName,
            regionCenter,
            regionRadiusKm,
            classification: body.classification ?? "unclassified",
            timeframeHours: body.timeframeHours ?? 24,
        };

        // 1. Aggregate data from all sources
        const aggregatedData = await aggregateRegionData({
            regionCenter: generationRequest.regionCenter,
            regionRadiusKm: generationRequest.regionRadiusKm,
            timeframeHours: generationRequest.timeframeHours ?? 24,
        });

        // 2. Format into structured report
        const report = formatIntelReport(generationRequest, aggregatedData);

        // 3. Store in memory
        storeReport(report);

        return NextResponse.json(
            {
                success: true,
                data: report,
                timestamp: new Date().toISOString(),
            },
            {
                status: 201,
                headers: { "Cache-Control": "no-store" },
            },
        );
    } catch (error) {
        console.error("Report generation failed:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Report generation failed",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
