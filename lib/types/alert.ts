/**
 * Alert system types.
 * Rule-based alerting for geopolitical and market threshold conditions.
 */

// ============================================
// Enum / Union Types
// ============================================

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertConditionType = "threshold" | "correlation" | "sentiment" | "proximity" | "count" | "absence";

// ============================================
// Alert Rule
// ============================================

export interface AlertRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: AlertSeverity;
    conditionType: AlertConditionType;
    conditionConfig: AlertCondition;
    regionName?: string;
    regionCenter?: { lat: number; lng: number };
    regionRadiusKm?: number;
    cooldownMinutes: number;
    lastTriggeredAt?: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================
// Condition Configs (discriminated union)
// ============================================

export type AlertCondition =
    | ThresholdCondition
    | CorrelationCondition
    | SentimentCondition
    | ProximityCondition
    | CountCondition
    | AbsenceCondition;

export interface ThresholdCondition {
    type: "threshold";
    dataSource: "conflict" | "gps_jamming" | "market" | "social";
    field: string;
    operator: "gt" | "gte" | "lt" | "lte" | "eq";
    value: number;
}

export interface CorrelationCondition {
    type: "correlation";
    symbol: string;
    changePercentThreshold: number;
    direction: "up" | "down" | "any";
    requireGeoEvent: boolean;
}

export interface SentimentCondition {
    type: "sentiment";
    platform: "x" | "truth_social" | "whitehouse" | "all";
    sentimentThreshold: number; // -1.0 to 1.0
    direction: "below" | "above";
    minPostCount: number;
}

export interface ProximityCondition {
    type: "proximity";
    entityType: "aircraft" | "vessel" | "satellite";
    radiusKm: number;
    minCount: number;
}

export interface CountCondition {
    type: "count";
    dataSource: "conflict" | "gps_jamming" | "social" | "vessel" | "aircraft";
    threshold: number;
    timeWindowMinutes: number;
}

export interface AbsenceCondition {
    type: "absence";
    dataSource: "aircraft" | "vessel" | "satellite";
    expectedMinCount: number;
    absenceMinutes: number;
}

// ============================================
// Alert Notification (triggered alert)
// ============================================

export interface AlertNotification {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    data: Record<string, unknown>;
    acknowledged: boolean;
    acknowledgedAt?: string;
    triggeredAt: string;
}

// ============================================
// Alert Preset (template for creating rules)
// ============================================

export interface AlertPreset {
    name: string;
    description: string;
    severity: AlertSeverity;
    conditionType: AlertConditionType;
    conditionConfig: AlertCondition;
    regionName?: string;
    regionCenter?: { lat: number; lng: number };
    regionRadiusKm?: number;
    cooldownMinutes: number;
}

// ============================================
// Preset Library
// ============================================

export const ALERT_PRESETS: AlertPreset[] = [
    {
        name: "Strait of Hormuz — Critical Conflict",
        description: "Alert when critical-severity conflict events occur near the Strait of Hormuz",
        severity: "critical",
        conditionType: "threshold",
        conditionConfig: { type: "threshold", dataSource: "conflict", field: "severity", operator: "eq", value: 5 },
        regionName: "Strait of Hormuz",
        regionCenter: { lat: 26.5667, lng: 56.25 },
        regionRadiusKm: 200,
        cooldownMinutes: 30,
    },
    {
        name: "GPS Jamming Spike",
        description: "Alert when 3+ GPS jamming zones detected in any region within 1 hour",
        severity: "high",
        conditionType: "count",
        conditionConfig: { type: "count", dataSource: "gps_jamming", threshold: 3, timeWindowMinutes: 60 },
        cooldownMinutes: 60,
    },
    {
        name: "Official Negative Sentiment",
        description: "Alert when White House or official posts show strongly negative sentiment",
        severity: "medium",
        conditionType: "sentiment",
        conditionConfig: { type: "sentiment", platform: "whitehouse", sentimentThreshold: -0.5, direction: "below", minPostCount: 1 },
        cooldownMinutes: 120,
    },
    {
        name: "Oil Market Correlation",
        description: "Alert when oil futures move >3% alongside geopolitical events",
        severity: "high",
        conditionType: "correlation",
        conditionConfig: { type: "correlation", symbol: "CL=F", changePercentThreshold: 3.0, direction: "any", requireGeoEvent: true },
        cooldownMinutes: 60,
    },
    {
        name: "Military Vessel Proximity",
        description: "Alert when 2+ military vessels detected within 50km of watched region",
        severity: "medium",
        conditionType: "proximity",
        conditionConfig: { type: "proximity", entityType: "vessel", radiusKm: 50, minCount: 2 },
        regionName: "Taiwan Strait",
        regionCenter: { lat: 24.0, lng: 119.0 },
        regionRadiusKm: 200,
        cooldownMinutes: 120,
    },
];

// ============================================
// Helper Functions
// ============================================

/** Tailwind-compatible color for alert severity badges */
export function getAlertSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
        case "critical":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "high":
            return "text-orange-400 bg-orange-950/50 border-orange-800";
        case "medium":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "low":
            return "text-blue-400 bg-blue-950/50 border-blue-800";
        case "info":
            return "text-zinc-400 bg-zinc-900/50 border-zinc-700";
    }
}

/** Icon name for alert severity */
export function getAlertSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
        case "critical":
            return "Siren";
        case "high":
            return "AlertTriangle";
        case "medium":
            return "Bell";
        case "low":
            return "BellDot";
        case "info":
            return "Info";
    }
}

/** Human-readable label for condition types */
export function getConditionTypeLabel(type: AlertConditionType): string {
    switch (type) {
        case "threshold":
            return "Threshold";
        case "correlation":
            return "Market Correlation";
        case "sentiment":
            return "Sentiment Analysis";
        case "proximity":
            return "Proximity Detection";
        case "count":
            return "Event Count";
        case "absence":
            return "Absence Detection";
    }
}

/** Format ISO date string to relative or absolute alert timestamp */
export function formatAlertTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
