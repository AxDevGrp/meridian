/**
 * Intelligence Report types.
 * Structured report format for regional geopolitical intelligence summaries.
 */

// ============================================
// Enum / Union Types
// ============================================

export type ReportClassification = "unclassified" | "internal" | "confidential" | "restricted";
export type ThreatLevel = "critical" | "high" | "elevated" | "guarded" | "low";

// ============================================
// Core Report
// ============================================

export interface IntelReport {
    id: string;
    title: string;
    regionName: string;
    regionCenter: { lat: number; lng: number };
    regionRadiusKm: number;
    classification: ReportClassification;
    threatLevel: ThreatLevel;
    executiveSummary: string;
    keyFindings: string[];
    sections: ReportSections;
    metadata: ReportMetadata;
    generatedAt: string;
    expiresAt: string;
}

// ============================================
// Report Sections
// ============================================

export interface ReportSections {
    threatAssessment: ThreatAssessmentSection;
    marketImpact: MarketImpactSection;
    entityTracking: EntityTrackingSection;
    socialSentiment: SocialSentimentSection;
    timeline: TimelineSection;
}

// ---- Threat Assessment ----

export interface ThreatAssessmentSection {
    overallThreat: ThreatLevel;
    conflictCount: number;
    gpsJammingCount: number;
    activeConflicts: ConflictSummary[];
    gpsJammingZones: GpsJammingSummary[];
    riskFactors: string[];
}

export interface ConflictSummary {
    id: string;
    title: string;
    severity: string;
    location: string;
    date: string;
    fatalities: number;
}

export interface GpsJammingSummary {
    id: string;
    region: string;
    severity: string;
    affectedArea: string;
    firstDetected: string;
}

// ---- Market Impact ----

export interface MarketImpactSection {
    overallImpact: "severe" | "significant" | "moderate" | "minimal" | "none";
    correlatedInstruments: CorrelatedInstrumentSummary[];
    sectorExposure: SectorExposure[];
    priceAlerts: PriceAlert[];
}

export interface CorrelatedInstrumentSummary {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    sensitivity: number;
    direction: "positive" | "negative" | "mixed";
    rationale: string;
}

export interface SectorExposure {
    sector: string;
    instrumentCount: number;
    avgSensitivity: number;
    direction: string;
}

export interface PriceAlert {
    symbol: string;
    name: string;
    changePercent: number;
    threshold: number;
    triggered: boolean;
}

// ---- Entity Tracking ----

export interface EntityTrackingSection {
    aircraftCount: number;
    vesselCount: number;
    satelliteCount: number;
    notableAircraft: EntitySummary[];
    notableVessels: EntitySummary[];
    notableSatellites: EntitySummary[];
}

export interface EntitySummary {
    id: string;
    name: string;
    type: string;
    detail: string;
    lastSeen: string;
}

// ---- Social Sentiment ----

export interface SocialSentimentSection {
    overallSentiment: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
    postCount: number;
    platformBreakdown: { platform: string; count: number; avgSentiment: number }[];
    topPosts: SocialPostSummary[];
    sentimentTrend: "deteriorating" | "stable" | "improving";
}

export interface SocialPostSummary {
    id: string;
    platform: string;
    author: string;
    content: string;
    sentiment: number;
    engagementScore: number;
    postedAt: string;
}

// ---- Timeline ----

export interface TimelineSection {
    events: TimelineEvent[];
    periodStart: string;
    periodEnd: string;
}

export interface TimelineEvent {
    timestamp: string;
    type: "conflict" | "gps_jamming" | "vessel" | "aircraft" | "social" | "market" | "alert";
    title: string;
    description: string;
    severity: string;
    location?: { lat: number; lng: number };
}

// ============================================
// Metadata
// ============================================

export interface ReportMetadata {
    generatedBy: string;
    version: string;
    dataSources: string[];
    dataFreshness: Record<string, string>;
    totalEntitiesAnalyzed: number;
    processingTimeMs: number;
    isSampleData: boolean;
}

// ============================================
// Request / Generation
// ============================================

export interface ReportGenerationRequest {
    regionName: string;
    regionCenter: { lat: number; lng: number };
    regionRadiusKm: number;
    classification?: ReportClassification;
    timeframeHours?: number;
}

// ============================================
// Predefined Regions (match Phase 3 seed data)
// ============================================

export const PREDEFINED_REGIONS: ReportGenerationRequest[] = [
    { regionName: "Strait of Hormuz", regionCenter: { lat: 26.5667, lng: 56.25 }, regionRadiusKm: 200 },
    { regionName: "South China Sea", regionCenter: { lat: 15.0, lng: 115.0 }, regionRadiusKm: 500 },
    { regionName: "Black Sea", regionCenter: { lat: 43.0, lng: 34.0 }, regionRadiusKm: 400 },
    { regionName: "Eastern Mediterranean", regionCenter: { lat: 34.0, lng: 33.0 }, regionRadiusKm: 300 },
    { regionName: "Taiwan Strait", regionCenter: { lat: 24.0, lng: 119.0 }, regionRadiusKm: 200 },
    { regionName: "Red Sea / Gulf of Aden", regionCenter: { lat: 13.0, lng: 45.0 }, regionRadiusKm: 400 },
    { regionName: "Korean Peninsula", regionCenter: { lat: 37.5, lng: 127.0 }, regionRadiusKm: 300 },
    { regionName: "Sub-Saharan Africa", regionCenter: { lat: 5.0, lng: 20.0 }, regionRadiusKm: 1500 },
];

// ============================================
// Helper Functions
// ============================================

/** Tailwind-compatible color for threat level badges */
export function getThreatLevelColor(level: ThreatLevel): string {
    switch (level) {
        case "critical":
            return "text-red-400 bg-red-950/50 border-red-800";
        case "high":
            return "text-orange-400 bg-orange-950/50 border-orange-800";
        case "elevated":
            return "text-amber-400 bg-amber-950/50 border-amber-800";
        case "guarded":
            return "text-yellow-400 bg-yellow-950/50 border-yellow-800";
        case "low":
            return "text-green-400 bg-green-950/50 border-green-800";
    }
}

/** Icon name for threat level */
export function getThreatLevelIcon(level: ThreatLevel): string {
    switch (level) {
        case "critical":
            return "AlertOctagon";
        case "high":
            return "AlertTriangle";
        case "elevated":
            return "ShieldAlert";
        case "guarded":
            return "Shield";
        case "low":
            return "ShieldCheck";
    }
}

/** Tailwind-compatible color for classification badge */
export function getClassificationBadgeColor(classification: ReportClassification): string {
    switch (classification) {
        case "restricted":
            return "text-red-300 bg-red-950/60 border-red-700";
        case "confidential":
            return "text-amber-300 bg-amber-950/60 border-amber-700";
        case "internal":
            return "text-blue-300 bg-blue-950/60 border-blue-700";
        case "unclassified":
            return "text-zinc-400 bg-zinc-900/60 border-zinc-700";
    }
}

/** Tailwind-compatible color for market impact level */
export function getMarketImpactColor(impact: string): string {
    switch (impact) {
        case "severe":
            return "text-red-400";
        case "significant":
            return "text-orange-400";
        case "moderate":
            return "text-amber-400";
        case "minimal":
            return "text-green-400";
        case "none":
            return "text-zinc-500";
        default:
            return "text-zinc-400";
    }
}

/** Human-readable label for sentiment values */
export function getSentimentLabel(sentiment: string): string {
    switch (sentiment) {
        case "very_negative":
            return "Very Negative";
        case "negative":
            return "Negative";
        case "neutral":
            return "Neutral";
        case "positive":
            return "Positive";
        case "very_positive":
            return "Very Positive";
        default:
            return sentiment;
    }
}

/** Format ISO date string to readable report date */
export function formatReportDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
    });
}
