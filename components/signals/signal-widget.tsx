"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useActiveSignals, useSignalStore } from "@/lib/stores/signal-store";
import { confidenceToSeverity } from "@/lib/types/signal";
import type { SignalSeverity, MarketSignal, MarketTarget } from "@/lib/types/signal";
import {
    Zap,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

/** Aggregated instrument row for the table */
interface InstrumentRow {
    symbol: string;
    name: string;
    direction: "up" | "down";
    magnitude: "small" | "moderate" | "large";
    confidence: number;
    severity: SignalSeverity;
    scenarioName: string;
    signalId: string;
    reasoning: string;
}

// ============================================
// Constants
// ============================================

const SEVERITY_GLOW: Record<SignalSeverity, string> = {
    critical: "shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    high: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
    moderate: "shadow-[0_0_15px_rgba(234,179,8,0.08)]",
    low: "",
};

const SEVERITY_BADGE_STYLES: Record<SignalSeverity, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

/**
 * Dot color by direction + magnitude.
 * Green = bullish (up), Red = bearish (down).
 * Brightness modulated by magnitude.
 */
function getDotColor(direction: "up" | "down", magnitude: string): string {
    if (direction === "up") {
        switch (magnitude) {
            case "large":
                return "bg-emerald-400";
            case "moderate":
                return "bg-emerald-500";
            default:
                return "bg-emerald-600";
        }
    }
    switch (magnitude) {
        case "large":
            return "bg-red-400";
        case "moderate":
            return "bg-red-500";
        default:
            return "bg-red-600";
    }
}

function getDotGlow(direction: "up" | "down", magnitude: string): string {
    if (magnitude !== "large") return "";
    return direction === "up"
        ? "shadow-[0_0_6px_rgba(52,211,153,0.5)]"
        : "shadow-[0_0_6px_rgba(248,113,113,0.5)]";
}

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
// Aggregation Logic
// ============================================

/**
 * Aggregate market targets from all active signals.
 * If the same instrument appears in multiple signals,
 * keep the one with highest confidence.
 */
function aggregateInstruments(signals: MarketSignal[]): InstrumentRow[] {
    const map = new Map<string, InstrumentRow>();

    for (const signal of signals) {
        const severity = confidenceToSeverity(signal.confidence);
        for (const target of signal.marketTargets) {
            const existing = map.get(target.symbol);
            if (!existing || signal.confidence > existing.confidence) {
                map.set(target.symbol, {
                    symbol: target.symbol,
                    name: target.name,
                    direction: target.expectedDirection,
                    magnitude: target.magnitude,
                    confidence: signal.confidence,
                    severity,
                    scenarioName: signal.playbookName,
                    signalId: signal.id,
                    reasoning: target.reasoning,
                });
            }
        }
    }

    // Sort: large magnitude first, then by confidence descending
    const MAGNITUDE_ORDER: Record<string, number> = {
        large: 0,
        moderate: 1,
        small: 2,
    };
    return Array.from(map.values()).sort(
        (a, b) =>
            (MAGNITUDE_ORDER[a.magnitude] ?? 2) -
            (MAGNITUDE_ORDER[b.magnitude] ?? 2) ||
            b.confidence - a.confidence,
    );
}

// ============================================
// Component
// ============================================

/**
 * Market Signals Dashboard — always visible, always expanded, upper-left.
 * Table format: each row is an instrument with a green/red status dot.
 */
export function SignalWidget() {
    const { signals, isEvaluating, lastEvaluatedAt, isSampleData } =
        useActiveSignals();
    const setSignalPanelOpen = useSignalStore((s) => s.setSignalPanelOpen);
    const setSelectedSignalId = useSignalStore((s) => s.setSelectedSignalId);

    const [, setTick] = useState(0);

    // Aggregate instruments from all signals
    const instruments = useMemo(
        () => aggregateInstruments(signals),
        [signals],
    );

    // Highest confidence signal for severity glow
    const maxSeverity = useMemo<SignalSeverity>(() => {
        if (signals.length === 0) return "low";
        return confidenceToSeverity(signals[0].confidence);
    }, [signals]);

    // Tick for relative time
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

    const handleRowClick = useCallback(
        (signalId: string) => {
            setSelectedSignalId(signalId);
            setSignalPanelOpen(true);
        },
        [setSelectedSignalId, setSignalPanelOpen],
    );

    const hasSignals = signals.length > 0;

    return (
        <div
            className={cn(
                "fixed top-[88px] left-4 z-30 w-[370px]",
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
                                ? `${instruments.length} instruments affected`
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
                        <span className="inline-flex items-center rounded-full border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/70">
                            Sample
                        </span>
                    )}
                </div>
            </div>

            {/* ─── Instrument Table ─── */}
            {hasSignals ? (
                <ScrollArea className="max-h-[calc(100vh-220px)]">
                    {/* Column headers */}
                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 border-b border-white/5 px-4 py-2">
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                            Status
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                            Instrument
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                            Impact
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                            Scenario
                        </span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-white/5">
                        {instruments.map((row) => (
                            <button
                                key={row.symbol}
                                type="button"
                                onClick={() => handleRowClick(row.signalId)}
                                className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                                {/* Status dot */}
                                <div className="flex items-center justify-center">
                                    <span
                                        className={cn(
                                            "inline-block h-2.5 w-2.5 rounded-full",
                                            getDotColor(
                                                row.direction,
                                                row.magnitude,
                                            ),
                                            getDotGlow(
                                                row.direction,
                                                row.magnitude,
                                            ),
                                            row.magnitude === "large" &&
                                            "animate-pulse",
                                        )}
                                    />
                                </div>

                                {/* Instrument symbol + name */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold tabular-nums text-zinc-100">
                                            {row.symbol}
                                        </span>
                                        {row.direction === "up" ? (
                                            <TrendingUp
                                                size={13}
                                                className="shrink-0 text-emerald-400"
                                            />
                                        ) : (
                                            <TrendingDown
                                                size={13}
                                                className="shrink-0 text-red-400"
                                            />
                                        )}
                                    </div>
                                    <p className="truncate text-[11px] text-zinc-500">
                                        {row.name}
                                    </p>
                                </div>

                                {/* Magnitude badge */}
                                <span
                                    className={cn(
                                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                        row.magnitude === "large" &&
                                        "bg-red-500/15 text-red-400",
                                        row.magnitude === "moderate" &&
                                        "bg-amber-500/15 text-amber-400",
                                        row.magnitude === "small" &&
                                        "bg-zinc-500/15 text-zinc-500",
                                    )}
                                >
                                    {row.magnitude}
                                </span>

                                {/* Scenario link */}
                                <div className="flex items-center gap-0.5 text-zinc-600">
                                    <ChevronRight size={12} />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Scenario summary beneath table */}
                    <div className="border-t border-white/5 px-4 py-2.5">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
                            Active Scenarios
                        </p>
                        <div className="space-y-1">
                            {signals.map((signal) => {
                                const sev = confidenceToSeverity(
                                    signal.confidence,
                                );
                                return (
                                    <button
                                        key={signal.id}
                                        type="button"
                                        onClick={() =>
                                            handleRowClick(signal.id)
                                        }
                                        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-white/[0.04]"
                                    >
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "h-5 px-1.5 text-[10px] font-bold tabular-nums",
                                                SEVERITY_BADGE_STYLES[sev],
                                            )}
                                        >
                                            {Math.round(
                                                signal.confidence * 100,
                                            )}
                                            %
                                        </Badge>
                                        <span className="truncate text-xs text-zinc-400">
                                            {signal.playbookName}
                                        </span>
                                        <ChevronRight
                                            size={11}
                                            className="ml-auto shrink-0 text-zinc-700"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
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
                        18 scenarios monitored
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
