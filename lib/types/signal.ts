/**
 * Market Impact Signal types.
 * Scenario playbooks, trigger conditions, causal chains, and market signals.
 */

// ============================================
// Trigger Condition Types
// ============================================

export type TriggerConditionKind =
    | "anomaly_present"     // A specific anomaly kind is active in a region
    | "risk_above"          // Region risk score above threshold
    | "pattern_detected"    // A specific pattern type detected
    | "market_move"         // Instrument moved beyond threshold %
    | "sentiment_shift"     // Social sentiment below threshold
    | "conflict_active"     // Conflict events in region above count
    | "gps_jamming_active"  // GPS jamming zones in region
    | "vessel_deviation";   // Vessel deviations detected in region

export interface TriggerCondition {
    kind: TriggerConditionKind;
    label: string;           // Human-readable: "Ship deviation in Hormuz"
    region?: string;         // Region name from MONITORED_REGIONS
    anomalyKind?: string;    // For anomaly_present
    patternKind?: string;    // For pattern_detected
    symbol?: string;         // For market_move
    threshold?: number;      // For risk_above, market_move, sentiment_shift
    direction?: "above" | "below";
    minCount?: number;       // For conflict_active, gps_jamming_active
}

// ============================================
// Causal Chain Types
// ============================================

export type CausalChainStepStatus = "triggered" | "watching" | "pending";

export interface CausalChainStep {
    order: number;
    event: string;           // "Ship attacked in Strait of Hormuz"
    consequence: string;     // "Shipping lanes narrow, insurance costs spike"
    icon: string;            // "ship" | "flame" | "chart-up" | "shield" | "radio" | "globe" | "alert"
    status: CausalChainStepStatus;
}

// ============================================
// Market Target Types
// ============================================

export type MarketTargetDirection = "up" | "down";
export type MarketTargetMagnitude = "small" | "moderate" | "large";

export interface MarketTarget {
    symbol: string;          // "CL=F"
    name: string;            // "WTI Crude Oil"
    expectedDirection: MarketTargetDirection;
    magnitude: MarketTargetMagnitude;
    reasoning: string;       // "Supply disruption drives spot price"
}

// ============================================
// Playbook Types
// ============================================

export type PlaybookCategory = "energy" | "technology" | "currency" | "safe-haven" | "commodity";

export interface ScenarioPlaybook {
    id: string;
    name: string;                     // "Hormuz Shipping Disruption"
    description: string;              // Brief description
    category: PlaybookCategory;
    triggerConditions: TriggerCondition[];
    confidenceThreshold: number;      // 0-1, minimum to activate (typically 0.5-0.6)
    causalChain: CausalChainStep[];   // 3-5 steps
    marketTargets: MarketTarget[];
    timeHorizon: string;              // "24-72 hours"
    historicalPrecedent?: string;     // "Similar to Jan 2024 Houthi attacks"
}

// ============================================
// Signal Types
// ============================================

export type SignalSeverity = "critical" | "high" | "moderate" | "low";
export type SignalStatus = "active" | "acknowledged" | "resolved" | "expired";

export interface MarketSignal {
    id: string;
    playbookId: string;
    playbookName: string;
    playbookCategory: PlaybookCategory;
    description: string;
    severity: SignalSeverity;
    status: SignalStatus;
    confidence: number;               // 0-1
    triggeredConditions: string[];    // Labels of triggered conditions
    pendingConditions: string[];      // Labels of pending conditions
    causalChain: CausalChainStep[];   // With status updated per condition
    marketTargets: MarketTarget[];
    activatedAt: string;              // ISO 8601
    acknowledgedAt?: string;
    resolvedAt?: string;
    timeHorizon: string;
    historicalPrecedent?: string;
}

// ============================================
// Helper Functions
// ============================================

/** Convert a 0–1 confidence score to a SignalSeverity */
export function confidenceToSeverity(confidence: number): SignalSeverity {
    if (confidence > 0.8) return "critical";
    if (confidence > 0.6) return "high";
    if (confidence > 0.4) return "moderate";
    return "low";
}

/** Tailwind-compatible color classes for signal severity badges */
export function getSignalSeverityColor(severity: SignalSeverity): string {
    switch (severity) {
        case "critical":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "high":
            return "text-orange-400 bg-orange-950/50 border-orange-800";
        case "moderate":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "low":
            return "text-green-400 bg-green-950/50 border-green-800";
    }
}

/** Human-readable label for a playbook category */
export function getPlaybookCategoryLabel(category: PlaybookCategory): string {
    switch (category) {
        case "energy":
            return "Energy";
        case "technology":
            return "Technology";
        case "currency":
            return "Currency / Macro";
        case "safe-haven":
            return "Safe Haven";
        case "commodity":
            return "Commodity";
    }
}

/** Lucide icon name for a playbook category */
export function getPlaybookCategoryIcon(category: PlaybookCategory): string {
    switch (category) {
        case "energy":
            return "Flame";
        case "technology":
            return "Cpu";
        case "currency":
            return "DollarSign";
        case "safe-haven":
            return "Shield";
        case "commodity":
            return "Wheat";
    }
}

/** Tailwind-compatible color classes for signal status badges */
export function getSignalStatusColor(status: SignalStatus): string {
    switch (status) {
        case "active":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "acknowledged":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "resolved":
            return "text-green-400 bg-green-950/50 border-green-800";
        case "expired":
            return "text-zinc-400 bg-zinc-950/50 border-zinc-800";
    }
}
