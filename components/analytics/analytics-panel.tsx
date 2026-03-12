"use client";

import { useCallback } from "react";
import {
    X,
    BarChart3,
    LayoutGrid,
    Waypoints,
    GitCompare,
} from "lucide-react";
import { useAnalyticsPanelState, useAnalyticsOverview } from "@/lib/stores/analytics-store";
import { RiskOverviewGrid } from "./risk-overview-grid";
import { AnomalyFeed } from "./anomaly-feed";
import { PatternFeed } from "./pattern-feed";
import { CorrelationMatrix } from "./correlation-matrix";
import { RegionComparison } from "./region-comparison";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// Tab config
// ============================================

type TabId = "overview" | "patterns" | "compare";

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "patterns", label: "Patterns", icon: Waypoints },
    { id: "compare", label: "Compare", icon: GitCompare },
];

// ============================================
// Component
// ============================================

/**
 * Full-screen analytics dashboard overlay.
 * Houses 3 tabs: Overview (risk grid + anomalies), Patterns (pattern feed + correlations),
 * and Compare (region comparison with radar chart).
 * Follows IntelPanel / AlertPanel overlay pattern.
 */
export function AnalyticsPanel() {
    const { panelOpen, activeTab, setPanelOpen, setActiveTab } =
        useAnalyticsPanelState();
    const { isSampleData, lastComputedAt } = useAnalyticsOverview();

    const handleClose = useCallback(() => {
        setPanelOpen(false);
    }, [setPanelOpen]);

    if (!panelOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col",
                    "border-l border-white/10 bg-black/95 shadow-2xl",
                    "animate-in slide-in-from-right duration-300",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} className="text-zinc-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                            Analytics Dashboard
                        </h2>
                        {isSampleData && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Sample Data
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {lastComputedAt && (
                            <span className="text-[10px] text-zinc-600">
                                {new Date(lastComputedAt).toLocaleTimeString()}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClose}
                            className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
                        >
                            <X size={16} />
                        </Button>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-white/5 px-3 py-2">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                                    activeTab === tab.id
                                        ? "bg-white/10 text-white"
                                        : "text-zinc-500 hover:text-zinc-300",
                                )}
                            >
                                <Icon size={12} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab content */}
                <ScrollArea className="flex-1">
                    <div className="p-4">
                        {activeTab === "overview" && <OverviewTab />}
                        {activeTab === "patterns" && <PatternsTab />}
                        {activeTab === "compare" && <CompareTab />}
                    </div>
                </ScrollArea>
            </div>
        </>
    );
}

// ============================================
// Tab content components
// ============================================

function OverviewTab() {
    return (
        <div className="flex flex-col gap-6">
            <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Regional Risk Scores
                </h3>
                <RiskOverviewGrid />
            </section>
            <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Anomaly Feed
                </h3>
                <AnomalyFeed />
            </section>
        </div>
    );
}

function PatternsTab() {
    return (
        <div className="flex flex-col gap-6">
            <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Detected Patterns
                </h3>
                <PatternFeed />
            </section>
            <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Correlation Matrix
                </h3>
                <CorrelationMatrix />
            </section>
        </div>
    );
}

function CompareTab() {
    return <RegionComparison />;
}
