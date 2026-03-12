/**
 * White House RSS feed fetcher
 * Parses whitehouse.gov RSS feeds for presidential actions, press briefings,
 * executive orders, and fact sheets.
 *
 * RSS Feeds:
 *   - https://www.whitehouse.gov/feed/               — All posts
 *   - https://www.whitehouse.gov/presidential-actions/feed/ — Executive orders, proclamations
 *   - https://www.whitehouse.gov/briefing-room/feed/  — Press briefings, statements
 */

import type { SocialPost, PolicyActionType } from "@/lib/types/social-post";

// ============================================
// Configuration
// ============================================

const WH_FEEDS = [
    {
        url: "https://www.whitehouse.gov/presidential-actions/feed/",
        defaultPolicyType: "executive_order" as PolicyActionType,
        category: "presidential_action",
    },
    // Note: briefing-room/statements-releases/feed/ and press-briefings/feed/
    // were removed from whitehouse.gov. The presidential-actions feed contains
    // executive orders, memoranda, proclamations, and nominations.
    // Additional WH feeds can be added here if new ones become available.
];

const FETCH_TIMEOUT = 15_000; // 15 seconds
const MAX_ITEMS_PER_FEED = 10;

export const WH_RSS_POLLING = {
    STANDARD: 300_000, // 5 minutes
    FAST: 120_000,     // 2 minutes
};

// ============================================
// RSS XML Parser (lightweight, no deps)
// ============================================

interface RSSItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    category: string[];
    guid: string;
    contentEncoded: string;
}

/**
 * Minimal RSS 2.0 XML parser — extracts <item> elements from RSS XML.
 * Avoids heavy XML parser dependencies.
 */
function parseRSSItems(xml: string): RSSItem[] {
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        items.push({
            title: extractTag(block, "title"),
            link: extractTag(block, "link"),
            description: stripHTML(extractTag(block, "description")),
            pubDate: extractTag(block, "pubDate"),
            category: extractAllTags(block, "category"),
            guid: extractTag(block, "guid"),
            contentEncoded: stripHTML(extractTag(block, "content:encoded")),
        });
    }

    return items;
}

function extractTag(xml: string, tag: string): string {
    // Handle CDATA sections
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
    const cdataMatch = cdataRegex.exec(xml);
    if (cdataMatch) return cdataMatch[1].trim();

    // Handle regular tags
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = regex.exec(xml);
    return m ? m[1].trim() : "";
}

function extractAllTags(xml: string, tag: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "gi");
    let m;
    while ((m = regex.exec(xml)) !== null) {
        results.push(m[1].trim());
    }
    return results;
}

function stripHTML(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================
// Policy Type Detection (keyword-based)
// ============================================

const POLICY_KEYWORDS: Record<PolicyActionType, string[]> = {
    tariff: ["tariff", "tariffs", "import duty", "duties", "section 232", "section 301", "trade barrier"],
    sanction: ["sanction", "sanctions", "ofac", "embargo", "asset freeze", "blocked persons"],
    executive_order: ["executive order", "presidential memorandum", "proclamation"],
    treaty: ["treaty", "agreement", "accord", "bilateral", "multilateral"],
    military: ["military", "defense", "deployment", "naval", "troops", "dod", "pentagon"],
    regulation: ["regulation", "regulatory", "deregulation", "rule", "rulemaking", "epa", "fda"],
    trade_deal: ["trade deal", "trade agreement", "trade partnership", "free trade", "reciprocal trade"],
    press_briefing: ["press briefing", "press conference", "press secretary"],
    other: [],
};

function detectPolicyType(text: string, defaultType: PolicyActionType): PolicyActionType {
    const lower = text.toLowerCase();

    // Check in priority order (most specific first)
    const priorityOrder: PolicyActionType[] = [
        "tariff", "sanction", "executive_order", "trade_deal",
        "treaty", "military", "regulation", "press_briefing",
    ];

    for (const policyType of priorityOrder) {
        const keywords = POLICY_KEYWORDS[policyType];
        if (keywords.some((kw) => lower.includes(kw))) {
            return policyType;
        }
    }

    return defaultType;
}

// ============================================
// Geo & Entity Extraction (keyword-based)
// ============================================

const GEO_KEYWORDS: Record<string, string[]> = {
    "China": ["china", "chinese", "beijing", "xi jinping"],
    "Russia": ["russia", "russian", "moscow", "kremlin", "putin"],
    "European Union": ["european union", "eu", "brussels"],
    "Middle East": ["middle east", "iran", "iraq", "syria", "yemen", "saudi"],
    "Taiwan": ["taiwan", "taipei"],
    "South China Sea": ["south china sea", "spratlys", "paracel"],
    "United States": ["united states", "america", "u.s.", "domestic"],
    "North Korea": ["north korea", "pyongyang", "dprk"],
    "Ukraine": ["ukraine", "kyiv", "kiev"],
    "Israel": ["israel", "gaza", "tel aviv"],
    "Japan": ["japan", "tokyo"],
    "India": ["india", "new delhi", "modi"],
};

function extractGeoReferences(text: string): string[] {
    const lower = text.toLowerCase();
    const results: string[] = [];

    for (const [region, keywords] of Object.entries(GEO_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            results.push(region);
        }
    }

    return results;
}

const ENTITY_KEYWORDS: string[] = [
    "steel", "aluminum", "oil", "gas", "lng", "energy", "tariff", "tariffs",
    "nato", "defense", "military", "trade", "sanctions", "economy", "gdp",
    "inflation", "interest rates", "federal reserve", "treasury",
    "semiconductor", "technology", "agriculture", "farmers",
    "immigration", "border", "fentanyl", "manufacturing",
];

function extractEntities(text: string): string[] {
    const lower = text.toLowerCase();
    return ENTITY_KEYWORDS.filter((kw) => lower.includes(kw));
}

// ============================================
// Main Fetcher
// ============================================

/**
 * Fetch and parse all White House RSS feeds into SocialPost[]
 */
export async function fetchWhiteHouseFeed(): Promise<{
    posts: SocialPost[];
    errors: string[];
}> {
    const allPosts: SocialPost[] = [];
    const errors: string[] = [];

    for (const feed of WH_FEEDS) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(feed.url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Meridian/1.0 (Geospatial Intelligence Platform)",
                    Accept: "application/rss+xml, application/xml, text/xml",
                },
            });
            clearTimeout(timeout);

            if (!response.ok) {
                errors.push(`WH RSS ${feed.category}: HTTP ${response.status}`);
                continue;
            }

            const xml = await response.text();
            const items = parseRSSItems(xml).slice(0, MAX_ITEMS_PER_FEED);

            for (const item of items) {
                const textForAnalysis = `${item.title} ${item.description || item.contentEncoded}`;
                const policyType = detectPolicyType(textForAnalysis, feed.defaultPolicyType);
                const geoRefs = extractGeoReferences(textForAnalysis);
                const entities = extractEntities(textForAnalysis);

                // Truncate content for display
                const content = item.description || item.contentEncoded;
                const displayContent = content.length > 500
                    ? `${item.title}: ${content.slice(0, 500)}…`
                    : `${item.title}: ${content}`;

                const post: SocialPost = {
                    id: `wh-rss-${hashString(item.guid || item.link)}`,
                    platform: "whitehouse",
                    postId: item.guid || item.link,
                    author: "White House",
                    content: displayContent,
                    url: item.link,
                    sentiment: null,        // Will be enriched by NLP
                    sentimentScore: null,    // Will be enriched by NLP
                    engagement: { likes: 0, reposts: 0, replies: 0 },
                    entitiesMentioned: entities,
                    geoReferences: geoRefs,
                    mediaUrls: [],
                    hasVideo: false,
                    postedAt: item.pubDate
                        ? new Date(item.pubDate).toISOString()
                        : new Date().toISOString(),
                    metadata: {
                        documentType: feed.category,
                        category: item.category,
                        source: "rss",
                    },

                    // NLP fields — will be enriched by GPT-4o-mini
                    sectors: [],
                    impliedInstruments: [],
                    policyType,
                    marketRelevance: 0,
                    nlpClassified: false,
                };

                allPosts.push(post);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`WH RSS ${feed.category}: ${msg}`);
        }
    }

    // Sort by date descending
    allPosts.sort((a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
    );

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduplicated = allPosts.filter((p) => {
        if (seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
    });

    return { posts: deduplicated, errors };
}

// ============================================
// Utility
// ============================================

/** Simple string hash for generating stable IDs from GUIDs/URLs */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}
