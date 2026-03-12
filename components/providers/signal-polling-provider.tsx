"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSignalStore } from "@/lib/stores/signal-store";
import { useDataStore } from "@/lib/stores/data-store";
import { useAircraftStore } from "@/lib/stores/aircraft-store";
import { useMarketStore } from "@/lib/stores/market-store";
import { useAnalyticsStore } from "@/lib/stores/analytics-store";
import { evaluateScenarios, generateSampleSignals } from "@/lib/scenario-engine";
import type { AnomalyDataSnapshot } from "@/lib/analytics/anomaly-engine";

/** Signal evaluation interval: 60 seconds */
const SIGNAL_POLL_INTERVAL = 60_000;

/** Initial delay before first evaluation (let data stores populate first) */
const INITIAL_DELAY = 5_000;

/**
 * Background provider that periodically evaluates scenario playbooks
 * against live data to generate market impact signals.
 * Falls back to sample signals when no real data is available.
 *
 * Pattern mirrors AnalyticsPollingProvider — accesses stores via
 * `.getState()` inside a stable `useCallback` to avoid stale closures.
 */
export function SignalPollingProvider({ children }: { children: React.ReactNode }) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const evaluate = useCallback(() => {
        const signalStore = useSignalStore.getState();
        const dataStore = useDataStore.getState();
        const aircraftStore = useAircraftStore.getState();
        const marketStore = useMarketStore.getState();
        const analyticsStore = useAnalyticsStore.getState();

        signalStore.setIsEvaluating(true);

        try {
            // Build the data snapshot for scenario evaluation
            const snapshot: AnomalyDataSnapshot = {
                conflicts: dataStore.conflicts.data,
                gpsJamming: dataStore.gpsJamming.data,
                vessels: dataStore.vessels.data,
                aircraft: aircraftStore.aircraft,
                socialPosts: dataStore.socialFeed.data,
                marketInstruments: marketStore.instruments,
            };

            // Pull analytics results
            const anomalies = analyticsStore.anomalies;
            const riskScores = analyticsStore.riskScores;
            const patterns = analyticsStore.patterns;

            // Determine whether we have any real data loaded
            const hasRealData =
                !dataStore.conflicts.isSampleData ||
                !dataStore.vessels.isSampleData ||
                aircraftStore.aircraft.length > 0;

            let signals;
            if (!hasRealData && anomalies.length === 0) {
                // No real data — use deterministic sample signals
                signals = generateSampleSignals();
            } else {
                // Evaluate live playbooks against real data
                signals = evaluateScenarios(snapshot, anomalies, riskScores, patterns);
            }

            const isSample = !hasRealData && anomalies.length === 0;
            signalStore.setActiveSignals(signals, isSample);
        } catch (error) {
            console.error("Signal evaluation error:", error);
        } finally {
            signalStore.setIsEvaluating(false);
        }
    }, []);

    useEffect(() => {
        // Delay the first evaluation so other polling providers populate stores
        const initialTimeout = setTimeout(evaluate, INITIAL_DELAY);

        // Set up recurring evaluation on a 60-second cadence
        intervalRef.current = setInterval(evaluate, SIGNAL_POLL_INTERVAL);

        return () => {
            clearTimeout(initialTimeout);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [evaluate]);

    return <>{children}</>;
}
