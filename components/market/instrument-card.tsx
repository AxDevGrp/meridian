"use client";

import { useCallback } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MarketInstrument } from "@/lib/types/market";
import {
    getDirectionColor,
    getAssetClassColor,
    formatPrice,
    formatChangePercent,
    formatVolume,
} from "@/lib/types/market";

interface InstrumentCardProps {
    instrument: MarketInstrument;
    compact?: boolean;
    showWatchlistToggle?: boolean;
    onToggleWatchlist?: (symbol: string) => void;
    isWatchlisted?: boolean;
    onClick?: () => void;
}

/**
 * Compact card showing a single instrument's price data.
 * Two modes: compact (ticker row) and full (sidebar detail).
 */
export function InstrumentCard({
    instrument,
    compact = false,
    showWatchlistToggle = false,
    onToggleWatchlist,
    isWatchlisted = false,
    onClick,
}: InstrumentCardProps) {
    const dirColor = getDirectionColor(instrument.direction);
    const assetColor = getAssetClassColor(instrument.assetClass);

    const directionArrow =
        instrument.direction === "up"
            ? "▲"
            : instrument.direction === "down"
                ? "▼"
                : "•";

    const handleWatchlistClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onToggleWatchlist?.(instrument.symbol);
        },
        [onToggleWatchlist, instrument.symbol],
    );

    // ─── Compact layout (ticker row) ───────────────────────
    if (compact) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="
                    w-full flex items-center justify-between gap-2
                    px-3 py-2 rounded-lg
                    bg-white/[0.03] hover:bg-white/[0.06]
                    transition-colors duration-150
                    text-left group
                    focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                "
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-white/90 font-mono shrink-0">
                        {instrument.symbol}
                    </span>
                    <span className="text-[11px] text-white/40 truncate">
                        {instrument.name}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-white/70">
                        {formatPrice(instrument.currentPrice, instrument.currency)}
                    </span>
                    <span
                        className="text-[11px] font-semibold font-mono"
                        style={{ color: dirColor }}
                    >
                        {directionArrow} {formatChangePercent(instrument.changePercent)}
                    </span>
                </div>
            </button>
        );
    }

    // ─── Full layout (sidebar / detail) ────────────────────
    return (
        <div
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
            className={`
                w-full rounded-lg px-3.5 py-3
                bg-white/[0.03] border border-white/[0.06]
                ${onClick ? "hover:bg-white/[0.06] cursor-pointer" : ""}
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
            `}
        >
            {/* Row 1: Symbol + Name + Watchlist toggle */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    {showWatchlistToggle && (
                        <button
                            type="button"
                            onClick={handleWatchlistClick}
                            className="shrink-0 p-0.5 hover:scale-110 transition-transform"
                            aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        >
                            <Star
                                className="w-3.5 h-3.5"
                                fill={isWatchlisted ? "#eab308" : "none"}
                                stroke={isWatchlisted ? "#eab308" : "#6b7280"}
                                strokeWidth={2}
                            />
                        </button>
                    )}
                    <span className="text-xs font-bold text-white/90 font-mono shrink-0">
                        {instrument.symbol}
                    </span>
                    <span className="text-[11px] text-white/40">—</span>
                    <span className="text-[11px] text-white/50 truncate">
                        {instrument.name}
                    </span>
                </div>
            </div>

            {/* Row 2: Price + Change */}
            <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-semibold font-mono text-white/90">
                    {formatPrice(instrument.currentPrice, instrument.currency)}
                </span>
                <span
                    className="text-xs font-semibold font-mono"
                    style={{ color: dirColor }}
                >
                    {directionArrow}{" "}
                    {instrument.changeAbsolute !== null
                        ? `${instrument.changeAbsolute >= 0 ? "+" : ""}$${Math.abs(instrument.changeAbsolute).toFixed(2)}`
                        : ""}{" "}
                    ({formatChangePercent(instrument.changePercent)})
                </span>
            </div>

            {/* Row 3: Sector + Asset Class + Volume */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {instrument.sector && (
                    <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 border-white/10"
                        style={{ color: assetColor, borderColor: `${assetColor}30` }}
                    >
                        {instrument.sector.charAt(0).toUpperCase() + instrument.sector.slice(1)}
                    </Badge>
                )}
                <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-white/10 text-white/40"
                >
                    {instrument.assetClass.charAt(0).toUpperCase() + instrument.assetClass.slice(1)}
                </Badge>
                {instrument.volume !== null && (
                    <span className="text-[10px] text-white/30 ml-auto">
                        Vol {formatVolume(instrument.volume)}
                    </span>
                )}
            </div>
        </div>
    );
}
