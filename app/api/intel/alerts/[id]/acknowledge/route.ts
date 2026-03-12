import { NextRequest, NextResponse } from "next/server";
import { getNotification, acknowledgeNotification } from "@/lib/stores/alert-store-server";

/**
 * POST /api/intel/alerts/[id]/acknowledge
 *
 * Marks a notification as acknowledged.
 * Sets acknowledged=true and acknowledgedAt timestamp.
 * Returns updated notification or 404.
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;

        const success = acknowledgeNotification(id);

        if (!success) {
            return NextResponse.json(
                { success: false, error: "Notification not found", id },
                { status: 404 },
            );
        }

        const notification = getNotification(id);

        return NextResponse.json(
            {
                success: true,
                data: notification,
                timestamp: new Date().toISOString(),
            },
            {
                headers: { "Cache-Control": "no-store" },
            },
        );
    } catch (error) {
        console.error("Alert acknowledge error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to acknowledge notification",
                detail: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
