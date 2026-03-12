import { NextRequest, NextResponse } from "next/server";
import { getRule, updateRule, deleteRule } from "@/lib/stores/alert-store-server";

/**
 * GET /api/intel/alerts/[id]
 *
 * Returns a single alert rule by ID. Returns 404 if not found.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const rule = getRule(id);

    if (!rule) {
        return NextResponse.json(
            { success: false, error: "Alert rule not found", id },
            { status: 404 },
        );
    }

    return NextResponse.json(
        {
            success: true,
            data: rule,
            timestamp: new Date().toISOString(),
        },
        {
            headers: { "Cache-Control": "no-cache" },
        },
    );
}

/**
 * PATCH /api/intel/alerts/[id]
 *
 * Updates alert rule fields (name, description, enabled, severity,
 * conditionConfig, cooldownMinutes, etc.). Returns updated rule.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Validate severity if provided
        if (body.severity) {
            const validSeverities = ["critical", "high", "medium", "low", "info"];
            if (!validSeverities.includes(body.severity)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid severity: ${body.severity}. Must be one of: ${validSeverities.join(", ")}`,
                    },
                    { status: 400 },
                );
            }
        }

        // Validate conditionType if provided
        if (body.conditionType) {
            const validTypes = ["threshold", "correlation", "sentiment", "proximity", "count", "absence"];
            if (!validTypes.includes(body.conditionType)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid conditionType: ${body.conditionType}. Must be one of: ${validTypes.join(", ")}`,
                    },
                    { status: 400 },
                );
            }
        }

        const updated = updateRule(id, body);

        if (!updated) {
            return NextResponse.json(
                { success: false, error: "Alert rule not found", id },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: updated,
                timestamp: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-store" },
            },
        );
    } catch (error) {
        console.error("Alert rule PATCH error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to update alert rule",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/intel/alerts/[id]
 *
 * Removes an alert rule. Returns 204 on success.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    const deleted = deleteRule(id);

    if (!deleted) {
        return NextResponse.json(
            { success: false, error: "Alert rule not found", id },
            { status: 404 },
        );
    }

    return new NextResponse(null, { status: 204 });
}
