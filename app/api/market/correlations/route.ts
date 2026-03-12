import { NextRequest, NextResponse } from "next/server";
import type { InstrumentCorrelation, CorrelationDirection } from "@/lib/types/market";

/**
 * Market Correlations API route
 * Returns instrument-region correlation mappings
 *
 * Query params:
 *   region    — optional, filter by region name
 *   symbol    — optional, filter by symbol
 *   eventType — optional, filter by event type ("conflict", "gps-jamming", "vessel")
 *   lat & lng — optional, find correlations near a geographic point
 *
 * Currently returns sample data from seed definitions.
 */

const CACHE_DURATION = 300; // 5 minutes — correlations rarely change

/**
 * Haversine distance in km between two lat/lng points
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Instrument name lookup — maps symbol to human-readable name
 */
const INSTRUMENT_NAMES: Record<string, string> = {
    "CL=F": "WTI Crude Oil Futures",
    "BZ=F": "Brent Crude Oil Futures",
    "NG=F": "Natural Gas Futures",
    "XOM": "Exxon Mobil Corporation",
    "CVX": "Chevron Corporation",
    "BP": "BP plc",
    "SHEL": "Shell plc",
    "FRO": "Frontline plc",
    "STNG": "Scorpio Tankers Inc.",
    "TNK": "Teekay Tankers Ltd.",
    "ZIM": "ZIM Integrated Shipping",
    "MATX": "Matson Inc.",
    "BDRY": "Breakwave Dry Bulk Shipping ETF",
    "LMT": "Lockheed Martin Corporation",
    "RTX": "RTX Corporation",
    "NOC": "Northrop Grumman Corporation",
    "GD": "General Dynamics Corporation",
    "BA": "The Boeing Company",
    "ITA": "iShares U.S. Aerospace & Defense ETF",
    "ZW=F": "Wheat Futures",
    "ZC=F": "Corn Futures",
    "ZS=F": "Soybean Futures",
    "DBA": "Invesco DB Agriculture Fund",
    "TSM": "Taiwan Semiconductor Manufacturing",
    "NVDA": "NVIDIA Corporation",
    "ASML": "ASML Holding N.V.",
    "INTC": "Intel Corporation",
    "AAPL": "Apple Inc.",
    "SOXX": "iShares Semiconductor ETF",
    "SMH": "VanEck Semiconductor ETF",
    "GLD": "SPDR Gold Shares",
    "SLV": "iShares Silver Trust",
    "UUP": "Invesco DB US Dollar Index Bullish Fund",
    "TLT": "iShares 20+ Year Treasury Bond ETF",
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones Industrial Average",
    "^VIX": "CBOE Volatility Index",
};

interface CorrelationDef {
    symbol: string;
    regionName: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    sensitivity: number;
    direction: CorrelationDirection;
    eventTypes: string[];
    rationale: string;
}

/**
 * All 60+ correlation mappings from 005_market_seed.sql
 * center uses {lat, lng} format extracted from ST_MakePoint(lng, lat)
 */
const CORRELATION_DEFS: CorrelationDef[] = [
    // Strait of Hormuz
    { symbol: "CL=F", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "20% of global oil transits Hormuz; disruption spikes crude prices" },
    { symbol: "BZ=F", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "Brent directly tied to Middle-East supply routes" },
    { symbol: "XOM", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "Major oil producer with Gulf exposure" },
    { symbol: "CVX", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "Major oil producer with Gulf exposure" },
    { symbol: "STNG", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "Product tankers transiting Hormuz daily" },
    { symbol: "FRO", regionName: "Strait of Hormuz", center: { lat: 26.57, lng: 56.25 }, radiusKm: 200, sensitivity: 0.9, direction: "negative", eventTypes: ["conflict", "gps-jamming", "vessel"], rationale: "Crude tankers heavily exposed to Hormuz disruption" },

    // Suez Canal
    { symbol: "ZIM", regionName: "Suez Canal", center: { lat: 30.46, lng: 32.35 }, radiusKm: 100, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Container shipping rerouted around Africa when Suez disrupted" },
    { symbol: "MATX", regionName: "Suez Canal", center: { lat: 30.46, lng: 32.35 }, radiusKm: 100, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Ocean logistics impacted by canal closures" },
    { symbol: "BDRY", regionName: "Suez Canal", center: { lat: 30.46, lng: 32.35 }, radiusKm: 100, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Baltic Dry proxy rises on shipping disruption" },
    { symbol: "CL=F", regionName: "Suez Canal", center: { lat: 30.46, lng: 32.35 }, radiusKm: 100, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Oil supply chain transits Suez" },

    // South China Sea
    { symbol: "TSM", regionName: "South China Sea", center: { lat: 14.0, lng: 115.0 }, radiusKm: 800, sensitivity: 0.7, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "TSMC supply chain transits South China Sea" },
    { symbol: "NVDA", regionName: "South China Sea", center: { lat: 14.0, lng: 115.0 }, radiusKm: 800, sensitivity: 0.7, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "NVIDIA chips fabbed by TSMC, supply chain exposure" },
    { symbol: "ASML", regionName: "South China Sea", center: { lat: 14.0, lng: 115.0 }, radiusKm: 800, sensitivity: 0.7, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "ASML equipment shipments transit the region" },
    { symbol: "SOXX", regionName: "South China Sea", center: { lat: 14.0, lng: 115.0 }, radiusKm: 800, sensitivity: 0.7, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "Broad semiconductor sector exposure" },
    { symbol: "SMH", regionName: "South China Sea", center: { lat: 14.0, lng: 115.0 }, radiusKm: 800, sensitivity: 0.7, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "Semiconductor ETF with Asia-Pacific exposure" },

    // Taiwan Strait
    { symbol: "TSM", regionName: "Taiwan Strait", center: { lat: 24.0, lng: 119.5 }, radiusKm: 300, sensitivity: 0.95, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "TSMC headquartered in Taiwan; invasion scenario = total disruption" },
    { symbol: "AAPL", regionName: "Taiwan Strait", center: { lat: 24.0, lng: 119.5 }, radiusKm: 300, sensitivity: 0.95, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Apple chips entirely fabbed by TSMC in Taiwan" },
    { symbol: "SOXX", regionName: "Taiwan Strait", center: { lat: 24.0, lng: 119.5 }, radiusKm: 300, sensitivity: 0.95, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Semiconductor index would collapse on Taiwan conflict" },
    { symbol: "NVDA", regionName: "Taiwan Strait", center: { lat: 24.0, lng: 119.5 }, radiusKm: 300, sensitivity: 0.95, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "NVIDIA entirely dependent on TSMC fabrication" },
    { symbol: "ASML", regionName: "Taiwan Strait", center: { lat: 24.0, lng: 119.5 }, radiusKm: 300, sensitivity: 0.95, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "ASML equipment installed at TSMC fabs in Taiwan" },

    // Black Sea
    { symbol: "ZW=F", regionName: "Black Sea", center: { lat: 43.5, lng: 34.0 }, radiusKm: 500, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "Ukraine/Russia account for ~30% of global wheat exports" },
    { symbol: "ZC=F", regionName: "Black Sea", center: { lat: 43.5, lng: 34.0 }, radiusKm: 500, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "Ukraine is a major corn exporter via Black Sea ports" },
    { symbol: "DBA", regionName: "Black Sea", center: { lat: 43.5, lng: 34.0 }, radiusKm: 500, sensitivity: 0.8, direction: "negative", eventTypes: ["conflict", "vessel", "gps-jamming"], rationale: "Broad agriculture ETF exposed to grain supply shocks" },

    // Red Sea / Gulf of Aden
    { symbol: "ZIM", regionName: "Red Sea / Gulf of Aden", center: { lat: 14.0, lng: 43.0 }, radiusKm: 400, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Container shipping directly threatened by Houthi attacks" },
    { symbol: "MATX", regionName: "Red Sea / Gulf of Aden", center: { lat: 14.0, lng: 43.0 }, radiusKm: 400, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Ocean logistics disrupted by Red Sea rerouting" },
    { symbol: "BDRY", regionName: "Red Sea / Gulf of Aden", center: { lat: 14.0, lng: 43.0 }, radiusKm: 400, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Shipping rates spike on Red Sea disruption" },
    { symbol: "CL=F", regionName: "Red Sea / Gulf of Aden", center: { lat: 14.0, lng: 43.0 }, radiusKm: 400, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Oil tanker routes through Bab el-Mandeb strait" },
    { symbol: "BZ=F", regionName: "Red Sea / Gulf of Aden", center: { lat: 14.0, lng: 43.0 }, radiusKm: 400, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Brent supply chain transits Red Sea" },

    // Baltic Sea
    { symbol: "NG=F", regionName: "Baltic Sea", center: { lat: 58.0, lng: 20.0 }, radiusKm: 400, sensitivity: 0.5, direction: "negative", eventTypes: ["conflict", "gps-jamming"], rationale: "Nord Stream and Baltic Pipe gas infrastructure" },
    { symbol: "BDRY", regionName: "Baltic Sea", center: { lat: 58.0, lng: 20.0 }, radiusKm: 400, sensitivity: 0.5, direction: "negative", eventTypes: ["conflict", "gps-jamming"], rationale: "Baltic shipping lanes for dry bulk" },

    // Persian Gulf
    { symbol: "CL=F", regionName: "Persian Gulf", center: { lat: 27.0, lng: 51.0 }, radiusKm: 500, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Heart of OPEC production — Saudi, UAE, Kuwait, Iraq" },
    { symbol: "BZ=F", regionName: "Persian Gulf", center: { lat: 27.0, lng: 51.0 }, radiusKm: 500, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Brent benchmark directly tied to Gulf supply" },
    { symbol: "NG=F", regionName: "Persian Gulf", center: { lat: 27.0, lng: 51.0 }, radiusKm: 500, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Qatar is world's largest LNG exporter" },
    { symbol: "XOM", regionName: "Persian Gulf", center: { lat: 27.0, lng: 51.0 }, radiusKm: 500, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Exxon has significant Gulf production assets" },
    { symbol: "SHEL", regionName: "Persian Gulf", center: { lat: 27.0, lng: 51.0 }, radiusKm: 500, sensitivity: 0.85, direction: "negative", eventTypes: ["conflict", "vessel"], rationale: "Shell has major LNG and upstream Gulf operations" },

    // Eastern Mediterranean
    { symbol: "NG=F", regionName: "Eastern Mediterranean", center: { lat: 34.0, lng: 33.0 }, radiusKm: 300, sensitivity: 0.6, direction: "negative", eventTypes: ["conflict", "gps-jamming"], rationale: "Leviathan and Tamar gas fields; subsea cables" },
    { symbol: "CL=F", regionName: "Eastern Mediterranean", center: { lat: 34.0, lng: 33.0 }, radiusKm: 300, sensitivity: 0.6, direction: "negative", eventTypes: ["conflict", "gps-jamming"], rationale: "Regional instability affects broader oil sentiment" },

    // Korean Peninsula
    { symbol: "^GSPC", regionName: "Korean Peninsula", center: { lat: 38.0, lng: 127.0 }, radiusKm: 300, sensitivity: 0.7, direction: "mixed", eventTypes: ["conflict"], rationale: "S&P 500 sells off on North Korea escalation" },
    { symbol: "GLD", regionName: "Korean Peninsula", center: { lat: 38.0, lng: 127.0 }, radiusKm: 300, sensitivity: 0.7, direction: "mixed", eventTypes: ["conflict"], rationale: "Gold rallies as safe haven during Korea tensions" },
    { symbol: "^VIX", regionName: "Korean Peninsula", center: { lat: 38.0, lng: 127.0 }, radiusKm: 300, sensitivity: 0.7, direction: "mixed", eventTypes: ["conflict"], rationale: "Volatility spikes on geopolitical fear" },
    { symbol: "LMT", regionName: "Korean Peninsula", center: { lat: 38.0, lng: 127.0 }, radiusKm: 300, sensitivity: 0.7, direction: "mixed", eventTypes: ["conflict"], rationale: "Defense contractor benefits from Korean tension" },
    { symbol: "RTX", regionName: "Korean Peninsula", center: { lat: 38.0, lng: 127.0 }, radiusKm: 300, sensitivity: 0.7, direction: "mixed", eventTypes: ["conflict"], rationale: "Raytheon missile defense systems deployed in Korea" },

    // Middle East (general)
    { symbol: "CL=F", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Broad Middle-East instability elevates oil risk premium" },
    { symbol: "BZ=F", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Brent premium rises on regional conflict" },
    { symbol: "GLD", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Gold safe-haven bid on Middle East escalation" },
    { symbol: "LMT", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Lockheed defense contracts increase with ME conflict" },
    { symbol: "RTX", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Raytheon missile systems deployed across Middle East" },
    { symbol: "^VIX", regionName: "Middle East (general)", center: { lat: 29.0, lng: 47.0 }, radiusKm: 1000, sensitivity: 0.6, direction: "mixed", eventTypes: ["conflict"], rationale: "Volatility index spikes on geopolitical escalation" },

    // Ukraine / Eastern Europe
    { symbol: "ZW=F", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Ukraine is a top-5 global wheat exporter" },
    { symbol: "NG=F", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Russian gas transit through Ukraine to Europe" },
    { symbol: "GLD", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Gold safe-haven demand rises on European conflict" },
    { symbol: "^VIX", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Market volatility elevated during Eastern European conflict" },
    { symbol: "LMT", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Lockheed arms exports increase with NATO spending" },
    { symbol: "NOC", regionName: "Ukraine / Eastern Europe", center: { lat: 49.0, lng: 32.0 }, radiusKm: 600, sensitivity: 0.75, direction: "mixed", eventTypes: ["conflict"], rationale: "Northrop Grumman benefits from European defense buildup" },
];

function buildCorrelations(): InstrumentCorrelation[] {
    return CORRELATION_DEFS.map((def) => ({
        symbol: def.symbol,
        instrumentName: INSTRUMENT_NAMES[def.symbol] ?? def.symbol,
        regionName: def.regionName,
        regionCenter: def.center,
        regionRadiusKm: def.radiusKm,
        sensitivity: def.sensitivity,
        direction: def.direction,
        eventTypes: def.eventTypes,
        rationale: def.rationale,
    }));
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const regionFilter = searchParams.get("region");
        const symbolFilter = searchParams.get("symbol");
        const eventTypeFilter = searchParams.get("eventType");
        const latParam = searchParams.get("lat");
        const lngParam = searchParams.get("lng");

        let correlations = buildCorrelations();

        // Filter by region (case-insensitive partial match)
        if (regionFilter) {
            const lower = regionFilter.toLowerCase();
            correlations = correlations.filter((c) =>
                c.regionName.toLowerCase().includes(lower)
            );
        }

        // Filter by symbol (exact match)
        if (symbolFilter) {
            correlations = correlations.filter((c) => c.symbol === symbolFilter);
        }

        // Filter by event type
        if (eventTypeFilter) {
            correlations = correlations.filter((c) =>
                c.eventTypes.includes(eventTypeFilter)
            );
        }

        // Proximity filter: return correlations where the point is within the region radius
        if (latParam && lngParam) {
            const lat = parseFloat(latParam);
            const lng = parseFloat(lngParam);

            if (!isNaN(lat) && !isNaN(lng)) {
                correlations = correlations.filter((c) => {
                    if (!c.regionCenter || !c.regionRadiusKm) return false;
                    const dist = haversineKm(lat, lng, c.regionCenter.lat, c.regionCenter.lng);
                    return dist <= c.regionRadiusKm;
                });
            }
        }

        return NextResponse.json(
            {
                correlations,
                isSampleData: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    count: correlations.length,
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
        console.error("Market correlations API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch market correlations" },
            { status: 500 }
        );
    }
}
