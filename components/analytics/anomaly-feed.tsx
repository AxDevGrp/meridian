"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, AlertCircle } from "lucide-react";
import { useAnomalyList } from "@/lib/stores/analytics-store";
import { useAnalyticsStore } from "@/lib/stores/analytics-store";
import { AnomalyCard } from "./anomaly-card";
import { AnomalyKindTabs } from "./anomaly-kind-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AnomalyKind, AnomalySeverity, AnalyticsSortBy } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

const SEVERITY_OPTIONS: { value: AnomalySeverity | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
];

const SORT_OPTIONS: { value: AnalyticsSortBy; label: string }[] = [
    { value: "severity", label: "Severity" },
    { value: "time", label: "Time" },
    { value: "score", label: "Score" },
];

/**
 * Scrollable feed of anomalies with kind/severity filters and sort toggle.
 */
export function AnomalyFeed() {
    const { anomalies, filter, severityFilter, sortBy, setFilter, setSeverityFilter, setSortBy } =
        useAnomalyList();
    const allAnomalies = useAnalyticsStore((s) => s.anomalies);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Compute per-kind counts from *all* anomalies (unfiltered)
    const kindCounts = useMemo(() => {
        const counts: Record<AnomalyKind | "all", number> = {
            all: allAnomalies.length,
            vessel_deviation: 0,
            aircraft_loitering: 0,
            gps_jamming_cluster: 0,
            market_anomaly: 0,
            sentiment_shift: 0,
            conflict_escalation: 0,
        };
        for (const a of allAnomalies) {
            counts[a.kind]++;
        }
        return counts;
    }, [allAnomalies]);

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    const cycleSortBy = useCallback(() => {
        const idx = SORT_OPTIONS.findIndex((o) => o.value === sortBy);
        const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
        setSortBy(next.value);
    }, [sortBy, setSortBy]);

    return (
        <div className="flex flex-col h-full">
            {/* Kind filter tabs */}
            <div className="border-b border-white/5 py-2 px-1">
                <AnomalyKindTabs
                    activeFilter={filter}
                    onFilterChange={setFilter}
                    counts={kindCounts}
                />
            </div>

            {/* Severity + Sort controls */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                {/* Severity filter */}
                <div className="flex items-center gap-1">
                    {SEVERITY_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSeverityFilter(opt.value)}
                            className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-medium transition-colors",
                                severityFilter === opt.value
                                    ? "bg-white/10 text-white"
                                    : "text-zinc-500 hover:text-zinc-300",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Sort toggle */}
                <button
                    type="button"
                    onClick={cycleSortBy}
                    className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    <ArrowUpDown className="w-3 h-3" />
                    {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </button>
            </div>

            {/* Anomaly list */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1.5">
                    {anomalies.length === 0 ? (
                        <EmptyState />
                    ) : (
                        anomalies.map((a) => (
                            <AnomalyCard
                                key={a.id}
                                anomaly={a}
                                expanded={expandedId === a.id}
                                onToggleExpand={() => handleToggleExpand(a.id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-700 mb-3" />
            <p className="text-xs text-zinc-500">No anomalies detected</p>
            <p className="text-[10px] text-zinc-600 mt-1">
                Adjust filters or wait for new data
            </p>
        </div>
    );
}
