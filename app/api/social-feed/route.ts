import { NextRequest, NextResponse } from "next/server";
import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";
import { fetchWhiteHouseFeed } from "@/lib/services/whitehouse-rss";
import { classifyPostsWithGPT, classifyWithKeywords } from "@/lib/services/social-nlp";

/**
 * Social Feed API route
 * Aggregates social media posts from multiple live sources + sample data:
 *
 *   1. White House RSS feeds (live — no API key needed)
 *   2. X (Twitter) API v2 — Trump timeline + keyword searches (requires X_BEARER_TOKEN)
 *   3. Sample data fallback for Truth Social (no public API)
 *
 * All posts are enriched with GPT-4o-mini NLP classification (if OPENAI_API_KEY set),
 * otherwise falls back to keyword-based classification.
 *
 * Query params:
 *   platform  — optional filter: "x" | "truth_social" | "whitehouse"
 *   limit     — max posts to return (default 50)
 *   since     — ISO 8601 timestamp to fetch posts after
 */

// Cache for 2 minutes
const CACHE_DURATION = 120;
const VALID_PLATFORMS: SocialPlatform[] = ["x", "truth_social", "whitehouse"];

// In-memory cache to avoid hammering APIs on every request
let cachedPosts: SocialPost[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 120_000; // 2 minutes

// ============================================
// X (Twitter) API v2 Integration
// ============================================

const X_API_BASE = "https://api.x.com/2";
const TRUMP_USER_ID = "25073877"; // @realDonaldTrump
const X_FETCH_TIMEOUT = 15_000;

interface XTweet {
    id: string;
    text: string;
    created_at?: string;
    public_metrics?: {
        retweet_count: number;
        reply_count: number;
        like_count: number;
        quote_count: number;
        impression_count?: number;
    };
    entities?: {
        urls?: Array<{ expanded_url: string }>;
        hashtags?: Array<{ tag: string }>;
        cashtags?: Array<{ tag: string }>;
        mentions?: Array<{ username: string }>;
    };
    context_annotations?: Array<{
        domain: { id: string; name: string };
        entity: { id: string; name: string };
    }>;
}

interface XAPIResponse {
    data?: XTweet[];
    meta?: { result_count: number; newest_id?: string; oldest_id?: string };
    errors?: Array<{ message: string; title: string }>;
}

/**
 * Fetch Trump's recent tweets from X API v2
 */
async function fetchXTrumpTimeline(): Promise<SocialPost[]> {
    const bearerToken = process.env.X_BEARER_TOKEN;
    if (!bearerToken) {
        console.log("[social-feed] No X_BEARER_TOKEN — skipping X API");
        return [];
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), X_FETCH_TIMEOUT);

        // Fetch Trump's recent tweets with expansions
        const fields = "tweet.fields=created_at,public_metrics,entities,context_annotations";
        const url = `${X_API_BASE}/users/${TRUMP_USER_ID}/tweets?${fields}&max_results=10`;

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                "User-Agent": "Meridian/1.0",
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error(`[social-feed] X API error ${response.status}: ${errText}`);
            return [];
        }

        const data: XAPIResponse = await response.json();

        if (data.errors) {
            console.error("[social-feed] X API errors:", data.errors);
            return [];
        }

        if (!data.data || data.data.length === 0) {
            console.log("[social-feed] No tweets returned from X API");
            return [];
        }

        return data.data.map((tweet) => tweetToSocialPost(tweet));
    } catch (err) {
        console.error("[social-feed] X API fetch failed:", err instanceof Error ? err.message : err);
        return [];
    }
}

/**
 * Search X for market-relevant keyword tweets
 */
async function fetchXKeywordSearch(): Promise<SocialPost[]> {
    const bearerToken = process.env.X_BEARER_TOKEN;
    if (!bearerToken) return [];

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), X_FETCH_TIMEOUT);

        // Search for Trump-related market-moving tweets
        const query = encodeURIComponent(
            '(from:realDonaldTrump tariff) OR (from:realDonaldTrump sanction) OR (from:realDonaldTrump "executive order") OR (from:realDonaldTrump China trade) OR (from:realDonaldTrump military)',
        );
        const fields = "tweet.fields=created_at,public_metrics,entities,context_annotations";
        const url = `${X_API_BASE}/tweets/search/recent?query=${query}&${fields}&max_results=10`;

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                "User-Agent": "Meridian/1.0",
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            // Don't log error for search — timeline is the primary source
            return [];
        }

        const data: XAPIResponse = await response.json();
        if (!data.data) return [];

        return data.data.map((tweet) => tweetToSocialPost(tweet));
    } catch {
        return [];
    }
}

/**
 * Convert an X API v2 tweet to our SocialPost format
 */
function tweetToSocialPost(tweet: XTweet): SocialPost {
    const entities: string[] = [];
    const geoRefs: string[] = [];

    // Extract entities from hashtags
    if (tweet.entities?.hashtags) {
        entities.push(...tweet.entities.hashtags.map((h) => h.tag));
    }
    // Extract cashtags
    if (tweet.entities?.cashtags) {
        entities.push(...tweet.entities.cashtags.map((c) => `$${c.tag}`));
    }
    // Extract context annotations as entities
    if (tweet.context_annotations) {
        for (const ann of tweet.context_annotations) {
            if (ann.entity?.name) entities.push(ann.entity.name);
        }
    }

    // Basic geo extraction from text
    const lower = tweet.text.toLowerCase();
    const GEO_MAP: Record<string, string> = {
        china: "China", russia: "Russia", taiwan: "Taiwan",
        europe: "European Union", iran: "Iran", ukraine: "Ukraine",
        "north korea": "North Korea", japan: "Japan", india: "India",
        "south china sea": "South China Sea", "middle east": "Middle East",
    };
    for (const [keyword, region] of Object.entries(GEO_MAP)) {
        if (lower.includes(keyword)) geoRefs.push(region);
    }

    return {
        id: `x-${tweet.id}`,
        platform: "x",
        postId: tweet.id,
        author: "@realDonaldTrump",
        content: tweet.text,
        url: `https://x.com/realDonaldTrump/status/${tweet.id}`,
        sentiment: null, // Will be filled by NLP
        sentimentScore: null,
        engagement: {
            likes: tweet.public_metrics?.like_count ?? 0,
            reposts: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0,
        },
        entitiesMentioned: [...new Set(entities)],
        geoReferences: [...new Set(geoRefs)],
        mediaUrls: [],
        hasVideo: false,
        postedAt: tweet.created_at || new Date().toISOString(),
        metadata: {
            isVerified: true,
            impressions: tweet.public_metrics?.impression_count ?? null,
            source: "x_api_v2",
        },
        // NLP fields — will be enriched
        sectors: [],
        impliedInstruments: tweet.entities?.cashtags?.map((c) => c.tag) ?? [],
        policyType: null,
        marketRelevance: 0,
        nlpClassified: false,
    };
}

// ============================================
// Truth Social Sample Data (no public API)
// ============================================

function getTruthSocialSamplePosts(): SocialPost[] {
    const now = new Date();

    return [
        {
            id: "social-ts-001",
            platform: "truth_social" as const,
            postId: "ts-109876543210",
            author: "@realDonaldTrump",
            content:
                "The European Union has been ripping off the United States for DECADES on trade. They put massive tariffs on our farmers and manufacturers, but expect FREE ACCESS to our markets. NOT ANYMORE! Fair Trade means RECIPROCAL Trade. Big announcement coming soon on EU tariffs!",
            url: "https://truthsocial.com/@realDonaldTrump/ts-109876543210",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 89_000, reposts: 31_000, replies: 14_000 },
            entitiesMentioned: ["European Union", "tariffs", "farmers", "trade"],
            geoReferences: ["European Union", "Brussels"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 95 * 60_000).toISOString(),
            metadata: { isVerified: true, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-ts-002",
            platform: "truth_social" as const,
            postId: "ts-109876543211",
            author: "@realDonaldTrump",
            content:
                "The Fake News media won't tell you this, but our economy is BOOMING! Stock market at record highs, unemployment at historic lows, and manufacturing is BACK in America. MAGA! 🇺🇸",
            url: "https://truthsocial.com/@realDonaldTrump/ts-109876543211",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 134_000, reposts: 42_000, replies: 18_000 },
            entitiesMentioned: ["economy", "stock market", "unemployment", "manufacturing"],
            geoReferences: ["United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 210 * 60_000).toISOString(),
            metadata: { isVerified: true, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-ts-003",
            platform: "truth_social" as const,
            postId: "ts-109876543212",
            author: "@realDonaldTrump",
            content:
                "Just spoke with President Zelensky of Ukraine. We are working on a GREAT deal that will bring PEACE and end the bloodshed. Russia needs to come to the table. The United States will broker the best deal the world has ever seen! 🇺🇸🇺🇦",
            url: "https://truthsocial.com/@realDonaldTrump/ts-109876543212",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 178_000, reposts: 56_000, replies: 32_000 },
            entitiesMentioned: ["Zelensky", "Ukraine", "Russia", "peace deal"],
            geoReferences: ["Ukraine", "Russia"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 320 * 60_000).toISOString(),
            metadata: { isVerified: true, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
    ];
}

// ============================================
// Fallback Sample Posts (used when no APIs available)
// ============================================

function getFullSamplePosts(): SocialPost[] {
    const now = new Date();

    return [
        {
            id: "social-wh-001",
            platform: "whitehouse" as const,
            postId: "eo-2026-0311-tariffs",
            author: "White House",
            content:
                "Executive Order on Adjusting Imports of Steel into the United States: The President has signed an executive order imposing a 25% tariff on all steel imports effective immediately, citing national security concerns under Section 232.",
            url: "https://www.whitehouse.gov/presidential-actions/executive-order-adjusting-imports-steel/",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["steel", "tariffs", "Section 232", "national security"],
            geoReferences: ["United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
            metadata: { documentType: "executive_order", category: "trade", source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: "tariff",
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-x-001",
            platform: "x" as const,
            postId: "1900000000000000001",
            author: "@realDonaldTrump",
            content:
                "Just signed a MASSIVE Executive Order on Steel Tariffs — 25%! Our steel workers have been treated VERY unfairly by China and others. This will bring JOBS and STRENGTH back to American steel. No more dumping! 🇺🇸🏭",
            url: "https://x.com/realDonaldTrump/status/1900000000000000001",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 245_000, reposts: 62_000, replies: 38_000 },
            entitiesMentioned: ["China", "steel", "tariffs", "American steel workers"],
            geoReferences: ["China", "United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 38 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 12_500_000, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-wh-002",
            platform: "whitehouse" as const,
            postId: "press-briefing-2026-0311",
            author: "White House Press Secretary",
            content:
                "Press Briefing: The Administration reaffirms its commitment to NATO while calling on European allies to increase defense spending to 3% of GDP. The President will meet with NATO Secretary General next week to discuss alliance readiness and burden sharing.",
            url: "https://www.whitehouse.gov/briefing-room/press-briefings/2026/03/11/",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["NATO", "defense spending", "European allies", "GDP"],
            geoReferences: ["Brussels", "Washington D.C."],
            mediaUrls: ["https://www.whitehouse.gov/wp-content/uploads/2026/03/briefing-room.mp4"],
            hasVideo: true,
            postedAt: new Date(now.getTime() - 120 * 60_000).toISOString(),
            metadata: { documentType: "press_briefing", category: "defense", source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: "press_briefing",
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-x-002",
            platform: "x" as const,
            postId: "1900000000000000002",
            author: "@realDonaldTrump",
            content:
                "Great meeting with President Xi of China. We discussed trade, fentanyl, and Taiwan. China has agreed to purchase $50B in American agricultural products. A WIN for our incredible farmers! Relationship with China is VERY GOOD. 🇺🇸🇨🇳",
            url: "https://x.com/realDonaldTrump/status/1900000000000000002",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 312_000, reposts: 78_000, replies: 52_000 },
            entitiesMentioned: ["China", "Xi Jinping", "trade", "fentanyl", "Taiwan", "agriculture"],
            geoReferences: ["China", "Beijing", "Taiwan"],
            mediaUrls: ["https://pbs.twimg.com/media/sample-xi-meeting.jpg"],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 150 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 18_200_000, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-x-003",
            platform: "x" as const,
            postId: "1900000000000000003",
            author: "@realDonaldTrump",
            content:
                "BREAKING: I have directed the Department of Defense to deploy additional naval assets to the South China Sea to ensure freedom of navigation. The United States will ALWAYS protect international shipping lanes. Our Navy is the STRONGEST in the world! 🚢💪",
            url: "https://x.com/realDonaldTrump/status/1900000000000000003",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 198_000, reposts: 54_000, replies: 41_000 },
            entitiesMentioned: ["Department of Defense", "South China Sea", "Navy", "freedom of navigation"],
            geoReferences: ["South China Sea", "Pacific Ocean"],
            mediaUrls: ["https://pbs.twimg.com/media/sample-navy-deployment.mp4"],
            hasVideo: true,
            postedAt: new Date(now.getTime() - 180 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 15_800_000, source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: null,
            marketRelevance: 0,
            nlpClassified: false,
        },
        {
            id: "social-wh-003",
            platform: "whitehouse" as const,
            postId: "fact-sheet-2026-0311-energy",
            author: "White House",
            content:
                "FACT SHEET: President Signs Executive Order to Expand Domestic Energy Production. The order opens federal lands for oil and gas leasing, streamlines permitting for LNG export terminals, and directs agencies to expedite critical mineral extraction for national security purposes.",
            url: "https://www.whitehouse.gov/briefing-room/statements-releases/2026/03/11/fact-sheet-energy/",
            sentiment: null,
            sentimentScore: null,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["energy", "oil", "gas", "LNG", "critical minerals", "federal lands"],
            geoReferences: ["United States", "Gulf of Mexico", "Alaska"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 240 * 60_000).toISOString(),
            metadata: { documentType: "fact_sheet", category: "energy", source: "sample" },
            sectors: [],
            impliedInstruments: [],
            policyType: "executive_order",
            marketRelevance: 0,
            nlpClassified: false,
        },
    ];
}

// ============================================
// Main API Handler
// ============================================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const platformParam = searchParams.get("platform");
        const limitParam = searchParams.get("limit");
        const sinceParam = searchParams.get("since");

        // Validate platform filter
        const platform = platformParam && VALID_PLATFORMS.includes(platformParam as SocialPlatform)
            ? (platformParam as SocialPlatform)
            : null;

        const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

        // Check cache
        const now = Date.now();
        const cacheExpired = now - lastFetchTime > CACHE_TTL;

        if (cacheExpired || cachedPosts.length === 0) {
            // Fetch from all sources in parallel
            const [whResult, xTimeline, xSearch] = await Promise.allSettled([
                fetchWhiteHouseFeed(),
                fetchXTrumpTimeline(),
                fetchXKeywordSearch(),
            ]);

            const allPosts: SocialPost[] = [];
            let hasLiveData = false;

            // White House RSS
            if (whResult.status === "fulfilled" && whResult.value.posts.length > 0) {
                allPosts.push(...whResult.value.posts);
                hasLiveData = true;
                if (whResult.value.errors.length > 0) {
                    console.warn("[social-feed] WH RSS warnings:", whResult.value.errors);
                }
            }

            // X API — Trump timeline
            if (xTimeline.status === "fulfilled" && xTimeline.value.length > 0) {
                allPosts.push(...xTimeline.value);
                hasLiveData = true;
            }

            // X API — keyword search (deduplicate against timeline)
            if (xSearch.status === "fulfilled" && xSearch.value.length > 0) {
                const existingIds = new Set(allPosts.map((p) => p.postId));
                const newSearchPosts = xSearch.value.filter((p) => !existingIds.has(p.postId));
                allPosts.push(...newSearchPosts);
                if (newSearchPosts.length > 0) hasLiveData = true;
            }

            // Truth Social — always sample (no public API)
            allPosts.push(...getTruthSocialSamplePosts());

            // If no live WH data, add sample WH + X posts
            if (!hasLiveData) {
                allPosts.push(...getFullSamplePosts());
            }

            // Deduplicate by ID
            const seen = new Set<string>();
            const deduplicated = allPosts.filter((p) => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            // NLP classification (GPT-4o-mini if available, keyword fallback otherwise)
            const unclassified = deduplicated.filter((p) => !p.nlpClassified);
            const alreadyClassified = deduplicated.filter((p) => p.nlpClassified);

            let classified: SocialPost[];
            if (unclassified.length > 0) {
                classified = await classifyPostsWithGPT(unclassified);
            } else {
                classified = [];
            }

            cachedPosts = [...classified, ...alreadyClassified].sort(
                (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
            );
            lastFetchTime = now;

            console.log(
                `[social-feed] Fetched ${cachedPosts.length} posts ` +
                `(WH: ${whResult.status === "fulfilled" ? whResult.value.posts.length : 0}, ` +
                `X: ${(xTimeline.status === "fulfilled" ? xTimeline.value.length : 0) + (xSearch.status === "fulfilled" ? xSearch.value.length : 0)}, ` +
                `TS: ${getTruthSocialSamplePosts().length} sample, ` +
                `Live: ${hasLiveData})`,
            );
        }

        // Apply filters
        let posts = [...cachedPosts];

        if (platform) {
            posts = posts.filter((p) => p.platform === platform);
        }

        if (sinceParam) {
            const sinceDate = new Date(sinceParam);
            if (!isNaN(sinceDate.getTime())) {
                posts = posts.filter((p) => new Date(p.postedAt) > sinceDate);
            }
        }

        posts = posts.slice(0, limit);

        const isSampleData = posts.every((p) => p.metadata?.source === "sample");

        return NextResponse.json(
            {
                posts,
                isSampleData,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: isSampleData ? "sample" : "live",
                    count: posts.length,
                    platforms: {
                        whitehouse: posts.filter((p) => p.platform === "whitehouse").length,
                        x: posts.filter((p) => p.platform === "x").length,
                        truth_social: posts.filter((p) => p.platform === "truth_social").length,
                    },
                    nlpClassified: posts.filter((p) => p.nlpClassified).length,
                },
            },
            {
                headers: {
                    "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`,
                },
            },
        );
    } catch (error) {
        console.error("Social feed API error:", error);

        // Emergency fallback — keyword-classify sample posts
        const fallback = getFullSamplePosts().map(classifyWithKeywords);

        return NextResponse.json(
            {
                posts: fallback,
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: "error_fallback",
                    count: fallback.length,
                },
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 200 }, // Return 200 with fallback data, not 500
        );
    }
}
