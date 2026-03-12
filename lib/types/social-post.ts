/**
 * Social media / news post data types
 * Covers X (Twitter), Truth Social, and WhiteHouse announcements
 */

import type { MarketSector } from "@/lib/types/market";

/**
 * Supported social media platforms
 */
export type SocialPlatform = "x" | "truth_social" | "whitehouse";

/**
 * Sentiment analysis labels
 */
export type SentimentLabel = "positive" | "negative" | "neutral" | "aggressive" | "urgent";

/**
 * Policy action type (for WH executive orders, sanctions, etc.)
 */
export type PolicyActionType =
    | "tariff"
    | "sanction"
    | "executive_order"
    | "treaty"
    | "military"
    | "regulation"
    | "trade_deal"
    | "press_briefing"
    | "other";

/**
 * Engagement metrics for a social post
 */
export interface PostEngagement {
    likes: number;
    reposts: number;
    replies: number;
}

/**
 * Social media post from any supported platform
 */
export interface SocialPost {
    /** Unique internal identifier */
    id: string;
    /** Source platform */
    platform: SocialPlatform;
    /** Platform-specific post ID */
    postId: string;
    /** Author / handle */
    author: string;
    /** Post text content */
    content: string;
    /** Canonical URL to the post */
    url: string;
    /** NLP sentiment label (null if not yet analyzed) */
    sentiment: SentimentLabel | null;
    /** Numeric sentiment score from -1.0 (negative) to 1.0 (positive) */
    sentimentScore: number | null;
    /** Engagement metrics */
    engagement: PostEngagement;
    /** Named entities mentioned in the post */
    entitiesMentioned: string[];
    /** Geographic references extracted from the post */
    geoReferences: string[];
    /** Attached media URLs (images/videos) */
    mediaUrls: string[];
    /** Whether the post contains video content */
    hasVideo: boolean;
    /** When the post was originally published (ISO 8601) */
    postedAt: string;
    /** Additional platform-specific metadata */
    metadata: Record<string, unknown>;

    // === NLP Classification Fields (GPT-4o-mini enriched) ===

    /** Market sectors this post is relevant to (GPT-4o-mini classified) */
    sectors: MarketSector[];
    /** Specific ticker symbols mentioned or implied */
    impliedInstruments: string[];
    /** Policy action type — primarily for WH announcements */
    policyType: PolicyActionType | null;
    /** Confidence that this post is market-moving (0.0–1.0) */
    marketRelevance: number;
    /** Whether NLP classification has been applied */
    nlpClassified: boolean;
}

// === Helper Functions ===

/**
 * Get display name for a social platform
 */
export function getPlatformDisplayName(platform: SocialPlatform): string {
    switch (platform) {
        case "x": return "X (Twitter)";
        case "truth_social": return "Truth Social";
        case "whitehouse": return "White House";
    }
}

/**
 * Get brand color for a social platform
 */
export function getPlatformColor(platform: SocialPlatform): string {
    switch (platform) {
        case "x": return "#1da1f2";
        case "truth_social": return "#5448ee";
        case "whitehouse": return "#002868";
    }
}

/**
 * Get icon name (Lucide) for a social platform
 */
export function getPlatformIcon(platform: SocialPlatform): string {
    switch (platform) {
        case "x": return "Twitter";
        case "truth_social": return "MessageCircle";
        case "whitehouse": return "Landmark";
    }
}

/**
 * Get display color for a sentiment label
 */
export function getSentimentColor(sentiment: SentimentLabel | null): string {
    switch (sentiment) {
        case "positive": return "#22c55e";
        case "negative": return "#ef4444";
        case "neutral": return "#94a3b8";
        case "aggressive": return "#f97316";
        case "urgent": return "#eab308";
        default: return "#6b7280";
    }
}

/**
 * Get display label for a sentiment value
 */
export function getSentimentDisplayLabel(sentiment: SentimentLabel | null): string {
    switch (sentiment) {
        case "positive": return "Positive";
        case "negative": return "Negative";
        case "neutral": return "Neutral";
        case "aggressive": return "Aggressive";
        case "urgent": return "Urgent";
        default: return "Unknown";
    }
}

/**
 * Calculate total engagement for a post
 */
export function getTotalEngagement(post: SocialPost): number {
    return post.engagement.likes + post.engagement.reposts + post.engagement.replies;
}

/**
 * Format engagement count for display (e.g. 1234 → "1.2K")
 */
export function formatEngagement(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
}
