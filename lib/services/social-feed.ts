import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";

/**
 * Social feed data service
 * Fetches social media posts and government announcements from our API
 */

const API_BASE = "/api/social-feed";

/**
 * Polling intervals for social feed
 */
export const SOCIAL_FEED_POLLING = {
    /** Standard polling interval (2 minutes) */
    STANDARD: 120_000,
    /** Fast polling for breaking news mode (30 seconds) */
    FAST: 30_000,
} as const;

/**
 * Social feed API response shape
 */
interface SocialFeedAPIResponse {
    posts: SocialPost[];
    isSampleData: boolean;
    metadata: {
        timestamp: string;
        source: string;
        count: number;
    };
    error?: string;
}

/**
 * Fetch social feed posts
 */
export async function fetchSocialFeed(params?: {
    platform?: SocialPlatform;
    limit?: number;
    since?: string;
}): Promise<{ posts: SocialPost[]; isSampleData: boolean }> {
    const searchParams = new URLSearchParams();

    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.since) searchParams.set("since", params.since);

    const url = searchParams.toString() ? `${API_BASE}?${searchParams}` : API_BASE;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Social feed fetch failed: ${response.status}`);
    }

    const data: SocialFeedAPIResponse = await response.json();
    return {
        posts: data.posts,
        isSampleData: data.isSampleData,
    };
}
