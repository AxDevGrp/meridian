import { NextRequest, NextResponse } from "next/server";
import type { PricePoint, PriceInterval } from "@/lib/types/market";

/**
 * Market Price History API route
 * Returns OHLCV price data for a given symbol
 *
 * Query params:
 *   symbol   — required, the ticker symbol
 *   interval — optional, "1d" (default), "1h", "5m"
 *   limit    — optional, max data points (default 30)
 *
 * Currently generates deterministic sample data based on symbol hash.
 */

const CACHE_DURATION = 60;

/**
 * Deterministic hash for a string → integer
 */
function hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * Simple seeded pseudo-random number generator (Mulberry32)
 * Returns a function that produces deterministic values in [0, 1)
 */
function seededRandom(seed: number): () => number {
    let state = seed | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Approximate base price for known symbols; falls back to a hash-derived price.
 */
const BASE_PRICES: Record<string, number> = {
    "CL=F": 72.14, "BZ=F": 76.83, "NG=F": 3.52,
    "XOM": 109.64, "CVX": 155.27, "BP": 34.85, "SHEL": 65.42,
    "FRO": 20.35, "STNG": 54.90, "TNK": 44.67,
    "ZIM": 24.53, "MATX": 119.80, "BDRY": 11.74,
    "LMT": 471.36, "RTX": 101.22, "NOC": 478.45,
    "GD": 281.90, "BA": 178.53, "ITA": 131.60,
    "ZW=F": 582.50, "ZC=F": 441.25, "ZS=F": 1198.00, "DBA": 23.85,
    "TSM": 150.32, "NVDA": 878.40, "ASML": 748.90,
    "INTC": 31.56, "AAPL": 181.24, "SOXX": 228.75, "SMH": 219.40,
    "GLD": 193.15, "SLV": 22.87, "UUP": 28.14, "TLT": 90.42,
    "^GSPC": 5218.67, "^DJI": 39142.50, "^VIX": 15.82,
};

function getBasePrice(symbol: string): number {
    return BASE_PRICES[symbol] ?? (10 + (hashCode(symbol) % 500));
}

/**
 * Generate deterministic OHLCV history using a random walk seeded by symbol hash.
 * The same symbol always generates the same chart shape.
 */
function generatePriceHistory(
    symbol: string,
    interval: PriceInterval,
    limit: number,
): PricePoint[] {
    const basePrice = getBasePrice(symbol);
    const seed = hashCode(symbol + interval);
    const rand = seededRandom(seed);

    const now = new Date();
    const msPerBar = intervalToMs(interval);
    const points: PricePoint[] = [];

    let price = basePrice * (0.95 + rand() * 0.1); // start ±5% from base

    for (let i = limit - 1; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * msPerBar);

        // Daily volatility: 0.5-2% range depending on symbol
        const volatility = 0.005 + rand() * 0.015;
        const drift = (rand() - 0.48) * volatility; // slight upward bias
        const open = price;
        const close = open * (1 + drift);

        // Intra-bar range
        const rangeFactor = volatility * (0.5 + rand() * 0.5);
        const high = Math.max(open, close) * (1 + rangeFactor * rand());
        const low = Math.min(open, close) * (1 - rangeFactor * rand());

        // Volume varies by day of week and randomness
        const dayOfWeek = timestamp.getUTCDay();
        const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.3 : 1.0;
        const baseVol = basePrice > 500 ? 2_000_000 : basePrice > 50 ? 8_000_000 : 15_000_000;
        const volume = Math.round(baseVol * weekendFactor * (0.4 + rand() * 1.2));

        points.push({
            symbol,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume,
            timestamp: timestamp.toISOString(),
        });

        price = close; // carry forward for next bar
    }

    return points;
}

function intervalToMs(interval: PriceInterval): number {
    switch (interval) {
        case "5m": return 5 * 60 * 1000;
        case "15m": return 15 * 60 * 1000;
        case "1m": return 60 * 1000;
        case "1h": return 60 * 60 * 1000;
        case "1d": return 24 * 60 * 60 * 1000;
        case "1w": return 7 * 24 * 60 * 60 * 1000;
        case "1mo": return 30 * 24 * 60 * 60 * 1000;
        default: return 24 * 60 * 60 * 1000;
    }
}

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "1d", "1w", "1mo"]);

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get("symbol");
        const intervalParam = searchParams.get("interval") || "1d";
        const limitParam = searchParams.get("limit");

        if (!symbol) {
            return NextResponse.json(
                { error: "Missing required query parameter: symbol" },
                { status: 400 }
            );
        }

        if (!VALID_INTERVALS.has(intervalParam)) {
            return NextResponse.json(
                { error: `Invalid interval "${intervalParam}". Valid: ${[...VALID_INTERVALS].join(", ")}` },
                { status: 400 }
            );
        }

        const interval = intervalParam as PriceInterval;
        const limit = Math.min(Math.max(parseInt(limitParam || "30", 10) || 30, 1), 365);

        const prices = generatePriceHistory(symbol, interval, limit);

        return NextResponse.json(
            {
                symbol,
                prices,
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    interval,
                    count: prices.length,
                },
            },
            {
                headers: {
                    "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                    "X-Data-Source": "sample",
                },
            }
        );
    } catch (error) {
        console.error("Market prices API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch price history" },
            { status: 500 }
        );
    }
}
