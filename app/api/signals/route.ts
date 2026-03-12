import { NextResponse } from "next/server";
import { generateSampleSignals } from "@/lib/scenario-engine";
import type { MarketSignal } from "@/lib/types/signal";

/**
 * GET /api/signals
 *
 * Returns current active market impact signals.
 * Server-side — generates sample signals directly via the scenario engine.
 */
export async function GET() {
    try {
        const signals: MarketSignal[] = generateSampleSignals();

        return NextResponse.json(
            {
                signals,
                evaluatedAt: new Date().toISOString(),
                isSampleData: true,
            },
            {
                headers: { "Cache-Control": "no-cache" },
            },
        );
    } catch (error) {
        console.error("Signals GET error:", error);
        return NextResponse.json(
            { error: "Failed to evaluate market signals" },
            { status: 500 },
        );
    }
}
