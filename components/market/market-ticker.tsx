"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    AlertCircle,
    FlaskConical,
    ArrowUpDown,
    SortAsc,
    Star,
} from "lucide-react";
import { InstrumentCard } from "./instrument-card";
import { PriceSparkline } from "./price-sparkline";
import { SectorFilterTabs } from "./sector-filter-tabs";
import {
    useMarketInstruments,
    useWatchlistInstruments,
    useMarketStore,
} from "@/lib/stores/market-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MarketSector, PricePoint } from "@/lib/types/market";

type SortMode = "change" | "alpha";
type SectorFilter = MarketSector | "all";

/**
 * Right-side collapsible market ticker panel.
 * Shows watchlist instruments + filterable instrument list with sparklines.
 */
export function MarketTicker() {
    const [expanded, setExpanded] = useState(false);
    const [activeSector, setActiveSector] = useState<SectorFilter>("all");
    const [sortMode, setSortMode] = useState<SortMode>("change");

    const { instruments, isLoading, error, lastUpdated, isSampleData } =
        useMarketInstruments();
    const { instruments: watchlistInstruments } = useWatchlistInstruments();

    const addToWatchlist = useMarketStore((s) => s.addToWatchlist);
    const removeFromWatchlist = useMarketStore((s) => s.removeFromWatchlist);
    const isInWatchlist = useMarketStore((s) => s.isInWatchlist);
    const priceHistory = useMarketStore((s) => s.priceHistory);
    const fetchPriceHistory = useMarketStore((s) => s.fetchPriceHistory);

    // Fetch sparkline data for watchlisted instruments
    useEffect(() => {
        for (const inst of watchlistInstruments) {
            if (!priceHistory[inst.symbol]) {
                fetchPriceHistory(inst.symbol, "1d", 30);
            }
        }
    }, [watchlistInstruments, priceHistory, fetchPriceHistory]);

    // Sector counts
    const sectorCounts = useMemo(() => {
        const counts: Record<string, number> = { all: instruments.length };
        for (const inst of instruments) {
            const sector = inst.sector ?? "other";
            counts[sector] = (counts[sector] ?? 0) + 1;
        }
        return counts;
    }, [instruments]);

    // Filtered + sorted instruments
    const filteredInstruments = useMemo(() => {
        let list =
            activeSector === "all"
                ? instruments
                : instruments.filter((i) => i.sector === activeSector);

        if (sortMode === "change") {
            list = [...list].sort(
                (a, b) =>
                    Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
            );
        } else {
            list = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
        }

        return list;
    }, [instruments, activeSector, sortMode]);

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

    const lastUpdatedLabel = useMemo(() => {
        if (!lastUpdated) return null;
        const diff = Date.now() - lastUpdated.getTime();
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return "just now";
        const min = Math.floor(sec / 60);
        return `${min}m ago`;
    }, [lastUpdated]);

    const toggleSort = useCallback(() => {
        setSortMode((prev) => (prev === "change" ? "alpha" : "change"));
    }, []);

    return (
        <>
            {/* Toggle button — fixed right edge */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={`
                    fixed top-1/2 -translate-y-1/2 z-30
                    transition-all duration-300 ease-out
                    ${expanded ? "right-[320px]" : "right-0"}
                    w-8 h-16 rounded-l-lg
                    bg-black/80 backdrop-blur-xl border border-r-0 border-white/10
                    hover:bg-white/[0.06]
                    flex items-center justify-center
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                    hidden md:flex
                `}
                aria-label={expanded ? "Close market panel" : "Open market panel"}
            >
                {expanded ? (
                    <ChevronRight className="w-4 h-4 text-white/50" />
                ) : (
                    <ChevronLeft className="w-4 h-4 text-white/50" />
                )}
            </button>

            {/* Panel — slides in from right */}
            <aside
                className={`
                    fixed top-0 right-0 bottom-0 z-20
                    w-[320px]
                    bg-black/80 backdrop-blur-xl
                    border-l border-white/10
                    shadow-2xl shadow-black/50
                    transform transition-transform duration-300 ease-out
                    flex flex-col
                    ${expanded ? "translate-x-0" : "translate-x-full"}
                    hidden md:flex
                `}
                aria-label="Market ticker panel"
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-white/80">Markets</span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50">
                            {instruments.length}
                        </span>

                        {isSampleData && (
                            <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-400/70 gap-1"
                            >
                                <FlaskConical className="w-2.5 h-2.5" />
                                Sample
                            </Badge>
                        )}

                        {lastUpdatedLabel && (
                            <span className="text-[10px] text-white/25 ml-auto">
                                {lastUpdatedLabel}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-3">
                        {/* Loading state */}
                        {isLoading && instruments.length === 0 && (
                            <div className="space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="bg-white/[0.03] rounded-lg p-3 space-y-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-12" />
                                            <Skeleton className="h-3 w-20" />
                                            <Skeleton className="h-3 w-14 ml-auto" />
                                        </div>
                                        <Skeleton className="h-6 w-full rounded" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error state */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}

                        {/* Watchlist section */}
                        {watchlistInstruments.length > 0 && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-2 px-1">
                                    <Star className="w-3 h-3 text-yellow-500" fill="#eab308" />
                                    <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                                        Watchlist
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {watchlistInstruments.map((inst) => (
                                        <div key={inst.symbol} className="flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <InstrumentCard
                                                    instrument={inst}
                                                    compact
                                                />
                                            </div>
                                            <div className="w-16 shrink-0">
                                                <PriceSparkline
                                                    prices={priceHistory[inst.symbol] ?? []}
                                                    height={24}
                                                    showArea={false}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-3 bg-white/[0.06]" />
                            </div>
                        )}

                        {/* Sector filter tabs */}
                        <div className="border-b border-white/[0.06] pb-2">
                            <SectorFilterTabs
                                activeSector={activeSector}
                                onSectorChange={setActiveSector}
                                counts={sectorCounts}
                            />
                        </div>

                        {/* Sort toggle */}
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] text-white/30">
                                {filteredInstruments.length} instrument{filteredInstruments.length !== 1 ? "s" : ""}
                            </span>
                            <button
                                type="button"
                                onClick={toggleSort}
                                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors"
                                aria-label={`Sort by ${sortMode === "change" ? "alphabetical" : "change percent"}`}
                            >
                                {sortMode === "change" ? (
                                    <ArrowUpDown className="w-3 h-3" />
                                ) : (
                                    <SortAsc className="w-3 h-3" />
                                )}
                                {sortMode === "change" ? "Top Movers" : "A–Z"}
                            </button>
                        </div>

                        {/* Instrument list */}
                        {!isLoading && !error && filteredInstruments.length === 0 && (
                            <div className="text-center py-6">
                                <TrendingUp className="w-6 h-6 text-white/15 mx-auto mb-2" />
                                <p className="text-xs text-white/30">
                                    {activeSector === "all"
                                        ? "No instruments available"
                                        : "No instruments in this sector"}
                                </p>
                            </div>
                        )}

                        <div className="space-y-1">
                            {filteredInstruments.map((inst) => (
                                <div key={inst.symbol} className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <InstrumentCard
                                            instrument={inst}
                                            compact
                                            showWatchlistToggle
                                            isWatchlisted={isInWatchlist(inst.symbol)}
                                            onToggleWatchlist={handleToggleWatchlist}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ScrollArea>
            </aside>
        </>
    );
}
