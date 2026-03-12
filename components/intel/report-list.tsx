"use client";

import { useEffect } from "react";
import {
    FileText,
    AlertCircle,
    FlaskConical,
    Clock,
    MapPin,
} from "lucide-react";
import { ThreatLevelBadge } from "./threat-level-badge";
import { useReportList } from "@/lib/stores/intel-store";
import { useIntelStore } from "@/lib/stores/intel-store";
import { getClassificationBadgeColor, formatReportDate } from "@/lib/types/intel-report";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { IntelReportSummary } from "@/lib/services/intel-reports";

/**
 * List of previously generated intelligence reports.
 * Clickable items open the full report viewer.
 */
export function ReportList() {
    const { reports, loading, error } = useReportList();
    const fetchReports = useIntelStore((s) => s.fetchReports);
    const fetchReport = useIntelStore((s) => s.fetchReport);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    if (loading && reports.length === 0) {
        return (
            <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-white/5" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <FileText className="h-10 w-10 text-zinc-600" />
                <p className="text-sm text-zinc-500">No intelligence reports generated yet.</p>
                <p className="text-xs text-zinc-600">
                    Use the generator to create your first regional report.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-2 p-3">
                {reports.map((report) => (
                    <ReportListItem
                        key={report.id}
                        report={report}
                        onClick={() => fetchReport(report.id)}
                    />
                ))}
            </div>
        </ScrollArea>
    );
}

// ──────────────────────────────────────────────

function ReportListItem({
    report,
    onClick,
}: {
    report: IntelReportSummary;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full rounded-md border border-white/5 bg-white/[0.02] p-3",
                "text-left transition-colors hover:border-white/10 hover:bg-white/[0.04]",
                "focus:outline-none focus:ring-1 focus:ring-white/20",
            )}
        >
            {/* Title row */}
            <div className="mb-1.5 flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-white leading-tight line-clamp-1">
                    {report.title}
                </h4>
                {report.isSampleData && (
                    <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-amber-800 bg-amber-950/30 px-1.5 py-0 text-[10px] text-amber-400"
                    >
                        <FlaskConical size={9} />
                        SAMPLE
                    </Badge>
                )}
            </div>

            {/* Badges */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <ThreatLevelBadge level={report.threatLevel} size="sm" />
                <Badge
                    variant="outline"
                    className={cn(
                        "px-1.5 py-0 text-[10px] font-mono uppercase border",
                        getClassificationBadgeColor(report.classification),
                    )}
                >
                    {report.classification}
                </Badge>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {report.regionName}
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatReportDate(report.generatedAt)}
                </span>
            </div>
        </button>
    );
}
