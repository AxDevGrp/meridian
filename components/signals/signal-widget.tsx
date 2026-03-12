"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useActiveSignals } from "@/lib/stores/signal-store";
import { SignalCard } from "./signal-card";
import { confidenceToSeverity } from "@/lib/types/signal";
import type { SignalSeverity } from "@/lib/types/signal";
import { Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// Constants
// ============================================

const SEVERITY_BADGE_STYLES: Record<SignalSeverity, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const SEVERITY_GLOW: Record<SignalSeverity, string> = {
    critical: "shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    high: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
    moderate: "shadow-[0_0_15px_rgba(234,179,8,0.08)]",
    low: "",
};

/** Relative time from ISO string */
function relativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime();
    const secs = Math.floor(diff / 1_000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}

// ============================================
// Component
// ============================================

/**
 * Market Signals Dashboard — always visible, always expanded, upper-left.
 * This is the "check engine light" for market intelligence.
 * Shows active causal scenario signals prominently.
 */
export function SignalWidget() {
    const { signals, isEvaluating, lastEvaluatedAt, isSampleData } =
        useActiveSignals();

    const prevCountRef = useRef(signals.length);
    const [, setTick] = useState(0);

    // Track count changes for potential future notifications
    useEffect(() => {
        prevCountRef.current = signals.length;
    }, [signals.length]);

    // Highest confidence signal
    const highestSignal = useMemo(
        () => (signals.length > 0 ? signals[0] : null),
        [signals],
    );

    const maxSeverity = useMemo<SignalSeverity>(
        () =>
            highestSignal
                ? confidenceToSeverity(highestSignal.confidence)
                : "low",
        [highestSignal],
    );

    // Update relative time every 5s
    useEffect(() => {
        if (!lastEvaluatedAt) return;
        const interval = setInterval(() => setTick((t) => t + 1), 5_000);
        return () => clearInterval(interval);
    }, [lastEvaluatedAt]);

    const updatedAgo = useMemo(
        () => (lastEvaluatedAt ? relativeTime(lastEvaluatedAt) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lastEvaluatedAt],
    );

    const hasSignals = signals.length > 0;

    return (
        <div
            className={cn(
                "fixed top-[88px] left-4 z-30 w-[340px]",
                "rounded-xl border bg-black/92 backdrop-blur-xl",
                "transition-all duration-300",
                hasSignals
                    ? cn("border-white/15", SEVERITY_GLOW[maxSeverity])
                    : "border-white/10",
            )}
        >
            {/* ─── Header ─── */}
            <div
                className={cn(
                    "flex items-center justify-between rounded-t-xl px-4 py-3",
                    hasSignals
                        ? "border-b border-white/10"
                        : "border-b border-white/5",
                )}
            >
                <div className="flex items-center gap-2.5">
                    {hasSignals ? (
                        <div
                            className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-lg",
                                maxSeverity === "critical" &&
                                "animate-pulse bg-red-500/20",
                                maxSeverity === "high" && "bg-amber-500/20",
                                maxSeverity === "moderate" && "bg-yellow-500/20",
                                maxSeverity === "low" && "bg-emerald-500/20",
                            )}
                        >
                            <AlertTriangle
                                size={16}
                                className={cn(
                                    maxSeverity === "critical" && "text-red-400",
                                    maxSeverity === "high" && "text-amber-400",
                                    maxSeverity === "moderate" &&
                                    "text-yellow-400",
                                    maxSeverity === "low" && "text-emerald-400",
                                )}
                            />
                        </div>
                    ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                            <Zap size={16} className="text-emerald-500/60" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                            Market Signals
                        </h2>
                        <p className="text-[10px] text-zinc-500">
                            {hasSignals
                                ? "Active scenarios detected"
                                : "All scenarios nominal"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasSignals && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "h-6 px-2.5 text-xs font-bold tabular-nums",
                                SEVERITY_BADGE_STYLES[maxSeverity],
                                maxSeverity === "critical" && "animate-pulse",
                            )}
                        >
                            {signals.length}
                        </Badge>
                    )}
                    {isSampleData && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/70">
                            Sample
                        </span>
                    )}
                </div>
            </div>

            {/* ─── Signal Cards ─── */}
            {hasSignals ? (
                <ScrollArea className="max-h-[calc(100vh-220px)]">
                    <div className="space-y-3 p-3">
                        {signals.map((signal) => (
                            <SignalCard key={signal.id} signal={signal} />
                        ))}
                    </div>

                    {signals.length <= 2 && (
                        <div className="border-t border-white/5 px-4 py-2">
                            <p className="flex items-center gap-1.5 text-[11px] text-emerald-400/60">
                                <CheckCircle2 size={12} />
                                No other scenarios active
                            </p>
                        </div>
                    )}
                </ScrollArea>
            ) : (
                <div className="px-4 py-8 text-center">
                    <CheckCircle2
                        size={28}
                        className="mx-auto mb-2 text-emerald-500/30"
                    />
                    <p className="text-sm font-medium text-emerald-400/70">
                        No active signals
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                        18 scenarios being monitored
                    </p>
                </div>
            )}

            {/* ─── Footer ─── */}
            <div className="flex items-center justify-between rounded-b-xl border-t border-white/5 px-4 py-2">
                <span className="text-[10px] text-zinc-600">
                    {updatedAgo
                        ? `Updated ${updatedAgo}`
                        : "Awaiting evaluation"}
                </span>
                {isEvaluating && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-500/60">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500/60" />
                        Evaluating…
                    </span>
                )}
            </div>
        </div>
    );
}
