import { NextResponse } from "next/server";
import type { IntelReport, ThreatLevel, ReportClassification } from "@/lib/types/intel-report";
import { getAllReports, reportCount, storeReport } from "@/lib/stores/report-store-server";

/**
 * GET /api/intel/reports
 *
 * Returns a list of all generated reports (summary only).
 * If no reports exist, seeds 2 sample pre-generated reports.
 */
export async function GET() {
    // Seed sample reports on first access
    if (reportCount() === 0) {
        seedSampleReports();
    }

    const reports = getAllReports();

    // Return summary projections (not full sections)
    const summaries = reports.map((r) => ({
        id: r.id,
        title: r.title,
        regionName: r.regionName,
        regionCenter: r.regionCenter,
        regionRadiusKm: r.regionRadiusKm,
        threatLevel: r.threatLevel,
        classification: r.classification,
        executiveSummary: r.executiveSummary,
        keyFindings: r.keyFindings,
        generatedAt: r.generatedAt,
        expiresAt: r.expiresAt,
        metadata: {
            isSampleData: r.metadata.isSampleData,
            totalEntitiesAnalyzed: r.metadata.totalEntitiesAnalyzed,
            processingTimeMs: r.metadata.processingTimeMs,
        },
    }));

    return NextResponse.json(
        {
            success: true,
            data: summaries,
            count: summaries.length,
            timestamp: new Date().toISOString(),
        },
        {
            headers: {
                "Cache-Control": "public, max-age=30",
            },
        },
    );
}

// ============================================
// Sample Report Seeds
// ============================================

function seedSampleReports() {
    const now = new Date();
    const expires = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // --- Strait of Hormuz Report ---
    const hormuzReport: IntelReport = {
        id: crypto.randomUUID(),
        title: "Intelligence Report: Strait of Hormuz",
        regionName: "Strait of Hormuz",
        regionCenter: { lat: 26.5667, lng: 56.25 },
        regionRadiusKm: 200,
        classification: "internal" as ReportClassification,
        threatLevel: "high" as ThreatLevel,
        executiveSummary:
            `As of ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}, ` +
            "the Strait of Hormuz region is assessed at a HIGH threat level. " +
            "The region has 3 active conflict event(s) and 2 GPS jamming zone(s) currently monitored. " +
            "Entity tracking shows 4 vessel(s) and 2 aircraft operating in the area. " +
            "Market impact is assessed as significant, with correlated financial instruments showing sensitivity to regional developments. " +
            "Social media sentiment is currently negative.",
        keyFindings: [
            "3 conflict events detected — most notable: Naval confrontation between IRGCN fast boats and commercial tanker escort in the Strait of Hormuz.",
            "2 GPS interference zones active near the Strait, indicating electronic warfare or navigation denial activity.",
            "2 military vessel(s) operating in the area, suggesting heightened naval presence.",
            "4 correlated financial instruments showing >2% price movement — WTI Crude +3.2%, Brent Crude +2.8%.",
            "7 of 15 monitored social posts carry significantly negative sentiment regarding regional tensions.",
        ],
        sections: {
            threatAssessment: {
                overallThreat: "high",
                conflictCount: 3,
                gpsJammingCount: 2,
                activeConflicts: [
                    {
                        id: "sample-hormuz-001",
                        title: "Naval confrontation between IRGCN fast boats and commercial tanker escort",
                        severity: "high",
                        location: "Strait of Hormuz, Iran",
                        date: yesterday.toISOString(),
                        fatalities: 0,
                    },
                    {
                        id: "sample-hormuz-002",
                        title: "Drone strike on oil infrastructure near Fujairah",
                        severity: "critical",
                        location: "Fujairah, UAE",
                        date: yesterday.toISOString(),
                        fatalities: 2,
                    },
                    {
                        id: "sample-hormuz-003",
                        title: "Armed clash between naval forces in disputed waters",
                        severity: "high",
                        location: "Persian Gulf, International Waters",
                        date: now.toISOString(),
                        fatalities: 0,
                    },
                ],
                gpsJammingZones: [
                    {
                        id: "sample-gps-hormuz-001",
                        region: "Strait of Hormuz",
                        severity: "high",
                        affectedArea: "80 km radius",
                        firstDetected: yesterday.toISOString(),
                    },
                    {
                        id: "sample-gps-hormuz-002",
                        region: "Northern Persian Gulf",
                        severity: "medium",
                        affectedArea: "50 km radius",
                        firstDetected: now.toISOString(),
                    },
                ],
                riskFactors: [
                    "3 active conflict events in region",
                    "2 GPS jamming/spoofing zones detected",
                    "2 military vessels tracked in area",
                    "2 high-severity combat events",
                ],
            },
            marketImpact: {
                overallImpact: "significant",
                correlatedInstruments: [
                    {
                        symbol: "CL=F",
                        name: "WTI Crude Oil Futures",
                        price: 78.45,
                        changePercent: 3.2,
                        sensitivity: 0.92,
                        direction: "positive",
                        rationale: "Strait of Hormuz disruption risk directly impacts oil transit",
                    },
                    {
                        symbol: "BZ=F",
                        name: "Brent Crude Oil Futures",
                        price: 82.10,
                        changePercent: 2.8,
                        sensitivity: 0.89,
                        direction: "positive",
                        rationale: "Global benchmark sensitive to Persian Gulf supply disruption",
                    },
                    {
                        symbol: "LMT",
                        name: "Lockheed Martin",
                        price: 472.30,
                        changePercent: 1.5,
                        sensitivity: 0.65,
                        direction: "positive",
                        rationale: "Defense sector benefits from regional escalation",
                    },
                ],
                sectorExposure: [
                    { sector: "energy", instrumentCount: 2, avgSensitivity: 0.905, direction: "positive" },
                    { sector: "defense", instrumentCount: 1, avgSensitivity: 0.65, direction: "positive" },
                ],
                priceAlerts: [
                    { symbol: "CL=F", name: "WTI Crude Oil Futures", changePercent: 3.2, threshold: 2.0, triggered: true },
                    { symbol: "BZ=F", name: "Brent Crude Oil Futures", changePercent: 2.8, threshold: 2.0, triggered: true },
                ],
            },
            entityTracking: {
                aircraftCount: 2,
                vesselCount: 4,
                satelliteCount: 0,
                notableAircraft: [
                    { id: "ac-sample-001", name: "UAE AF C-130", type: "aircraft", detail: "United Arab Emirates · Airborne", lastSeen: now.toISOString() },
                    { id: "ac-sample-002", name: "USN P-8A", type: "aircraft", detail: "United States · Maritime patrol", lastSeen: now.toISOString() },
                ],
                notableVessels: [
                    { id: "vs-sample-001", name: "USS Bataan (LHD-5)", type: "military", detail: "United States · Under way", lastSeen: now.toISOString() },
                    { id: "vs-sample-002", name: "IRIN Sahand", type: "military", detail: "Iran · Under way", lastSeen: now.toISOString() },
                    { id: "vs-sample-003", name: "MT Pacific Voyager", type: "tanker", detail: "Liberia · Under way using engine", lastSeen: now.toISOString() },
                ],
                notableSatellites: [],
            },
            socialSentiment: {
                overallSentiment: "negative",
                postCount: 15,
                platformBreakdown: [
                    { platform: "x", count: 8, avgSentiment: -0.35 },
                    { platform: "whitehouse", count: 3, avgSentiment: -0.2 },
                    { platform: "truth_social", count: 4, avgSentiment: -0.45 },
                ],
                topPosts: [
                    {
                        id: "sp-001",
                        platform: "whitehouse",
                        author: "White House",
                        content: "The United States condemns provocative actions in the Strait of Hormuz and reaffirms commitment to freedom of navigation.",
                        sentiment: -0.3,
                        engagementScore: 45000,
                        postedAt: now.toISOString(),
                    },
                    {
                        id: "sp-002",
                        platform: "x",
                        author: "@MaritimeAnalyst",
                        content: "BREAKING: Reports of naval confrontation in Strait of Hormuz. Oil prices surging. Multiple military vessels in area.",
                        sentiment: -0.6,
                        engagementScore: 12000,
                        postedAt: now.toISOString(),
                    },
                ],
                sentimentTrend: "deteriorating",
            },
            timeline: {
                events: [
                    {
                        timestamp: now.toISOString(),
                        type: "conflict",
                        title: "Armed clash between naval forces in disputed waters",
                        description: "IRGCN vs Coalition forces",
                        severity: "high",
                        location: { lat: 26.5, lng: 56.3 },
                    },
                    {
                        timestamp: now.toISOString(),
                        type: "gps_jamming",
                        title: "GPS jamming — Northern Persian Gulf",
                        description: "Severity: medium, 45 reports",
                        severity: "medium",
                        location: { lat: 27.0, lng: 56.0 },
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "conflict",
                        title: "Drone strike on oil infrastructure near Fujairah",
                        description: "Unknown vs UAE forces",
                        severity: "critical",
                        location: { lat: 25.1, lng: 56.3 },
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "market",
                        title: "WTI Crude +3.2%",
                        description: "Significant price movement correlated with regional events",
                        severity: "high",
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "social",
                        title: "[WHITEHOUSE] White House",
                        description: "The United States condemns provocative actions in the Strait of Hormuz...",
                        severity: "medium",
                    },
                ],
                periodStart: yesterday.toISOString(),
                periodEnd: now.toISOString(),
            },
        },
        metadata: {
            generatedBy: "meridian-intel-engine",
            version: "1.0.0",
            dataSources: [
                "conflicts/acled",
                "gps-jamming/gpsjam",
                "vessels/ais",
                "aircraft/opensky",
                "social-feed/multi",
                "market/instruments",
                "market/correlations",
            ],
            dataFreshness: {},
            totalEntitiesAnalyzed: 26,
            processingTimeMs: 0,
            isSampleData: true,
        },
        generatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
    };

    // --- South China Sea Report ---
    const scsReport: IntelReport = {
        id: crypto.randomUUID(),
        title: "Intelligence Report: South China Sea",
        regionName: "South China Sea",
        regionCenter: { lat: 15.0, lng: 115.0 },
        regionRadiusKm: 500,
        classification: "unclassified" as ReportClassification,
        threatLevel: "elevated" as ThreatLevel,
        executiveSummary:
            `As of ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}, ` +
            "the South China Sea region is assessed at an ELEVATED threat level. " +
            "The region has 1 active conflict event and military vessel activity currently monitored. " +
            "Entity tracking shows 6 vessel(s) and 3 aircraft operating in the area. " +
            "Market impact is assessed as moderate, with shipping and defense sectors showing sensitivity to regional developments. " +
            "Social media sentiment is currently neutral with deteriorating trend.",
        keyFindings: [
            "1 conflict event detected — Maritime militia confrontation near Scarborough Shoal between PRC and Philippine vessels.",
            "3 military vessel(s) operating in the area, including a PLA Navy destroyer and 2 coast guard vessels.",
            "2 correlated financial instruments showing notable movement — shipping ETF -1.8%, defense sector +1.2%.",
            "Increased PLA Air Force activity with J-16 fighters patrolling the Pratas Islands airspace.",
            "5 of 12 monitored social posts carry negative sentiment regarding freedom of navigation operations.",
        ],
        sections: {
            threatAssessment: {
                overallThreat: "elevated",
                conflictCount: 1,
                gpsJammingCount: 0,
                activeConflicts: [
                    {
                        id: "sample-scs-001",
                        title: "Maritime militia confrontation near Scarborough Shoal",
                        severity: "medium",
                        location: "Scarborough Shoal, South China Sea",
                        date: yesterday.toISOString(),
                        fatalities: 0,
                    },
                ],
                gpsJammingZones: [],
                riskFactors: [
                    "1 active conflict event in region",
                    "3 military vessels tracked in area",
                    "Heightened air force patrol activity",
                ],
            },
            marketImpact: {
                overallImpact: "moderate",
                correlatedInstruments: [
                    {
                        symbol: "SBLK",
                        name: "Star Bulk Carriers",
                        price: 18.92,
                        changePercent: -1.8,
                        sensitivity: 0.72,
                        direction: "negative",
                        rationale: "Shipping disruption risk in major trade route",
                    },
                    {
                        symbol: "LMT",
                        name: "Lockheed Martin",
                        price: 472.30,
                        changePercent: 1.2,
                        sensitivity: 0.58,
                        direction: "positive",
                        rationale: "Indo-Pacific defense posture escalation",
                    },
                    {
                        symbol: "RTX",
                        name: "RTX Corporation",
                        price: 112.50,
                        changePercent: 0.9,
                        sensitivity: 0.52,
                        direction: "positive",
                        rationale: "Regional defense spending increase expected",
                    },
                ],
                sectorExposure: [
                    { sector: "shipping", instrumentCount: 1, avgSensitivity: 0.72, direction: "negative" },
                    { sector: "defense", instrumentCount: 2, avgSensitivity: 0.55, direction: "positive" },
                ],
                priceAlerts: [],
            },
            entityTracking: {
                aircraftCount: 3,
                vesselCount: 6,
                satelliteCount: 0,
                notableAircraft: [
                    { id: "ac-scs-001", name: "PLA J-16", type: "aircraft", detail: "China · Fighter patrol", lastSeen: now.toISOString() },
                    { id: "ac-scs-002", name: "USN P-8A Poseidon", type: "aircraft", detail: "United States · Maritime patrol", lastSeen: now.toISOString() },
                ],
                notableVessels: [
                    { id: "vs-scs-001", name: "CNS Nanning (162)", type: "military", detail: "China · PLA Navy destroyer", lastSeen: now.toISOString() },
                    { id: "vs-scs-002", name: "CCG 5901", type: "military", detail: "China · Coast Guard", lastSeen: now.toISOString() },
                    { id: "vs-scs-003", name: "BRP Sierra Madre", type: "military", detail: "Philippines · Navy", lastSeen: now.toISOString() },
                ],
                notableSatellites: [],
            },
            socialSentiment: {
                overallSentiment: "neutral",
                postCount: 12,
                platformBreakdown: [
                    { platform: "x", count: 7, avgSentiment: -0.1 },
                    { platform: "whitehouse", count: 2, avgSentiment: -0.15 },
                    { platform: "truth_social", count: 3, avgSentiment: -0.05 },
                ],
                topPosts: [
                    {
                        id: "sp-scs-001",
                        platform: "x",
                        author: "@IndoPacificWatch",
                        content: "PLA Navy destroyer spotted near Scarborough Shoal. Philippines Coast Guard deploying additional vessels to area.",
                        sentiment: -0.4,
                        engagementScore: 8500,
                        postedAt: now.toISOString(),
                    },
                ],
                sentimentTrend: "deteriorating",
            },
            timeline: {
                events: [
                    {
                        timestamp: now.toISOString(),
                        type: "vessel",
                        title: "Vessel: CNS Nanning (162)",
                        description: "military · China",
                        severity: "high",
                        location: { lat: 15.2, lng: 117.8 },
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "conflict",
                        title: "Maritime militia confrontation near Scarborough Shoal",
                        description: "PRC Maritime Militia vs Philippine Coast Guard",
                        severity: "medium",
                        location: { lat: 15.15, lng: 117.76 },
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "aircraft",
                        title: "PLA J-16 fighter patrol",
                        description: "China · Pratas Islands airspace",
                        severity: "medium",
                        location: { lat: 20.7, lng: 116.7 },
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: "social",
                        title: "[X] @IndoPacificWatch",
                        description: "PLA Navy destroyer spotted near Scarborough Shoal...",
                        severity: "low",
                    },
                ],
                periodStart: yesterday.toISOString(),
                periodEnd: now.toISOString(),
            },
        },
        metadata: {
            generatedBy: "meridian-intel-engine",
            version: "1.0.0",
            dataSources: [
                "conflicts/acled",
                "gps-jamming/gpsjam",
                "vessels/ais",
                "aircraft/opensky",
                "social-feed/multi",
                "market/instruments",
                "market/correlations",
            ],
            dataFreshness: {},
            totalEntitiesAnalyzed: 22,
            processingTimeMs: 0,
            isSampleData: true,
        },
        generatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
    };

    storeReport(hormuzReport);
    storeReport(scsReport);
}
