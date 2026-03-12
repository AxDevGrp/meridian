import { NextRequest, NextResponse } from "next/server";
import type { Watchlist, WatchlistItem } from "@/lib/types/market";

/**
 * Market Watchlist API route
 * CRUD for watchlist management (sample data backed)
 *
 * GET  — Returns the default watchlist
 * POST — Body { symbols: string[] } — replaces watchlist items
 *
 * In production, this would connect to a database.
 * The frontend persists watchlists in localStorage independently.
 */

const DEFAULT_SYMBOLS = ["CL=F", "BZ=F", "GLD", "^VIX", "^GSPC", "TSM", "LMT", "ZIM"];

// In-memory store for the server session
let serverWatchlist: Watchlist | null = null;

function buildWatchlist(symbols: string[]): Watchlist {
    const now = new Date().toISOString();
    const items: WatchlistItem[] = symbols.map((symbol) => ({
        symbol,
        addedAt: now,
    }));

    return {
        id: "default",
        name: "Default Watchlist",
        items,
        createdAt: now,
        updatedAt: now,
    };
}

function getWatchlist(): Watchlist {
    if (!serverWatchlist) {
        serverWatchlist = buildWatchlist(DEFAULT_SYMBOLS);
    }
    return serverWatchlist;
}

export async function GET() {
    try {
        const watchlist = getWatchlist();

        return NextResponse.json(
            {
                watchlist,
                isSampleData: true,
            },
            {
                headers: {
                    "Cache-Control": "no-cache",
                    "X-Data-Source": "sample",
                },
            }
        );
    } catch (error) {
        console.error("Watchlist GET error:", error);
        return NextResponse.json(
            { error: "Failed to fetch watchlist" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const symbols: string[] = body?.symbols;

        if (!Array.isArray(symbols)) {
            return NextResponse.json(
                { error: "Request body must include `symbols` as a string array" },
                { status: 400 }
            );
        }

        // Validate: all items should be non-empty strings
        const cleaned = symbols
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim());

        serverWatchlist = buildWatchlist(cleaned);

        return NextResponse.json(
            {
                watchlist: serverWatchlist,
                isSampleData: true,
            },
            {
                headers: {
                    "Cache-Control": "no-cache",
                },
            }
        );
    } catch (error) {
        console.error("Watchlist POST error:", error);
        return NextResponse.json(
            { error: "Failed to update watchlist" },
            { status: 500 }
        );
    }
}
