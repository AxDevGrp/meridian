import { NextRequest, NextResponse } from "next/server";
import type { AlertNotification } from "@/lib/types/alert";
import { getHistory, addNotification, historyCount, getAllRules } from "@/lib/stores/alert-store-server";

/**
 * GET /api/intel/alerts/history
 *
 * Returns alert notification history, sorted by triggeredAt DESC.
 * Accepts ?limit=50 query param.
 * Seeds sample notifications if none exist.
 */
export async function GET(request: NextRequest) {
    try {
        // Seed sample notifications if history is empty
        if (historyCount() === 0) {
            seedSampleNotifications();
        }

        const url = new URL(request.url);
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;

        const notifications = getHistory(limit && !isNaN(limit) ? limit : undefined);

        return NextResponse.json(
            {
                success: true,
                data: notifications,
                count: notifications.length,
                timestamp: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-cache" },
            },
        );
    } catch (error) {
        console.error("Alert history GET error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch alert history" },
            { status: 500 },
        );
    }
}

// ============================================
// Sample Notification Seeds
// ============================================

function seedSampleNotifications(): void {
    const now = new Date();
    const rules = getAllRules();

    // Build notifications that reference existing preset rules
    const sampleNotifications: Array<{
        ruleName: string;
        severity: AlertNotification["severity"];
        title: string;
        message: string;
        data: Record<string, unknown>;
        minutesAgo: number;
    }> = [
            {
                ruleName: "Strait of Hormuz — Critical Conflict",
                severity: "critical",
                title: "Critical conflict event detected near Strait of Hormuz",
                message: "A severity-5 conflict event involving naval forces was detected 45km from the Strait of Hormuz chokepoint. Multiple military vessels in the area have altered course.",
                data: {
                    conflictId: "acled-evt-28491",
                    severity: 5,
                    distanceKm: 45,
                    region: "Strait of Hormuz",
                    vesselCount: 3,
                },
                minutesAgo: 23,
            },
            {
                ruleName: "GPS Jamming Spike",
                severity: "high",
                title: "GPS jamming spike — 4 zones in Eastern Mediterranean",
                message: "4 GPS jamming zones detected within the last 60 minutes across the Eastern Mediterranean region. Affected area spans from Cyprus to the Levantine coast.",
                data: {
                    zoneCount: 4,
                    region: "Eastern Mediterranean",
                    timeWindowMinutes: 60,
                    affectedAreaSqKm: 85000,
                },
                minutesAgo: 47,
            },
            {
                ruleName: "Oil Market Correlation",
                severity: "high",
                title: "Oil futures surge +3.8% amid geopolitical escalation",
                message: "Brent Crude (BZ=F) surged 3.8% in the last hour, coinciding with reported military activity in the Persian Gulf region. WTI also up 3.2%.",
                data: {
                    symbol: "BZ=F",
                    changePercent: 3.8,
                    currentPrice: 84.52,
                    relatedEvent: "Persian Gulf military activity",
                },
                minutesAgo: 112,
            },
            {
                ruleName: "Official Negative Sentiment",
                severity: "medium",
                title: "Negative sentiment detected in official statements",
                message: "White House press briefing contained strongly negative sentiment (-0.72) regarding trade negotiations. Multiple posts flagged with geopolitical risk keywords.",
                data: {
                    platform: "whitehouse",
                    sentiment: -0.72,
                    postCount: 3,
                    keywords: ["sanctions", "escalation", "response"],
                },
                minutesAgo: 185,
            },
            {
                ruleName: "Military Vessel Proximity",
                severity: "medium",
                title: "3 military vessels detected near Taiwan Strait",
                message: "3 military-flagged vessels detected within 50km of the Taiwan Strait watch zone. Vessel types include destroyer and frigate classifications.",
                data: {
                    vesselCount: 3,
                    radiusKm: 50,
                    region: "Taiwan Strait",
                    vesselTypes: ["destroyer", "frigate", "patrol"],
                },
                minutesAgo: 320,
            },
        ];

    for (const sample of sampleNotifications) {
        // Find matching rule by name
        const matchingRule = rules.find((r) => r.name === sample.ruleName);

        const notification: AlertNotification = {
            id: crypto.randomUUID(),
            ruleId: matchingRule?.id ?? crypto.randomUUID(),
            ruleName: sample.ruleName,
            severity: sample.severity,
            title: sample.title,
            message: sample.message,
            data: sample.data,
            acknowledged: false,
            triggeredAt: new Date(now.getTime() - sample.minutesAgo * 60_000).toISOString(),
        };

        addNotification(notification);
    }
}
