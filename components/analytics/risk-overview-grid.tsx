"use client";

import { useMemo } from "react";
import { useRiskScores } from "@/lib/stores/analytics-store";
import { RiskOverviewCard } from "./risk-overview-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Grid of all region risk cards.
 * Sorted by score (highest risk first), 2 columns on desktop, 1 on mobile.
 */
export function RiskOverviewGrid() {
    const { riskScores, setSelectedRegion } = useRiskScores();

    const sorted = useMemo(
        () => [...riskScores].sort((a, b) => b.overallScore - a.overallScore),
        [riskScores],
    );

    if (riskScores.length === 0) {
        return <RiskOverviewSkeleton />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sorted.map((rs) => (
                <RiskOverviewCard
                    key={rs.regionName}
                    riskScore={rs}
                    onClick={() => setSelectedRegion(rs.regionName)}
                />
            ))}
        </div>
    );
}

function RiskOverviewSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={`skel-${i}`}
                    className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2"
                >
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-2.5 w-10" />
                        <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-6 w-full" />
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, j) => (
                            <Skeleton key={`fskel-${j}`} className="h-2.5 w-full" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
