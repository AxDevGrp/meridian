"use client";

/**
 * Zustand store for analytics state: anomalies, risk scores, patterns.
 * Provides filter/sort controls, panel state, and computed getters.
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
    Anomaly,
    RiskScore,
    Pattern,
    AnalyticsSnapshot,
    AnomalyKind,
    AnomalySeverity,
    AnalyticsSortBy,
} from "@/lib/types/analytics";

// ============================================
// Store State
// ============================================

interface AnalyticsStoreState {
    // Data
    anomalies: Anomaly[];
    riskScores: RiskScore[];
    patterns: Pattern[];

    // Status
    isComputing: boolean;
    lastComputedAt: string | null;
    isSampleData: boolean;
    error: string | null;

    // Filters
    anomalyFilter: AnomalyKind | "all";
    severityFilter: AnomalySeverity | "all";
    sortBy: AnalyticsSortBy;

    // Panel state
    analyticsPanelOpen: boolean;
    activeTab: "overview" | "patterns" | "compare";
    selectedRegion: string | null;

    // Actions
    setSnapshot: (snapshot: AnalyticsSnapshot) => void;
    setComputing: (computing: boolean) => void;
    setError: (error: string | null) => void;

    setAnomalyFilter: (filter: AnomalyKind | "all") => void;
    setSeverityFilter: (filter: AnomalySeverity | "all") => void;
    setSortBy: (sort: AnalyticsSortBy) => void;

    setAnalyticsPanelOpen: (open: boolean) => void;
    setActiveTab: (tab: "overview" | "patterns" | "compare") => void;
    setSelectedRegion: (region: string | null) => void;

    // Computed getters
    getFilteredAnomalies: () => Anomaly[];
    getRiskScoreForRegion: (regionName: string) => RiskScore | undefined;
    getAnomaliesForRegion: (regionName: string) => Anomaly[];
    getAnomalyCountBySeverity: () => Record<AnomalySeverity, number>;
}

// ============================================
// Severity ordering for sort
// ============================================

const SEVERITY_ORDER: Record<AnomalySeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

// ============================================
// Store
// ============================================

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
    // Data
    anomalies: [],
    riskScores: [],
    patterns: [],

    // Status
    isComputing: false,
    lastComputedAt: null,
    isSampleData: false,
    error: null,

    // Filters
    anomalyFilter: "all",
    severityFilter: "all",
    sortBy: "severity",

    // Panel state
    analyticsPanelOpen: false,
    activeTab: "overview",
    selectedRegion: null,

    // === Actions ===

    setSnapshot: (snapshot: AnalyticsSnapshot) =>
        set({
            anomalies: snapshot.anomalies,
            riskScores: snapshot.riskScores,
            patterns: snapshot.patterns,
            lastComputedAt: snapshot.computedAt,
            isSampleData: snapshot.isSampleData,
            isComputing: false,
            error: null,
        }),

    setComputing: (computing: boolean) => set({ isComputing: computing }),

    setError: (error: string | null) =>
        set({ error, isComputing: false }),

    setAnomalyFilter: (filter: AnomalyKind | "all") =>
        set({ anomalyFilter: filter }),

    setSeverityFilter: (filter: AnomalySeverity | "all") =>
        set({ severityFilter: filter }),

    setSortBy: (sort: AnalyticsSortBy) => set({ sortBy: sort }),

    setAnalyticsPanelOpen: (open: boolean) =>
        set({ analyticsPanelOpen: open }),

    setActiveTab: (tab: "overview" | "patterns" | "compare") =>
        set({ activeTab: tab }),

    setSelectedRegion: (region: string | null) =>
        set({ selectedRegion: region }),

    // === Computed Getters ===

    getFilteredAnomalies: (): Anomaly[] => {
        const state = get();
        let filtered = [...state.anomalies];

        // Filter by kind
        if (state.anomalyFilter !== "all") {
            filtered = filtered.filter((a) => a.kind === state.anomalyFilter);
        }

        // Filter by severity
        if (state.severityFilter !== "all") {
            filtered = filtered.filter(
                (a) => a.severity === state.severityFilter,
            );
        }

        // Sort
        switch (state.sortBy) {
            case "severity":
                filtered.sort(
                    (a, b) =>
                        SEVERITY_ORDER[a.severity] -
                        SEVERITY_ORDER[b.severity],
                );
                break;
            case "time":
                filtered.sort(
                    (a, b) =>
                        new Date(b.detectedAt).getTime() -
                        new Date(a.detectedAt).getTime(),
                );
                break;
            case "score":
                filtered.sort((a, b) => b.score - a.score);
                break;
        }

        return filtered;
    },

    getRiskScoreForRegion: (regionName: string): RiskScore | undefined => {
        const state = get();
        return state.riskScores.find((r) => r.regionName === regionName);
    },

    getAnomaliesForRegion: (regionName: string): Anomaly[] => {
        const state = get();
        return state.anomalies.filter((a) => a.regionName === regionName);
    },

    getAnomalyCountBySeverity: (): Record<AnomalySeverity, number> => {
        const state = get();
        const counts: Record<AnomalySeverity, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };
        for (const anomaly of state.anomalies) {
            counts[anomaly.severity]++;
        }
        return counts;
    },
}));

// ============================================
// Selector Hooks
// ============================================

export const useAnalyticsOverview = () =>
    useAnalyticsStore(
        useShallow((s) => ({
            anomalies: s.anomalies,
            riskScores: s.riskScores,
            patterns: s.patterns,
            isComputing: s.isComputing,
            lastComputedAt: s.lastComputedAt,
            isSampleData: s.isSampleData,
            error: s.error,
        })),
    );

export const useAnomalyList = () =>
    useAnalyticsStore(
        useShallow((s) => ({
            anomalies: s.getFilteredAnomalies(),
            filter: s.anomalyFilter,
            severityFilter: s.severityFilter,
            sortBy: s.sortBy,
            setFilter: s.setAnomalyFilter,
            setSeverityFilter: s.setSeverityFilter,
            setSortBy: s.setSortBy,
        })),
    );

export const useRiskScores = () =>
    useAnalyticsStore(
        useShallow((s) => ({
            riskScores: s.riskScores,
            selectedRegion: s.selectedRegion,
            setSelectedRegion: s.setSelectedRegion,
        })),
    );

export const usePatternList = () =>
    useAnalyticsStore(
        useShallow((s) => ({
            patterns: s.patterns,
        })),
    );

export const useAnalyticsPanelState = () =>
    useAnalyticsStore(
        useShallow((s) => ({
            panelOpen: s.analyticsPanelOpen,
            activeTab: s.activeTab,
            setPanelOpen: s.setAnalyticsPanelOpen,
            setActiveTab: s.setActiveTab,
        })),
    );

export const useAnalyticsAnomalyCount = () =>
    useAnalyticsStore((s) => s.anomalies.length);
