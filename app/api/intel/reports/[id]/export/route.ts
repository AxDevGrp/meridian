import { NextRequest, NextResponse } from "next/server";
import { getReport, reportCount } from "@/lib/stores/report-store-server";
import type { IntelReport } from "@/lib/types/intel-report";

/**
 * GET /api/intel/reports/[id]/export?format=markdown
 *
 * Exports a report as markdown (downloadable).
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const format = request.nextUrl.searchParams.get("format") || "markdown";

    // Lazy seed if store is empty
    if (reportCount() === 0) {
        const listModule = await import("@/app/api/intel/reports/route");
        await listModule.GET();
    }

    const report = getReport(id);

    if (!report) {
        return NextResponse.json(
            { success: false, error: "Report not found", id },
            { status: 404 },
        );
    }

    if (format !== "markdown") {
        return NextResponse.json(
            { success: false, error: `Unsupported format: ${format}. Supported: markdown` },
            { status: 400 },
        );
    }

    const markdown = reportToMarkdown(report);
    const filename = `intel-report-${report.regionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${report.id.slice(0, 8)}.md`;

    return new NextResponse(markdown, {
        status: 200,
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}

// ============================================
// Markdown formatter
// ============================================

function reportToMarkdown(report: IntelReport): string {
    const lines: string[] = [];
    const { sections } = report;

    // Header
    lines.push(`# ${report.title}`);
    lines.push("");
    lines.push(`**Classification:** ${report.classification.toUpperCase()}`);
    lines.push(`**Threat Level:** ${report.threatLevel.toUpperCase()}`);
    lines.push(`**Region:** ${report.regionName} (${report.regionCenter.lat}°N, ${report.regionCenter.lng}°E, ${report.regionRadiusKm} km radius)`);
    lines.push(`**Generated:** ${report.generatedAt}`);
    lines.push(`**Expires:** ${report.expiresAt}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Executive Summary
    lines.push("## Executive Summary");
    lines.push("");
    lines.push(report.executiveSummary);
    lines.push("");

    // Key Findings
    lines.push("## Key Findings");
    lines.push("");
    for (const finding of report.keyFindings) {
        lines.push(`- ${finding}`);
    }
    lines.push("");

    // Threat Assessment
    lines.push("## Threat Assessment");
    lines.push("");
    lines.push(`**Overall Threat:** ${sections.threatAssessment.overallThreat.toUpperCase()}`);
    lines.push(`**Active Conflicts:** ${sections.threatAssessment.conflictCount}`);
    lines.push(`**GPS Jamming Zones:** ${sections.threatAssessment.gpsJammingCount}`);
    lines.push("");

    if (sections.threatAssessment.activeConflicts.length > 0) {
        lines.push("### Active Conflicts");
        lines.push("");
        lines.push("| Title | Severity | Location | Date | Fatalities |");
        lines.push("|-------|----------|----------|------|------------|");
        for (const c of sections.threatAssessment.activeConflicts) {
            lines.push(`| ${c.title} | ${c.severity} | ${c.location} | ${c.date.split("T")[0]} | ${c.fatalities} |`);
        }
        lines.push("");
    }

    if (sections.threatAssessment.gpsJammingZones.length > 0) {
        lines.push("### GPS Jamming Zones");
        lines.push("");
        lines.push("| Region | Severity | Affected Area |");
        lines.push("|--------|----------|---------------|");
        for (const z of sections.threatAssessment.gpsJammingZones) {
            lines.push(`| ${z.region} | ${z.severity} | ${z.affectedArea} |`);
        }
        lines.push("");
    }

    if (sections.threatAssessment.riskFactors.length > 0) {
        lines.push("### Risk Factors");
        lines.push("");
        for (const r of sections.threatAssessment.riskFactors) {
            lines.push(`- ${r}`);
        }
        lines.push("");
    }

    // Market Impact
    lines.push("## Market Impact");
    lines.push("");
    lines.push(`**Overall Impact:** ${sections.marketImpact.overallImpact.toUpperCase()}`);
    lines.push("");

    if (sections.marketImpact.correlatedInstruments.length > 0) {
        lines.push("### Correlated Instruments");
        lines.push("");
        lines.push("| Symbol | Name | Price | Change % | Sensitivity | Direction |");
        lines.push("|--------|------|-------|----------|-------------|-----------|");
        for (const i of sections.marketImpact.correlatedInstruments) {
            lines.push(
                `| ${i.symbol} | ${i.name} | $${i.price.toFixed(2)} | ${i.changePercent >= 0 ? "+" : ""}${i.changePercent.toFixed(2)}% | ${i.sensitivity.toFixed(2)} | ${i.direction} |`,
            );
        }
        lines.push("");
    }

    if (sections.marketImpact.sectorExposure.length > 0) {
        lines.push("### Sector Exposure");
        lines.push("");
        for (const s of sections.marketImpact.sectorExposure) {
            lines.push(`- **${s.sector}**: ${s.instrumentCount} instrument(s), avg sensitivity ${s.avgSensitivity.toFixed(2)}, direction: ${s.direction}`);
        }
        lines.push("");
    }

    // Entity Tracking
    lines.push("## Entity Tracking");
    lines.push("");
    lines.push(`- **Aircraft:** ${sections.entityTracking.aircraftCount}`);
    lines.push(`- **Vessels:** ${sections.entityTracking.vesselCount}`);
    lines.push(`- **Satellites:** ${sections.entityTracking.satelliteCount}`);
    lines.push("");

    if (sections.entityTracking.notableVessels.length > 0) {
        lines.push("### Notable Vessels");
        lines.push("");
        for (const v of sections.entityTracking.notableVessels) {
            lines.push(`- **${v.name}** (${v.type}) — ${v.detail}`);
        }
        lines.push("");
    }

    if (sections.entityTracking.notableAircraft.length > 0) {
        lines.push("### Notable Aircraft");
        lines.push("");
        for (const a of sections.entityTracking.notableAircraft) {
            lines.push(`- **${a.name}** — ${a.detail}`);
        }
        lines.push("");
    }

    // Social Sentiment
    lines.push("## Social Sentiment");
    lines.push("");
    lines.push(`**Overall Sentiment:** ${sections.socialSentiment.overallSentiment.replace(/_/g, " ").toUpperCase()}`);
    lines.push(`**Post Count:** ${sections.socialSentiment.postCount}`);
    lines.push(`**Trend:** ${sections.socialSentiment.sentimentTrend}`);
    lines.push("");

    if (sections.socialSentiment.platformBreakdown.length > 0) {
        lines.push("### Platform Breakdown");
        lines.push("");
        lines.push("| Platform | Posts | Avg Sentiment |");
        lines.push("|----------|-------|---------------|");
        for (const p of sections.socialSentiment.platformBreakdown) {
            lines.push(`| ${p.platform} | ${p.count} | ${p.avgSentiment.toFixed(2)} |`);
        }
        lines.push("");
    }

    // Timeline
    if (sections.timeline.events.length > 0) {
        lines.push("## Timeline");
        lines.push("");
        lines.push(`Period: ${sections.timeline.periodStart.split("T")[0]} — ${sections.timeline.periodEnd.split("T")[0]}`);
        lines.push("");
        for (const e of sections.timeline.events) {
            const ts = e.timestamp.split("T")[0];
            lines.push(`- **${ts}** [${e.type.toUpperCase()}] ${e.title} — ${e.description} (${e.severity})`);
        }
        lines.push("");
    }

    // Metadata
    lines.push("---");
    lines.push("");
    lines.push("## Report Metadata");
    lines.push("");
    lines.push(`- Generated by: ${report.metadata.generatedBy}`);
    lines.push(`- Version: ${report.metadata.version}`);
    lines.push(`- Data sources: ${report.metadata.dataSources.join(", ")}`);
    lines.push(`- Entities analyzed: ${report.metadata.totalEntitiesAnalyzed}`);
    lines.push(`- Processing time: ${report.metadata.processingTimeMs}ms`);
    lines.push(`- Sample data: ${report.metadata.isSampleData ? "Yes" : "No"}`);
    lines.push("");

    return lines.join("\n");
}
