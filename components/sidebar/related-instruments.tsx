"use client";

import { useMemo, useCallback, useEffect } from "react";
import { TrendingUp, Star, AlertTriangle } from "lucide-react";
import { InstrumentCard } from "@/components/market/instrument-card";
import { PriceSparkline } from "@/components/market/price-sparkline";
import { useMarketStore, useCorrelations } from "@/lib/stores/market-store";
import { computeCorrelationScore, rankCorrelations } from "@/lib/correlation-engine";
import type { CorrelationInput, CorrelationResult } from "@/lib/correlation-engine";
import type { InstrumentCorrelation, MarketInstrument } from "@/lib/types/market";
import { getDirectionColor, formatChangePercent } from "@/lib/types/market";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface RelatedInstrumentsProps {
    entityType: string;
    entitySeverity?: string;
    entityLocation?: { lat: number; lng: number } | null;
    regionName?: string;
}

/**
 * Sidebar section showing financial instruments correlated with the
 * currently selected geospatial entity. The KEY differentiator —
 * clicking a conflict event in the Strait of Hormuz shows oil futures
 * and tanker stocks.
 */
export function RelatedInstruments({
    entityType,
    entitySeverity = "medium",
    entityLocation,
    regionName,
}: RelatedInstrumentsProps) {
    const { correlations, isLoading: isLoadingCorrelations } = useCorrelations();
    const instruments = useMarketStore((s) => s.instruments);
    const addToWatchlist = useMarketStore((s) => s.addToWatchlist);
    const removeFromWatchlist = useMarketStore((s) => s.removeFromWatchlist);
    const isInWatchlist = useMarketStore((s) => s.isInWatchlist);
    const priceHistory = useMarketStore((s) => s.priceHistory);
    const fetchPriceHistory = useMarketStore((s) => s.fetchPriceHistory);
    const getCorrelationsForRegion = useMarketStore((s) => s.getCorrelationsForRegion);
    const getCorrelationsNearPoint = useMarketStore((s) => s.getCorrelationsNearPoint);

    // Find matching correlations using region name or proximity
    const matchingCorrelations = useMemo(() => {
        let matches: InstrumentCorrelation[] = [];

        if (regionName) {
            matches = getCorrelationsForRegion(regionName);
        }

        // If no region matches, try proximity-based
        if (matches.length === 0 && entityLocation) {
            matches = getCorrelationsNearPoint(entityLocation.lat, entityLocation.lng);
        }

        // De-duplicate by symbol
        const seen = new Set<string>();
        return matches.filter((c) => {
            if (seen.has(c.symbol)) return false;
            seen.add(c.symbol);
            return true;
        });
    }, [regionName, entityLocation, getCorrelationsForRegion, getCorrelationsNearPoint]);

    // Compute and rank correlation scores
    const rankedResults = useMemo(() => {
        if (matchingCorrelations.length === 0 || !entityLocation) return [];

        const inputs: CorrelationInput[] = matchingCorrelations.map((corr) => ({
            eventType: entityType,
            eventSeverity: entitySeverity,
            eventLocation: entityLocation,
            correlation: corr,
        }));

        return rankCorrelations(inputs);
    }, [matchingCorrelations, entityType, entitySeverity, entityLocation]);

    // Build a map of symbol → instrument for quick lookup
    const instrumentMap = useMemo(() => {
        const map = new Map<string, MarketInstrument>();
        for (const inst of instruments) {
            map.set(inst.symbol, inst);
        }
        return map;
    }, [instruments]);

    // Build correlation map for rationale/direction display
    const correlationMap = useMemo(() => {
        const map = new Map<string, InstrumentCorrelation>();
        for (const c of matchingCorrelations) {
            map.set(c.symbol, c);
        }
        return map;
    }, [matchingCorrelations]);

    // Fetch sparkline data for matched instruments
    useEffect(() => {
        for (const result of rankedResults) {
            if (!priceHistory[result.symbol]) {
                fetchPriceHistory(result.symbol, "1d", 30);
            }
        }
    }, [rankedResults, priceHistory, fetchPriceHistory]);

    const handleToggleWatchlist = useCallback(
        (symbol: string) => {
            if (isInWatchlist(symbol)) {
                removeFromWatchlist(symbol);
            } else {
                addToWatchlist(symbol);
            }
        },
        [isInWatchlist, addToWatchlist, removeFromWatchlist],
    );

    // Don't render if we have no location to correlate against
    if (!entityLocation && !regionName) return null;

    // Loading state
    if (isLoadingCorrelations && correlations.length === 0) {
        return (
            <div className="px-4 py-3">
                <Separator className="mb-3 bg-white/[0.06]" />
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-white/60">Market Impact</span>
                </div>
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-6 w-full rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Empty state
    if (rankedResults.length === 0) {
        return (
            <div className="px-4 py-3">
                <Separator className="mb-3 bg-white/[0.06]" />
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-white/30" />
                    <span className="text-xs font-medium text-white/40">Market Impact</span>
                </div>
                <p className="text-[11px] text-white/25 text-center py-4">
                    No market correlations found for this location
                </p>
            </div>
        );
    }

    return (
        <div className="px-4 py-3">
            <Separator className="mb-3 bg-white/[0.06]" />

            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-white/60">Market Impact</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-400/80">
                    {rankedResults.length}
                </span>
            </div>

            {/* Correlated instruments */}
            <div className="space-y-2">
                {rankedResults.map((result) => {
                    const instrument = instrumentMap.get(result.symbol);
                    const correlation = correlationMap.get(result.symbol);

                    if (!instrument) return null;

                    const directionLabel =
                        correlation?.direction === "positive"
                            ? "Tends to rise"
                            : correlation?.direction === "negative"
                                ? "Tends to fall"
                                : "Mixed signal";

                    const directionIcon =
                        correlation?.direction === "positive"
                            ? "📈"
                            : correlation?.direction === "negative"
                                ? "📉"
                                : "↔️";

                    return (
                        <div
                            key={result.symbol}
                            className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2"
                        >
                            {/* Instrument info */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleWatchlist(result.symbol)}
                                        className="shrink-0 p-0.5 hover:scale-110 transition-transform"
                                        aria-label={
                                            isInWatchlist(result.symbol)
                                                ? "Remove from watchlist"
                                                : "Add to watchlist"
                                        }
                                    >
                                        <Star
                                            className="w-3.5 h-3.5"
                                            fill={isInWatchlist(result.symbol) ? "#eab308" : "none"}
                                            stroke={isInWatchlist(result.symbol) ? "#eab308" : "#6b7280"}
                                            strokeWidth={2}
                                        />
                                    </button>
                                    <span className="text-xs font-bold text-white/90 font-mono">
                                        {instrument.symbol}
                                    </span>
                                    <span className="text-[11px] text-white/40 truncate">
                                        {instrument.name}
                                    </span>
                                </div>

                                {/* Score badge */}
                                <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400/80 shrink-0"
                                >
                                    {Math.round(result.score * 100)}% match
                                </Badge>
                            </div>

                            {/* Price + sparkline row */}
                            <div className="flex items-center gap-3">
                                <div className="shrink-0">
                                    <span className="text-sm font-semibold font-mono text-white/80">
                                        {instrument.currentPrice !== null
                                            ? `$${instrument.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : "—"}
                                    </span>
                                    <span
                                        className="ml-1.5 text-[11px] font-mono font-semibold"
                                        style={{ color: getDirectionColor(instrument.direction) }}
                                    >
                                        {formatChangePercent(instrument.changePercent)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <PriceSparkline
                                        prices={priceHistory[result.symbol] ?? []}
                                        height={24}
                                        showArea={false}
                                    />
                                </div>
                            </div>

                            {/* Correlation direction + rationale */}
                            <div className="flex items-start gap-1.5">
                                <span className="text-[11px] shrink-0">{directionIcon}</span>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-medium text-white/50">
                                        {directionLabel}
                                    </span>
                                    {correlation?.rationale && (
                                        <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
                                            {correlation.rationale}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Sensitivity + proximity factors */}
                            <div className="flex items-center gap-3 text-[9px] text-white/25">
                                <span>
                                    Sensitivity: {Math.round(result.sensitivityFactor * 100)}%
                                </span>
                                <span>
                                    Proximity: {Math.round(result.proximityFactor * 100)}%
                                </span>
                                {result.eventTypeMatch && (
                                    <span className="text-amber-400/50 flex items-center gap-0.5">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Direct trigger
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
