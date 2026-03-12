import { NextRequest, NextResponse } from "next/server";
import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";

/**
 * Social Feed API route
 * Returns social media posts and government announcements
 *
 * Query params:
 *   platform  — optional filter: "x" | "truth_social" | "whitehouse"
 *   limit     — max posts to return (default 50)
 *   since     — ISO 8601 timestamp to fetch posts after
 *
 * Currently returns sample data; will proxy to Python pipeline once connected.
 */

// Cache for 2 minutes
const CACHE_DURATION = 120;

/**
 * Generate sample social feed data for development
 */
function getSamplePosts(): SocialPost[] {
    const now = new Date();

    return [
        {
            id: "social-wh-001",
            platform: "whitehouse",
            postId: "eo-2026-0311-tariffs",
            author: "White House",
            content:
                "Executive Order on Adjusting Imports of Steel into the United States: The President has signed an executive order imposing a 25% tariff on all steel imports effective immediately, citing national security concerns under Section 232.",
            url: "https://www.whitehouse.gov/presidential-actions/executive-order-adjusting-imports-steel/",
            sentiment: "aggressive",
            sentimentScore: -0.6,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["steel", "tariffs", "Section 232", "national security"],
            geoReferences: ["United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
            metadata: { documentType: "executive_order", category: "trade" },
        },
        {
            id: "social-x-001",
            platform: "x",
            postId: "1900000000000000001",
            author: "@realDonaldTrump",
            content:
                "Just signed a MASSIVE Executive Order on Steel Tariffs — 25%! Our steel workers have been treated VERY unfairly by China and others. This will bring JOBS and STRENGTH back to American steel. No more dumping! 🇺🇸🏭",
            url: "https://x.com/realDonaldTrump/status/1900000000000000001",
            sentiment: "aggressive",
            sentimentScore: -0.4,
            engagement: { likes: 245_000, reposts: 62_000, replies: 38_000 },
            entitiesMentioned: ["China", "steel", "tariffs", "American steel workers"],
            geoReferences: ["China", "United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 38 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 12_500_000 },
        },
        {
            id: "social-ts-001",
            platform: "truth_social",
            postId: "ts-109876543210",
            author: "@realDonaldTrump",
            content:
                "The European Union has been ripping off the United States for DECADES on trade. They put massive tariffs on our farmers and manufacturers, but expect FREE ACCESS to our markets. NOT ANYMORE! Fair Trade means RECIPROCAL Trade. Big announcement coming soon on EU tariffs!",
            url: "https://truthsocial.com/@realDonaldTrump/ts-109876543210",
            sentiment: "aggressive",
            sentimentScore: -0.5,
            engagement: { likes: 89_000, reposts: 31_000, replies: 14_000 },
            entitiesMentioned: ["European Union", "tariffs", "farmers", "trade"],
            geoReferences: ["European Union", "Brussels"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 95 * 60_000).toISOString(),
            metadata: { isVerified: true },
        },
        {
            id: "social-wh-002",
            platform: "whitehouse",
            postId: "press-briefing-2026-0311",
            author: "White House Press Secretary",
            content:
                "Press Briefing: The Administration reaffirms its commitment to NATO while calling on European allies to increase defense spending to 3% of GDP. The President will meet with NATO Secretary General next week to discuss alliance readiness and burden sharing.",
            url: "https://www.whitehouse.gov/briefing-room/press-briefings/2026/03/11/",
            sentiment: "neutral",
            sentimentScore: 0.1,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["NATO", "defense spending", "European allies", "GDP"],
            geoReferences: ["Brussels", "Washington D.C."],
            mediaUrls: ["https://www.whitehouse.gov/wp-content/uploads/2026/03/briefing-room.mp4"],
            hasVideo: true,
            postedAt: new Date(now.getTime() - 120 * 60_000).toISOString(),
            metadata: { documentType: "press_briefing", category: "defense" },
        },
        {
            id: "social-x-002",
            platform: "x",
            postId: "1900000000000000002",
            author: "@realDonaldTrump",
            content:
                "Great meeting with President Xi of China. We discussed trade, fentanyl, and Taiwan. China has agreed to purchase $50B in American agricultural products. A WIN for our incredible farmers! Relationship with China is VERY GOOD. 🇺🇸🇨🇳",
            url: "https://x.com/realDonaldTrump/status/1900000000000000002",
            sentiment: "positive",
            sentimentScore: 0.7,
            engagement: { likes: 312_000, reposts: 78_000, replies: 52_000 },
            entitiesMentioned: ["China", "Xi Jinping", "trade", "fentanyl", "Taiwan", "agriculture"],
            geoReferences: ["China", "Beijing", "Taiwan"],
            mediaUrls: ["https://pbs.twimg.com/media/sample-xi-meeting.jpg"],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 150 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 18_200_000 },
        },
        {
            id: "social-x-003",
            platform: "x",
            postId: "1900000000000000003",
            author: "@realDonaldTrump",
            content:
                "BREAKING: I have directed the Department of Defense to deploy additional naval assets to the South China Sea to ensure freedom of navigation. The United States will ALWAYS protect international shipping lanes. Our Navy is the STRONGEST in the world! 🚢💪",
            url: "https://x.com/realDonaldTrump/status/1900000000000000003",
            sentiment: "urgent",
            sentimentScore: -0.2,
            engagement: { likes: 198_000, reposts: 54_000, replies: 41_000 },
            entitiesMentioned: ["Department of Defense", "South China Sea", "Navy", "freedom of navigation"],
            geoReferences: ["South China Sea", "Pacific Ocean"],
            mediaUrls: ["https://pbs.twimg.com/media/sample-navy-deployment.mp4"],
            hasVideo: true,
            postedAt: new Date(now.getTime() - 180 * 60_000).toISOString(),
            metadata: { isVerified: true, impressions: 15_800_000 },
        },
        {
            id: "social-ts-002",
            platform: "truth_social",
            postId: "ts-109876543211",
            author: "@realDonaldTrump",
            content:
                "The Fake News media won't tell you this, but our economy is BOOMING! Stock market at record highs, unemployment at historic lows, and manufacturing is BACK in America. MAGA! 🇺🇸",
            url: "https://truthsocial.com/@realDonaldTrump/ts-109876543211",
            sentiment: "positive",
            sentimentScore: 0.8,
            engagement: { likes: 134_000, reposts: 42_000, replies: 18_000 },
            entitiesMentioned: ["economy", "stock market", "unemployment", "manufacturing"],
            geoReferences: ["United States"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 210 * 60_000).toISOString(),
            metadata: { isVerified: true },
        },
        {
            id: "social-wh-003",
            platform: "whitehouse",
            postId: "fact-sheet-2026-0311-energy",
            author: "White House",
            content:
                "FACT SHEET: President Signs Executive Order to Expand Domestic Energy Production. The order opens federal lands for oil and gas leasing, streamlines permitting for LNG export terminals, and directs agencies to expedite critical mineral extraction for national security purposes.",
            url: "https://www.whitehouse.gov/briefing-room/statements-releases/2026/03/11/fact-sheet-energy/",
            sentiment: "neutral",
            sentimentScore: 0.2,
            engagement: { likes: 0, reposts: 0, replies: 0 },
            entitiesMentioned: ["energy", "oil", "gas", "LNG", "critical minerals", "federal lands"],
            geoReferences: ["United States", "Gulf of Mexico", "Alaska"],
            mediaUrls: [],
            hasVideo: false,
            postedAt: new Date(now.getTime() - 240 * 60_000).toISOString(),
            metadata: { documentType: "fact_sheet", category: "energy" },
        },
    ];
}

const VALID_PLATFORMS: SocialPlatform[] = ["x", "truth_social", "whitehouse"];

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

        // Get sample posts
        let posts = getSamplePosts();

        // Filter by platform
        if (platform) {
            posts = posts.filter((p) => p.platform === platform);
        }

        // Filter by since timestamp
        if (sinceParam) {
            const sinceDate = new Date(sinceParam);
            if (!isNaN(sinceDate.getTime())) {
                posts = posts.filter((p) => new Date(p.postedAt) > sinceDate);
            }
        }

        // Apply limit
        posts = posts.slice(0, limit);

        return NextResponse.json(
            {
                posts,
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: "sample",
                    count: posts.length,
                },
            },
            {
                headers: {
                    "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`,
                },
            }
        );
    } catch (error) {
        console.error("Social feed API error:", error);
        return NextResponse.json(
            {
                posts: [],
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    source: "error",
                    count: 0,
                },
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
