import { NextRequest, NextResponse } from "next/server";
import type { MarketInstrument, AssetClass, MarketSector, PriceDirection } from "@/lib/types/market";

/**
 * Market Instruments API route
 * Returns all tracked instruments with current prices
 *
 * Query params:
 *   sector     — optional filter by MarketSector
 *   assetClass — optional filter by AssetClass
 *   symbols    — optional comma-separated list of specific symbols
 *
 * Currently returns sample data; will proxy to DB / pipeline once connected.
 */

const CACHE_DURATION = 60; // 1 minute

/**
 * Simple deterministic hash for a string → number in [0,1)
 */
function hashSeed(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h % 10000) / 10000;
}

/**
 * Generate a small deterministic-ish change percent using current hour + symbol
 * so the value shifts over time but is stable within the same minute window.
 */
function generateChange(symbol: string, basePrice: number): {
    currentPrice: number;
    previousClose: number;
    changePercent: number;
    changeAbsolute: number;
    direction: PriceDirection;
    volume: number;
} {
    const now = new Date();
    const hourSeed = now.getUTCHours() + now.getUTCMinutes() / 60;
    const seed = hashSeed(symbol) + hourSeed / 24;
    // Change percent between -3% and +3%, biased by symbol hash
    const rawChange = (Math.sin(seed * 6.2831) * 2.5) + (Math.cos(seed * 3.14) * 0.5);
    const changePercent = Math.round(rawChange * 100) / 100;
    const changeAbsolute = Math.round(basePrice * changePercent / 100 * 100) / 100;
    const previousClose = basePrice;
    const currentPrice = Math.round((basePrice + changeAbsolute) * 100) / 100;
    const direction: PriceDirection = changePercent > 0.05 ? "up" : changePercent < -0.05 ? "down" : "flat";

    // Volume: base volume adjusted by symbol hash
    const baseVol = basePrice > 500 ? 2_000_000 : basePrice > 50 ? 8_000_000 : 15_000_000;
    const volume = Math.round(baseVol * (0.6 + hashSeed(symbol + "vol") * 0.8));

    return { currentPrice, previousClose, changePercent, changeAbsolute, direction, volume };
}

interface InstrumentDef {
    symbol: string;
    name: string;
    assetClass: AssetClass;
    sector: MarketSector;
    exchange: string;
    currency: string;
    description: string;
    basePrice: number;
}

/**
 * All 37 instruments from the seed data with realistic base prices
 */
const INSTRUMENT_DEFS: InstrumentDef[] = [
    // Energy
    { symbol: "CL=F", name: "WTI Crude Oil Futures", assetClass: "future", sector: "energy", exchange: "NYMEX", currency: "USD", description: "West Texas Intermediate crude oil continuous contract", basePrice: 72.14 },
    { symbol: "BZ=F", name: "Brent Crude Oil Futures", assetClass: "future", sector: "energy", exchange: "ICE", currency: "USD", description: "Brent crude oil continuous contract", basePrice: 76.83 },
    { symbol: "NG=F", name: "Natural Gas Futures", assetClass: "future", sector: "energy", exchange: "NYMEX", currency: "USD", description: "Henry Hub natural gas continuous contract", basePrice: 3.52 },
    { symbol: "XOM", name: "Exxon Mobil Corporation", assetClass: "equity", sector: "energy", exchange: "NYSE", currency: "USD", description: "Integrated oil and gas major", basePrice: 109.64 },
    { symbol: "CVX", name: "Chevron Corporation", assetClass: "equity", sector: "energy", exchange: "NYSE", currency: "USD", description: "Integrated oil and gas major", basePrice: 155.27 },
    { symbol: "BP", name: "BP plc", assetClass: "equity", sector: "energy", exchange: "NYSE", currency: "USD", description: "British integrated oil and gas major (ADR)", basePrice: 34.85 },
    { symbol: "SHEL", name: "Shell plc", assetClass: "equity", sector: "energy", exchange: "NYSE", currency: "USD", description: "Anglo-Dutch integrated oil and gas major (ADR)", basePrice: 65.42 },

    // Shipping
    { symbol: "FRO", name: "Frontline plc", assetClass: "equity", sector: "shipping", exchange: "NYSE", currency: "USD", description: "International seaborne transportation of crude oil", basePrice: 20.35 },
    { symbol: "STNG", name: "Scorpio Tankers Inc.", assetClass: "equity", sector: "shipping", exchange: "NYSE", currency: "USD", description: "Product tanker shipping company", basePrice: 54.90 },
    { symbol: "TNK", name: "Teekay Tankers Ltd.", assetClass: "equity", sector: "shipping", exchange: "NYSE", currency: "USD", description: "Crude oil and product tanker company", basePrice: 44.67 },
    { symbol: "ZIM", name: "ZIM Integrated Shipping", assetClass: "equity", sector: "shipping", exchange: "NYSE", currency: "USD", description: "Container shipping and logistics", basePrice: 24.53 },
    { symbol: "MATX", name: "Matson Inc.", assetClass: "equity", sector: "shipping", exchange: "NYSE", currency: "USD", description: "Ocean transportation and logistics", basePrice: 119.80 },
    { symbol: "BDRY", name: "Breakwave Dry Bulk Shipping ETF", assetClass: "etf", sector: "shipping", exchange: "NYSE", currency: "USD", description: "Tracks the Baltic Dry Index via freight futures", basePrice: 11.74 },

    // Defense
    { symbol: "LMT", name: "Lockheed Martin Corporation", assetClass: "equity", sector: "defense", exchange: "NYSE", currency: "USD", description: "Aerospace, defense, and security", basePrice: 471.36 },
    { symbol: "RTX", name: "RTX Corporation", assetClass: "equity", sector: "defense", exchange: "NYSE", currency: "USD", description: "Aerospace and defense conglomerate (Raytheon)", basePrice: 101.22 },
    { symbol: "NOC", name: "Northrop Grumman Corporation", assetClass: "equity", sector: "defense", exchange: "NYSE", currency: "USD", description: "Aerospace and defense technology", basePrice: 478.45 },
    { symbol: "GD", name: "General Dynamics Corporation", assetClass: "equity", sector: "defense", exchange: "NYSE", currency: "USD", description: "Aerospace and defense systems", basePrice: 281.90 },
    { symbol: "BA", name: "The Boeing Company", assetClass: "equity", sector: "defense", exchange: "NYSE", currency: "USD", description: "Aerospace manufacturer and defense contractor", basePrice: 178.53 },
    { symbol: "ITA", name: "iShares U.S. Aerospace & Defense ETF", assetClass: "etf", sector: "defense", exchange: "BATS", currency: "USD", description: "US aerospace and defense sector ETF", basePrice: 131.60 },

    // Agriculture
    { symbol: "ZW=F", name: "Wheat Futures", assetClass: "future", sector: "agriculture", exchange: "CBOT", currency: "USD", description: "Chicago wheat continuous contract", basePrice: 582.50 },
    { symbol: "ZC=F", name: "Corn Futures", assetClass: "future", sector: "agriculture", exchange: "CBOT", currency: "USD", description: "Chicago corn continuous contract", basePrice: 441.25 },
    { symbol: "ZS=F", name: "Soybean Futures", assetClass: "future", sector: "agriculture", exchange: "CBOT", currency: "USD", description: "Chicago soybean continuous contract", basePrice: 1198.00 },
    { symbol: "DBA", name: "Invesco DB Agriculture Fund", assetClass: "etf", sector: "agriculture", exchange: "NYSE", currency: "USD", description: "Broad agricultural commodity ETF", basePrice: 23.85 },

    // Technology / Semiconductors
    { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing", assetClass: "equity", sector: "technology", exchange: "NYSE", currency: "USD", description: "World's largest semiconductor foundry (ADR)", basePrice: 150.32 },
    { symbol: "NVDA", name: "NVIDIA Corporation", assetClass: "equity", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "GPU and AI chip leader", basePrice: 878.40 },
    { symbol: "ASML", name: "ASML Holding N.V.", assetClass: "equity", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "Semiconductor lithography equipment monopoly (ADR)", basePrice: 748.90 },
    { symbol: "INTC", name: "Intel Corporation", assetClass: "equity", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "Semiconductor manufacturing and design", basePrice: 31.56 },
    { symbol: "AAPL", name: "Apple Inc.", assetClass: "equity", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "Consumer electronics and technology giant", basePrice: 181.24 },
    { symbol: "SOXX", name: "iShares Semiconductor ETF", assetClass: "etf", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "Philadelphia Semiconductor Index ETF", basePrice: 228.75 },
    { symbol: "SMH", name: "VanEck Semiconductor ETF", assetClass: "etf", sector: "technology", exchange: "NASDAQ", currency: "USD", description: "Semiconductor sector ETF", basePrice: 219.40 },

    // Finance / Safe Havens
    { symbol: "GLD", name: "SPDR Gold Shares", assetClass: "etf", sector: "finance", exchange: "NYSE", currency: "USD", description: "Gold bullion ETF — primary safe-haven proxy", basePrice: 193.15 },
    { symbol: "SLV", name: "iShares Silver Trust", assetClass: "etf", sector: "finance", exchange: "NYSE", currency: "USD", description: "Silver bullion ETF", basePrice: 22.87 },
    { symbol: "UUP", name: "Invesco DB US Dollar Index Bullish Fund", assetClass: "etf", sector: "finance", exchange: "NYSE", currency: "USD", description: "US Dollar index ETF", basePrice: 28.14 },
    { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetClass: "etf", sector: "finance", exchange: "NASDAQ", currency: "USD", description: "Long-term US Treasury bond ETF", basePrice: 90.42 },

    // Indices
    { symbol: "^GSPC", name: "S&P 500", assetClass: "index", sector: "finance", exchange: "SNP", currency: "USD", description: "Standard & Poor's 500 broad market index", basePrice: 5218.67 },
    { symbol: "^DJI", name: "Dow Jones Industrial Average", assetClass: "index", sector: "finance", exchange: "DJI", currency: "USD", description: "Blue-chip 30-stock index", basePrice: 39142.50 },
    { symbol: "^VIX", name: "CBOE Volatility Index", assetClass: "index", sector: "finance", exchange: "CBOE", currency: "USD", description: "Market fear gauge — spikes on geopolitical shocks", basePrice: 15.82 },
];

function buildSampleInstruments(): MarketInstrument[] {
    const now = new Date().toISOString();

    return INSTRUMENT_DEFS.map((def) => {
        const { currentPrice, previousClose, changePercent, changeAbsolute, direction, volume } =
            generateChange(def.symbol, def.basePrice);

        return {
            symbol: def.symbol,
            name: def.name,
            assetClass: def.assetClass,
            sector: def.sector,
            exchange: def.exchange,
            currency: def.currency,
            description: def.description,
            currentPrice,
            previousClose,
            changePercent,
            changeAbsolute,
            direction,
            volume,
            lastUpdated: now,
        };
    });
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const sector = searchParams.get("sector") as MarketSector | null;
        const assetClass = searchParams.get("assetClass") as AssetClass | null;
        const symbolsParam = searchParams.get("symbols");

        let instruments = buildSampleInstruments();

        // Apply filters
        if (sector) {
            instruments = instruments.filter((i) => i.sector === sector);
        }
        if (assetClass) {
            instruments = instruments.filter((i) => i.assetClass === assetClass);
        }
        if (symbolsParam) {
            const symbolSet = new Set(symbolsParam.split(",").map((s) => s.trim()));
            instruments = instruments.filter((i) => symbolSet.has(i.symbol));
        }

        return NextResponse.json(
            {
                instruments,
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    count: instruments.length,
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
        console.error("Market instruments API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch market instruments" },
            { status: 500 }
        );
    }
}
