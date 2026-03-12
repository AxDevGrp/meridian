import { NextRequest, NextResponse } from "next/server";
import type { AlertRule } from "@/lib/types/alert";
import { getAllRules, createRule } from "@/lib/stores/alert-store-server";

/**
 * GET /api/intel/alerts
 *
 * Returns all alert rules, sorted by createdAt DESC.
 */
export async function GET() {
    try {
        const rules = getAllRules();

        return NextResponse.json(
            {
                success: true,
                data: rules,
                count: rules.length,
                timestamp: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control": "no-cache",
                },
            },
        );
    } catch (error) {
        console.error("Alert rules GET error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch alert rules" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/intel/alerts
 *
 * Creates a new alert rule from request body.
 * Validates required fields, generates UUID and timestamps.
 * Returns 201 with the created rule.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const { name, severity, conditionType, conditionConfig } = body as Partial<AlertRule>;

        if (!name || !severity || !conditionType || !conditionConfig) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields: name, severity, conditionType, conditionConfig",
                },
                { status: 400 },
            );
        }

        // Validate severity
        const validSeverities = ["critical", "high", "medium", "low", "info"];
        if (!validSeverities.includes(severity)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid severity: ${severity}. Must be one of: ${validSeverities.join(", ")}`,
                },
                { status: 400 },
            );
        }

        // Validate conditionType
        const validTypes = ["threshold", "correlation", "sentiment", "proximity", "count", "absence"];
        if (!validTypes.includes(conditionType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid conditionType: ${conditionType}. Must be one of: ${validTypes.join(", ")}`,
                },
                { status: 400 },
            );
        }

        const now = new Date().toISOString();

        const rule: AlertRule = {
            id: crypto.randomUUID(),
            name,
            description: body.description ?? "",
            enabled: body.enabled ?? false,
            severity,
            conditionType,
            conditionConfig,
            regionName: body.regionName,
            regionCenter: body.regionCenter,
            regionRadiusKm: body.regionRadiusKm,
            cooldownMinutes: body.cooldownMinutes ?? 60,
            createdAt: now,
            updatedAt: now,
        };

        createRule(rule);

        return NextResponse.json(
            {
                success: true,
                data: rule,
                timestamp: new Date().toISOString(),
            },
            {
                status: 201,
                headers: { "Cache-Control": "no-store" },
            },
        );
    } catch (error) {
        console.error("Alert rule creation failed:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to create alert rule",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
