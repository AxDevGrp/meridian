"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { AlertRule, AlertNotification } from "@/lib/types/alert";
import {
    fetchAlertRules,
    fetchAlertRule,
    createAlertRule as createAlertRuleAPI,
    updateAlertRule as updateAlertRuleAPI,
    deleteAlertRule as deleteAlertRuleAPI,
    fetchAlertHistory,
    acknowledgeAlert as acknowledgeAlertAPI,
} from "@/lib/services/alerts";

/**
 * Zustand store for managing alert rules and notifications.
 * Uses localStorage for persistence (matching Phase 3 watchlist pattern).
 */

// === Constants ===

const ALERT_RULES_STORAGE_KEY = "meridian-alert-rules";
const MAX_TOASTS = 3;

// === localStorage helpers (safe for SSR) ===

function loadRulesFromStorage(): AlertRule[] | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(ALERT_RULES_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as AlertRule[];
    } catch {
        return null;
    }
}

function saveRulesToStorage(rules: AlertRule[]): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
        // Storage full or unavailable — silently ignore
    }
}

// === Compute unacknowledged count ===

function computeUnacknowledgedCount(notifications: AlertNotification[]): number {
    return notifications.filter((n) => !n.acknowledged).length;
}

// === State interface ===

interface AlertStoreState {
    // Alert rules
    rules: AlertRule[];
    rulesLoading: boolean;
    rulesError: string | null;

    // Notification history
    notifications: AlertNotification[];
    notificationsLoading: boolean;

    // Toast queue (active toasts shown to user)
    toastQueue: AlertNotification[];
    maxToasts: number;

    // Panel visibility
    alertPanelOpen: boolean;
    alertHistoryOpen: boolean;

    // Unacknowledged count (for badge)
    unacknowledgedCount: number;

    // Actions — Rules CRUD
    fetchRules: () => Promise<void>;
    createRule: (rule: Omit<AlertRule, "id" | "createdAt" | "updatedAt">) => Promise<AlertRule | null>;
    updateRule: (id: string, updates: Partial<AlertRule>) => Promise<void>;
    deleteRule: (id: string) => Promise<void>;
    toggleRule: (id: string) => Promise<void>;

    // Actions — Notifications
    fetchNotifications: (limit?: number) => Promise<void>;
    addNotification: (notification: AlertNotification) => void;
    acknowledgeNotification: (id: string) => Promise<void>;
    acknowledgeAll: () => Promise<void>;

    // Actions — Toast management
    pushToast: (notification: AlertNotification) => void;
    dismissToast: (id: string) => void;

    // Actions — Panel visibility
    setAlertPanelOpen: (open: boolean) => void;
    setAlertHistoryOpen: (open: boolean) => void;
}

// === Initial state ===

const initialState = {
    rules: [] as AlertRule[],
    rulesLoading: false,
    rulesError: null as string | null,

    notifications: [] as AlertNotification[],
    notificationsLoading: false,

    toastQueue: [] as AlertNotification[],
    maxToasts: MAX_TOASTS,

    alertPanelOpen: false,
    alertHistoryOpen: false,

    unacknowledgedCount: 0,
};

// === Store ===

export const useAlertStore = create<AlertStoreState>((set, get) => ({
    ...initialState,

    // ─── Fetch Rules ────────────────────────────────────────

    fetchRules: async () => {
        set({ rulesLoading: true, rulesError: null });

        try {
            const rules = await fetchAlertRules();
            set({
                rules,
                rulesLoading: false,
            });
            saveRulesToStorage(rules);
        } catch (err) {
            // Fall back to localStorage if available
            const cached = loadRulesFromStorage();
            set({
                rulesLoading: false,
                rulesError:
                    err instanceof Error ? err.message : "Failed to fetch alert rules",
                rules: cached ?? get().rules,
            });
        }
    },

    // ─── Create Rule ────────────────────────────────────────

    createRule: async (rule) => {
        try {
            const created = await createAlertRuleAPI(rule);
            set((state) => {
                const updatedRules = [created, ...state.rules];
                saveRulesToStorage(updatedRules);
                return { rules: updatedRules };
            });
            return created;
        } catch (err) {
            console.error("Failed to create alert rule:", err);
            return null;
        }
    },

    // ─── Update Rule ────────────────────────────────────────

    updateRule: async (id, updates) => {
        try {
            const updated = await updateAlertRuleAPI(id, updates);
            set((state) => {
                const updatedRules = state.rules.map((r) =>
                    r.id === id ? updated : r,
                );
                saveRulesToStorage(updatedRules);
                return { rules: updatedRules };
            });
        } catch (err) {
            console.error("Failed to update alert rule:", err);
        }
    },

    // ─── Delete Rule ────────────────────────────────────────

    deleteRule: async (id) => {
        try {
            await deleteAlertRuleAPI(id);
            set((state) => {
                const updatedRules = state.rules.filter((r) => r.id !== id);
                saveRulesToStorage(updatedRules);
                return { rules: updatedRules };
            });
        } catch (err) {
            console.error("Failed to delete alert rule:", err);
        }
    },

    // ─── Toggle Rule ────────────────────────────────────────

    toggleRule: async (id) => {
        const rule = get().rules.find((r) => r.id === id);
        if (!rule) return;

        try {
            const updated = await updateAlertRuleAPI(id, { enabled: !rule.enabled });
            set((state) => {
                const updatedRules = state.rules.map((r) =>
                    r.id === id ? updated : r,
                );
                saveRulesToStorage(updatedRules);
                return { rules: updatedRules };
            });
        } catch (err) {
            console.error("Failed to toggle alert rule:", err);
        }
    },

    // ─── Fetch Notifications ────────────────────────────────

    fetchNotifications: async (limit) => {
        set({ notificationsLoading: true });

        try {
            const notifications = await fetchAlertHistory(limit);
            set({
                notifications,
                notificationsLoading: false,
                unacknowledgedCount: computeUnacknowledgedCount(notifications),
            });
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
            set({ notificationsLoading: false });
        }
    },

    // ─── Add Notification (local) ───────────────────────────

    addNotification: (notification) => {
        set((state) => {
            const updatedNotifications = [notification, ...state.notifications];
            return {
                notifications: updatedNotifications,
                unacknowledgedCount: computeUnacknowledgedCount(updatedNotifications),
            };
        });
    },

    // ─── Acknowledge Notification ───────────────────────────

    acknowledgeNotification: async (id) => {
        try {
            await acknowledgeAlertAPI(id);
            set((state) => {
                const updatedNotifications = state.notifications.map((n) =>
                    n.id === id
                        ? { ...n, acknowledged: true, acknowledgedAt: new Date().toISOString() }
                        : n,
                );
                return {
                    notifications: updatedNotifications,
                    unacknowledgedCount: computeUnacknowledgedCount(updatedNotifications),
                };
            });
        } catch (err) {
            console.error("Failed to acknowledge notification:", err);
        }
    },

    // ─── Acknowledge All ────────────────────────────────────

    acknowledgeAll: async () => {
        const { notifications } = get();
        const unacknowledged = notifications.filter((n) => !n.acknowledged);

        // Fire all acknowledge calls in parallel
        await Promise.allSettled(
            unacknowledged.map((n) => acknowledgeAlertAPI(n.id)),
        );

        set((state) => {
            const now = new Date().toISOString();
            const updatedNotifications = state.notifications.map((n) =>
                !n.acknowledged
                    ? { ...n, acknowledged: true, acknowledgedAt: now }
                    : n,
            );
            return {
                notifications: updatedNotifications,
                unacknowledgedCount: 0,
            };
        });
    },

    // ─── Push Toast ─────────────────────────────────────────

    pushToast: (notification) => {
        set((state) => {
            let queue = [...state.toastQueue];

            // If at max capacity, remove oldest non-critical toast
            if (queue.length >= MAX_TOASTS) {
                const nonCriticalIndex = queue.findIndex((t) => t.severity !== "critical");
                if (nonCriticalIndex !== -1) {
                    queue.splice(nonCriticalIndex, 1);
                } else {
                    // All critical — remove the oldest anyway
                    queue.shift();
                }
            }

            queue.push(notification);

            return { toastQueue: queue };
        });
    },

    // ─── Dismiss Toast ──────────────────────────────────────

    dismissToast: (id) => {
        set((state) => ({
            toastQueue: state.toastQueue.filter((t) => t.id !== id),
        }));
    },

    // ─── Panel Visibility ───────────────────────────────────

    setAlertPanelOpen: (open) => {
        set({ alertPanelOpen: open });
    },

    setAlertHistoryOpen: (open) => {
        set({ alertHistoryOpen: open });
    },
}));

// === Selector Hooks ===

/** Alert rules with loading/error state */
export const useAlertRules = () =>
    useAlertStore(
        useShallow((s) => ({
            rules: s.rules,
            loading: s.rulesLoading,
            error: s.rulesError,
        })),
    );

/** Alert notifications with loading state */
export const useAlertNotifications = () =>
    useAlertStore(
        useShallow((s) => ({
            notifications: s.notifications,
            loading: s.notificationsLoading,
        })),
    );

/** Active toast queue */
export const useAlertToasts = () =>
    useAlertStore(
        useShallow((s) => ({
            toasts: s.toastQueue,
        })),
    );

/** Unacknowledged notification count (for badge) */
export const useUnacknowledgedCount = () =>
    useAlertStore((s) => s.unacknowledgedCount);

/** Alert panel visibility state */
export const useAlertPanelState = () =>
    useAlertStore(
        useShallow((s) => ({
            panelOpen: s.alertPanelOpen,
            historyOpen: s.alertHistoryOpen,
        })),
    );
