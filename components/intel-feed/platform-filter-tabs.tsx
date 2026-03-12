"use client";

import { Twitter, MessageCircle, Landmark, Rss } from "lucide-react";
import type { SocialPlatform } from "@/lib/types/social-post";
import { getPlatformColor } from "@/lib/types/social-post";

type FilterValue = SocialPlatform | "all";

interface PlatformFilterTabsProps {
    activeFilter: FilterValue;
    onFilterChange: (filter: FilterValue) => void;
    counts: Record<FilterValue, number>;
}

const tabs: { value: FilterValue; label: string; icon: typeof Rss }[] = [
    { value: "all", label: "All", icon: Rss },
    { value: "x", label: "𝕏", icon: Twitter },
    { value: "truth_social", label: "Truth", icon: MessageCircle },
    { value: "whitehouse", label: "WH", icon: Landmark },
];

/**
 * Horizontal filter tabs for the intel feed.
 * Platform-colored active indicator with count badges.
 */
export function PlatformFilterTabs({
    activeFilter,
    onFilterChange,
    counts,
}: PlatformFilterTabsProps) {
    return (
        <div className="flex items-center gap-1 px-1" role="tablist" aria-label="Filter by platform">
            {tabs.map(({ value, label, icon: Icon }) => {
                const isActive = activeFilter === value;
                const accentColor = value === "all" ? "#94a3b8" : getPlatformColor(value);

                return (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`feed-panel-${value}`}
                        onClick={() => onFilterChange(value)}
                        className={`
                            relative flex items-center gap-1.5 px-3 py-1.5 rounded-md
                            text-xs font-medium transition-all duration-200
                            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                            ${isActive
                                ? "text-white bg-white/10"
                                : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                            }
                        `}
                        style={isActive ? { borderBottom: `2px solid ${accentColor}` } : undefined}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                        <span
                            className={`
                                ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                                ${isActive ? "bg-white/15 text-white/80" : "bg-white/5 text-white/30"}
                            `}
                        >
                            {counts[value]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
