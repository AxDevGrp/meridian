/**
 * Client-side alert rule evaluation engine.
 * Checks current data snapshots against alert rules and generates notifications.
 */

import type {
    AlertRule,
    AlertNotification,
    AlertCondition,
    ThresholdCondition,
    CorrelationCondition,
    SentimentCondition,
    ProximityCondition,
    CountCondition,
} from "@/lib/types/alert";
import { haversineKm } from "@/lib/correlation-engine";

// ============================================
// Data Snapshot — all data needed for evaluation
// ============================================

export interface AlertDataSnapshot {
    conflicts: Record<string, unknown>[];
    gpsJamming: Record<string, unknown>[];
    vessels: Record<string, unknown>[];
    aircraft: Record<string, unknown>[];
    socialPosts: Record<string, unknown>[];
    marketInstruments: Record<string, unknown>[];
    correlations: Record<string, unknown>[];
}

// ============================================
// Evaluation Result
// ============================================

interface EvaluationResult {
    triggered: boolean;
    notification?: AlertNotification;
}

// ============================================
// Severity numeric mapping for threshold comparisons
// ============================================

const SEVERITY_NUMERIC: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
};

// ============================================
// Main Entry Point
// ============================================

/**
 * Evaluate all enabled alert rules against the current data snapshot.
 * Returns an array of triggered AlertNotification objects.
 */
export function evaluateAlertRules(
    rules: AlertRule[],
    data: AlertDataSnapshot,
): AlertNotification[] {
    const now = Date.now();
    const notifications: AlertNotification[] = [];

    for (const rule of rules) {
        // Skip disabled rules
        if (!rule.enabled) continue;

        // Skip rules in cooldown
        if (rule.lastTriggeredAt) {
            const lastTriggered = new Date(rule.lastTriggeredAt).getTime();
            const cooldownMs = rule.cooldownMinutes * 60_000;
            if (lastTriggered + cooldownMs > now) continue;
        }

        // Evaluate based on condition type
        const condition = rule.conditionConfig;
        let result: EvaluationResult = { triggered: false };

        switch (condition.type) {
            case "threshold":
                result = evaluateThreshold(rule, condition, data);
                break;
            case "correlation":
                result = evaluateCorrelation(rule, condition, data);
                break;
            case "sentiment":
                result = evaluateSentiment(rule, condition, data);
                break;
            case "proximity":
                result = evaluateProximity(rule, condition, data);
                break;
            case "count":
                result = evaluateCount(rule, condition, data);
                break;
            // absence type not yet implemented
        }

        if (result.triggered && result.notification) {
            notifications.push(result.notification);
        }
    }

    return notifications;
}

// ============================================
// Threshold Evaluator
// ============================================

function evaluateThreshold(
    rule: AlertRule,
    condition: ThresholdCondition,
    data: AlertDataSnapshot,
): EvaluationResult {
    // Select data source
    let items = getDataSource(condition.dataSource, data);
    if (items.length === 0) return { triggered: false };

    // Filter by region if rule has regionCenter
    if (rule.regionCenter && rule.regionRadiusKm) {
        items = filterByProximity(items, rule.regionCenter, rule.regionRadiusKm);
    }

    // Check field against threshold
    const matchingItems: Record<string, unknown>[] = [];

    for (const item of items) {
        let fieldValue: number;

        // Special handling for severity field — map string to numeric
        if (condition.field === "severity") {
            const rawSeverity = String(getNestedField(item, condition.field) ?? "").toLowerCase();
            fieldValue = SEVERITY_NUMERIC[rawSeverity] ?? 0;
        } else {
            const raw = getNestedField(item, condition.field);
            fieldValue = typeof raw === "number" ? raw : parseFloat(String(raw));
            if (isNaN(fieldValue)) continue;
        }

        if (compareValues(fieldValue, condition.operator, condition.value)) {
            matchingItems.push(item);
        }
    }

    if (matchingItems.length === 0) return { triggered: false };

    return {
        triggered: true,
        notification: createNotification(
            rule,
            `${rule.name} — Threshold Alert`,
            `${matchingItems.length} item(s) matched ${condition.field} ${condition.operator} ${condition.value} in ${condition.dataSource} data${rule.regionName ? ` near ${rule.regionName}` : ""}.`,
            { matchingItems: matchingItems.slice(0, 5) },
        ),
    };
}

// ============================================
// Correlation Evaluator
// ============================================

function evaluateCorrelation(
    rule: AlertRule,
    condition: CorrelationCondition,
    data: AlertDataSnapshot,
): EvaluationResult {
    // Find instrument by symbol
    const instrument = data.marketInstruments.find(
        (i) => String(i.symbol) === condition.symbol,
    );
    if (!instrument) return { triggered: false };

    const changePercent = Number(instrument.changePercent ?? 0);
    const absChange = Math.abs(changePercent);

    // Check if change exceeds threshold
    if (absChange < condition.changePercentThreshold) return { triggered: false };

    // Check direction
    if (condition.direction === "up" && changePercent <= 0) return { triggered: false };
    if (condition.direction === "down" && changePercent >= 0) return { triggered: false };

    // If requireGeoEvent, check for any conflicts or GPS jamming
    if (condition.requireGeoEvent) {
        const hasGeoEvent = data.conflicts.length > 0 || data.gpsJamming.length > 0;
        if (!hasGeoEvent) return { triggered: false };
    }

    const dirLabel = changePercent > 0 ? "up" : "down";

    return {
        triggered: true,
        notification: createNotification(
            rule,
            `${rule.name} — Market Correlation`,
            `${condition.symbol} is ${dirLabel} ${absChange.toFixed(2)}% (threshold: ${condition.changePercentThreshold}%)${condition.requireGeoEvent ? " with active geopolitical events" : ""}.`,
            { matchingItems: [instrument] },
        ),
    };
}

// ============================================
// Sentiment Evaluator
// ============================================

function evaluateSentiment(
    rule: AlertRule,
    condition: SentimentCondition,
    data: AlertDataSnapshot,
): EvaluationResult {
    let posts = data.socialPosts;

    // Filter by platform if specified
    if (condition.platform !== "all") {
        posts = posts.filter((p) => String(p.platform) === condition.platform);
    }

    // Check minimum post count
    if (posts.length < condition.minPostCount) return { triggered: false };

    // Calculate average sentiment
    const sentiments = posts
        .map((p) => Number(p.sentiment ?? p.sentimentScore ?? 0))
        .filter((s) => !isNaN(s));

    if (sentiments.length === 0) return { triggered: false };

    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

    // Check direction
    const triggered =
        condition.direction === "below"
            ? avgSentiment < condition.sentimentThreshold
            : avgSentiment > condition.sentimentThreshold;

    if (!triggered) return { triggered: false };

    return {
        triggered: true,
        notification: createNotification(
            rule,
            `${rule.name} — Sentiment Alert`,
            `Average sentiment is ${avgSentiment.toFixed(2)} (${condition.direction} ${condition.sentimentThreshold}) across ${sentiments.length} ${condition.platform === "all" ? "" : condition.platform + " "}posts.`,
            { matchingItems: posts.slice(0, 5), avgSentiment },
        ),
    };
}

// ============================================
// Proximity Evaluator
// ============================================

function evaluateProximity(
    rule: AlertRule,
    condition: ProximityCondition,
    data: AlertDataSnapshot,
): EvaluationResult {
    // Must have a region center for proximity check
    if (!rule.regionCenter) return { triggered: false };

    // Get entities by type
    let entities: Record<string, unknown>[];
    switch (condition.entityType) {
        case "aircraft":
            entities = data.aircraft;
            break;
        case "vessel":
            entities = data.vessels;
            break;
        case "satellite":
            entities = []; // satellites not in snapshot
            break;
        default:
            return { triggered: false };
    }

    // Count entities within radius
    const nearby = filterByProximity(entities, rule.regionCenter, condition.radiusKm);

    if (nearby.length < condition.minCount) return { triggered: false };

    return {
        triggered: true,
        notification: createNotification(
            rule,
            `${rule.name} — Proximity Alert`,
            `${nearby.length} ${condition.entityType}(s) detected within ${condition.radiusKm}km of ${rule.regionName ?? "monitored region"} (threshold: ${condition.minCount}).`,
            { matchingItems: nearby.slice(0, 10) },
        ),
    };
}

// ============================================
// Count Evaluator
// ============================================

function evaluateCount(
    rule: AlertRule,
    condition: CountCondition,
    data: AlertDataSnapshot,
): EvaluationResult {
    let items = getDataSource(condition.dataSource, data);

    // Filter by region if rule has regionCenter
    if (rule.regionCenter && rule.regionRadiusKm) {
        items = filterByProximity(items, rule.regionCenter, rule.regionRadiusKm);
    }

    // Filter by time window if available
    if (condition.timeWindowMinutes > 0) {
        const cutoff = Date.now() - condition.timeWindowMinutes * 60_000;
        items = items.filter((item) => {
            const ts = getTimestamp(item);
            return ts ? ts >= cutoff : true; // include items without timestamps
        });
    }

    if (items.length < condition.threshold) return { triggered: false };

    return {
        triggered: true,
        notification: createNotification(
            rule,
            `${rule.name} — Count Alert`,
            `${items.length} ${condition.dataSource} event(s) detected${rule.regionName ? ` near ${rule.regionName}` : ""}${condition.timeWindowMinutes ? ` within ${condition.timeWindowMinutes} minutes` : ""} (threshold: ${condition.threshold}).`,
            { matchingItems: items.slice(0, 10), count: items.length },
        ),
    };
}

// ============================================
// Helper Functions
// ============================================

/** Get the appropriate data array for a data source identifier */
function getDataSource(
    source: string,
    data: AlertDataSnapshot,
): Record<string, unknown>[] {
    switch (source) {
        case "conflict":
            return data.conflicts;
        case "gps_jamming":
            return data.gpsJamming;
        case "market":
            return data.marketInstruments;
        case "social":
            return data.socialPosts;
        case "vessel":
            return data.vessels;
        case "aircraft":
            return data.aircraft;
        default:
            return [];
    }
}

/** Filter items by geographic proximity to a center point */
function filterByProximity(
    items: Record<string, unknown>[],
    center: { lat: number; lng: number },
    radiusKm: number,
): Record<string, unknown>[] {
    return items.filter((item) => {
        const coords = extractCoordinates(item);
        if (!coords) return false;
        const dist = haversineKm(center.lat, center.lng, coords.lat, coords.lng);
        return dist <= radiusKm;
    });
}

/** Extract lat/lng from an item using common field patterns */
function extractCoordinates(
    item: Record<string, unknown>,
): { lat: number; lng: number } | null {
    // Direct lat/lng fields
    if (typeof item.latitude === "number" && typeof item.longitude === "number") {
        return { lat: item.latitude, lng: item.longitude };
    }
    if (typeof item.lat === "number" && typeof item.lng === "number") {
        return { lat: item.lat, lng: item.lng };
    }
    if (typeof item.lat === "number" && typeof item.lon === "number") {
        return { lat: item.lat, lng: item.lon as number };
    }

    // Nested location object
    const loc = item.location as Record<string, unknown> | undefined;
    if (loc) {
        if (typeof loc.lat === "number" && typeof loc.lng === "number") {
            return { lat: loc.lat, lng: loc.lng };
        }
        if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
            return { lat: loc.latitude, lng: loc.longitude };
        }
    }

    // Center field (gps jamming zones)
    const center = item.center as Record<string, unknown> | undefined;
    if (center && typeof center.lat === "number" && typeof center.lng === "number") {
        return { lat: center.lat, lng: center.lng };
    }

    return null;
}

/** Get a nested field value from an object using dot notation */
function getNestedField(item: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = item;
    for (const key of keys) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/** Compare two values using an operator string */
function compareValues(actual: number, operator: string, threshold: number): boolean {
    switch (operator) {
        case "gt":
            return actual > threshold;
        case "gte":
            return actual >= threshold;
        case "lt":
            return actual < threshold;
        case "lte":
            return actual <= threshold;
        case "eq":
            return actual === threshold;
        default:
            return false;
    }
}

/** Extract timestamp from an item and return as epoch ms */
function getTimestamp(item: Record<string, unknown>): number | null {
    const candidates = [
        "timestamp",
        "date",
        "createdAt",
        "postedAt",
        "firstDetected",
        "eventDate",
        "lastSeen",
    ];
    for (const key of candidates) {
        const val = item[key];
        if (typeof val === "string") {
            const ts = new Date(val).getTime();
            if (!isNaN(ts)) return ts;
        }
        if (typeof val === "number") return val;
    }
    return null;
}

/** Create an AlertNotification from rule + details */
function createNotification(
    rule: AlertRule,
    title: string,
    message: string,
    data: Record<string, unknown>,
): AlertNotification {
    return {
        id: crypto.randomUUID(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        title,
        message,
        data,
        acknowledged: false,
        triggeredAt: new Date().toISOString(),
    };
}
