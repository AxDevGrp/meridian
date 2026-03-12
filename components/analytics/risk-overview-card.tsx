"use client";

import { useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";
import type { RiskScore, RiskTrend } from "@/lib/types/analytics";
import { getRiskLevelColor } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

interface RiskOverviewCardProps {
    riskScore: RiskScore;
    compact?: boolean;
    onClick?: () => void;
}

const TREND_CONFIG: Record<RiskTrend, { icon: typeof TrendingUp; label: string; color: string }> = {
    deteriorating: { icon: TrendingUp, label: "Worsening", color: "text-red-400" },
    stable: { icon: Minus, label: "Stable", color: "text-zinc-400" },
    improving: { icon: TrendingDown, label: "Improving", color: "text-green-400" },
};

/** Inline SVG sparkline for risk score history */
function RiskSparkline({ data, color }: { data: number[]; color: string }) {
    const pathData = useMemo(() => {
        if (data.length < 2) return null;
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const vw = 100;
        const vh = 24;
        const pad = 1;

        const points = data.map((val, i) => {
            const x = pad + (i / (data.length - 1)) * (vw - pad * 2);
            const y = pad + (1 - (val - min) / range) * (vh - pad * 2);
            return `${x},${y}`;
        });

        return points.join(" ");
    }, [data]);

    if (!pathData) return null;

    return (
        <svg
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="w-full h-6"
            aria-hidden="true"
        >
            <polyline
                points={pathData}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

/** Score progress bar */
function ScoreBar({ score, color }: { score: number; color: string }) {
    return (
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                    width: `${Math.min(score, 100)}%`,
                    backgroundColor: color,
                }}
            />
        </div>
    );
}

/**
 * Risk overview card — displays a single region's risk score
 * with progress bar, sparkline, trend indicator, and factor breakdown.
 */
export function RiskOverviewCard({ riskScore, compact = false, onClick }: RiskOverviewCardProps) {
    const levelColor = getRiskLevelColor(riskScore.riskLevel);
    const trendCfg = TREND_CONFIG[riskScore.trend];
    const TrendIcon = trendCfg.icon;

    // Extract raw color for sparkline/bar
    const accentColor = useMemo(() => {
        switch (riskScore.riskLevel) {
            case "critical": return "#ef4444";
            case "high": return "#f97316";
            case "elevated": return "#eab308";
            case "moderate": return "#3b82f6";
            case "low": return "#22c55e";
        }
    }, [riskScore.riskLevel]);

    const factors = useMemo(() => {
        const f = riskScore.factors;
        return [
            { name: "Conflict", score: f.conflictIntensity.score },
            { name: "Military", score: f.militaryActivity.score },
            { name: "GPS", score: f.gpsJamming.score },
            { name: "Market", score: f.marketVolatility.score },
            { name: "Sentiment", score: f.socialSentiment.score },
            { name: "Traffic", score: f.vesselTraffic.score },
        ];
    }, [riskScore.factors]);

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full text-left rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-all duration-200",
                "hover:bg-white/[0.05] hover:border-white/15",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
                onClick && "cursor-pointer",
            )}
        >
            {/* Header: Region name + score badge */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white truncate mr-2">
                    {riskScore.regionName}
                </span>
                <span
                    className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        levelColor,
                    )}
                >
                    <span className="font-mono">{riskScore.overallScore}</span>/100
                </span>
            </div>

            {/* Progress bar */}
            <ScoreBar score={riskScore.overallScore} color={accentColor} />

            {/* Risk level + trend */}
            <div className="flex items-center justify-between mt-2">
                <span
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        levelColor.split(" ")[0], // just the text color
                    )}
                >
                    {riskScore.riskLevel}
                </span>
                <span className={cn("flex items-center gap-1 text-[10px]", trendCfg.color)}>
                    <TrendIcon className="w-3 h-3" />
                    {trendCfg.label}
                </span>
            </div>

            {/* Sparkline */}
            {riskScore.sparklineHistory.length >= 2 && (
                <div className="mt-2">
                    <RiskSparkline data={riskScore.sparklineHistory} color={accentColor} />
                </div>
            )}

            {/* Factor breakdown */}
            {!compact && (
                <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
                    {factors.map((f) => (
                        <div key={f.name} className="flex items-center justify-between">
                            <span className="text-[9px] text-zinc-500 truncate">{f.name}</span>
                            <span className="text-[10px] font-mono text-zinc-300 ml-1">{f.score}</span>
                        </div>
                    ))}
                </div>
            )}
        </button>
    );
}
