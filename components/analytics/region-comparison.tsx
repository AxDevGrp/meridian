"use client";

import { useState, useMemo, useCallback } from "react";
import { useRiskScores } from "@/lib/stores/analytics-store";
import { RadarChart } from "./radar-chart";
import { cn } from "@/lib/utils";
import type { RiskScore, RiskLevel } from "@/lib/types/analytics";
import { getRiskLevelColor, scoreToRiskLevel } from "@/lib/types/analytics";

// ============================================
// Constants
// ============================================

const MAX_SELECTED = 4;

/** Distinct comparison colors for up to 4 regions */
const COMPARE_COLORS = [
    "#34d399", // emerald-400
    "#38bdf8", // sky-400
    "#fbbf24", // amber-400
    "#fb7185", // rose-400
];

/** The 6 risk factor keys we compare (skip historicalBaseline) */
const FACTOR_KEYS = [
    { key: "conflictIntensity" as const, label: "Conflict" },
    { key: "militaryActivity" as const, label: "Military" },
    { key: "gpsJamming" as const, label: "GPS Jamming" },
    { key: "marketVolatility" as const, label: "Market Vol." },
    { key: "socialSentiment" as const, label: "Sentiment" },
    { key: "vesselTraffic" as const, label: "Vessel Traffic" },
];

// ============================================
// Helpers
// ============================================

/** Heat-map background color for a 0–100 score */
function heatBg(score: number): string {
    if (score >= 80) return "bg-red-950/50 text-red-300";
    if (score >= 60) return "bg-orange-950/50 text-orange-300";
    if (score >= 40) return "bg-amber-950/50 text-amber-300";
    if (score >= 20) return "bg-yellow-950/30 text-yellow-300";
    return "bg-green-950/30 text-green-300";
}

/** Risk level badge */
function RiskLevelBadge({ level }: { level: RiskLevel }) {
    return (
        <span
            className={cn(
                "inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                getRiskLevelColor(level),
            )}
        >
            {level}
        </span>
    );
}

// ============================================
// Component
// ============================================

/**
 * Region comparison view — select up to 4 regions and compare via
 * radar chart + side-by-side score cards + factor comparison table.
 */
export function RegionComparison() {
    const { riskScores } = useRiskScores();
    const [selectedNames, setSelectedNames] = useState<string[]>([]);

    // Toggle region selection (max 4)
    const toggleRegion = useCallback(
        (name: string) => {
            setSelectedNames((prev) => {
                if (prev.includes(name)) {
                    return prev.filter((n) => n !== name);
                }
                if (prev.length >= MAX_SELECTED) return prev;
                return [...prev, name];
            });
        },
        [],
    );

    // Build selected RiskScore objects with assigned colors
    const selected = useMemo(
        () =>
            selectedNames
                .map((name, idx) => {
                    const rs = riskScores.find((r) => r.regionName === name);
                    if (!rs) return null;
                    return { ...rs, color: COMPARE_COLORS[idx] };
                })
                .filter(Boolean) as (RiskScore & { color: string })[],
        [selectedNames, riskScores],
    );

    // Build radar data from selected regions
    const radarRegions = useMemo(
        () =>
            selected.map((rs) => ({
                name: rs.regionName,
                color: rs.color,
                factors: FACTOR_KEYS.map((fk) => ({
                    name: fk.label,
                    value: rs.factors[fk.key].score,
                })),
            })),
        [selected],
    );

    // Sort all risk scores by overallScore desc for selector
    const sortedScores = useMemo(
        () => [...riskScores].sort((a, b) => b.overallScore - a.overallScore),
        [riskScores],
    );

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* Region selector */}
            <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Select Regions to Compare{" "}
                    <span className="text-zinc-600">
                        ({selectedNames.length}/{MAX_SELECTED})
                    </span>
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                    {sortedScores.map((rs) => {
                        const idx = selectedNames.indexOf(rs.regionName);
                        const isSelected = idx !== -1;
                        const color = isSelected
                            ? COMPARE_COLORS[idx]
                            : undefined;
                        const disabled =
                            !isSelected && selectedNames.length >= MAX_SELECTED;

                        return (
                            <button
                                key={rs.regionName}
                                type="button"
                                disabled={disabled}
                                onClick={() => toggleRegion(rs.regionName)}
                                className={cn(
                                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all",
                                    isSelected
                                        ? "border-white/20 bg-white/[0.06]"
                                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]",
                                    disabled && "cursor-not-allowed opacity-40",
                                )}
                            >
                                {/* Colored indicator */}
                                <span
                                    className={cn(
                                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                                        isSelected
                                            ? "border-transparent"
                                            : "border-white/15",
                                    )}
                                    style={
                                        isSelected
                                            ? { backgroundColor: color }
                                            : undefined
                                    }
                                >
                                    {isSelected && (
                                        <svg
                                            viewBox="0 0 12 12"
                                            className="h-2 w-2"
                                            fill="none"
                                            stroke="black"
                                            strokeWidth={2}
                                        >
                                            <path d="M2 6l3 3 5-5" />
                                        </svg>
                                    )}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <span className="block truncate text-[11px] font-medium text-zinc-300">
                                        {rs.regionName}
                                    </span>
                                </div>

                                <span className="font-mono text-[11px] font-bold text-zinc-400">
                                    {rs.overallScore}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Radar chart */}
            {selected.length >= 2 ? (
                <div className="flex justify-center">
                    <RadarChart regions={radarRegions} size={260} />
                </div>
            ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-white/10 py-12">
                    <p className="text-[11px] text-zinc-600">
                        Select at least 2 regions to view comparison chart
                    </p>
                </div>
            )}

            {/* Score cards — side by side */}
            {selected.length > 0 && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {selected.map((rs) => (
                        <div
                            key={rs.regionName}
                            className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5"
                        >
                            <div className="mb-1.5 flex items-center gap-1.5">
                                <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: rs.color }}
                                />
                                <span className="truncate text-[10px] font-semibold text-zinc-300">
                                    {rs.regionName}
                                </span>
                            </div>
                            <div className="mb-1 font-mono text-xl font-black text-white">
                                {rs.overallScore}
                            </div>
                            <RiskLevelBadge level={rs.riskLevel} />
                        </div>
                    ))}
                </div>
            )}

            {/* Factor comparison table */}
            {selected.length >= 2 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="py-1.5 pr-3 text-left font-semibold uppercase tracking-wider text-zinc-500">
                                    Factor
                                </th>
                                {selected.map((rs) => (
                                    <th
                                        key={rs.regionName}
                                        className="px-2 py-1.5 text-center font-semibold"
                                        style={{ color: rs.color }}
                                    >
                                        {rs.regionName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {FACTOR_KEYS.map((fk) => (
                                <tr
                                    key={fk.key}
                                    className="border-b border-white/5"
                                >
                                    <td className="py-1.5 pr-3 text-zinc-400">
                                        {fk.label}
                                    </td>
                                    {selected.map((rs) => {
                                        const score = rs.factors[fk.key].score;
                                        return (
                                            <td
                                                key={`${rs.regionName}-${fk.key}`}
                                                className="px-2 py-1.5 text-center"
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block min-w-[32px] rounded px-1.5 py-0.5 font-mono font-bold",
                                                        heatBg(score),
                                                    )}
                                                >
                                                    {score}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {/* Overall row */}
                            <tr className="border-t border-white/10">
                                <td className="py-1.5 pr-3 font-semibold text-zinc-300">
                                    Overall
                                </td>
                                {selected.map((rs) => (
                                    <td
                                        key={`overall-${rs.regionName}`}
                                        className="px-2 py-1.5 text-center"
                                    >
                                        <span
                                            className={cn(
                                                "inline-block min-w-[32px] rounded px-1.5 py-0.5 font-mono font-bold",
                                                heatBg(rs.overallScore),
                                            )}
                                        >
                                            {rs.overallScore}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
