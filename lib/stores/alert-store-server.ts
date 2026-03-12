/**
 * Server-side in-memory alert store (MVP).
 * Used by API routes to persist alert rules and notification history
 * during the server process lifetime.
 *
 * In production this would be replaced by database persistence.
 */

import type { AlertRule, AlertNotification } from "@/lib/types/alert";
import { ALERT_PRESETS } from "@/lib/types/alert";

// ============================================
// Module-level Maps — persist for Node process lifetime
// ============================================

const alertRules = new Map<string, AlertRule>();
const alertHistory = new Map<string, AlertNotification>();

// ============================================
// Initialization — seed presets on first import
// ============================================

let initialized = false;

function ensureInitialized(): void {
    if (initialized) return;
    initialized = true;

    const now = new Date();

    ALERT_PRESETS.forEach((preset, index) => {
        const id = crypto.randomUUID();
        const createdAt = new Date(now.getTime() - (index + 1) * 3600_000).toISOString();

        const rule: AlertRule = {
            id,
            name: preset.name,
            description: preset.description,
            enabled: false, // All disabled by default
            severity: preset.severity,
            conditionType: preset.conditionType,
            conditionConfig: preset.conditionConfig,
            regionName: preset.regionName,
            regionCenter: preset.regionCenter,
            regionRadiusKm: preset.regionRadiusKm,
            cooldownMinutes: preset.cooldownMinutes,
            createdAt,
            updatedAt: createdAt,
        };

        alertRules.set(id, rule);
    });
}

// ============================================
// Rule CRUD
// ============================================

export function getAllRules(): AlertRule[] {
    ensureInitialized();
    return Array.from(alertRules.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function getRule(id: string): AlertRule | undefined {
    ensureInitialized();
    return alertRules.get(id);
}

export function createRule(rule: AlertRule): void {
    ensureInitialized();
    alertRules.set(rule.id, rule);
}

export function updateRule(id: string, updates: Partial<AlertRule>): AlertRule | undefined {
    ensureInitialized();
    const existing = alertRules.get(id);
    if (!existing) return undefined;

    const updated: AlertRule = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent ID overwrite
        createdAt: existing.createdAt, // Preserve original creation time
        updatedAt: new Date().toISOString(),
    };

    alertRules.set(id, updated);
    return updated;
}

export function deleteRule(id: string): boolean {
    ensureInitialized();
    return alertRules.delete(id);
}

export function ruleCount(): number {
    ensureInitialized();
    return alertRules.size;
}

// ============================================
// Notification History
// ============================================

export function getHistory(limit?: number): AlertNotification[] {
    ensureInitialized();
    const sorted = Array.from(alertHistory.values()).sort(
        (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    );
    return limit ? sorted.slice(0, limit) : sorted;
}

export function getNotification(id: string): AlertNotification | undefined {
    ensureInitialized();
    return alertHistory.get(id);
}

export function addNotification(notification: AlertNotification): void {
    ensureInitialized();
    alertHistory.set(notification.id, notification);
}

export function acknowledgeNotification(id: string): boolean {
    ensureInitialized();
    const notification = alertHistory.get(id);
    if (!notification) return false;

    notification.acknowledged = true;
    notification.acknowledgedAt = new Date().toISOString();
    alertHistory.set(id, notification);
    return true;
}

export function historyCount(): number {
    ensureInitialized();
    return alertHistory.size;
}
