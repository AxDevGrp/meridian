"use client";

/**
 * Zustand store for market impact signals.
 * Manages active signals, history, panel UI state, and evaluation status.
 *
 * CRITICAL: All useShallow selectors select RAW store references only.
 * ALL derived data (filtering, sorting, mapping) is done with useMemo.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { MarketSignal, SignalSeverity } from "@/lib/types/signal";

// ============================================
// Severity ordering for sort
// ============================================

const SEVERITY_ORDER: Record<SignalSeverity, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
    low: 3,
};

// ============================================
// Store State
// ============================================

interface SignalStoreState {
    // Data
    activeSignals: MarketSignal[];
    signalHistory: MarketSignal[];

    // UI state
    signalPanelOpen: boolean;
    selectedSignalId: string | null;
    isEvaluating: boolean;
    lastEvaluatedAt: string | null;
    isSampleData: boolean;

    // Actions
    setActiveSignals: (signals: MarketSignal[], isSample: boolean) => void;
    dismissSignal: (id: string) => void;
    acknowledgeSignal: (id: string) => void;
    resolveSignal: (id: string) => void;
    setSignalPanelOpen: (open: boolean) => void;
    setSelectedSignalId: (id: string | null) => void;
    setIsEvaluating: (evaluating: boolean) => void;
}

// ============================================
// History cap
// ============================================

const MAX_HISTORY = 50;

// ============================================
// Store
// ============================================

export const useSignalStore = create<SignalStoreState>((set, get) => ({
    // Data
    activeSignals: [],
    signalHistory: [],

    // UI state
    signalPanelOpen: false,
    selectedSignalId: null,
    isEvaluating: false,
    lastEvaluatedAt: null,
    isSampleData: false,

    // === Actions ===

    setActiveSignals: (signals: MarketSignal[], isSample: boolean) => {
        const state = get();
        const now = new Date().toISOString();
        const newIds = new Set(signals.map((s) => s.id));

        // Move previously active signals that are no longer present to history
        const resolved: MarketSignal[] = state.activeSignals
            .filter((s) => !newIds.has(s.id))
            .map((s) => ({
                ...s,
                status: "resolved" as const,
                resolvedAt: now,
            }));

        // Merge with existing history, cap at MAX_HISTORY
        const updatedHistory = [...resolved, ...state.signalHistory].slice(
            0,
            MAX_HISTORY,
        );

        set({
            activeSignals: signals,
            signalHistory: updatedHistory,
            lastEvaluatedAt: now,
            isSampleData: isSample,
            isEvaluating: false,
        });
    },

    dismissSignal: (id: string) => {
        const state = get();
        const now = new Date().toISOString();
        const signal = state.activeSignals.find((s) => s.id === id);
        if (!signal) return;

        const resolvedSignal: MarketSignal = {
            ...signal,
            status: "resolved",
            resolvedAt: now,
        };

        set({
            activeSignals: state.activeSignals.filter((s) => s.id !== id),
            signalHistory: [resolvedSignal, ...state.signalHistory].slice(
                0,
                MAX_HISTORY,
            ),
        });
    },

    acknowledgeSignal: (id: string) => {
        const state = get();
        const now = new Date().toISOString();

        set({
            activeSignals: state.activeSignals.map((s) =>
                s.id === id
                    ? { ...s, status: "acknowledged" as const, acknowledgedAt: now }
                    : s,
            ),
        });
    },

    resolveSignal: (id: string) => {
        const state = get();
        const now = new Date().toISOString();
        const signal = state.activeSignals.find((s) => s.id === id);
        if (!signal) return;

        const resolvedSignal: MarketSignal = {
            ...signal,
            status: "resolved",
            resolvedAt: now,
        };

        set({
            activeSignals: state.activeSignals.filter((s) => s.id !== id),
            signalHistory: [resolvedSignal, ...state.signalHistory].slice(
                0,
                MAX_HISTORY,
            ),
        });
    },

    setSignalPanelOpen: (open: boolean) => set({ signalPanelOpen: open }),

    setSelectedSignalId: (id: string | null) => set({ selectedSignalId: id }),

    setIsEvaluating: (evaluating: boolean) => set({ isEvaluating: evaluating }),
}));

// ============================================
// Selector Hooks
// ============================================

/**
 * Returns active signals sorted by confidence (highest first).
 * Uses useMemo for all derived data — NEVER filter/sort inside useShallow.
 */
export function useActiveSignals(): {
    signals: MarketSignal[];
    isEvaluating: boolean;
    lastEvaluatedAt: string | null;
    isSampleData: boolean;
} {
    const { activeSignals, isEvaluating, lastEvaluatedAt, isSampleData } =
        useSignalStore(
            useShallow((s) => ({
                activeSignals: s.activeSignals,
                isEvaluating: s.isEvaluating,
                lastEvaluatedAt: s.lastEvaluatedAt,
                isSampleData: s.isSampleData,
            })),
        );

    const signals = useMemo(() => {
        return [...activeSignals].sort((a, b) => b.confidence - a.confidence);
    }, [activeSignals]);

    return { signals, isEvaluating, lastEvaluatedAt, isSampleData };
}

/**
 * Returns the highest-severity active signal (for header indicator).
 */
export function useHighestSignal(): {
    signal: MarketSignal | null;
    count: number;
    maxSeverity: SignalSeverity | null;
} {
    const { activeSignals } = useSignalStore(
        useShallow((s) => ({
            activeSignals: s.activeSignals,
        })),
    );

    const result = useMemo(() => {
        if (activeSignals.length === 0) {
            return { signal: null, count: 0, maxSeverity: null };
        }

        const sorted = [...activeSignals].sort(
            (a, b) =>
                SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
        );

        return {
            signal: sorted[0],
            count: activeSignals.length,
            maxSeverity: sorted[0].severity,
        };
    }, [activeSignals]);

    return result;
}

/**
 * Returns a specific signal by ID (searches both active and history).
 */
export function useSignalById(id: string | null): MarketSignal | null {
    const { activeSignals, signalHistory } = useSignalStore(
        useShallow((s) => ({
            activeSignals: s.activeSignals,
            signalHistory: s.signalHistory,
        })),
    );

    const signal = useMemo(() => {
        if (!id) return null;
        return (
            activeSignals.find((s) => s.id === id) ??
            signalHistory.find((s) => s.id === id) ??
            null
        );
    }, [id, activeSignals, signalHistory]);

    return signal;
}

/**
 * Returns signal panel UI state and setters.
 */
export function useSignalPanelState(): {
    panelOpen: boolean;
    selectedSignalId: string | null;
    setPanelOpen: (open: boolean) => void;
    setSelectedSignalId: (id: string | null) => void;
} {
    return useSignalStore(
        useShallow((s) => ({
            panelOpen: s.signalPanelOpen,
            selectedSignalId: s.selectedSignalId,
            setPanelOpen: s.setSignalPanelOpen,
            setSelectedSignalId: s.setSelectedSignalId,
        })),
    );
}

/**
 * Returns signal history sorted by resolvedAt (newest first).
 */
export function useSignalHistory(): MarketSignal[] {
    const { signalHistory } = useSignalStore(
        useShallow((s) => ({
            signalHistory: s.signalHistory,
        })),
    );

    const sorted = useMemo(() => {
        return [...signalHistory].sort((a, b) => {
            const aTime = a.resolvedAt
                ? new Date(a.resolvedAt).getTime()
                : 0;
            const bTime = b.resolvedAt
                ? new Date(b.resolvedAt).getTime()
                : 0;
            return bTime - aTime;
        });
    }, [signalHistory]);

    return sorted;
}
