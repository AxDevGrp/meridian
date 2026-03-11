"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface StreamEvent {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
}

interface UseEventStreamOptions {
    /** Whether the stream connection is enabled */
    enabled?: boolean;
    /** Callback for each incoming event */
    onEvent?: (event: StreamEvent) => void;
    /** Callback on connection established */
    onConnect?: () => void;
    /** Callback on connection lost */
    onDisconnect?: () => void;
    /** Reconnection delay in ms (default: 5000) */
    reconnectDelay?: number;
    /** Max reconnection attempts (default: 10) */
    maxReconnectAttempts?: number;
}

export type StreamStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Hook to connect to the SSE event stream for real-time data updates.
 *
 * @example
 * ```tsx
 * const { status, lastEvent } = useEventStream({
 *   enabled: true,
 *   onEvent: (event) => {
 *     if (event.type === 'aircraft_update') {
 *       // Trigger aircraft data refetch
 *     }
 *   },
 * });
 * ```
 */
export function useEventStream(options: UseEventStreamOptions = {}) {
    const {
        enabled = true,
        onEvent,
        onConnect,
        onDisconnect,
        reconnectDelay = 5000,
        maxReconnectAttempts = 10,
    } = options;

    const [status, setStatus] = useState<StreamStatus>("disconnected");
    const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
    const [reconnectCount, setReconnectCount] = useState(0);

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const onEventRef = useRef(onEvent);
    const onConnectRef = useRef(onConnect);
    const onDisconnectRef = useRef(onDisconnect);

    // Keep callback refs current
    onEventRef.current = onEvent;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;

    const connect = useCallback(() => {
        // Don't connect if not enabled or already connected
        if (!enabled) return;
        if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

        // Clean up existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setStatus("connecting");

        const eventSource = new EventSource("/api/events/stream");
        eventSourceRef.current = eventSource;

        // Listen for all event types
        const eventTypes = [
            "connected",
            "aircraft_update",
            "vessel_update",
            "satellite_update",
            "conflict_update",
            "gps_jamming_update",
            "heartbeat",
        ];

        for (const eventType of eventTypes) {
            eventSource.addEventListener(eventType, (e: MessageEvent) => {
                try {
                    const parsed: StreamEvent = JSON.parse(e.data);
                    setLastEvent(parsed);

                    if (eventType === "connected") {
                        setStatus("connected");
                        setReconnectCount(0);
                        onConnectRef.current?.();
                    }

                    onEventRef.current?.(parsed);
                } catch {
                    // Ignore parse errors
                }
            });
        }

        eventSource.onerror = () => {
            setStatus("error");
            eventSource.close();
            onDisconnectRef.current?.();

            // Auto-reconnect with backoff
            setReconnectCount((prev) => {
                const next = prev + 1;
                if (next <= maxReconnectAttempts) {
                    const delay = reconnectDelay * Math.min(next, 5);
                    reconnectTimerRef.current = setTimeout(() => {
                        connect();
                    }, delay);
                }
                return next;
            });
        };
    }, [enabled, reconnectDelay, maxReconnectAttempts]);

    const disconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setStatus("disconnected");
        setReconnectCount(0);
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        status,
        lastEvent,
        reconnectCount,
        connect,
        disconnect,
    };
}
