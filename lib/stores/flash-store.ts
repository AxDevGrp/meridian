/**
 * FLASH Alert Store (Zustand)
 *
 * Manages the queue of active FLASH alerts, dismissal state,
 * and history of past alerts.
 *
 * IMPORTANT: Do NOT call .filter()/.map() inside useShallow selectors.
 * Derive filtered data with useMemo in consuming components.
 */

import { create } from "zustand";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FlashAlert, FlashPriority } from "@/lib/types/flash";

// ============================================
// Store Interface
// ============================================

interface FlashState {
    /** Active (non-dismissed) flash alerts, newest first */
    alerts: FlashAlert[];
    /** Dismissed alerts (kept for history) */
    history: FlashAlert[];
    /** Whether FLASH system is enabled */
    enabled: boolean;
    /** Whether audio alerts are enabled */
    audioEnabled: boolean;
    /** Maximum number of active alerts shown simultaneously */
    maxVisible: number;

    // Actions
    addAlert: (alert: FlashAlert) => void;
    addAlerts: (alerts: FlashAlert[]) => void;
    dismissAlert: (id: string) => void;
    dismissAll: () => void;
    clearExpired: () => void;
    toggleEnabled: () => void;
    toggleAudio: () => void;
}

// ============================================
// Store
// ============================================

export const useFlashStore = create<FlashState>((set) => ({
    alerts: [],
    history: [],
    enabled: true,
    audioEnabled: true,
    maxVisible: 3,

    addAlert: (alert) =>
        set((state) => {
            // Prevent duplicates (same source post ID)
            if (state.alerts.some((a) => a.sourcePost.id === alert.sourcePost.id)) {
                return state;
            }
            return {
                alerts: [alert, ...state.alerts],
            };
        }),

    addAlerts: (alerts) =>
        set((state) => {
            const existingIds = new Set(state.alerts.map((a) => a.sourcePost.id));
            const newAlerts = alerts.filter((a) => !existingIds.has(a.sourcePost.id));
            if (newAlerts.length === 0) return state;
            return {
                alerts: [...newAlerts, ...state.alerts],
            };
        }),

    dismissAlert: (id) =>
        set((state) => {
            const alert = state.alerts.find((a) => a.id === id);
            if (!alert) return state;
            return {
                alerts: state.alerts.filter((a) => a.id !== id),
                history: [{ ...alert, dismissed: true }, ...state.history].slice(0, 50),
            };
        }),

    dismissAll: () =>
        set((state) => ({
            alerts: [],
            history: [
                ...state.alerts.map((a) => ({ ...a, dismissed: true })),
                ...state.history,
            ].slice(0, 50),
        })),

    clearExpired: () =>
        set((state) => {
            const now = Date.now();
            const expired: FlashAlert[] = [];
            const active: FlashAlert[] = [];

            for (const alert of state.alerts) {
                if (alert.expiresAt && new Date(alert.expiresAt).getTime() <= now) {
                    expired.push({ ...alert, dismissed: true });
                } else {
                    active.push(alert);
                }
            }

            if (expired.length === 0) return state;

            return {
                alerts: active,
                history: [...expired, ...state.history].slice(0, 50),
            };
        }),

    toggleEnabled: () =>
        set((state) => ({ enabled: !state.enabled })),

    toggleAudio: () =>
        set((state) => ({ audioEnabled: !state.audioEnabled })),
}));

// ============================================
// Safe Hooks (no .filter inside useShallow)
// ============================================

/**
 * Get visible flash alerts (capped at maxVisible)
 */
export function useVisibleFlashAlerts(): FlashAlert[] {
    const alerts = useFlashStore((s) => s.alerts);
    const maxVisible = useFlashStore((s) => s.maxVisible);
    return useMemo(() => alerts.slice(0, maxVisible), [alerts, maxVisible]);
}

/**
 * Get the highest-priority active alert
 */
export function useTopFlashAlert(): FlashAlert | null {
    const alerts = useFlashStore((s) => s.alerts);
    return useMemo(() => {
        if (alerts.length === 0) return null;
        const order: Record<FlashPriority, number> = { critical: 0, urgent: 1, breaking: 2 };
        const sorted = [...alerts].sort((a, b) => order[a.priority] - order[b.priority]);
        return sorted[0];
    }, [alerts]);
}

/**
 * Get flash alert count by priority
 */
export function useFlashCounts(): Record<FlashPriority, number> {
    const alerts = useFlashStore((s) => s.alerts);
    return useMemo(() => {
        const counts: Record<FlashPriority, number> = { critical: 0, urgent: 0, breaking: 0 };
        for (const a of alerts) {
            counts[a.priority]++;
        }
        return counts;
    }, [alerts]);
}

/**
 * Get flash store actions
 */
export function useFlashActions() {
    return useFlashStore(
        useShallow((s) => ({
            addAlert: s.addAlert,
            addAlerts: s.addAlerts,
            dismissAlert: s.dismissAlert,
            dismissAll: s.dismissAll,
            clearExpired: s.clearExpired,
            toggleEnabled: s.toggleEnabled,
            toggleAudio: s.toggleAudio,
        })),
    );
}
