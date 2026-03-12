"use client";

import {
    Flame,
    Ship,
    Shield,
    Cpu,
    Wheat,
    Landmark,
    LayoutGrid,
} from "lucide-react";
import type { MarketSector } from "@/lib/types/market";
import { getSectorColor } from "@/lib/types/market";

type FilterValue = MarketSector | "all";

interface SectorFilterTabsProps {
    activeSector: FilterValue;
    onSectorChange: (sector: FilterValue) => void;
    counts: Record<string, number>;
}

const tabs: { value: FilterValue; label: string; icon: typeof LayoutGrid }[] = [
    { value: "all", label: "All", icon: LayoutGrid },
    { value: "energy", label: "Energy", icon: Flame },
    { value: "shipping", label: "Shipping", icon: Ship },
    { value: "defense", label: "Defense", icon: Shield },
    { value: "technology", label: "Tech", icon: Cpu },
    { value: "agriculture", label: "Agri", icon: Wheat },
    { value: "finance", label: "Finance", icon: Landmark },
];

/**
 * Horizontal scrollable sector filter tabs.
 * Mirrors the platform-filter-tabs pattern from intel-feed.
 */
export function SectorFilterTabs({
    activeSector,
    onSectorChange,
    counts,
}: SectorFilterTabsProps) {
    return (
        <div
            className="flex items-center gap-1 px-1 overflow-x-auto scrollbar-none"
            role="tablist"
            aria-label="Filter by sector"
        >
            {tabs.map(({ value, label, icon: Icon }) => {
                const isActive = activeSector === value;
                const accentColor = value === "all" ? "#94a3b8" : getSectorColor(value);
                const count = counts[value] ?? 0;

                return (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSectorChange(value)}
                        className={`
                            relative flex items-center gap-1 px-2.5 py-1.5 rounded-md
                            text-[11px] font-medium transition-all duration-200 shrink-0
                            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                            ${isActive
                                ? "text-white bg-white/10"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }
                        `}
                        style={isActive ? { borderBottom: `2px solid ${accentColor}` } : undefined}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                        {count > 0 && (
                            <span
                                className={`
                                    ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold
                                    ${isActive ? "bg-white/15 text-white/80" : "bg-white/5 text-white/30"}
                                `}
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
