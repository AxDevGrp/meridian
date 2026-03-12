/**
 * FLASH Alert types for breaking news / high-priority social media intelligence.
 *
 * A FLASH alert fires when incoming social posts meet urgency thresholds —
 * e.g. "President declares war", "bomb detonation reported", "new tariff EO signed".
 * Social media often breaks intel before news/data channels, so FLASH
 * gives the trader a head start.
 */

import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";
import type { MarketSector } from "@/lib/types/market";

// ============================================
// Flash Priority Levels
// ============================================

/**
 * CRITICAL — Immediate kinetic / existential market risk (war, nuclear, coup)
 * URGENT   — Major policy shift with direct market impact (sanctions, tariffs, blockade)
 * BREAKING — Significant development worth immediate attention (exec orders, major tweets)
 */
export type FlashPriority = "critical" | "urgent" | "breaking";

// ============================================
// Flash Alert
// ============================================

export interface FlashAlert {
    /** Unique ID */
    id: string;
    /** Priority level */
    priority: FlashPriority;
    /** One-line headline derived from the post */
    headline: string;
    /** The triggering social post (full data) */
    sourcePost: SocialPost;
    /** Which platform originated this */
    platform: SocialPlatform;
    /** Sectors potentially affected */
    sectors: MarketSector[];
    /** Why this was flagged as a FLASH */
    triggerReason: string;
    /** When the FLASH was created (ISO 8601) */
    createdAt: string;
    /** Whether the user has dismissed this FLASH */
    dismissed: boolean;
    /** Auto-dismiss timestamp (ISO 8601) — null means manual dismiss only */
    expiresAt: string | null;
}

// ============================================
// Flash Detection Config
// ============================================

/**
 * Keywords that, when found in a post, can trigger a FLASH.
 * Grouped by priority level.
 */
export const FLASH_KEYWORDS: Record<FlashPriority, string[]> = {
    critical: [
        // Multi-word phrases — high specificity, minimal false positives
        "declares war",
        "declaration of war",
        "declared war",
        "act of war",
        "nuclear strike",
        "nuclear weapon",
        "nuclear launch",
        "nuclear detonation",
        "missile launch",
        "missile strike",
        "terror attack",
        "terrorist attack",
        "martial law",
        "military invasion",
        "armed invasion",
        // Single words with word-boundary matching (>6 chars = safe)
        "assassination",
        "assassinated",
        "detonation",
        "bombing",
    ],
    urgent: [
        // Policy/economic — these ARE the market movers
        "new tariff",
        "tariff increase",
        "tariffs on",
        "impose tariff",
        "new sanctions",
        "sanctions on",
        "sanctions against",
        "executive order",
        "emergency declaration",
        "national emergency",
        "state of emergency",
        "military deployment",
        "troops deployed",
        "naval blockade",
        "trade war",
        "oil embargo",
        "export ban",
        "import ban",
        "price cap",
        "retaliatory tariff",
        "retaliatory sanction",
        "economic retaliation",
    ],
    breaking: [
        // Journalistic urgency markers (require additional signal to fire)
        "breaking news",
        "just in",
        "developing story",
        "emergency meeting",
        "emergency summit",
        "ceasefire agreement",
        "peace deal",
        "troop withdrawal",
        "unprecedented move",
    ],
};

/**
 * Auto-dismiss durations per priority (milliseconds).
 * CRITICAL stays visible until manually dismissed.
 */
export const FLASH_DURATION: Record<FlashPriority, number | null> = {
    critical: null,       // manual dismiss only
    urgent: 60_000,       // 60 seconds
    breaking: 45_000,     // 45 seconds
};

// ============================================
// Display Helpers
// ============================================

export function getFlashColor(priority: FlashPriority): string {
    switch (priority) {
        case "critical": return "#ef4444";   // red-500
        case "urgent": return "#f59e0b";     // amber-500
        case "breaking": return "#eab308";   // yellow-500
    }
}

export function getFlashLabel(priority: FlashPriority): string {
    switch (priority) {
        case "critical": return "⚠ CRITICAL FLASH";
        case "urgent": return "⚡ URGENT FLASH";
        case "breaking": return "📡 BREAKING";
    }
}

export function getFlashBgClass(priority: FlashPriority): string {
    switch (priority) {
        case "critical": return "bg-red-600/95";
        case "urgent": return "bg-amber-600/95";
        case "breaking": return "bg-yellow-600/90";
    }
}

export function getFlashBorderClass(priority: FlashPriority): string {
    switch (priority) {
        case "critical": return "border-red-400";
        case "urgent": return "border-amber-400";
        case "breaking": return "border-yellow-400";
    }
}
