/**
 * Server-Sent Events (SSE) endpoint for real-time data streaming.
 * 
 * Pushes live updates from all data sources to connected clients.
 * Each event includes: source type, entity data, and timestamp.
 * 
 * Usage: const eventSource = new EventSource('/api/events/stream');
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE event types matching our data layers */
type SSEEventType =
    | "connected"
    | "aircraft_update"
    | "vessel_update"
    | "satellite_update"
    | "conflict_update"
    | "gps_jamming_update"
    | "heartbeat";

interface SSEMessage {
    type: SSEEventType;
    data: unknown;
    timestamp: string;
}

function formatSSE(event: SSEMessage): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * GET /api/events/stream
 * 
 * Establishes an SSE connection and pushes data updates.
 * Currently polls the internal API routes on configurable intervals
 * and pushes deltas to connected clients.
 * 
 * When the Python pipeline + Redis pub/sub is active, this will
 * subscribe to Redis channels instead of polling.
 */
export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Send connected event
            const connectedMsg = formatSSE({
                type: "connected",
                data: {
                    message: "Connected to Meridian event stream",
                    sources: ["aircraft", "vessel", "satellite", "conflict", "gps-jamming"],
                },
                timestamp: new Date().toISOString(),
            });
            controller.enqueue(encoder.encode(connectedMsg));

            // Heartbeat interval to keep connection alive
            const heartbeatInterval = setInterval(() => {
                try {
                    const heartbeat = formatSSE({
                        type: "heartbeat",
                        data: { status: "alive" },
                        timestamp: new Date().toISOString(),
                    });
                    controller.enqueue(encoder.encode(heartbeat));
                } catch {
                    clearInterval(heartbeatInterval);
                }
            }, 30_000); // Every 30 seconds

            // Data polling intervals (simplified; production would use Redis pub/sub)
            const pollingIntervals: NodeJS.Timeout[] = [];

            // Aircraft updates - every 15s
            pollingIntervals.push(
                setInterval(async () => {
                    try {
                        const baseUrl = request.nextUrl.origin;
                        const res = await fetch(`${baseUrl}/api/aircraft`, {
                            cache: "no-store",
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const msg = formatSSE({
                                type: "aircraft_update",
                                data: {
                                    count: data.aircraft?.length ?? 0,
                                    source: "opensky",
                                },
                                timestamp: new Date().toISOString(),
                            });
                            controller.enqueue(encoder.encode(msg));
                        }
                    } catch {
                        // Silently skip failed polls
                    }
                }, 15_000)
            );

            // Vessel updates - every 60s
            pollingIntervals.push(
                setInterval(async () => {
                    try {
                        const baseUrl = request.nextUrl.origin;
                        const res = await fetch(`${baseUrl}/api/vessels`, {
                            cache: "no-store",
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const msg = formatSSE({
                                type: "vessel_update",
                                data: {
                                    count: data.vessels?.length ?? 0,
                                    source: "ais",
                                },
                                timestamp: new Date().toISOString(),
                            });
                            controller.enqueue(encoder.encode(msg));
                        }
                    } catch {
                        // Silently skip failed polls
                    }
                }, 60_000)
            );

            // Satellite updates - every 5min
            pollingIntervals.push(
                setInterval(async () => {
                    try {
                        const baseUrl = request.nextUrl.origin;
                        const res = await fetch(`${baseUrl}/api/satellites`, {
                            cache: "no-store",
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const msg = formatSSE({
                                type: "satellite_update",
                                data: {
                                    count: data.satellites?.length ?? 0,
                                    source: "celestrak",
                                },
                                timestamp: new Date().toISOString(),
                            });
                            controller.enqueue(encoder.encode(msg));
                        }
                    } catch {
                        // Silently skip failed polls
                    }
                }, 300_000)
            );

            // Conflict updates - every 10min
            pollingIntervals.push(
                setInterval(async () => {
                    try {
                        const baseUrl = request.nextUrl.origin;
                        const res = await fetch(`${baseUrl}/api/conflicts`, {
                            cache: "no-store",
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const msg = formatSSE({
                                type: "conflict_update",
                                data: {
                                    count: data.conflicts?.length ?? 0,
                                    source: "acled",
                                },
                                timestamp: new Date().toISOString(),
                            });
                            controller.enqueue(encoder.encode(msg));
                        }
                    } catch {
                        // Silently skip failed polls
                    }
                }, 600_000)
            );

            // Clean up on client disconnect
            request.signal.addEventListener("abort", () => {
                clearInterval(heartbeatInterval);
                for (const interval of pollingIntervals) {
                    clearInterval(interval);
                }
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
