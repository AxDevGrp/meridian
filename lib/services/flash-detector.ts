/**
 * FLASH Alert Detection Service
 *
 * Scans incoming social posts for FLASH-worthy content.
 * Social media breaks intel before traditional news channels —
 * this detector identifies market-moving posts in real time.
 *
 * Detection factors:
 *   1. Keyword matching against priority-tiered word lists
 *   2. NLP sentiment (aggressive / urgent)
 *   3. Market relevance score (>= 0.7)
 *   4. Platform authority boost (WH announcements flash easier)
 *   5. Engagement velocity (high like/repost counts)
 */

import type { SocialPost } from "@/lib/types/social-post";
import type { FlashAlert, FlashPriority } from "@/lib/types/flash";
import { FLASH_KEYWORDS, FLASH_DURATION } from "@/lib/types/flash";

// ============================================
// Detection Thresholds
// ============================================

/** Minimum marketRelevance score to consider for FLASH */
const MIN_RELEVANCE = 0.5;

/** Platform authority multiplier — WH posts need lower keyword match confidence */
const PLATFORM_BOOST: Record<string, number> = {
    whitehouse: 1.5,
    truth_social: 1.2,
    x: 1.0,
};

/** Engagement thresholds that can independently trigger a FLASH */
const ENGAGEMENT_FLASH_THRESHOLD = 50_000; // 50K total engagement

// ============================================
// Previously-seen post IDs (avoid duplicate flashes)
// ============================================

const seenPostIds = new Set<string>();

/**
 * Scan a batch of social posts and return any that qualify as FLASH alerts.
 * Call this each time new posts arrive from the social feed.
 */
export function detectFlashAlerts(posts: SocialPost[]): FlashAlert[] {
    const alerts: FlashAlert[] = [];

    for (const post of posts) {
        // Skip posts we've already evaluated
        if (seenPostIds.has(post.id)) continue;
        seenPostIds.add(post.id);

        const result = evaluatePost(post);
        if (result) {
            alerts.push(result);
        }
    }

    // Sort: critical first, then urgent, then breaking
    const priorityOrder: Record<FlashPriority, number> = { critical: 0, urgent: 1, breaking: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return alerts;
}

/**
 * Reset the seen-post tracker (useful for testing or session reset)
 */
export function resetFlashDetector(): void {
    seenPostIds.clear();
}

// ============================================
// Core Evaluation
// ============================================

function evaluatePost(post: SocialPost): FlashAlert | null {
    const contentLower = post.content.toLowerCase();
    const boost = PLATFORM_BOOST[post.platform] ?? 1.0;

    // --- Pass 1: Keyword scan (highest priority wins) ---
    // Use word-boundary matching for short keywords to avoid false positives
    // (e.g. "war" matching "Warsh" or "warrant")
    let matchedPriority: FlashPriority | null = null;
    let matchedKeyword = "";

    for (const priority of ["critical", "urgent", "breaking"] as FlashPriority[]) {
        for (const keyword of FLASH_KEYWORDS[priority]) {
            if (matchKeyword(contentLower, keyword.toLowerCase())) {
                matchedPriority = priority;
                matchedKeyword = keyword;
                break;
            }
        }
        if (matchedPriority) break;
    }

    // --- Pass 2: Sentiment-based detection ---
    const isSentimentUrgent = post.sentiment === "aggressive" || post.sentiment === "urgent";

    // --- Pass 3: Market relevance gate ---
    const effectiveRelevance = post.marketRelevance * boost;
    const isHighRelevance = effectiveRelevance >= 0.7;

    // --- Pass 4: Engagement-based flash ---
    const totalEngagement =
        post.engagement.likes + post.engagement.reposts + post.engagement.replies;
    const isViralFlash = totalEngagement >= ENGAGEMENT_FLASH_THRESHOLD;

    // --- Decision Matrix ---
    let finalPriority: FlashPriority | null = null;
    let triggerReason = "";

    if (matchedPriority === "critical") {
        // Critical keywords always flash
        finalPriority = "critical";
        triggerReason = `Critical keyword "${matchedKeyword}" detected`;
    } else if (matchedPriority === "urgent" && (isSentimentUrgent || isHighRelevance)) {
        // Urgent keyword + sentiment/relevance confirmation
        finalPriority = "urgent";
        triggerReason = `Urgent keyword "${matchedKeyword}" + ${isSentimentUrgent ? "aggressive sentiment" : "high market relevance"}`;
    } else if (matchedPriority === "urgent" && post.platform === "whitehouse") {
        // WH announcements with urgent keywords always flash
        finalPriority = "urgent";
        triggerReason = `White House announcement: "${matchedKeyword}"`;
    } else if (isSentimentUrgent && isHighRelevance && !matchedPriority) {
        // No keyword but extreme sentiment + high relevance
        finalPriority = "breaking";
        triggerReason = `${post.sentiment} sentiment with market relevance ${post.marketRelevance.toFixed(2)}`;
    } else if (isViralFlash && (matchedPriority || isSentimentUrgent)) {
        // Viral engagement + any other signal
        finalPriority = matchedPriority ?? "breaking";
        triggerReason = `Viral engagement (${formatCount(totalEngagement)}) + ${matchedKeyword || post.sentiment}`;
    } else if (matchedPriority === "breaking" && isHighRelevance) {
        // Breaking keyword + high relevance
        finalPriority = "breaking";
        triggerReason = `Breaking keyword "${matchedKeyword}" + relevance ${effectiveRelevance.toFixed(2)}`;
    } else if (post.platform === "whitehouse" && post.marketRelevance >= MIN_RELEVANCE) {
        // Any WH post above minimum relevance gets at least a breaking flash
        if (matchedPriority) {
            finalPriority = matchedPriority;
            triggerReason = `White House: "${matchedKeyword}"`;
        }
    }

    if (!finalPriority) return null;

    // Build the FLASH alert
    const now = new Date();
    const duration = FLASH_DURATION[finalPriority];
    const expiresAt = duration ? new Date(now.getTime() + duration).toISOString() : null;

    return {
        id: `flash-${post.id}-${now.getTime()}`,
        priority: finalPriority,
        headline: buildHeadline(post, matchedKeyword),
        sourcePost: post,
        platform: post.platform,
        sectors: post.sectors ?? [],
        triggerReason,
        createdAt: now.toISOString(),
        dismissed: false,
        expiresAt,
    };
}

// ============================================
// Headline Builder
// ============================================

function buildHeadline(post: SocialPost, keyword: string): string {
    const platformPrefix = {
        whitehouse: "WHITE HOUSE",
        truth_social: "TRUTH SOCIAL",
        x: "X/TWITTER",
    }[post.platform];

    // Use first ~120 chars of content, cleaned up
    const content = post.content
        .replace(/https?:\/\/\S+/g, "") // strip URLs
        .replace(/\s+/g, " ")
        .trim();

    const truncated = content.length > 120 ? content.slice(0, 117) + "..." : content;

    return `${platformPrefix}: ${truncated}`;
}

// ============================================
// Utilities
// ============================================

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

/**
 * Word-boundary-aware keyword matching.
 * For short keywords (≤5 chars like "war", "bomb", "coup"), uses regex word
 * boundaries to avoid false positives like "Warsh", "bombastic", "coupons".
 * For longer multi-word phrases, uses simple includes().
 */
function matchKeyword(text: string, keyword: string): boolean {
    // Multi-word phrases: use includes (they're specific enough)
    if (keyword.includes(" ")) {
        return text.includes(keyword);
    }

    // Short single-word keywords: use word boundary regex
    if (keyword.length <= 6) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        return regex.test(text);
    }

    // Longer single words: includes is fine
    return text.includes(keyword);
}
