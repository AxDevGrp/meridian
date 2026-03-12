/**
 * Intel Report Formatter — server-side module.
 * Takes aggregated data and produces a structured IntelReport.
 * Purely deterministic (no LLM).
 *
 * Used exclusively by API routes (not browser).
 */

import type { AggregatedData } from "@/lib/services/intel-aggregator";
import type {
    IntelReport,
    ReportGenerationRequest,
    ReportSections,
    ReportMetadata,
    ThreatLevel,
    ThreatAssessmentSection,
    MarketImpactSection,
    EntityTrackingSection,
    SocialSentimentSection,
    TimelineSection,
    ConflictSummary,
    GpsJammingSummary,
    CorrelatedInstrumentSummary,
    SectorExposure,
    PriceAlert,
    EntitySummary,
    SocialPostSummary,
    TimelineEvent,
} from "@/lib/types/intel-report";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;

// ============================================
// Severity numeric mapping
// ============================================

const SEVERITY_SCORE: Record<string, number> = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    info: 0.1,
};

function severityToNumber(s: string | undefined | null): number {
    if (!s) return 0;
    return SEVERITY_SCORE[s.toLowerCase()] ?? 0.3;
}

// ============================================
// Public API
// ============================================

/**
 * Format aggregated data into a structured intel report.
 */
export function formatIntelReport(
    request: ReportGenerationRequest,
    data: AggregatedData,
): IntelReport {
    const startMs = Date.now();

    const threatAssessment = buildThreatAssessment(data);
    const marketImpact = buildMarketImpact(data);
    const entityTracking = buildEntityTracking(data);
    const socialSentiment = buildSocialSentiment(data);
    const timeline = buildTimeline(data);
    const threatLevel = computeThreatLevel(data);

    const sections: ReportSections = {
        threatAssessment,
        marketImpact,
        entityTracking,
        socialSentiment,
        timeline,
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 hours

    const partialReport: Partial<IntelReport> = {
        regionName: request.regionName,
        threatLevel,
        sections,
    };

    const executiveSummary = generateExecutiveSummary(partialReport, data);
    const keyFindings = generateKeyFindings(partialReport, data);
    const processingTimeMs = Date.now() - startMs;

    const totalEntities =
        data.conflicts.length +
        data.gpsJamming.length +
        data.vessels.length +
        data.aircraft.length +
        data.socialPosts.length +
        data.marketInstruments.length;

    const metadata: ReportMetadata = {
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
        dataFreshness: data.fetchTimestamps,
        totalEntitiesAnalyzed: totalEntities,
        processingTimeMs,
        isSampleData: true, // all current data is sample
    };

    return {
        id: crypto.randomUUID(),
        title: `Intelligence Report: ${request.regionName}`,
        regionName: request.regionName,
        regionCenter: request.regionCenter,
        regionRadiusKm: request.regionRadiusKm,
        classification: request.classification ?? "unclassified",
        threatLevel,
        executiveSummary,
        keyFindings,
        sections,
        metadata,
        generatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
}

// ============================================
// Section Builders
// ============================================

function buildThreatAssessment(data: AggregatedData): ThreatAssessmentSection {
    const activeConflicts: ConflictSummary[] = data.conflicts.slice(0, 10).map((c: D) => ({
        id: c.eventId || c.id || "unknown",
        title: c.notes || c.subEventType || "Armed conflict event",
        severity: c.severity || mapEventTypeSeverity(c.eventType),
        location: [c.location, c.country].filter(Boolean).join(", "),
        date: c.eventDate || "",
        fatalities: c.fatalities?.reported ?? 0,
    }));

    const gpsJammingZones: GpsJammingSummary[] = data.gpsJamming.slice(0, 10).map((z: D) => ({
        id: z.id || "unknown",
        region: z.name || z.region || "Unknown",
        severity: z.severity || "medium",
        affectedArea: z.radiusKm ? `${z.radiusKm} km radius` : "Unknown extent",
        firstDetected: z.firstDetected || z.detectedAt || "",
    }));

    const riskFactors: string[] = [];
    if (data.conflicts.length > 0) {
        riskFactors.push(`${data.conflicts.length} active conflict event(s) in region`);
    }
    if (data.gpsJamming.length > 0) {
        riskFactors.push(`${data.gpsJamming.length} GPS jamming/spoofing zone(s) detected`);
    }

    const militaryVessels = data.vessels.filter(
        (v: D) => v.vesselType === "military" || v.type === "military",
    );
    if (militaryVessels.length > 0) {
        riskFactors.push(`${militaryVessels.length} military vessel(s) tracked in area`);
    }

    const highSeverityConflicts = data.conflicts.filter(
        (c: D) => c.severity === "critical" || c.severity === "high" ||
            c.eventType === "battles" || c.eventType === "explosions_remote_violence",
    );
    if (highSeverityConflicts.length > 0) {
        riskFactors.push(`${highSeverityConflicts.length} high-severity combat event(s)`);
    }

    return {
        overallThreat: computeThreatLevel(data),
        conflictCount: data.conflicts.length,
        gpsJammingCount: data.gpsJamming.length,
        activeConflicts,
        gpsJammingZones,
        riskFactors,
    };
}

function buildMarketImpact(data: AggregatedData): MarketImpactSection {
    // Build correlated instruments from correlations + market data
    const instrumentMap = new Map<string, D>();
    for (const inst of data.marketInstruments) {
        instrumentMap.set(inst.symbol, inst);
    }

    const correlatedInstruments: CorrelatedInstrumentSummary[] = data.correlations
        .slice(0, 15)
        .map((c: D) => {
            const inst = instrumentMap.get(c.symbol);
            return {
                symbol: c.symbol || "",
                name: c.instrumentName || inst?.name || c.symbol || "",
                price: inst?.price ?? inst?.latestPrice ?? 0,
                changePercent: inst?.changePercent ?? inst?.dailyChangePercent ?? 0,
                sensitivity: c.sensitivity ?? 0.5,
                direction: (c.direction as "positive" | "negative" | "mixed") || "negative",
                rationale: c.rationale || `Correlated with ${c.regionName || "region"} events`,
            };
        });

    // Sector exposure
    const sectorMap = new Map<string, { count: number; totalSens: number; direction: string }>();
    for (const ci of correlatedInstruments) {
        const inst = instrumentMap.get(ci.symbol);
        const sector = inst?.sector || "other";
        const existing = sectorMap.get(sector) || { count: 0, totalSens: 0, direction: ci.direction };
        existing.count++;
        existing.totalSens += ci.sensitivity;
        sectorMap.set(sector, existing);
    }
    const sectorExposure: SectorExposure[] = Array.from(sectorMap.entries()).map(
        ([sector, info]) => ({
            sector,
            instrumentCount: info.count,
            avgSensitivity: info.count > 0 ? info.totalSens / info.count : 0,
            direction: info.direction,
        }),
    );

    // Price alerts (instruments with >2% change)
    const priceAlerts: PriceAlert[] = data.marketInstruments
        .filter((i: D) => Math.abs(i.changePercent ?? i.dailyChangePercent ?? 0) > 2)
        .slice(0, 10)
        .map((i: D) => ({
            symbol: i.symbol,
            name: i.name || i.symbol,
            changePercent: i.changePercent ?? i.dailyChangePercent ?? 0,
            threshold: 2.0,
            triggered: true,
        }));

    // Overall impact level
    const maxChange = Math.max(
        ...correlatedInstruments.map((ci) => Math.abs(ci.changePercent)),
        0,
    );
    let overallImpact: MarketImpactSection["overallImpact"] = "none";
    if (maxChange >= 5) overallImpact = "severe";
    else if (maxChange >= 3) overallImpact = "significant";
    else if (maxChange >= 1.5) overallImpact = "moderate";
    else if (correlatedInstruments.length > 0) overallImpact = "minimal";

    return {
        overallImpact,
        correlatedInstruments,
        sectorExposure,
        priceAlerts,
    };
}

function buildEntityTracking(data: AggregatedData): EntityTrackingSection {
    const notableAircraft: EntitySummary[] = data.aircraft.slice(0, 5).map((a: D) => ({
        id: a.icao24 || a.id || "unknown",
        name: a.callsign || a.icao24 || "Unknown Aircraft",
        type: "aircraft",
        detail: [a.originCountry, a.onGround ? "On ground" : "Airborne"]
            .filter(Boolean)
            .join(" · "),
        lastSeen: a.lastContact
            ? new Date(a.lastContact * 1000).toISOString()
            : new Date().toISOString(),
    }));

    const notableVessels: EntitySummary[] = data.vessels.slice(0, 5).map((v: D) => ({
        id: v.mmsi || v.id || "unknown",
        name: v.name || v.vesselName || "Unknown Vessel",
        type: v.vesselType || v.type || "vessel",
        detail: [v.flag || v.flagCountry, v.navigationStatus || v.status]
            .filter(Boolean)
            .join(" · "),
        lastSeen: v.lastPositionUpdate || v.timestamp || new Date().toISOString(),
    }));

    // Satellites are not fetched in the aggregator currently, leave empty
    const notableSatellites: EntitySummary[] = [];

    return {
        aircraftCount: data.aircraft.length,
        vesselCount: data.vessels.length,
        satelliteCount: 0,
        notableAircraft,
        notableVessels,
        notableSatellites,
    };
}

function buildSocialSentiment(data: AggregatedData): SocialSentimentSection {
    const posts = data.socialPosts;

    // Platform breakdown
    const platformMap = new Map<string, { count: number; totalSentiment: number }>();
    for (const p of posts) {
        const platform = p.platform || "unknown";
        const existing = platformMap.get(platform) || { count: 0, totalSentiment: 0 };
        existing.count++;
        existing.totalSentiment += (p.sentimentScore as number) ?? 0;
        platformMap.set(platform, existing);
    }
    const platformBreakdown = Array.from(platformMap.entries()).map(([platform, info]) => ({
        platform,
        count: info.count,
        avgSentiment: info.count > 0 ? info.totalSentiment / info.count : 0,
    }));

    // Top posts by engagement
    const topPosts: SocialPostSummary[] = [...posts]
        .sort((a: D, b: D) => {
            const aScore = (a.engagement?.likes ?? 0) + (a.engagement?.reposts ?? 0);
            const bScore = (b.engagement?.likes ?? 0) + (b.engagement?.reposts ?? 0);
            return bScore - aScore;
        })
        .slice(0, 5)
        .map((p: D) => ({
            id: p.id || "unknown",
            platform: p.platform || "unknown",
            author: p.author || "Unknown",
            content: typeof p.content === "string" ? p.content.slice(0, 280) : "",
            sentiment: (p.sentimentScore as number) ?? 0,
            engagementScore:
                (p.engagement?.likes ?? 0) +
                (p.engagement?.reposts ?? 0) +
                (p.engagement?.replies ?? 0),
            postedAt: p.postedAt || "",
        }));

    // Compute overall sentiment
    const avgSentiment =
        posts.length > 0
            ? posts.reduce((sum: number, p: D) => sum + ((p.sentimentScore as number) ?? 0), 0) /
            posts.length
            : 0;

    let overallSentiment: SocialSentimentSection["overallSentiment"] = "neutral";
    if (avgSentiment <= -0.5) overallSentiment = "very_negative";
    else if (avgSentiment <= -0.15) overallSentiment = "negative";
    else if (avgSentiment >= 0.5) overallSentiment = "very_positive";
    else if (avgSentiment >= 0.15) overallSentiment = "positive";

    // Sentiment trend (simple heuristic: compare first half vs second half)
    let sentimentTrend: SocialSentimentSection["sentimentTrend"] = "stable";
    if (posts.length >= 4) {
        const mid = Math.floor(posts.length / 2);
        const firstHalf = posts.slice(0, mid);
        const secondHalf = posts.slice(mid);
        const firstAvg =
            firstHalf.reduce((s: number, p: D) => s + ((p.sentimentScore as number) ?? 0), 0) /
            firstHalf.length;
        const secondAvg =
            secondHalf.reduce((s: number, p: D) => s + ((p.sentimentScore as number) ?? 0), 0) /
            secondHalf.length;
        const delta = secondAvg - firstAvg;
        if (delta < -0.1) sentimentTrend = "deteriorating";
        else if (delta > 0.1) sentimentTrend = "improving";
    }

    return {
        overallSentiment,
        postCount: posts.length,
        platformBreakdown,
        topPosts,
        sentimentTrend,
    };
}

function buildTimeline(data: AggregatedData): TimelineSection {
    const events: TimelineEvent[] = [];

    // Conflicts
    for (const c of data.conflicts) {
        events.push({
            timestamp: c.eventDate || new Date().toISOString(),
            type: "conflict",
            title: c.notes?.slice(0, 100) || c.subEventType || "Conflict event",
            description: [c.actor1, c.actor2].filter(Boolean).join(" vs "),
            severity: c.severity || mapEventTypeSeverity(c.eventType),
            location:
                c.latitude != null && c.longitude != null
                    ? { lat: c.latitude, lng: c.longitude }
                    : undefined,
        });
    }

    // GPS Jamming
    for (const z of data.gpsJamming) {
        events.push({
            timestamp: z.firstDetected || z.detectedAt || new Date().toISOString(),
            type: "gps_jamming",
            title: `GPS ${z.interferenceType || "jamming"} — ${z.name || "Unknown zone"}`,
            description: `Severity: ${z.severity || "medium"}, ${z.reportCount || 0} reports`,
            severity: z.severity || "medium",
            location:
                z.latitude != null && z.longitude != null
                    ? { lat: z.latitude, lng: z.longitude }
                    : undefined,
        });
    }

    // Vessels (notable only — military, large tankers)
    for (const v of data.vessels.filter(
        (v: D) => v.vesselType === "military" || v.type === "military" || v.vesselType === "tanker",
    ).slice(0, 5)) {
        events.push({
            timestamp: v.lastPositionUpdate || v.timestamp || new Date().toISOString(),
            type: "vessel",
            title: `Vessel: ${v.name || v.vesselName || v.mmsi || "Unknown"}`,
            description: `${v.vesselType || v.type || "vessel"} · ${v.flag || v.flagCountry || "Unknown flag"}`,
            severity: v.vesselType === "military" || v.type === "military" ? "high" : "low",
            location:
                v.latitude != null && v.longitude != null
                    ? { lat: v.latitude, lng: v.longitude }
                    : undefined,
        });
    }

    // Social posts (top 3 by engagement)
    const topSocial = [...data.socialPosts]
        .sort((a: D, b: D) => {
            const aE = (a.engagement?.likes ?? 0) + (a.engagement?.reposts ?? 0);
            const bE = (b.engagement?.likes ?? 0) + (b.engagement?.reposts ?? 0);
            return bE - aE;
        })
        .slice(0, 3);
    for (const p of topSocial) {
        events.push({
            timestamp: p.postedAt || new Date().toISOString(),
            type: "social",
            title: `[${(p.platform || "social").toUpperCase()}] ${p.author || "Unknown"}`,
            description: typeof p.content === "string" ? p.content.slice(0, 150) : "",
            severity: (p.sentimentScore ?? 0) < -0.3 ? "medium" : "low",
        });
    }

    // Sort timeline by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const timestamps = events.map((e) => new Date(e.timestamp).getTime()).filter(isFinite);
    const periodStart = timestamps.length > 0
        ? new Date(Math.min(...timestamps)).toISOString()
        : new Date().toISOString();
    const periodEnd = timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : new Date().toISOString();

    return {
        events,
        periodStart,
        periodEnd,
    };
}

// ============================================
// Threat Level Computation
// ============================================

/**
 * Weighted threat-level algorithm:
 * - Conflict: 35%
 * - GPS Jamming: 20%
 * - Vessel: 15%
 * - Sentiment: 15%
 * - Market: 15%
 *
 * Score 0–1, then map to ThreatLevel.
 */
function computeThreatLevel(data: AggregatedData): ThreatLevel {
    // --- Conflict score (0–1) ---
    const conflictCount = data.conflicts.length;
    const maxConflictSeverity = Math.max(
        ...data.conflicts.map((c: D) => severityToNumber(c.severity || mapEventTypeSeverity(c.eventType))),
        0,
    );
    const conflictScore = Math.min(1, (conflictCount / 5) * 0.6 + maxConflictSeverity * 0.4);

    // --- GPS Jamming score (0–1) ---
    const jammingCount = data.gpsJamming.length;
    const maxJammingSeverity = Math.max(
        ...data.gpsJamming.map((z: D) => severityToNumber(z.severity)),
        0,
    );
    const jammingScore = Math.min(1, (jammingCount / 3) * 0.5 + maxJammingSeverity * 0.5);

    // --- Vessel score (0–1) — military/suspicious presence ---
    const militaryVessels = data.vessels.filter(
        (v: D) => v.vesselType === "military" || v.type === "military",
    );
    const vesselScore = Math.min(1, militaryVessels.length / 3);

    // --- Sentiment score (0–1) — negative sentiment ratio ---
    const negativePosts = data.socialPosts.filter(
        (p: D) => ((p.sentimentScore as number) ?? 0) < -0.2,
    );
    const sentimentScore =
        data.socialPosts.length > 0
            ? negativePosts.length / data.socialPosts.length
            : 0;

    // --- Market score (0–1) — price volatility ---
    const changes = data.marketInstruments.map(
        (i: D) => Math.abs((i.changePercent ?? i.dailyChangePercent ?? 0) as number),
    );
    const maxChange = Math.max(...changes, 0);
    const marketScore = Math.min(1, maxChange / 5);

    // Weighted composite
    const composite =
        conflictScore * 0.35 +
        jammingScore * 0.2 +
        vesselScore * 0.15 +
        sentimentScore * 0.15 +
        marketScore * 0.15;

    if (composite >= 0.8) return "critical";
    if (composite >= 0.6) return "high";
    if (composite >= 0.4) return "elevated";
    if (composite >= 0.2) return "guarded";
    return "low";
}

// ============================================
// Summary Generators
// ============================================

function generateExecutiveSummary(
    report: Partial<IntelReport>,
    data: AggregatedData,
): string {
    const region = report.regionName || "Unknown Region";
    const date = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const threatLevel = report.threatLevel || "low";
    const conflictCount = data.conflicts.length;
    const jammingCount = data.gpsJamming.length;
    const vesselCount = data.vessels.length;
    const aircraftCount = data.aircraft.length;

    const sections = report.sections;
    const marketImpact = sections?.marketImpact?.overallImpact || "none";
    const sentiment = sections?.socialSentiment?.overallSentiment || "neutral";

    const parts: string[] = [];

    parts.push(
        `As of ${date}, the ${region} region is assessed at a ${threatLevel.toUpperCase()} threat level.`,
    );

    if (conflictCount > 0 || jammingCount > 0) {
        const conflictStr = conflictCount > 0 ? `${conflictCount} active conflict event(s)` : "";
        const jammingStr = jammingCount > 0 ? `${jammingCount} GPS jamming zone(s)` : "";
        parts.push(
            `The region has ${[conflictStr, jammingStr].filter(Boolean).join(" and ")} currently monitored.`,
        );
    }

    if (vesselCount > 0 || aircraftCount > 0) {
        parts.push(
            `Entity tracking shows ${vesselCount} vessel(s) and ${aircraftCount} aircraft operating in the area.`,
        );
    }

    if (marketImpact !== "none") {
        parts.push(
            `Market impact is assessed as ${marketImpact}, with correlated financial instruments showing sensitivity to regional developments.`,
        );
    }

    const sentimentMap: Record<string, string> = {
        very_negative: "strongly negative",
        negative: "negative",
        neutral: "neutral",
        positive: "positive",
        very_positive: "strongly positive",
    };
    parts.push(
        `Social media sentiment is currently ${sentimentMap[sentiment] || sentiment}.`,
    );

    return parts.join(" ");
}

function generateKeyFindings(
    report: Partial<IntelReport>,
    data: AggregatedData,
): string[] {
    const findings: string[] = [];

    // Top conflict finding
    if (data.conflicts.length > 0) {
        const topConflict = data.conflicts[0] as D;
        findings.push(
            `${data.conflicts.length} conflict event(s) detected — most notable: ${topConflict.notes?.slice(0, 120) || topConflict.subEventType || "armed conflict"} in ${topConflict.country || "the region"}.`,
        );
    }

    // GPS jamming finding
    if (data.gpsJamming.length > 0) {
        findings.push(
            `${data.gpsJamming.length} GPS interference zone(s) active, indicating electronic warfare or navigation denial activity.`,
        );
    }

    // Military vessel finding
    const military = data.vessels.filter(
        (v: D) => v.vesselType === "military" || v.type === "military",
    );
    if (military.length > 0) {
        findings.push(
            `${military.length} military vessel(s) operating in the area, suggesting heightened naval presence.`,
        );
    }

    // Market finding
    const bigMovers = data.marketInstruments.filter(
        (i: D) => Math.abs(i.changePercent ?? i.dailyChangePercent ?? 0) > 2,
    );
    if (bigMovers.length > 0) {
        findings.push(
            `${bigMovers.length} correlated financial instrument(s) showing >2% price movement, indicating market sensitivity to regional events.`,
        );
    }

    // Sentiment finding
    const negativePosts = data.socialPosts.filter(
        (p: D) => ((p.sentimentScore as number) ?? 0) < -0.3,
    );
    if (negativePosts.length > 0) {
        findings.push(
            `${negativePosts.length} of ${data.socialPosts.length} monitored social posts carry significantly negative sentiment.`,
        );
    }

    // Aircraft finding
    if (data.aircraft.length > 0) {
        findings.push(
            `${data.aircraft.length} aircraft tracked in the region airspace.`,
        );
    }

    // Correlation finding
    if (data.correlations.length > 0) {
        findings.push(
            `${data.correlations.length} instrument–region correlation(s) active for this area.`,
        );
    }

    // Return 3–7 findings
    return findings.slice(0, 7);
}

// ============================================
// Utility
// ============================================

/** Map ACLED event type to a severity string */
function mapEventTypeSeverity(eventType: string | undefined): string {
    if (!eventType) return "medium";
    switch (eventType) {
        case "battles":
        case "explosions_remote_violence":
            return "high";
        case "violence_against_civilians":
            return "critical";
        case "riots":
            return "medium";
        case "protests":
            return "low";
        case "strategic_developments":
            return "info";
        default:
            return "medium";
    }
}
