import type { AlertRule, AlertNotification } from "@/lib/types/alert";

/**
 * Alert service — fetch wrappers for alert API routes.
 * Follows the same pattern as lib/services/market.ts.
 */

// === API base paths ===

const API_ALERTS = "/api/intel/alerts";
const API_ALERT_HISTORY = "/api/intel/alerts/history";

// === API response types ===

interface AlertRulesResponse {
    success: boolean;
    data: AlertRule[];
    count: number;
    timestamp: string;
}

interface AlertRuleResponse {
    success: boolean;
    data: AlertRule;
    timestamp: string;
}

interface AlertHistoryResponse {
    success: boolean;
    data: AlertNotification[];
    count: number;
    timestamp: string;
}

interface AlertNotificationResponse {
    success: boolean;
    data: AlertNotification;
    timestamp: string;
}

// === Fetch functions — Rules CRUD ===

/**
 * Fetch all alert rules.
 */
export async function fetchAlertRules(): Promise<AlertRule[]> {
    const response = await fetch(API_ALERTS);

    if (!response.ok) {
        throw new Error(`Failed to fetch alert rules: ${response.status}`);
    }

    const data: AlertRulesResponse = await response.json();
    return data.data;
}

/**
 * Fetch a single alert rule by ID.
 */
export async function fetchAlertRule(id: string): Promise<AlertRule> {
    const response = await fetch(`${API_ALERTS}/${id}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Alert rule not found: ${id}`);
        }
        throw new Error(`Failed to fetch alert rule: ${response.status}`);
    }

    const data: AlertRuleResponse = await response.json();
    return data.data;
}

/**
 * Create a new alert rule.
 */
export async function createAlertRule(
    rule: Omit<AlertRule, "id" | "createdAt" | "updatedAt">,
): Promise<AlertRule> {
    const response = await fetch(API_ALERTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
            errorData?.error ?? `Failed to create alert rule: ${response.status}`,
        );
    }

    const data: AlertRuleResponse = await response.json();
    return data.data;
}

/**
 * Update an existing alert rule.
 */
export async function updateAlertRule(
    id: string,
    updates: Partial<AlertRule>,
): Promise<AlertRule> {
    const response = await fetch(`${API_ALERTS}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Alert rule not found: ${id}`);
        }
        const errorData = await response.json().catch(() => null);
        throw new Error(
            errorData?.error ?? `Failed to update alert rule: ${response.status}`,
        );
    }

    const data: AlertRuleResponse = await response.json();
    return data.data;
}

/**
 * Delete an alert rule.
 */
export async function deleteAlertRule(id: string): Promise<void> {
    const response = await fetch(`${API_ALERTS}/${id}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Alert rule not found: ${id}`);
        }
        throw new Error(`Failed to delete alert rule: ${response.status}`);
    }
}

// === Fetch functions — Notification History ===

/**
 * Fetch alert notification history.
 */
export async function fetchAlertHistory(limit?: number): Promise<AlertNotification[]> {
    const url = limit
        ? `${API_ALERT_HISTORY}?limit=${limit}`
        : API_ALERT_HISTORY;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch alert history: ${response.status}`);
    }

    const data: AlertHistoryResponse = await response.json();
    return data.data;
}

/**
 * Acknowledge a notification.
 */
export async function acknowledgeAlert(id: string): Promise<AlertNotification> {
    const response = await fetch(`${API_ALERTS}/${id}/acknowledge`, {
        method: "POST",
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Notification not found: ${id}`);
        }
        throw new Error(`Failed to acknowledge notification: ${response.status}`);
    }

    const data: AlertNotificationResponse = await response.json();
    return data.data;
}
