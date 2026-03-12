import { NextRequest, NextResponse } from "next/server";
import { getReport, reportCount } from "@/lib/stores/report-store-server";

/**
 * GET /api/intel/reports/[id]
 *
 * Returns the full intel report by ID.
 * Returns 404 if the report is not found.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    // If store is empty, trigger seed by calling the list endpoint first
    // (This is a lazy-seed pattern — the list route seeds on first access)
    if (reportCount() === 0) {
        // Import dynamically to trigger seed
        const listModule = await import("@/app/api/intel/reports/route");
        await listModule.GET();
    }

    const report = getReport(id);

    if (!report) {
        return NextResponse.json(
            {
                success: false,
                error: "Report not found",
                id,
            },
            { status: 404 },
        );
    }

    return NextResponse.json(
        {
            success: true,
            data: report,
            timestamp: new Date().toISOString(),
        },
        {
            headers: {
                "Cache-Control": "public, max-age=60",
            },
        },
    );
}
