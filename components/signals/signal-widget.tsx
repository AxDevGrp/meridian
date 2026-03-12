"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useActiveSignals } from "@/lib/stores/signal-store";
import { SignalCard } from "./signal-card";
import { confidenceToSeverity } from "@/lib/types/signal";
import type { SignalSeverity } from "@/lib/types/signal";
import { Zap, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
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
 * Persistent signal widget — always visible on the left side below the Layer Panel.
 * Shows active market impact signals with collapsed/expanded states.
 */
export function SignalWidget() {
    const { signals, isEvaluating, lastEvaluatedAt, isSampleData } =
        useActiveSignals();

    const [expanded, setExpanded] = useState(false);
    const prevCountRef = useRef(signals.length);

    // Auto-expand when new signals appear
    useEffect(() => {
        if (signals.length > prevCountRef.current && signals.length > 0) {
            setExpanded(true);
        }
        prevCountRef.current = signals.length;
    }, [signals.length]);

    const toggleExpanded = useCallback(() => {
        setExpanded((prev) => !prev);
    }, []);

    // Highest confidence signal for collapsed preview
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
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!lastEvaluatedAt) return;
        const interval = setInterval(() => setTick((t) => t + 1), 5_000);
        return () => clearInterval(interval);
    }, [lastEvaluatedAt]);

    const updatedAgo = useMemo(
        () => (lastEvaluatedAt ? relativeTime(lastEvaluatedAt) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lastEvaluatedAt, /* tick dependency via state */],
    );

    const hasSignals = signals.length > 0;

    return (
        <div
            className={cn(
                "fixed bottom-[68px] left-4 z-30 w-72",
                "rounded-xl border border-white/10 bg-black/90 backdrop-blur-md",
                "shadow-2xl transition-all duration-200",
            )}
        >
            {/* Header — always visible */}
            <button
                type="button"
                onClick={toggleExpanded}
                className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5",
                    "rounded-t-xl transition-colors hover:bg-white/5",
                    !expanded && "rounded-b-xl",
                )}
            >
                <div className="flex items-center gap-2">
                    <Zap
                        size={14}
                        className={cn(
                            hasSignals ? "text-amber-400" : "text-zinc-600",
                        )}
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        Market Signals
                    </span>
                    {hasSignals && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "h-4 px-1.5 text-[9px] font-bold tabular-nums",
                                SEVERITY_BADGE_STYLES[maxSeverity],
                                maxSeverity === "critical" && "animate-pulse",
                            )}
                        >
                            {signals.length}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {hasSignals && (
                        <span
                            className={cn(
                                "h-2 w-2 rounded-full",
                                maxSeverity === "critical" && "bg-red-500 animate-pulse",
                                maxSeverity === "high" && "bg-amber-500",
                                maxSeverity === "moderate" && "bg-yellow-500",
                                maxSeverity === "low" && "bg-emerald-500",
                            )}
                        />
                    )}
                    {expanded ? (
                        <ChevronUp size={14} className="text-zinc-500" />
                    ) : (
                        <ChevronDown size={14} className="text-zinc-500" />
                    )}
                </div>
            </button>

            {/* Collapsed preview — highest signal */}
            {!expanded && hasSignals && highestSignal && (
                <div className="border-t border-white/5 px-3 py-2">
                    <p className="truncate text-[11px] text-zinc-400">
                        <span className="font-medium text-zinc-300">
                            {highestSignal.playbookName}
                        </span>
                        <span className="ml-1.5 tabular-nums text-zinc-500">
                            — {Math.round(highestSignal.confidence * 100)}%
                        </span>
                    </p>
                </div>
            )}

            {/* Collapsed — no signals */}
            {!expanded && !hasSignals && (
                <div className="border-t border-white/5 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                        <CheckCircle2 size={12} />
                        No active signals
                    </p>
                </div>
            )}

            {/* Expanded state */}
            {expanded && (
                <div className="border-t border-white/5">
                    {hasSignals ? (
                        <>
                            <ScrollArea className="max-h-[320px]">
                                <div className="space-y-2 p-2">
                                    {signals.map((signal) => (
                                        <SignalCard
                                            key={signal.id}
                                            signal={signal}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                            {signals.length <= 2 && (
                                <div className="border-t border-white/5 px-3 py-1.5">
                                    <p className="flex items-center gap-1.5 text-[10px] text-emerald-400/60">
                                        <CheckCircle2 size={10} />
                                        No other scenarios active
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="px-3 py-4 text-center">
                            <CheckCircle2
                                size={20}
                                className="mx-auto mb-1.5 text-emerald-500/40"
                            />
                            <p className="text-[11px] text-emerald-400/80">
                                No active signals
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-600">
                                All scenarios nominal
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-white/5 px-3 py-1.5">
                        <span className="text-[10px] text-zinc-600">
                            {updatedAgo
                                ? `Updated ${updatedAgo}`
                                : "Awaiting evaluation"}
                        </span>
                        {isSampleData && (
                            <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-700">
                                Sample
                            </span>
                        )}
                        {isEvaluating && (
                            <span className="text-[9px] text-amber-500/60">
                                Evaluating…
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
