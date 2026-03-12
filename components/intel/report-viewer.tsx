"use client";

import { useState, useCallback } from "react";
import {
    ArrowLeft,
    Download,
    ChevronDown,
    ChevronRight,
    Shield,
    TrendingUp,
    TrendingDown,
    Plane,
    Ship,
    Satellite,
    MessageSquare,
    Clock,
    AlertTriangle,
    Radio,
    MapPin,
    Loader2,
    AlertCircle,
    BarChart3,
    Crosshair,
    Newspaper,
} from "lucide-react";
import { ThreatLevelBadge } from "./threat-level-badge";
import { useActiveReport } from "@/lib/stores/intel-store";
import { useIntelStore } from "@/lib/stores/intel-store";
import {
    getClassificationBadgeColor,
    getMarketImpactColor,
    getSentimentLabel,
    formatReportDate,
} from "@/lib/types/intel-report";
import type {
    IntelReport,
    ThreatAssessmentSection,
    MarketImpactSection,
    EntityTrackingSection,
    SocialSentimentSection,
    TimelineSection,
    TimelineEvent,
} from "@/lib/types/intel-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// Section collapse state type
// ============================================

type SectionKey =
    | "threat"
    | "market"
    | "entity"
    | "social"
    | "timeline";

// ============================================
// Main Report Viewer
// ============================================

/**
 * Full report viewer displaying all sections of an IntelReport.
 * Uses collapsible sections for dense data and clean visual hierarchy.
 */
export function ReportViewer() {
    const { report, loading, error } = useActiveReport();
    const clearActiveReport = useIntelStore((s) => s.clearActiveReport);
    const exportReport = useIntelStore((s) => s.exportReport);
    const [exporting, setExporting] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
        new Set(),
    );

    const toggleSection = useCallback((key: SectionKey) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const handleExport = useCallback(async () => {
        if (!report) return;
        setExporting(true);
        const markdown = await exportReport(report.id, "markdown");
        setExporting(false);

        if (markdown) {
            const blob = new Blob([markdown], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${report.title.replace(/\s+/g, "_")}.md`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [report, exportReport]);

    if (loading) {
        return (
            <div className="space-y-4 p-6">
                <Skeleton className="h-6 w-48 bg-white/5" />
                <Skeleton className="h-4 w-72 bg-white/5" />
                <Skeleton className="h-32 w-full bg-white/5" />
                <Skeleton className="h-24 w-full bg-white/5" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-8">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearActiveReport}
                    className="text-zinc-400 hover:text-white"
                >
                    <ArrowLeft size={14} className="mr-1" /> Back
                </Button>
            </div>
        );
    }

    if (!report) return null;

    return (
        <ScrollArea className="h-full">
            <div className="space-y-5 p-5">
                {/* ── Header ──────────────────────── */}
                <div className="flex items-start justify-between gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearActiveReport}
                        className="shrink-0 text-zinc-400 hover:text-white"
                    >
                        <ArrowLeft size={14} className="mr-1" /> Back
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExport}
                        disabled={exporting}
                        className="shrink-0 text-zinc-400 hover:text-white"
                    >
                        {exporting ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Download size={14} />
                        )}
                        <span className="ml-1">Export</span>
                    </Button>
                </div>

                {/* Title */}
                <div>
                    <h2 className="mb-2 text-lg font-bold text-white leading-tight">
                        {report.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <ThreatLevelBadge level={report.threatLevel} size="md" />
                        <Badge
                            variant="outline"
                            className={cn(
                                "border px-2 py-0.5 text-[10px] font-mono uppercase",
                                getClassificationBadgeColor(report.classification),
                            )}
                        >
                            {report.classification}
                        </Badge>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Clock size={10} />
                            {formatReportDate(report.generatedAt)}
                        </span>
                    </div>
                </div>

                {/* ── Executive Summary ────────────── */}
                <SectionCard title="EXECUTIVE SUMMARY" icon={Shield} defaultOpen>
                    <p className="text-sm leading-relaxed text-zinc-300">
                        {report.executiveSummary}
                    </p>
                </SectionCard>

                {/* ── Key Findings ─────────────────── */}
                <SectionCard title="KEY FINDINGS" icon={Crosshair} defaultOpen>
                    <ul className="space-y-1.5">
                        {report.keyFindings.map((finding, i) => (
                            <li
                                key={i}
                                className="flex gap-2 text-sm text-zinc-300"
                            >
                                <span className="mt-0.5 text-zinc-600">•</span>
                                {finding}
                            </li>
                        ))}
                    </ul>
                </SectionCard>

                <Separator className="bg-white/5" />

                {/* ── Collapsible Sections ────────── */}
                <CollapsibleSection
                    sectionKey="threat"
                    title="Threat Assessment"
                    icon={AlertTriangle}
                    summary={`${report.sections.threatAssessment.conflictCount} conflicts, ${report.sections.threatAssessment.gpsJammingCount} GPS zones`}
                    expanded={expandedSections.has("threat")}
                    onToggle={() => toggleSection("threat")}
                >
                    <ThreatAssessmentContent
                        section={report.sections.threatAssessment}
                    />
                </CollapsibleSection>

                <CollapsibleSection
                    sectionKey="market"
                    title="Market Impact"
                    icon={BarChart3}
                    summary={`${report.sections.marketImpact.correlatedInstruments.length} correlated instruments`}
                    expanded={expandedSections.has("market")}
                    onToggle={() => toggleSection("market")}
                >
                    <MarketImpactContent section={report.sections.marketImpact} />
                </CollapsibleSection>

                <CollapsibleSection
                    sectionKey="entity"
                    title="Entity Tracking"
                    icon={Satellite}
                    summary={`${report.sections.entityTracking.aircraftCount} aircraft, ${report.sections.entityTracking.vesselCount} vessels`}
                    expanded={expandedSections.has("entity")}
                    onToggle={() => toggleSection("entity")}
                >
                    <EntityTrackingContent
                        section={report.sections.entityTracking}
                    />
                </CollapsibleSection>

                <CollapsibleSection
                    sectionKey="social"
                    title="Social Sentiment"
                    icon={Newspaper}
                    summary={`${report.sections.socialSentiment.postCount} posts, ${report.sections.socialSentiment.sentimentTrend}`}
                    expanded={expandedSections.has("social")}
                    onToggle={() => toggleSection("social")}
                >
                    <SocialSentimentContent
                        section={report.sections.socialSentiment}
                    />
                </CollapsibleSection>

                <CollapsibleSection
                    sectionKey="timeline"
                    title="Timeline"
                    icon={Clock}
                    summary={`${report.sections.timeline.events.length} events`}
                    expanded={expandedSections.has("timeline")}
                    onToggle={() => toggleSection("timeline")}
                >
                    <TimelineContent section={report.sections.timeline} />
                </CollapsibleSection>

                {/* ── Metadata footer ─────────────── */}
                <div className="rounded-md border border-white/5 bg-white/[0.01] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Report Metadata
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                        <span>
                            Sources: {report.metadata.dataSources.join(", ")}
                        </span>
                        <span>
                            Entities analyzed: {report.metadata.totalEntitiesAnalyzed}
                        </span>
                        <span>
                            Processing: {report.metadata.processingTimeMs}ms
                        </span>
                        <span>Version: {report.metadata.version}</span>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}

// ============================================
// Generic Section Card (always visible)
// ============================================

function SectionCard({
    title,
    icon: Icon,
    defaultOpen: _defaultOpen,
    children,
}: {
    title: string;
    icon: typeof Shield;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-white/5 bg-white/[0.02] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <Icon size={13} />
                {title}
            </h3>
            {children}
        </div>
    );
}

// ============================================
// Collapsible Section Wrapper
// ============================================

function CollapsibleSection({
    sectionKey: _sectionKey,
    title,
    icon: Icon,
    summary,
    expanded,
    onToggle,
    children,
}: {
    sectionKey: SectionKey;
    title: string;
    icon: typeof Shield;
    summary: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-white/5 bg-white/[0.02]">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
            >
                {expanded ? (
                    <ChevronDown size={14} className="text-zinc-500" />
                ) : (
                    <ChevronRight size={14} className="text-zinc-500" />
                )}
                <Icon size={13} className="text-zinc-400" />
                <span className="text-sm font-medium text-white">{title}</span>
                <span className="ml-auto text-[11px] text-zinc-500">
                    ({summary})
                </span>
            </button>
            {expanded && (
                <div className="border-t border-white/5 px-4 py-3">
                    {children}
                </div>
            )}
        </div>
    );
}

// ============================================
// Threat Assessment Section Content
// ============================================

function ThreatAssessmentContent({
    section,
}: {
    section: ThreatAssessmentSection;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Overall Threat:</span>
                <ThreatLevelBadge level={section.overallThreat} size="sm" />
            </div>

            {/* Active Conflicts */}
            {section.activeConflicts.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Active Conflicts ({section.conflictCount})
                    </h4>
                    <div className="space-y-1.5">
                        {section.activeConflicts.map((c) => (
                            <div
                                key={c.id}
                                className="flex items-center justify-between rounded border border-white/5 px-3 py-1.5 text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={11} className="text-orange-400" />
                                    <span className="text-zinc-300">{c.title}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                    <span className="font-mono uppercase">{c.severity}</span>
                                    <span>{c.location}</span>
                                    {c.fatalities > 0 && (
                                        <span className="text-red-400">
                                            {c.fatalities} fatalities
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* GPS Jamming Zones */}
            {section.gpsJammingZones.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        GPS Jamming Zones ({section.gpsJammingCount})
                    </h4>
                    <div className="space-y-1.5">
                        {section.gpsJammingZones.map((z) => (
                            <div
                                key={z.id}
                                className="flex items-center justify-between rounded border border-white/5 px-3 py-1.5 text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <Radio size={11} className="text-yellow-400" />
                                    <span className="text-zinc-300">{z.region}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                    <span className="font-mono uppercase">{z.severity}</span>
                                    <span>{z.affectedArea}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risk Factors */}
            {section.riskFactors.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Risk Factors
                    </h4>
                    <ul className="space-y-1">
                        {section.riskFactors.map((factor, i) => (
                            <li key={i} className="flex gap-2 text-xs text-zinc-400">
                                <span className="text-zinc-600">▸</span>
                                {factor}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ============================================
// Market Impact Section Content
// ============================================

function MarketImpactContent({ section }: { section: MarketImpactSection }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Overall Impact:</span>
                <span
                    className={cn(
                        "text-xs font-semibold uppercase",
                        getMarketImpactColor(section.overallImpact),
                    )}
                >
                    {section.overallImpact}
                </span>
            </div>

            {/* Correlated Instruments */}
            {section.correlatedInstruments.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Correlated Instruments
                    </h4>
                    <div className="space-y-1">
                        {section.correlatedInstruments.map((inst) => (
                            <div
                                key={inst.symbol}
                                className="flex items-center justify-between rounded border border-white/5 px-3 py-1.5"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-white">
                                        {inst.symbol}
                                    </span>
                                    <span className="text-[11px] text-zinc-500 line-clamp-1">
                                        {inst.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-zinc-300">
                                        ${inst.price.toFixed(2)}
                                    </span>
                                    <span
                                        className={cn(
                                            "flex items-center gap-0.5 font-mono text-xs font-medium",
                                            inst.changePercent >= 0
                                                ? "text-emerald-400"
                                                : "text-red-400",
                                        )}
                                    >
                                        {inst.changePercent >= 0 ? (
                                            <TrendingUp size={10} />
                                        ) : (
                                            <TrendingDown size={10} />
                                        )}
                                        {inst.changePercent >= 0 ? "+" : ""}
                                        {inst.changePercent.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sector Exposure */}
            {section.sectorExposure.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Sector Exposure
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {section.sectorExposure.map((se) => (
                            <div
                                key={se.sector}
                                className="rounded border border-white/5 px-3 py-2"
                            >
                                <span className="text-[11px] font-medium uppercase text-zinc-400">
                                    {se.sector}
                                </span>
                                <div className="mt-0.5 flex items-baseline gap-2">
                                    <span className="font-mono text-sm text-white">
                                        {se.instrumentCount}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">
                                        instruments
                                    </span>
                                </div>
                                <div className="mt-0.5">
                                    <div className="h-1 w-full rounded-full bg-white/5">
                                        <div
                                            className="h-1 rounded-full bg-blue-500/60"
                                            style={{
                                                width: `${Math.min(se.avgSensitivity * 100, 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// Entity Tracking Section Content
// ============================================

function EntityTrackingContent({
    section,
}: {
    section: EntityTrackingSection;
}) {
    return (
        <div className="space-y-4">
            {/* Counts */}
            <div className="grid grid-cols-3 gap-2">
                <CountCard icon={Plane} label="Aircraft" count={section.aircraftCount} />
                <CountCard icon={Ship} label="Vessels" count={section.vesselCount} />
                <CountCard
                    icon={Satellite}
                    label="Satellites"
                    count={section.satelliteCount}
                />
            </div>

            {/* Notable entities */}
            <EntityList title="Notable Aircraft" items={section.notableAircraft} />
            <EntityList title="Notable Vessels" items={section.notableVessels} />
            <EntityList title="Notable Satellites" items={section.notableSatellites} />
        </div>
    );
}

function CountCard({
    icon: Icon,
    label,
    count,
}: {
    icon: typeof Plane;
    label: string;
    count: number;
}) {
    return (
        <div className="rounded border border-white/5 px-3 py-2 text-center">
            <Icon size={14} className="mx-auto mb-1 text-zinc-500" />
            <div className="font-mono text-lg font-bold text-white">{count}</div>
            <div className="text-[10px] text-zinc-600">{label}</div>
        </div>
    );
}

function EntityList({
    title,
    items,
}: {
    title: string;
    items: { id: string; name: string; type: string; detail: string; lastSeen: string }[];
}) {
    if (items.length === 0) return null;

    return (
        <div>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase text-zinc-500">
                {title}
            </h4>
            <div className="space-y-1">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="flex items-center justify-between rounded border border-white/5 px-3 py-1.5 text-xs"
                    >
                        <div>
                            <span className="font-medium text-zinc-300">
                                {item.name}
                            </span>
                            <span className="ml-2 text-zinc-600">{item.type}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500 line-clamp-1 max-w-[200px]">
                            {item.detail}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================
// Social Sentiment Section Content
// ============================================

function SocialSentimentContent({
    section,
}: {
    section: SocialSentimentSection;
}) {
    return (
        <div className="space-y-4">
            {/* Overview */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                    <span className="text-zinc-500">Sentiment: </span>
                    <span className="font-semibold text-zinc-300">
                        {getSentimentLabel(section.overallSentiment)}
                    </span>
                </div>
                <div>
                    <span className="text-zinc-500">Trend: </span>
                    <span
                        className={cn(
                            "font-semibold",
                            section.sentimentTrend === "deteriorating"
                                ? "text-red-400"
                                : section.sentimentTrend === "improving"
                                    ? "text-green-400"
                                    : "text-zinc-400",
                        )}
                    >
                        {section.sentimentTrend}
                    </span>
                </div>
                <div>
                    <span className="text-zinc-500">Posts: </span>
                    <span className="font-mono text-zinc-300">
                        {section.postCount}
                    </span>
                </div>
            </div>

            {/* Platform breakdown */}
            {section.platformBreakdown.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Platform Breakdown
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                        {section.platformBreakdown.map((p) => (
                            <div
                                key={p.platform}
                                className="rounded border border-white/5 px-3 py-2"
                            >
                                <span className="text-[11px] font-medium uppercase text-zinc-400">
                                    {p.platform.replace("_", " ")}
                                </span>
                                <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-sm text-white">
                                        {p.count}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">
                                        posts
                                    </span>
                                </div>
                                <span
                                    className={cn(
                                        "font-mono text-[11px]",
                                        p.avgSentiment < -0.3
                                            ? "text-red-400"
                                            : p.avgSentiment > 0.3
                                                ? "text-green-400"
                                                : "text-zinc-400",
                                    )}
                                >
                                    {p.avgSentiment >= 0 ? "+" : ""}
                                    {p.avgSentiment.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top posts */}
            {section.topPosts.length > 0 && (
                <div>
                    <h4 className="mb-2 text-[11px] font-bold uppercase text-zinc-500">
                        Top Posts
                    </h4>
                    <div className="space-y-1.5">
                        {section.topPosts.slice(0, 5).map((post) => (
                            <div
                                key={post.id}
                                className="rounded border border-white/5 px-3 py-2"
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare size={10} className="text-zinc-500" />
                                        <span className="text-[11px] font-medium text-zinc-300">
                                            @{post.author}
                                        </span>
                                        <span className="text-[10px] uppercase text-zinc-600">
                                            {post.platform.replace("_", " ")}
                                        </span>
                                    </div>
                                    <span
                                        className={cn(
                                            "font-mono text-[11px]",
                                            post.sentiment < -0.3
                                                ? "text-red-400"
                                                : post.sentiment > 0.3
                                                    ? "text-green-400"
                                                    : "text-zinc-400",
                                        )}
                                    >
                                        {post.sentiment.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 line-clamp-2">
                                    {post.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// Timeline Section Content
// ============================================

const TIMELINE_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
    conflict: AlertTriangle,
    gps_jamming: Radio,
    vessel: Ship,
    aircraft: Plane,
    social: MessageSquare,
    market: TrendingUp,
    alert: AlertCircle,
};

const TIMELINE_SEVERITY_COLORS: Record<string, string> = {
    critical: "border-l-red-500",
    high: "border-l-orange-500",
    medium: "border-l-yellow-500",
    low: "border-l-blue-500",
    info: "border-l-zinc-600",
};

function TimelineContent({ section }: { section: TimelineSection }) {
    return (
        <div className="space-y-1">
            <p className="mb-2 text-[11px] text-zinc-500">
                {formatReportDate(section.periodStart)} → {formatReportDate(section.periodEnd)}
            </p>
            {section.events.map((event, i) => (
                <TimelineEventItem key={i} event={event} />
            ))}
        </div>
    );
}

function TimelineEventItem({ event }: { event: TimelineEvent }) {
    const Icon = TIMELINE_TYPE_ICONS[event.type] ?? Clock;
    const severityBorder =
        TIMELINE_SEVERITY_COLORS[event.severity] ?? "border-l-zinc-700";

    return (
        <div
            className={cn(
                "flex gap-3 border-l-2 py-1.5 pl-3",
                severityBorder,
            )}
        >
            <Icon size={12} className="mt-0.5 shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-300 line-clamp-1">
                        {event.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-600">
                        {new Date(event.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-1">
                    {event.description}
                </p>
            </div>
        </div>
    );
}
