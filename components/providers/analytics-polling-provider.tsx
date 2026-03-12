"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAnalyticsStore } from "@/lib/stores/analytics-store";
import { useDataStore } from "@/lib/stores/data-store";
import { useAircraftStore } from "@/lib/stores/aircraft-store";
import { useMarketStore } from "@/lib/stores/market-store";
import { detectAnomalies, type AnomalyDataSnapshot } from "@/lib/analytics/anomaly-engine";
import { computeRiskScores } from "@/lib/analytics/risk-engine";
import { detectPatterns } from "@/lib/analytics/pattern-engine";
import {
    generateSampleAnomalies,
    generateSampleRiskScores,
    generateSamplePatterns,
} from "@/lib/analytics/sample-analytics-data";

/** Analytics computation interval: 60 seconds */
const ANALYTICS_INTERVAL = 60_000;

/**
 * Background provider that periodically computes analytics
 * (anomalies, risk scores, patterns) from all data stores.
 * Falls back to sample data when stores are empty.
 */
export function AnalyticsPollingProvider({ children }: { children: React.ReactNode }) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Analytics store actions
    const setSnapshot = useAnalyticsStore((s) => s.setSnapshot);
    const setComputing = useAnalyticsStore((s) => s.setComputing);
    const setError = useAnalyticsStore((s) => s.setError);

    // Data store subscriptions
    const conflicts = useDataStore((s) => s.conflicts.data);
    const gpsJamming = useDataStore((s) => s.gpsJamming.data);
    const vessels = useDataStore((s) => s.vessels.data);
    const socialPosts = useDataStore((s) => s.socialFeed.data);

    // Aircraft store
    const aircraft = useAircraftStore((s) => s.aircraft);

    // Market store
    const instruments = useMarketStore((s) => s.instruments);

    const computeAnalytics = useCallback(() => {
        try {
            setComputing(true);

            // Check if we have real data from any store
            const hasRealData =
                conflicts.length > 0 ||
                gpsJamming.length > 0 ||
                vessels.length > 0 ||
                aircraft.length > 0 ||
                socialPosts.length > 0 ||
                instruments.length > 0;

            if (hasRealData) {
                // Build snapshot from live store data
                const snapshot: AnomalyDataSnapshot = {
                    conflicts,
                    gpsJamming,
                    vessels,
                    aircraft,
                    socialPosts,
                    marketInstruments: instruments,
                };

                // Run all three engines
                const anomalies = detectAnomalies(snapshot);
                const riskScores = computeRiskScores(snapshot);
                const patterns = detectPatterns(snapshot);

                setSnapshot({
                    anomalies,
                    riskScores,
                    patterns,
                    computedAt: new Date().toISOString(),
                    isSampleData: false,
                });
            } else {
                // Fall back to sample data
                setSnapshot({
                    anomalies: generateSampleAnomalies(),
                    riskScores: generateSampleRiskScores(),
                    patterns: generateSamplePatterns(),
                    computedAt: new Date().toISOString(),
                    isSampleData: true,
                });
            }
        } catch (error) {
            console.error("Analytics computation error:", error);
            setError(
                error instanceof Error
                    ? error.message
                    : "Analytics computation failed",
            );
        }
    }, [
        conflicts,
        gpsJamming,
        vessels,
        aircraft,
        socialPosts,
        instruments,
        setSnapshot,
        setComputing,
        setError,
    ]);

    useEffect(() => {
        // Run one computation cycle immediately on mount
        computeAnalytics();

        // Start interval for periodic re-computation
        timerRef.current = setInterval(computeAnalytics, ANALYTICS_INTERVAL);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [computeAnalytics]);

    return <>{children}</>;
}
