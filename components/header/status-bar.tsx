"use client";

import { useEffect, useState } from "react";
import { Clock, Plane, PlaneTakeoff, Ship, Satellite, AlertTriangle, Loader2 } from "lucide-react";
import { useAircraft } from "@/lib/hooks/use-aircraft";
import { useEntityCounts } from "@/lib/stores/data-store";
import { cn } from "@/lib/utils";

/**
 * Data freshness thresholds (in seconds)
 */
const FRESHNESS_THRESHOLDS = {
    FRESH: 10, // "Just now" threshold
    RECENT: 60, // "Xs ago" threshold
    AGING: 300, // "Xm ago" threshold (5 min)
    STALE: 300, // "Stale data" threshold (5 min)
} as const;

/**
 * Get relative time string for data freshness
 */
function getRelativeTime(secondsAgo: number): string {
    if (secondsAgo < FRESHNESS_THRESHOLDS.FRESH) {
        return "Just now";
    }
    if (secondsAgo < FRESHNESS_THRESHOLDS.RECENT) {
        return `${Math.floor(secondsAgo)}s ago`;
    }
    if (secondsAgo < FRESHNESS_THRESHOLDS.AGING) {
        return `${Math.floor(secondsAgo / 60)}m ago`;
    }
    return "Stale data";
}

/**
 * Get freshness status for styling
 */
function getFreshnessStatus(secondsAgo: number): "fresh" | "recent" | "aging" | "stale" {
    if (secondsAgo < FRESHNESS_THRESHOLDS.FRESH) return "fresh";
    if (secondsAgo < FRESHNESS_THRESHOLDS.RECENT) return "recent";
    if (secondsAgo < FRESHNESS_THRESHOLDS.AGING) return "aging";
    return "stale";
}

/**
 * Get connection status based on polling and error states
 */
function getConnectionStatus(
    isPolling: boolean,
    isLoading: boolean,
    error: string | null,
    secondsAgo: number
): {
    status: "connected" | "connecting" | "stale" | "error";
    label: string;
} {
    if (error) {
        return { status: "error", label: "Error" };
    }
    if (isLoading) {
        return { status: "connecting", label: "Updating..." };
    }
    if (!isPolling) {
        return { status: "stale", label: "Paused" };
    }
    if (secondsAgo > FRESHNESS_THRESHOLDS.STALE) {
        return { status: "stale", label: "Stale" };
    }
    return { status: "connected", label: "Live" };
}

/**
 * Status indicator dot with pulse animation
 */
function StatusDot({
    status,
    className,
}: {
    status: "connected" | "connecting" | "stale" | "error" | "fresh" | "recent" | "aging";
    className?: string;
}) {
    const statusColors = {
        connected: "bg-green-500",
        connecting: "bg-yellow-500",
        stale: "bg-orange-500",
        error: "bg-red-500",
        fresh: "bg-green-500",
        recent: "bg-green-400",
        aging: "bg-yellow-500",
    };

    const shouldPulse = status === "connected" || status === "fresh" || status === "connecting";

    return (
        <span
            className={cn(
                "inline-block w-2 h-2 rounded-full",
                statusColors[status],
                shouldPulse && "animate-pulse",
                className
            )}
        />
    );
}

/**
 * Format UTC time as HH:MM:SS
 */
function formatUTCTime(date: Date): string {
    return date.toISOString().slice(11, 19);
}

/**
 * Status Bar Component
 * Displays current UTC time, data freshness, aircraft counts, and connection status
 */
export function StatusBar() {
    const { aircraftCount, airborneCount, groundedCount, isLoading, error, lastUpdated, isPolling } =
        useAircraft();
    const entityCounts = useEntityCounts();

    // Current UTC time (updates every second) - null initially to avoid hydration mismatch
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    // Seconds since last data update
    const [secondsAgo, setSecondsAgo] = useState(0);

    // Update current time every second - only on client
    useEffect(() => {
        // Set initial time on client
        setCurrentTime(new Date());

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Calculate seconds since last update
    useEffect(() => {
        const calculateSecondsAgo = () => {
            if (!lastUpdated) return 0;
            return Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        };

        // Update immediately
        setSecondsAgo(calculateSecondsAgo());

        // Then update every second
        const interval = setInterval(() => {
            setSecondsAgo(calculateSecondsAgo());
        }, 1000);

        return () => clearInterval(interval);
    }, [lastUpdated]);

    const freshnessStatus = getFreshnessStatus(secondsAgo);
    const { status: connectionStatus, label: connectionLabel } = getConnectionStatus(
        isPolling,
        isLoading,
        error,
        secondsAgo
    );

    return (
        <div className="flex items-center gap-6 text-sm">
            {/* UTC Time */}
            <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs font-mono">
                    {currentTime ? formatUTCTime(currentTime) : "--:--:--"}
                </span>
                <span className="text-muted-foreground/60 text-xs">UTC</span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-border/50" />

            {/* Data Freshness */}
            <div className="flex items-center gap-2">
                <StatusDot status={freshnessStatus} />
                <span
                    className={cn(
                        "text-xs",
                        freshnessStatus === "stale" ? "text-red-400" : "text-muted-foreground"
                    )}
                >
                    {getRelativeTime(secondsAgo)}
                </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-border/50" />

            {/* Entity Counts */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <PlaneTakeoff className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-foreground font-medium tabular-nums">{airborneCount}</span>
                    <span className="text-muted-foreground text-xs">aircraft</span>
                </div>
                {entityCounts.vessels > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Ship className="w-3.5 h-3.5 text-[#00aaff]" />
                        <span className="text-foreground font-medium tabular-nums">{entityCounts.vessels}</span>
                        <span className="text-muted-foreground text-xs">vessels</span>
                    </div>
                )}
                {entityCounts.satellites > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Satellite className="w-3.5 h-3.5 text-[#aa88ff]" />
                        <span className="text-foreground font-medium tabular-nums">{entityCounts.satellites}</span>
                        <span className="text-muted-foreground text-xs">sats</span>
                    </div>
                )}
                {entityCounts.conflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#ff4444]" />
                        <span className="text-foreground font-medium tabular-nums">{entityCounts.conflicts}</span>
                        <span className="text-muted-foreground text-xs">events</span>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-border/50" />

            {/* Connection Status */}
            <div className="flex items-center gap-2">
                {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 text-yellow-500 animate-spin" />
                ) : (
                    <StatusDot status={connectionStatus} />
                )}
                <span
                    className={cn(
                        "text-xs",
                        connectionStatus === "error" && "text-red-400",
                        connectionStatus === "stale" && "text-orange-400",
                        connectionStatus === "connecting" && "text-yellow-400",
                        connectionStatus === "connected" && "text-green-400"
                    )}
                >
                    {connectionLabel}
                </span>
            </div>

            {/* Error indicator */}
            {error && (
                <>
                    <div className="w-px h-4 bg-border/50" />
                    <div className="flex items-center gap-1.5" title={error}>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400 text-xs truncate max-w-32">{error}</span>
                    </div>
                </>
            )}
        </div>
    );
}