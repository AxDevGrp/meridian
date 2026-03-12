/**
 * Market data types for the financial intelligence layer.
 * Instruments, prices, correlation mappings, and watchlists.
 */

// ============================================
// Enum / Union Types
// ============================================

export type AssetClass =
    | "equity"
    | "commodity"
    | "currency"
    | "crypto"
    | "index"
    | "etf"
    | "bond"
    | "future";

export type MarketSector =
    | "energy"
    | "shipping"
    | "defense"
    | "agriculture"
    | "technology"
    | "finance"
    | "materials"
    | "industrials"
    | "utilities"
    | "other";

export type PriceDirection = "up" | "down" | "flat";

export type CorrelationDirection = "positive" | "negative" | "mixed";

export type PriceInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w" | "1mo";

// ============================================
// Core Interfaces
// ============================================

/** A tracked financial instrument (stock, ETF, future, index). */
export interface MarketInstrument {
    /** Ticker symbol (e.g. "CL=F", "TSM", "^VIX") */
    symbol: string;
    /** Human-readable name */
    name: string;
    /** Classification */
    assetClass: AssetClass;
    /** Market sector */
    sector: MarketSector | null;
    /** Exchange code (NYSE, NASDAQ, NYMEX, etc.) */
    exchange: string | null;
    /** Currency code (default "USD") */
    currency: string;
    /** Optional description */
    description: string | null;
    /** Latest price */
    currentPrice: number | null;
    /** Previous session close */
    previousClose: number | null;
    /** Percentage change from previous close */
    changePercent: number | null;
    /** Absolute change from previous close */
    changeAbsolute: number | null;
    /** Price direction since previous close */
    direction: PriceDirection;
    /** Latest volume */
    volume: number | null;
    /** ISO 8601 timestamp of last price update */
    lastUpdated: string | null;
}

/** A single OHLCV price data point. */
export interface PricePoint {
    symbol: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number;
    volume: number | null;
    /** ISO 8601 timestamp */
    timestamp: string;
}

/** Maps an instrument to a geographic region for event correlation. */
export interface InstrumentCorrelation {
    symbol: string;
    instrumentName: string;
    regionName: string;
    regionCenter: { lat: number; lng: number } | null;
    regionRadiusKm: number | null;
    /** Sensitivity factor 0.0–1.0 */
    sensitivity: number;
    /** Whether the instrument moves with or against events */
    direction: CorrelationDirection;
    /** Which event layer types trigger this correlation */
    eventTypes: string[];
    /** Human-readable explanation of the correlation */
    rationale: string | null;
}

/** Computed score when a geospatial event matches a correlated instrument. */
export interface CorrelationScore {
    instrument: MarketInstrument;
    correlation: InstrumentCorrelation;
    /** Composite score: severity × sensitivity × proximity */
    score: number;
    /** Severity of the triggering event */
    eventSeverity: string;
    /** 0.0–1.0 proximity factor based on event distance to region center */
    proximityFactor: number;
}

/** A single item in a user's watchlist. */
export interface WatchlistItem {
    symbol: string;
    /** ISO 8601 timestamp when added */
    addedAt: string;
}

/** A named watchlist of tracked instruments. */
export interface Watchlist {
    id: string;
    name: string;
    items: WatchlistItem[];
    /** ISO 8601 */
    createdAt: string;
    /** ISO 8601 */
    updatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get color for an asset class (for badges, charts, etc.)
 */
export function getAssetClassColor(assetClass: AssetClass): string {
    switch (assetClass) {
        case "equity": return "#3b82f6"; // blue
        case "commodity": return "#f59e0b"; // amber
        case "currency": return "#10b981"; // emerald
        case "crypto": return "#8b5cf6"; // violet
        case "index": return "#6366f1"; // indigo
        case "etf": return "#06b6d4"; // cyan
        case "bond": return "#64748b"; // slate
        case "future": return "#f97316"; // orange
    }
}

/**
 * Get color for a market sector
 */
export function getSectorColor(sector: MarketSector | null): string {
    switch (sector) {
        case "energy": return "#ef4444"; // red
        case "shipping": return "#0ea5e9"; // sky
        case "defense": return "#6b7280"; // gray
        case "agriculture": return "#22c55e"; // green
        case "technology": return "#a855f7"; // purple
        case "finance": return "#eab308"; // yellow
        case "materials": return "#d97706"; // amber-dark
        case "industrials": return "#78716c"; // stone
        case "utilities": return "#14b8a6"; // teal
        case "other": return "#94a3b8"; // slate-light
        default: return "#94a3b8";
    }
}

/**
 * Get color for a price direction
 */
export function getDirectionColor(direction: PriceDirection): string {
    switch (direction) {
        case "up": return "#22c55e"; // green
        case "down": return "#ef4444"; // red
        case "flat": return "#6b7280"; // gray
    }
}

/**
 * Format a price with currency symbol and 2 decimal places
 */
export function formatPrice(price: number | null, currency: string = "USD"): string {
    if (price === null || price === undefined) return "—";

    const symbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        JPY: "¥",
    };
    const sym = symbols[currency] ?? currency + " ";

    return `${sym}${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a percentage change with sign ("+2.34%" / "-1.56%")
 */
export function formatChangePercent(pct: number | null): string {
    if (pct === null || pct === undefined) return "—";
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Format a volume number for display ("1.2M", "453K", "12.3B")
 */
export function formatVolume(vol: number | null): string {
    if (vol === null || vol === undefined) return "—";
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
    return String(vol);
}

/**
 * Get a Lucide icon name for an asset class
 */
export function getAssetClassIcon(assetClass: AssetClass): string {
    switch (assetClass) {
        case "equity": return "Building2";
        case "commodity": return "Flame";
        case "currency": return "DollarSign";
        case "crypto": return "Bitcoin";
        case "index": return "BarChart3";
        case "etf": return "PieChart";
        case "bond": return "FileText";
        case "future": return "TrendingUp";
    }
}
