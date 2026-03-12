"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useDataStore } from "@/lib/stores/data-store";
import { useAircraftStore } from "@/lib/stores/aircraft-store";
import { useMarketStore } from "@/lib/stores/market-store";
import { evaluateAlertRules } from "@/lib/alert-engine";
import type { AlertDataSnapshot } from "@/lib/alert-engine";

/** Polling interval for alert evaluation (30 seconds) */
const EVALUATION_INTERVAL_MS = 30_000;

/**
 * Background provider that periodically evaluates alert rules
 * against current data from all stores. Triggered notifications
 * are pushed to the toast queue and notification history.
 */
export function AlertPollingProvider({ children }: { children: React.ReactNode }) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastEvalRef = useRef<number>(0);

    // Alert store actions & rules
    const rules = useAlertStore((s) => s.rules);
    const pushToast = useAlertStore((s) => s.pushToast);
    const addNotification = useAlertStore((s) => s.addNotification);
    const fetchRules = useAlertStore((s) => s.fetchRules);
    const fetchNotifications = useAlertStore((s) => s.fetchNotifications);
    const updateRule = useAlertStore((s) => s.updateRule);

    // Data store subscriptions
    const conflicts = useDataStore((s) => s.conflicts.data);
    const gpsJamming = useDataStore((s) => s.gpsJamming.data);
    const vessels = useDataStore((s) => s.vessels.data);
    const socialPosts = useDataStore((s) => s.socialFeed.data);

    // Aircraft store
    const aircraft = useAircraftStore((s) => s.aircraft);

    // Market store
    const instruments = useMarketStore((s) => s.instruments);
    const correlations = useMarketStore((s) => s.correlations);

    // Build snapshot and evaluate
    const evaluate = useCallback(() => {
        if (rules.length === 0) return;

        const now = Date.now();

        // Debounce — don't evaluate more frequently than the interval
        if (now - lastEvalRef.current < EVALUATION_INTERVAL_MS * 0.9) return;
        lastEvalRef.current = now;

        const snapshot: AlertDataSnapshot = {
            conflicts: conflicts as unknown as Record<string, unknown>[],
            gpsJamming: gpsJamming as unknown as Record<string, unknown>[],
            vessels: vessels as unknown as Record<string, unknown>[],
            aircraft: aircraft as unknown as Record<string, unknown>[],
            socialPosts: socialPosts as unknown as Record<string, unknown>[],
            marketInstruments: instruments as unknown as Record<string, unknown>[],
            correlations: correlations as unknown as Record<string, unknown>[],
        };

        const notifications = evaluateAlertRules(rules, snapshot);

        for (const notification of notifications) {
            pushToast(notification);
            addNotification(notification);

            // Update lastTriggeredAt on the rule to enforce cooldown
            updateRule(notification.ruleId, {
                lastTriggeredAt: notification.triggeredAt,
            });
        }
    }, [
        rules,
        conflicts,
        gpsJamming,
        vessels,
        aircraft,
        socialPosts,
        instruments,
        correlations,
        pushToast,
        addNotification,
        updateRule,
    ]);

    // Fetch rules and notifications on mount
    useEffect(() => {
        fetchRules();
        fetchNotifications(50);
    }, [fetchRules, fetchNotifications]);

    // Set up evaluation interval
    useEffect(() => {
        // Run initial evaluation after a short delay (give stores time to hydrate)
        const initialTimer = setTimeout(() => {
            evaluate();
        }, 5_000);

        // Set up recurring interval
        timerRef.current = setInterval(evaluate, EVALUATION_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimer);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [evaluate]);

    return <>{children}</>;
}
