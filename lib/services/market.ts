import type {
    MarketInstrument,
    MarketSector,
    AssetClass,
    PricePoint,
    PriceInterval,
    InstrumentCorrelation,
    Watchlist,
} from "@/lib/types/market";

/**
 * Market data service — fetch wrappers for all market API routes.
 */

// === Polling intervals ===

export const MARKET_POLLING = {
    /** Price & instrument updates — 1 minute */
    PRICES: 60_000,
    /** Instrument list updates — 1 minute */
    INSTRUMENTS: 60_000,
    /** Correlation mappings — 5 minutes (rarely changes) */
    CORRELATIONS: 300_000,
} as const;

// === API base paths ===

const API_INSTRUMENTS = "/api/market/instruments";
const API_PRICES = "/api/market/prices";
const API_CORRELATIONS = "/api/market/correlations";
const API_WATCHLIST = "/api/market/watchlist";

// === Response types ===

interface InstrumentsResponse {
    instruments: MarketInstrument[];
    isSampleData: boolean;
    metadata: { timestamp: string; count: number };
}

interface PricesResponse {
    symbol: string;
    prices: PricePoint[];
    isSampleData: boolean;
    metadata: { timestamp: string; interval: string; count: number };
}

interface CorrelationsResponse {
    correlations: InstrumentCorrelation[];
    isSampleData: boolean;
    metadata: { timestamp: string; count: number };
}

interface WatchlistResponse {
    watchlist: Watchlist;
    isSampleData: boolean;
}

// === Fetch functions ===

/**
 * Fetch all tracked instruments with current prices.
 * Supports optional filtering by sector, asset class, or specific symbols.
 */
export async function fetchInstruments(params?: {
    sector?: MarketSector;
    assetClass?: AssetClass;
    symbols?: string[];
}): Promise<{ instruments: MarketInstrument[]; isSampleData: boolean }> {
    const searchParams = new URLSearchParams();

    if (params?.sector) searchParams.set("sector", params.sector);
    if (params?.assetClass) searchParams.set("assetClass", params.assetClass);
    if (params?.symbols?.length) searchParams.set("symbols", params.symbols.join(","));

    const url = searchParams.toString()
        ? `${API_INSTRUMENTS}?${searchParams}`
        : API_INSTRUMENTS;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch instruments: ${response.status}`);
    }

    const data: InstrumentsResponse = await response.json();
    return {
        instruments: data.instruments,
        isSampleData: data.isSampleData,
    };
}

/**
 * Fetch OHLCV price history for a specific symbol.
 */
export async function fetchPriceHistory(params: {
    symbol: string;
    interval?: PriceInterval;
    limit?: number;
}): Promise<{ symbol: string; prices: PricePoint[]; isSampleData: boolean }> {
    const searchParams = new URLSearchParams({ symbol: params.symbol });

    if (params.interval) searchParams.set("interval", params.interval);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const url = `${API_PRICES}?${searchParams}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch price history for ${params.symbol}: ${response.status}`);
    }

    const data: PricesResponse = await response.json();
    return {
        symbol: data.symbol,
        prices: data.prices,
        isSampleData: data.isSampleData,
    };
}

/**
 * Fetch instrument-region correlation mappings.
 * Supports filtering by region, symbol, event type, and geographic proximity.
 */
export async function fetchCorrelations(params?: {
    region?: string;
    symbol?: string;
    eventType?: string;
    lat?: number;
    lng?: number;
}): Promise<{ correlations: InstrumentCorrelation[]; isSampleData: boolean }> {
    const searchParams = new URLSearchParams();

    if (params?.region) searchParams.set("region", params.region);
    if (params?.symbol) searchParams.set("symbol", params.symbol);
    if (params?.eventType) searchParams.set("eventType", params.eventType);
    if (params?.lat !== undefined) searchParams.set("lat", String(params.lat));
    if (params?.lng !== undefined) searchParams.set("lng", String(params.lng));

    const url = searchParams.toString()
        ? `${API_CORRELATIONS}?${searchParams}`
        : API_CORRELATIONS;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch correlations: ${response.status}`);
    }

    const data: CorrelationsResponse = await response.json();
    return {
        correlations: data.correlations,
        isSampleData: data.isSampleData,
    };
}

/**
 * Fetch the current watchlist.
 */
export async function fetchWatchlist(): Promise<{
    watchlist: Watchlist;
    isSampleData: boolean;
}> {
    const response = await fetch(API_WATCHLIST);

    if (!response.ok) {
        throw new Error(`Failed to fetch watchlist: ${response.status}`);
    }

    const data: WatchlistResponse = await response.json();
    return {
        watchlist: data.watchlist,
        isSampleData: data.isSampleData,
    };
}

/**
 * Update the watchlist with a new set of symbols.
 */
export async function updateWatchlist(
    symbols: string[]
): Promise<{ watchlist: Watchlist }> {
    const response = await fetch(API_WATCHLIST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
    });

    if (!response.ok) {
        throw new Error(`Failed to update watchlist: ${response.status}`);
    }

    const data: WatchlistResponse = await response.json();
    return { watchlist: data.watchlist };
}
