/**
 * Social Post NLP Classification Service
 * Uses GPT-4o-mini to enrich social posts with:
 *   - Sentiment analysis (label + score)
 *   - Market sector classification
 *   - Implied financial instruments
 *   - Market relevance score
 *   - Policy action type (for WH posts)
 *
 * Falls back to keyword-based classification if OpenAI API key is not configured.
 */

import OpenAI from "openai";
import type { SocialPost, SentimentLabel, PolicyActionType } from "@/lib/types/social-post";
import type { MarketSector } from "@/lib/types/market";

// ============================================
// OpenAI Client (lazy-initialized)
// ============================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
    if (openaiClient) return openaiClient;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === "your_openai_api_key_here") {
        return null;
    }

    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

// ============================================
// GPT-4o-mini Classification
// ============================================

interface NLPClassification {
    sentiment: SentimentLabel;
    sentimentScore: number;
    sectors: MarketSector[];
    impliedInstruments: string[];
    policyType: PolicyActionType | null;
    marketRelevance: number;
    geoReferences: string[];
    entitiesMentioned: string[];
}

const SYSTEM_PROMPT = `You are a financial intelligence analyst. Classify social media posts and government announcements for their market impact.

Respond ONLY with valid JSON matching this schema:
{
  "sentiment": "positive" | "negative" | "neutral" | "aggressive" | "urgent",
  "sentimentScore": number (-1.0 to 1.0),
  "sectors": string[] (from: "energy", "shipping", "defense", "agriculture", "technology", "finance", "materials", "industrials", "utilities", "other"),
  "impliedInstruments": string[] (ticker symbols like "CL=F", "XLE", "NVDA", "^VIX", "GLD"),
  "policyType": "tariff" | "sanction" | "executive_order" | "treaty" | "military" | "regulation" | "trade_deal" | "press_briefing" | null,
  "marketRelevance": number (0.0 to 1.0, how likely this moves markets),
  "geoReferences": string[] (countries/regions mentioned),
  "entitiesMentioned": string[] (key entities: people, organizations, commodities)
}

Rules:
- "marketRelevance" > 0.7 for executive orders, tariff announcements, military deployments, sanctions
- "marketRelevance" 0.3-0.7 for general policy statements, press briefings
- "marketRelevance" < 0.3 for general commentary, personal opinions
- For tariff posts: include affected commodity futures and sector ETFs
- For military posts: include defense stocks (LMT, RTX, NOC) and VIX
- For trade deal posts: include affected country ETFs and currency pairs
- Be specific with ticker symbols — use standard formats (futures: CL=F, indices: ^GSPC)`;

/**
 * Classify a batch of social posts using GPT-4o-mini.
 * Batches up to 5 posts per API call for efficiency.
 */
export async function classifyPostsWithGPT(
    posts: SocialPost[],
): Promise<SocialPost[]> {
    const client = getOpenAIClient();
    if (!client) {
        console.log("[social-nlp] No OpenAI API key — using keyword fallback");
        return posts.map(classifyWithKeywords);
    }

    const BATCH_SIZE = 5;
    const results: SocialPost[] = [];

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);
        const classified = await classifyBatch(client, batch);
        results.push(...classified);
    }

    return results;
}

async function classifyBatch(
    client: OpenAI,
    posts: SocialPost[],
): Promise<SocialPost[]> {
    try {
        const userContent = posts
            .map((p, idx) => `[${idx}] Platform: ${p.platform} | Author: ${p.author}\n${p.content}`)
            .join("\n\n---\n\n");

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1, // Low temperature for consistent classification
            max_tokens: 2000,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Classify these ${posts.length} posts. Return a JSON array of ${posts.length} classification objects:\n\n${userContent}`,
                },
            ],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            console.warn("[social-nlp] Empty GPT response — falling back to keywords");
            return posts.map(classifyWithKeywords);
        }

        const parsed = JSON.parse(content);
        // GPT may return { classifications: [...] } or just [...]
        const classifications: NLPClassification[] = Array.isArray(parsed)
            ? parsed
            : parsed.classifications || parsed.results || [];

        return posts.map((post, idx) => {
            const cls = classifications[idx];
            if (!cls) return classifyWithKeywords(post);

            return {
                ...post,
                sentiment: cls.sentiment || post.sentiment,
                sentimentScore: cls.sentimentScore ?? post.sentimentScore,
                sectors: cls.sectors || post.sectors,
                impliedInstruments: cls.impliedInstruments || post.impliedInstruments,
                policyType: cls.policyType ?? post.policyType,
                marketRelevance: cls.marketRelevance ?? post.marketRelevance,
                geoReferences: cls.geoReferences?.length ? cls.geoReferences : post.geoReferences,
                entitiesMentioned: cls.entitiesMentioned?.length ? cls.entitiesMentioned : post.entitiesMentioned,
                nlpClassified: true,
            };
        });
    } catch (err) {
        console.error("[social-nlp] GPT classification failed:", err);
        return posts.map(classifyWithKeywords);
    }
}

// ============================================
// Keyword-Based Fallback Classification
// ============================================

const SECTOR_KEYWORDS: Record<MarketSector, string[]> = {
    energy: ["oil", "gas", "lng", "petroleum", "opec", "energy", "crude", "pipeline", "drilling", "fracking"],
    shipping: ["shipping", "maritime", "port", "vessel", "tanker", "cargo", "freight", "container", "shipping lanes"],
    defense: ["defense", "military", "nato", "troops", "navy", "army", "missile", "weapon", "pentagon", "dod"],
    agriculture: ["agriculture", "farm", "wheat", "corn", "soybean", "crop", "food", "grain", "livestock"],
    technology: ["technology", "semiconductor", "chip", "ai", "artificial intelligence", "tech", "cyber", "digital"],
    finance: ["finance", "bank", "treasury", "interest rate", "federal reserve", "bond", "gold", "dollar"],
    materials: ["steel", "aluminum", "copper", "lithium", "mineral", "mining", "rare earth", "metals"],
    industrials: ["manufacturing", "infrastructure", "construction", "industrial", "factory", "supply chain"],
    utilities: ["utility", "electric", "power grid", "nuclear", "renewable", "solar", "wind"],
    other: [],
};

const INSTRUMENT_KEYWORDS: Record<string, string[]> = {
    "CL=F": ["oil", "crude", "petroleum", "oil price"],
    "BZ=F": ["brent", "brent crude"],
    "NG=F": ["natural gas", "lng"],
    "GLD": ["gold", "safe haven", "precious metal"],
    "^VIX": ["volatility", "fear", "uncertainty", "market panic"],
    "^GSPC": ["s&p", "stock market", "wall street", "equities"],
    "TLT": ["treasury", "bond", "interest rate", "yield"],
    "XLE": ["energy sector", "energy stocks"],
    "LMT": ["lockheed", "defense contract", "military spending"],
    "RTX": ["raytheon", "defense", "weapons"],
    "ITA": ["aerospace", "defense etf"],
    "TSM": ["tsmc", "taiwan semiconductor", "chip manufacturing"],
    "NVDA": ["nvidia", "gpu", "ai chip"],
    "SOXX": ["semiconductor", "chip stocks", "semiconductor etf"],
    "ZIM": ["container shipping", "shipping company"],
    "WEAT": ["wheat", "grain"],
    "DBA": ["agriculture", "crop prices"],
    "XLB": ["materials", "steel", "aluminum", "metals"],
    "UUP": ["dollar", "usd", "dollar strength"],
    "EEM": ["emerging markets", "em currencies"],
};

const SENTIMENT_KEYWORDS: Record<SentimentLabel, string[]> = {
    positive: ["great", "win", "boom", "record", "strong", "growth", "deal", "agreement", "peace"],
    negative: ["crash", "crisis", "collapse", "decline", "loss", "weak", "recession", "downturn"],
    neutral: ["announces", "statement", "reports", "briefing", "update"],
    aggressive: ["tariff", "sanction", "retaliate", "dump", "unfair", "rip off", "massive", "huge"],
    urgent: ["breaking", "urgent", "emergency", "deploy", "immediate", "effective immediately"],
};

const POLICY_KEYWORDS_SIMPLE: Record<PolicyActionType, string[]> = {
    tariff: ["tariff", "tariffs", "import duty", "duties", "section 232", "section 301"],
    sanction: ["sanction", "sanctions", "embargo", "asset freeze"],
    executive_order: ["executive order", "presidential memorandum", "proclamation"],
    treaty: ["treaty", "agreement", "accord"],
    military: ["military", "deploy", "naval", "troops"],
    regulation: ["regulation", "regulatory", "deregulation"],
    trade_deal: ["trade deal", "trade agreement", "trade partnership"],
    press_briefing: ["press briefing", "press conference"],
    other: [],
};

/**
 * Classify a single post using keyword matching.
 * Used as fallback when OpenAI API key is not available.
 */
export function classifyWithKeywords(post: SocialPost): SocialPost {
    const lower = post.content.toLowerCase();

    // Detect sectors
    const sectors: MarketSector[] = [];
    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
        if (sector === "other") continue;
        if (keywords.some((kw) => lower.includes(kw))) {
            sectors.push(sector as MarketSector);
        }
    }

    // Detect implied instruments
    const impliedInstruments: string[] = [];
    for (const [symbol, keywords] of Object.entries(INSTRUMENT_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            impliedInstruments.push(symbol);
        }
    }

    // Detect sentiment (if not already set)
    let sentiment = post.sentiment;
    let sentimentScore = post.sentimentScore;
    if (!sentiment) {
        let bestMatch: SentimentLabel = "neutral";
        let bestCount = 0;
        for (const [label, keywords] of Object.entries(SENTIMENT_KEYWORDS)) {
            const count = keywords.filter((kw) => lower.includes(kw)).length;
            if (count > bestCount) {
                bestCount = count;
                bestMatch = label as SentimentLabel;
            }
        }
        sentiment = bestMatch;
        sentimentScore = sentiment === "positive" ? 0.5
            : sentiment === "negative" ? -0.5
                : sentiment === "aggressive" ? -0.4
                    : sentiment === "urgent" ? -0.2
                        : 0.0;
    }

    // Detect policy type
    let policyType = post.policyType;
    if (!policyType && post.platform === "whitehouse") {
        for (const [type, keywords] of Object.entries(POLICY_KEYWORDS_SIMPLE)) {
            if (type === "other") continue;
            if (keywords.some((kw) => lower.includes(kw))) {
                policyType = type as PolicyActionType;
                break;
            }
        }
    }

    // Compute market relevance
    let marketRelevance = 0.2; // baseline
    if (post.platform === "whitehouse") marketRelevance += 0.3;
    if (policyType === "tariff" || policyType === "sanction" || policyType === "executive_order") {
        marketRelevance += 0.3;
    }
    if (policyType === "military") marketRelevance += 0.2;
    if (sectors.length > 0) marketRelevance += 0.1;
    if (impliedInstruments.length > 2) marketRelevance += 0.1;
    marketRelevance = Math.min(1.0, marketRelevance);

    return {
        ...post,
        sentiment,
        sentimentScore,
        sectors,
        impliedInstruments,
        policyType,
        marketRelevance,
        nlpClassified: true,
    };
}
