"use client";

import {
    Ship,
    Plane,
    Radio,
    TrendingUp,
    MessageSquare,
    Swords,
    Activity,
} from "lucide-react";
import type { AnomalyKind } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

type FilterValue = AnomalyKind | "all";

interface AnomalyKindTabsProps {
    activeFilter: FilterValue;
    onFilterChange: (filter: FilterValue) => void;
    counts: Record<FilterValue, number>;
}

const TABS: { value: FilterValue; label: string; icon: typeof Activity }[] = [
    { value: "all", label: "All", icon: Activity },
    { value: "vessel_deviation", label: "Vessel", icon: Ship },
    { value: "aircraft_loitering", label: "Aircraft", icon: Plane },
    { value: "gps_jamming_cluster", label: "GPS", icon: Radio },
    { value: "market_anomaly", label: "Market", icon: TrendingUp },
    { value: "sentiment_shift", label: "Sentiment", icon: MessageSquare },
    { value: "conflict_escalation", label: "Conflict", icon: Swords },
];

/**
 * Horizontal filter tabs for anomaly kinds.
 * Each tab shows an icon, label, and count badge.
 */
export function AnomalyKindTabs({
    activeFilter,
    onFilterChange,
    counts,
}: AnomalyKindTabsProps) {
    return (
        <div
            className="flex items-center gap-1 overflow-x-auto scrollbar-none px-1"
            role="tablist"
            aria-label="Filter by anomaly kind"
        >
            {TABS.map(({ value, label, icon: Icon }) => {
                const isActive = activeFilter === value;
                const count = counts[value] ?? 0;

                return (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onFilterChange(value)}
                        className={cn(
                            "relative flex items-center gap-1 px-2.5 py-1.5 rounded-md",
                            "text-[10px] font-medium transition-all duration-200 whitespace-nowrap",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
                            isActive
                                ? "text-white bg-white/10"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]",
                        )}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                        {count > 0 && (
                            <span
                                className={cn(
                                    "ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold",
                                    isActive
                                        ? "bg-white/15 text-white/80"
                                        : "bg-white/5 text-white/30",
                                )}
                            >
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
