"use client";

import { useMemo } from "react";
import {
    Ship,
    Plane,
    Radio,
    TrendingUp,
    MessageSquare,
    Swords,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import type {
    Anomaly,
    AnomalyKind,
} from "@/lib/types/analytics";
import { getAnomalySeverityColor } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

interface AnomalyCardProps {
    anomaly: Anomaly;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

const KIND_ICONS: Record<AnomalyKind, typeof Ship> = {
    vessel_deviation: Ship,
    aircraft_loitering: Plane,
    gps_jamming_cluster: Radio,
    market_anomaly: TrendingUp,
    sentiment_shift: MessageSquare,
    conflict_escalation: Swords,
};

/** Relative time from ISO string */
function relativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/**
 * Card for a single anomaly.
 * Shows kind icon, severity badge, description, score bar, timestamp,
 * and an expandable details section with kind-specific metadata.
 */
export function AnomalyCard({ anomaly, expanded = false, onToggleExpand }: AnomalyCardProps) {
    const Icon = KIND_ICONS[anomaly.kind];
    const severityColor = getAnomalySeverityColor(anomaly.severity);
    const time = useMemo(() => relativeTime(anomaly.detectedAt), [anomaly.detectedAt]);

    return (
        <div
            className={cn(
                "rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-all duration-200",
                "hover:bg-white/[0.04]",
            )}
        >
            {/* Header: Icon + title + severity badge */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">
                        {anomaly.title}
                    </span>
                </div>
                <span
                    className={cn(
                        "flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        severityColor,
                    )}
                >
                    {anomaly.severity}
                </span>
            </div>

            {/* Description */}
            <p className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {anomaly.description}
            </p>

            {/* Score bar + timestamp */}
            <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[9px] text-zinc-500 font-mono">
                        {anomaly.score.toFixed(2)}
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-amber-500/70"
                            style={{ width: `${anomaly.score * 100}%` }}
                        />
                    </div>
                </div>
                <span className="text-[9px] text-zinc-600 flex-shrink-0">{time}</span>
            </div>

            {/* Expand toggle */}
            {onToggleExpand && (
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    {expanded ? (
                        <ChevronDown className="w-3 h-3" />
                    ) : (
                        <ChevronRight className="w-3 h-3" />
                    )}
                    Details
                </button>
            )}

            {/* Expanded metadata */}
            {expanded && (
                <div className="mt-2 border-t border-white/5 pt-2">
                    <AnomalyMetadata anomaly={anomaly} />
                </div>
            )}
        </div>
    );
}

/** Kind-specific metadata renderer */
function AnomalyMetadata({ anomaly }: { anomaly: Anomaly }) {
    const rows = useMemo(() => {
        switch (anomaly.kind) {
            case "vessel_deviation":
                return [
                    { label: "Vessel", value: anomaly.metadata.vesselName },
                    { label: "Expected Lane", value: anomaly.metadata.expectedLane },
                    { label: "Deviation", value: `${anomaly.metadata.deviationKm.toFixed(1)} km` },
                    { label: "Heading", value: `${anomaly.metadata.heading}°` },
                    { label: "Speed", value: `${anomaly.metadata.speed.toFixed(1)} kn` },
                ];
            case "aircraft_loitering":
                return [
                    { label: "Callsign", value: anomaly.metadata.callsign },
                    { label: "Circles", value: String(anomaly.metadata.circleCount) },
                    { label: "Duration", value: `${anomaly.metadata.durationMinutes} min` },
                    { label: "Radius", value: `${anomaly.metadata.radiusKm.toFixed(1)} km` },
                    { label: "Altitude", value: `${anomaly.metadata.altitude.toLocaleString()} ft` },
                ];
            case "gps_jamming_cluster":
                return [
                    { label: "Zones", value: String(anomaly.metadata.zoneCount) },
                    { label: "Cluster Radius", value: `${anomaly.metadata.clusterRadiusKm.toFixed(1)} km` },
                    { label: "Peak Severity", value: anomaly.metadata.peakSeverity },
                    { label: "Affected Region", value: anomaly.metadata.affectedRegion },
                ];
            case "market_anomaly":
                return [
                    { label: "Symbol", value: anomaly.metadata.symbol },
                    { label: "Z-Score", value: anomaly.metadata.zScore.toFixed(2) },
                    { label: "Change", value: `${anomaly.metadata.changePercent > 0 ? "+" : ""}${anomaly.metadata.changePercent.toFixed(2)}%` },
                    { label: "Hist. Avg", value: `${anomaly.metadata.historicalAvgChange.toFixed(2)}%` },
                ];
            case "sentiment_shift":
                return [
                    { label: "Platform", value: anomaly.metadata.platform },
                    { label: "Previous", value: anomaly.metadata.previousSentiment.toFixed(2) },
                    { label: "Current", value: anomaly.metadata.currentSentiment.toFixed(2) },
                    { label: "Shift", value: anomaly.metadata.shiftMagnitude.toFixed(2) },
                    { label: "Posts", value: String(anomaly.metadata.postCount) },
                ];
            case "conflict_escalation":
                return [
                    { label: "Region", value: anomaly.metadata.regionName },
                    { label: "Previous", value: String(anomaly.metadata.previousCount) },
                    { label: "Current", value: String(anomaly.metadata.currentCount) },
                    { label: "Escalation", value: `${(anomaly.metadata.escalationRate * 100).toFixed(0)}%` },
                    { label: "Max Severity", value: anomaly.metadata.maxSeverity },
                ];
        }
    }, [anomaly]);

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[9px] text-zinc-600">{r.label}</span>
                    <span className="text-[10px] font-mono text-zinc-300">{r.value}</span>
                </div>
            ))}
        </div>
    );
}
