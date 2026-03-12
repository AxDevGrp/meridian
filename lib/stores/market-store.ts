import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
    MarketInstrument,
    MarketSector,
    AssetClass,
    PricePoint,
    PriceInterval,
    InstrumentCorrelation,
    Watchlist,
    WatchlistItem,
} from "@/lib/types/market";
import {
    fetchInstruments,
    fetchPriceHistory,
    fetchCorrelations,
    fetchWatchlist as fetchWatchlistAPI,
    updateWatchlist as updateWatchlistAPI,
    MARKET_POLLING,
} from "@/lib/services/market";

/**
 * Dedicated Zustand store for market data.
 * Separate from data-store.ts to keep concerns isolated.
 */

// === Constants ===

const WATCHLIST_STORAGE_KEY = "meridian-watchlist";
const DEFAULT_WATCHLIST_SYMBOLS = ["CL=F", "BZ=F", "GLD", "^VIX", "^GSPC", "TSM", "LMT", "ZIM"];

// === localStorage helpers (safe for SSR) ===

function loadWatchlistFromStorage(): Watchlist | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as Watchlist;
    } catch {
        return null;
    }
}

function saveWatchlistToStorage(watchlist: Watchlist): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
        // Storage full or unavailable — silently ignore
    }
}

function buildLocalWatchlist(symbols: string[]): Watchlist {
    const now = new Date().toISOString();
    return {
        id: "local",
        name: "My Watchlist",
        items: symbols.map((symbol) => ({ symbol, addedAt: now })),
        createdAt: now,
        updatedAt: now,
    };
}

// === Haversine for client-side proximity check ===

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// === State interface ===

interface MarketState {
    // Data
    instruments: MarketInstrument[];
    correlations: InstrumentCorrelation[];
    watchlist: Watchlist | null;
    priceHistory: Record<string, PricePoint[]>;

    // Loading states
    isLoadingInstruments: boolean;
    isLoadingCorrelations: boolean;
    isLoadingWatchlist: boolean;
    isLoadingPrices: Record<string, boolean>;

    // Errors
    instrumentsError: string | null;
    correlationsError: string | null;

    // Metadata
    lastUpdated: Date | null;
    isSampleData: boolean;

    // Polling
    pollingInterval: ReturnType<typeof setInterval> | null;

    // Actions — Fetch
    fetchInstruments: (params?: {
        sector?: MarketSector;
        assetClass?: AssetClass;
        symbols?: string[];
    }) => Promise<void>;
    fetchCorrelations: (params?: {
        region?: string;
        symbol?: string;
        eventType?: string;
    }) => Promise<void>;
    fetchWatchlist: () => Promise<void>;
    fetchPriceHistory: (
        symbol: string,
        interval?: PriceInterval,
        limit?: number,
    ) => Promise<void>;
    fetchAll: () => Promise<void>;

    // Actions — Watchlist
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
    isInWatchlist: (symbol: string) => boolean;

    // Actions — Polling
    startPolling: () => void;
    stopPolling: () => void;

    // Actions — Correlation lookup
    getCorrelationsForRegion: (regionName: string) => InstrumentCorrelation[];
    getCorrelationsForSymbol: (symbol: string) => InstrumentCorrelation[];
    getCorrelationsNearPoint: (lat: number, lng: number) => InstrumentCorrelation[];

    // Reset
    reset: () => void;
}

// === Initial state (no data loaded) ===

const initialState = {
    instruments: [] as MarketInstrument[],
    correlations: [] as InstrumentCorrelation[],
    watchlist: null as Watchlist | null,
    priceHistory: {} as Record<string, PricePoint[]>,

    isLoadingInstruments: false,
    isLoadingCorrelations: false,
    isLoadingWatchlist: false,
    isLoadingPrices: {} as Record<string, boolean>,

    instrumentsError: null as string | null,
    correlationsError: null as string | null,

    lastUpdated: null as Date | null,
    isSampleData: false,

    pollingInterval: null as ReturnType<typeof setInterval> | null,
};

// === Store ===

export const useMarketStore = create<MarketState>((set, get) => ({
    ...initialState,

    // ─── Fetch Instruments ───────────────────────────────────

    fetchInstruments: async (params) => {
        set({ isLoadingInstruments: true, instrumentsError: null });

        try {
            const result = await fetchInstruments(params);
            set({
                instruments: result.instruments,
                isLoadingInstruments: false,
                isSampleData: result.isSampleData,
                lastUpdated: new Date(),
            });
        } catch (err) {
            set({
                isLoadingInstruments: false,
                instrumentsError:
                    err instanceof Error ? err.message : "Failed to fetch instruments",
            });
        }
    },

    // ─── Fetch Correlations ──────────────────────────────────

    fetchCorrelations: async (params) => {
        set({ isLoadingCorrelations: true, correlationsError: null });

        try {
            const result = await fetchCorrelations(params);
            set({
                correlations: result.correlations,
                isLoadingCorrelations: false,
            });
        } catch (err) {
            set({
                isLoadingCorrelations: false,
                correlationsError:
                    err instanceof Error ? err.message : "Failed to fetch correlations",
            });
        }
    },

    // ─── Fetch Watchlist ─────────────────────────────────────

    fetchWatchlist: async () => {
        set({ isLoadingWatchlist: true });

        try {
            // Prefer localStorage watchlist, fall back to API default
            const stored = loadWatchlistFromStorage();
            if (stored) {
                set({ watchlist: stored, isLoadingWatchlist: false });
                return;
            }

            const result = await fetchWatchlistAPI();
            const wl = result.watchlist;
            saveWatchlistToStorage(wl);
            set({ watchlist: wl, isLoadingWatchlist: false });
        } catch (err) {
            // If API fails but we have nothing, use default symbols
            const fallback = buildLocalWatchlist(DEFAULT_WATCHLIST_SYMBOLS);
            saveWatchlistToStorage(fallback);
            set({
                watchlist: fallback,
                isLoadingWatchlist: false,
            });
            console.warn("Watchlist fetch failed, using defaults:", err);
        }
    },

    // ─── Fetch Price History ─────────────────────────────────

    fetchPriceHistory: async (symbol, interval, limit) => {
        set((state) => ({
            isLoadingPrices: { ...state.isLoadingPrices, [symbol]: true },
        }));

        try {
            const result = await fetchPriceHistory({ symbol, interval, limit });
            set((state) => ({
                priceHistory: { ...state.priceHistory, [symbol]: result.prices },
                isLoadingPrices: { ...state.isLoadingPrices, [symbol]: false },
            }));
        } catch (err) {
            console.error(`Price history fetch failed for ${symbol}:`, err);
            set((state) => ({
                isLoadingPrices: { ...state.isLoadingPrices, [symbol]: false },
            }));
        }
    },

    // ─── Fetch All ───────────────────────────────────────────

    fetchAll: async () => {
        const state = get();
        await Promise.allSettled([
            state.fetchInstruments(),
            state.fetchCorrelations(),
            state.fetchWatchlist(),
        ]);
    },

    // ─── Watchlist Mutations ─────────────────────────────────

    addToWatchlist: (symbol) => {
        const { watchlist } = get();
        const current = watchlist ?? buildLocalWatchlist([]);
        const exists = current.items.some((item) => item.symbol === symbol);
        if (exists) return;

        const newItem: WatchlistItem = {
            symbol,
            addedAt: new Date().toISOString(),
        };
        const updated: Watchlist = {
            ...current,
            items: [...current.items, newItem],
            updatedAt: new Date().toISOString(),
        };

        saveWatchlistToStorage(updated);
        set({ watchlist: updated });

        // Fire-and-forget sync to server
        updateWatchlistAPI(updated.items.map((i) => i.symbol)).catch(() => { });
    },

    removeFromWatchlist: (symbol) => {
        const { watchlist } = get();
        if (!watchlist) return;

        const updated: Watchlist = {
            ...watchlist,
            items: watchlist.items.filter((item) => item.symbol !== symbol),
            updatedAt: new Date().toISOString(),
        };

        saveWatchlistToStorage(updated);
        set({ watchlist: updated });

        // Fire-and-forget sync to server
        updateWatchlistAPI(updated.items.map((i) => i.symbol)).catch(() => { });
    },

    isInWatchlist: (symbol) => {
        const { watchlist } = get();
        return watchlist?.items.some((item) => item.symbol === symbol) ?? false;
    },

    // ─── Polling ─────────────────────────────────────────────

    startPolling: () => {
        const state = get();
        if (state.pollingInterval) clearInterval(state.pollingInterval);

        // Initial fetch
        state.fetchAll();

        const intervalId = setInterval(() => {
            const s = get();
            // Instruments & prices on 1-min cadence, correlations on 5-min
            s.fetchInstruments();
        }, MARKET_POLLING.INSTRUMENTS);

        // Separate slower cadence for correlations
        // We'll piggy-back on a counter within the main interval
        let tick = 0;
        const combinedInterval = setInterval(() => {
            tick++;
            const s = get();
            s.fetchInstruments();
            // Correlations every 5th tick (5 minutes)
            if (tick % 5 === 0) {
                s.fetchCorrelations();
            }
        }, MARKET_POLLING.INSTRUMENTS);

        // Clear the simple interval we created first
        clearInterval(intervalId);

        set({ pollingInterval: combinedInterval });
    },

    stopPolling: () => {
        const { pollingInterval } = get();
        if (pollingInterval) {
            clearInterval(pollingInterval);
            set({ pollingInterval: null });
        }
    },

    // ─── Correlation Lookups ─────────────────────────────────

    getCorrelationsForRegion: (regionName) => {
        const lower = regionName.toLowerCase();
        return get().correlations.filter((c) =>
            c.regionName.toLowerCase().includes(lower)
        );
    },

    getCorrelationsForSymbol: (symbol) => {
        return get().correlations.filter((c) => c.symbol === symbol);
    },

    getCorrelationsNearPoint: (lat, lng) => {
        return get().correlations.filter((c) => {
            if (!c.regionCenter || !c.regionRadiusKm) return false;
            const dist = haversineKm(lat, lng, c.regionCenter.lat, c.regionCenter.lng);
            return dist <= c.regionRadiusKm;
        });
    },

    // ─── Reset ───────────────────────────────────────────────

    reset: () => {
        const state = get();
        state.stopPolling();
        set(initialState);
    },
}));

// === Selector Hooks ===

/** All instruments with loading/error state */
export const useMarketInstruments = () =>
    useMarketStore(
        useShallow((state) => ({
            instruments: state.instruments,
            isLoading: state.isLoadingInstruments,
            error: state.instrumentsError,
            lastUpdated: state.lastUpdated,
            isSampleData: state.isSampleData,
        }))
    );

/** Instruments filtered to the current watchlist */
export function useWatchlistInstruments() {
    const { instruments, watchlist, isLoadingInstruments, isLoadingWatchlist } =
        useMarketStore(
            useShallow((state) => ({
                instruments: state.instruments,
                watchlist: state.watchlist,
                isLoadingInstruments: state.isLoadingInstruments,
                isLoadingWatchlist: state.isLoadingWatchlist,
            })),
        );

    const filteredInstruments = useMemo(() => {
        const symbolSet = new Set(
            watchlist?.items.map((i) => i.symbol) ?? [],
        );
        return instruments.filter((i) => symbolSet.has(i.symbol));
    }, [instruments, watchlist]);

    return {
        instruments: filteredInstruments,
        watchlist,
        isLoading: isLoadingInstruments || isLoadingWatchlist,
    };
}

/** All correlations with loading state */
export const useCorrelations = () =>
    useMarketStore(
        useShallow((state) => ({
            correlations: state.correlations,
            isLoading: state.isLoadingCorrelations,
            error: state.correlationsError,
        }))
    );

/** Single instrument by symbol */
export const useInstrumentBySymbol = (symbol: string | null) =>
    useMarketStore((state) =>
        symbol ? state.instruments.find((i) => i.symbol === symbol) ?? null : null
    );

/** Price history for a specific symbol */
export const usePriceHistory = (symbol: string | null) =>
    useMarketStore(
        useShallow((state) => ({
            prices: symbol ? (state.priceHistory[symbol] ?? []) : [],
            isLoading: symbol ? (state.isLoadingPrices[symbol] ?? false) : false,
        }))
    );

/** Correlations filtered to a specific region */
export function useCorrelationsForRegion(region: string | null) {
    const correlations = useMarketStore((state) => state.correlations);

    const filtered = useMemo(() => {
        if (!region) return [] as InstrumentCorrelation[];
        const lower = region.toLowerCase();
        return correlations.filter((c) =>
            c.regionName.toLowerCase().includes(lower),
        );
    }, [correlations, region]);

    return { correlations: filtered };
}

/** Aggregate market statistics */
export function useMarketStats() {
    const instruments = useMarketStore((state) => state.instruments);

    return useMemo(() => {
        const total = instruments.length;
        const sectors = new Set(
            instruments.map((i) => i.sector).filter(Boolean),
        ).size;
        const changes = instruments
            .map((i) => i.changePercent)
            .filter((c): c is number => c !== null);
        const avgChange =
            changes.length > 0
                ? Math.round(
                    (changes.reduce((a, b) => a + b, 0) / changes.length) *
                    100,
                ) / 100
                : 0;
        const gainers = instruments.filter(
            (i) => i.direction === "up",
        ).length;
        const losers = instruments.filter(
            (i) => i.direction === "down",
        ).length;

        return { total, sectors, avgChange, gainers, losers };
    }, [instruments]);
}
