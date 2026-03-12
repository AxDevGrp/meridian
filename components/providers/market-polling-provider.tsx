"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/lib/stores/market-store";

/**
 * Provider that starts market data polling when mounted.
 * Fetches instruments, correlations, and watchlist on mount,
 * then polls instruments on a 60s cadence.
 */
export function MarketPollingProvider({ children }: { children: React.ReactNode }) {
    const fetchAll = useMarketStore((state) => state.fetchAll);
    const startPolling = useMarketStore((state) => state.startPolling);
    const stopPolling = useMarketStore((state) => state.stopPolling);

    useEffect(() => {
        fetchAll();
        startPolling();
        return () => stopPolling();
    }, [fetchAll, startPolling, stopPolling]);

    return <>{children}</>;
}
