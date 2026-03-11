import { NextRequest, NextResponse } from "next/server";
import type { Vessel, VesselType, NavigationStatus } from "@/lib/types/vessel";

/**
 * AIS Maritime vessel tracking API
 *
 * Uses free AIS data sources. Since most comprehensive AIS APIs require
 * paid subscriptions, this provides:
 * 1. Real data from free AIS APIs (when available)
 * 2. Realistic sample data covering major shipping lanes for development
 *
 * For production, integrate with:
 * - MarineTraffic API (paid)
 * - AISHub (free with data contribution)
 * - VesselFinder API
 */

// Cache configuration
const CACHE_DURATION = 60; // 1 minute

// In-memory cache
let cachedResponse: {
    data: unknown;
    timestamp: number;
} | null = null;

/**
 * Generate realistic sample vessel data along major shipping lanes
 */
function generateSampleVessels(): Vessel[] {
    const now = Math.floor(Date.now() / 1000);

    // Major shipping lanes and port areas with realistic vessel distribution
    const vessels: Vessel[] = [
        // Strait of Hormuz - Oil tankers
        {
            mmsi: "210001001",
            name: "PACIFIC VOYAGER",
            imo: "9801234",
            callsign: "D5AB1",
            vesselType: "tanker",
            flag: "Liberia",
            longitude: 56.25,
            latitude: 26.55,
            course: 120,
            speed: 12.5,
            heading: 118,
            navigationStatus: "under_way_using_engine",
            destination: "SINGAPORE",
            eta: null,
            draught: 16.2,
            length: 333,
            width: 60,
            lastUpdate: now - 120,
        },
        {
            mmsi: "636015001",
            name: "CRUDE CARRIER III",
            imo: "9812345",
            callsign: "A8KL2",
            vesselType: "tanker",
            flag: "Marshall Islands",
            longitude: 56.42,
            latitude: 26.38,
            course: 300,
            speed: 11.8,
            heading: 298,
            navigationStatus: "under_way_using_engine",
            destination: "RAS TANURA",
            eta: null,
            draught: 8.5,
            length: 274,
            width: 48,
            lastUpdate: now - 60,
        },
        // Suez Canal approach
        {
            mmsi: "477001001",
            name: "MAERSK SEALAND",
            imo: "9823456",
            callsign: "VRBA1",
            vesselType: "cargo",
            flag: "Hong Kong",
            longitude: 32.33,
            latitude: 31.25,
            course: 180,
            speed: 8.2,
            heading: 182,
            navigationStatus: "under_way_using_engine",
            destination: "SUEZ CANAL",
            eta: null,
            draught: 14.5,
            length: 400,
            width: 59,
            lastUpdate: now - 90,
        },
        // Red Sea
        {
            mmsi: "538005001",
            name: "MSC ISABELLA",
            imo: "9834567",
            callsign: "V7AB3",
            vesselType: "cargo",
            flag: "Marshall Islands",
            longitude: 39.8,
            latitude: 18.5,
            course: 340,
            speed: 14.1,
            heading: 338,
            navigationStatus: "under_way_using_engine",
            destination: "ROTTERDAM",
            eta: null,
            draught: 15.0,
            length: 366,
            width: 51,
            lastUpdate: now - 45,
        },
        // South China Sea
        {
            mmsi: "413001001",
            name: "COSCO SHIPPING UNIVERSE",
            imo: "9845678",
            callsign: "BRCD4",
            vesselType: "cargo",
            flag: "China",
            longitude: 114.2,
            latitude: 12.5,
            course: 225,
            speed: 15.3,
            heading: 223,
            navigationStatus: "under_way_using_engine",
            destination: "SINGAPORE",
            eta: null,
            draught: 13.8,
            length: 399,
            width: 58,
            lastUpdate: now - 30,
        },
        // Malacca Strait
        {
            mmsi: "563001001",
            name: "EVERGREEN GLORY",
            imo: "9856789",
            callsign: "9V2345",
            vesselType: "cargo",
            flag: "Singapore",
            longitude: 101.5,
            latitude: 2.8,
            course: 315,
            speed: 13.7,
            heading: 314,
            navigationStatus: "under_way_using_engine",
            destination: "SHANGHAI",
            eta: null,
            draught: 14.2,
            length: 334,
            width: 48,
            lastUpdate: now - 75,
        },
        // English Channel
        {
            mmsi: "245001001",
            name: "SPIRIT OF BRITAIN",
            imo: "9867890",
            callsign: "PCAB1",
            vesselType: "passenger",
            flag: "Netherlands",
            longitude: 1.5,
            latitude: 51.0,
            course: 240,
            speed: 18.5,
            heading: 238,
            navigationStatus: "under_way_using_engine",
            destination: "DOVER",
            eta: null,
            draught: 6.2,
            length: 213,
            width: 31,
            lastUpdate: now - 15,
        },
        // Mediterranean
        {
            mmsi: "247001001",
            name: "MEDITERRANEO FISHING",
            imo: null,
            callsign: "IBCD2",
            vesselType: "fishing",
            flag: "Italy",
            longitude: 12.5,
            latitude: 38.5,
            course: 90,
            speed: 5.2,
            heading: 88,
            navigationStatus: "engaged_in_fishing",
            destination: null,
            eta: null,
            draught: 4.5,
            length: 35,
            width: 8,
            lastUpdate: now - 200,
        },
        // Cape of Good Hope
        {
            mmsi: "353001001",
            name: "ATLANTIC PIONEER",
            imo: "9878901",
            callsign: "HOAB1",
            vesselType: "tanker",
            flag: "Panama",
            longitude: 18.4,
            latitude: -34.3,
            course: 270,
            speed: 13.2,
            heading: 268,
            navigationStatus: "under_way_using_engine",
            destination: "HOUSTON",
            eta: null,
            draught: 15.8,
            length: 320,
            width: 55,
            lastUpdate: now - 180,
        },
        // Panama Canal approach
        {
            mmsi: "371001001",
            name: "OCEAN GATEWAY",
            imo: "9889012",
            callsign: "HPAB3",
            vesselType: "cargo",
            flag: "Panama",
            longitude: -79.5,
            latitude: 8.9,
            course: 350,
            speed: 6.5,
            heading: 348,
            navigationStatus: "under_way_using_engine",
            destination: "COLON",
            eta: null,
            draught: 12.0,
            length: 294,
            width: 40,
            lastUpdate: now - 100,
        },
        // Persian Gulf
        {
            mmsi: "422001001",
            name: "AL RUWAIS",
            imo: "9890123",
            callsign: "A6AB1",
            vesselType: "tanker",
            flag: "UAE",
            longitude: 52.0,
            latitude: 25.5,
            course: 200,
            speed: 10.1,
            heading: 198,
            navigationStatus: "under_way_using_engine",
            destination: "JEBEL ALI",
            eta: null,
            draught: 11.5,
            length: 250,
            width: 44,
            lastUpdate: now - 55,
        },
        // Baltic Sea
        {
            mmsi: "211001001",
            name: "BALTIC TRADER",
            imo: "9801122",
            callsign: "DAAB1",
            vesselType: "cargo",
            flag: "Germany",
            longitude: 20.0,
            latitude: 57.5,
            course: 45,
            speed: 11.8,
            heading: 43,
            navigationStatus: "under_way_using_engine",
            destination: "ST PETERSBURG",
            eta: null,
            draught: 9.5,
            length: 180,
            width: 28,
            lastUpdate: now - 130,
        },
        // Coast of Somalia (anti-piracy patrol)
        {
            mmsi: "211900001",
            name: "FGS HAMBURG",
            imo: null,
            callsign: "DRCD1",
            vesselType: "military",
            flag: "Germany",
            longitude: 48.5,
            latitude: 11.5,
            course: 180,
            speed: 16.0,
            heading: 178,
            navigationStatus: "under_way_using_engine",
            destination: null,
            eta: null,
            draught: 6.0,
            length: 143,
            width: 17,
            lastUpdate: now - 300,
        },
        // North Sea - Tug
        {
            mmsi: "244001001",
            name: "FAIRPLAY 33",
            imo: null,
            callsign: "PDAB1",
            vesselType: "tug",
            flag: "Netherlands",
            longitude: 4.0,
            latitude: 52.0,
            course: 280,
            speed: 8.5,
            heading: 278,
            navigationStatus: "under_way_using_engine",
            destination: "ROTTERDAM",
            eta: null,
            draught: 5.0,
            length: 45,
            width: 14,
            lastUpdate: now - 85,
        },
        // Taiwan Strait
        {
            mmsi: "416001001",
            name: "YANG MING UNITY",
            imo: "9812233",
            callsign: "BLCD1",
            vesselType: "cargo",
            flag: "Taiwan",
            longitude: 119.5,
            latitude: 24.5,
            course: 200,
            speed: 16.8,
            heading: 198,
            navigationStatus: "under_way_using_engine",
            destination: "KAOHSIUNG",
            eta: null,
            draught: 13.5,
            length: 368,
            width: 51,
            lastUpdate: now - 25,
        },
    ];

    // Add slight randomization to positions to make it feel more dynamic
    return vessels.map((v) => ({
        ...v,
        longitude: v.longitude + (Math.random() - 0.5) * 0.1,
        latitude: v.latitude + (Math.random() - 0.5) * 0.1,
        speed: v.speed ? v.speed + (Math.random() - 0.5) * 2 : null,
    }));
}

/**
 * GET /api/vessels
 * Fetches maritime vessel data
 *
 * Query parameters:
 * - region: Filter by region name
 * - type: Filter by vessel type
 * - limit: Maximum results (default: 50)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const vesselTypeFilter = searchParams.get("type") as VesselType | null;
    const limit = parseInt(searchParams.get("limit") || "50");

    // Check cache
    const now = Date.now();
    if (cachedResponse && (now - cachedResponse.timestamp) < CACHE_DURATION * 1000) {
        return NextResponse.json(cachedResponse.data, {
            headers: {
                "Cache-Control": `public, max-age=${CACHE_DURATION}`,
                "X-Cache": "HIT",
            },
        });
    }

    // Generate sample vessel data
    // In production, this would fetch from a real AIS API
    let vessels = generateSampleVessels();

    // Apply filters
    if (vesselTypeFilter) {
        vessels = vessels.filter((v) => v.vesselType === vesselTypeFilter);
    }

    vessels = vessels.slice(0, limit);

    const responseData = {
        vessels,
        count: vessels.length,
        timestamp: Math.floor(now / 1000),
        isSampleData: true,
    };

    cachedResponse = { data: responseData, timestamp: now };

    return NextResponse.json(responseData, {
        headers: {
            "Cache-Control": `public, max-age=${CACHE_DURATION}`,
            "X-Data-Source": "sample",
        },
    });
}
