"use client";

import { useMemo } from "react";
import {
    Clock,
    MapPin,
    ListOrdered,
    Users,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import type { Pattern, PatternKind } from "@/lib/types/analytics";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PatternCardProps {
    pattern: Pattern;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

const KIND_ICONS: Record<PatternKind, typeof Clock> = {
    temporal_correlation: Clock,
    spatial_cluster: MapPin,
    sequence_detection: ListOrdered,
    entity_cooccurrence: Users,
};

const KIND_LABELS: Record<PatternKind, string> = {
    temporal_correlation: "Temporal Correlation",
    spatial_cluster: "Spatial Cluster",
    sequence_detection: "Sequence Detection",
    entity_cooccurrence: "Entity Co-occurrence",
};

/**
 * Card for a detected cross-layer pattern.
 * Shows kind icon, confidence bar, involved layers, and expandable details.
 */
export function PatternCard({ pattern, expanded = false, onToggleExpand }: PatternCardProps) {
    const Icon = KIND_ICONS[pattern.kind];
    const label = KIND_LABELS[pattern.kind];
    const pct = Math.round(pattern.confidence * 100);

    return (
        <div
            className={cn(
                "rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-all duration-200",
                "hover:bg-white/[0.04]",
            )}
        >
            {/* Header: icon + kind label + confidence */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">
                        {label}
                    </span>
                </div>
                <span className="flex-shrink-0 text-[10px] font-mono text-zinc-400">
                    Conf: <span className="text-white font-bold">{pct}%</span>
                </span>
            </div>

            {/* Confidence bar */}
            <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                    className="h-full rounded-full bg-blue-500/60 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Description */}
            <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {pattern.description}
            </p>

            {/* Involved layers as badges */}
            <div className="mt-2 flex flex-wrap gap-1">
                {pattern.involvedLayers.map((layer) => (
                    <Badge
                        key={layer}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border-white/10 text-zinc-400"
                    >
                        {layer}
                    </Badge>
                ))}
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
                    {expanded ? "Hide" : "Show"} details
                </button>
            )}

            {/* Expanded details */}
            {expanded && (
                <div className="mt-2 border-t border-white/5 pt-2">
                    <PatternMetadata pattern={pattern} />
                </div>
            )}
        </div>
    );
}

/** Kind-specific metadata renderer */
function PatternMetadata({ pattern }: { pattern: Pattern }) {
    const content = useMemo(() => {
        switch (pattern.kind) {
            case "temporal_correlation":
                return (
                    <div className="space-y-1">
                        <div className="text-[9px] text-zinc-500 mb-1">
                            Window: {pattern.metadata.timeWindowMinutes} min • Strength:{" "}
                            {(pattern.metadata.correlationStrength * 100).toFixed(0)}%
                        </div>
                        {pattern.metadata.events.map((evt, i) => (
                            <div key={`${evt.id}-${i}`} className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="text-[8px] px-1 py-0 border-white/10 text-zinc-500"
                                >
                                    {evt.layer}
                                </Badge>
                                <span className="text-[10px] text-zinc-300 truncate">
                                    {evt.title}
                                </span>
                                <span className="text-[9px] text-zinc-600 ml-auto flex-shrink-0">
                                    {new Date(evt.timestamp).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                );

            case "spatial_cluster":
                return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <MetaRow label="Center" value={`${pattern.metadata.center.lat.toFixed(2)}, ${pattern.metadata.center.lng.toFixed(2)}`} />
                        <MetaRow label="Radius" value={`${pattern.metadata.radiusKm.toFixed(1)} km`} />
                        <MetaRow label="Entities" value={String(pattern.metadata.entityCount)} />
                        <MetaRow label="Density" value={pattern.metadata.density.toFixed(2)} />
                    </div>
                );

            case "sequence_detection":
                return (
                    <div className="space-y-1">
                        <div className="text-[9px] text-zinc-500 mb-1">
                            Pattern: {pattern.metadata.patternName} • Recurrence:{" "}
                            {pattern.metadata.recurrenceCount}×
                        </div>
                        {pattern.metadata.steps.map((step) => (
                            <div key={step.order} className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-zinc-600 w-4">
                                    {step.order}.
                                </span>
                                <Badge
                                    variant="outline"
                                    className="text-[8px] px-1 py-0 border-white/10 text-zinc-500"
                                >
                                    {step.layer}
                                </Badge>
                                <span className="text-[10px] text-zinc-300 truncate">
                                    {step.description}
                                </span>
                            </div>
                        ))}
                    </div>
                );

            case "entity_cooccurrence":
                return (
                    <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <MetaRow label="Incidents" value={String(pattern.metadata.incidentCount)} />
                            <MetaRow label="Regions" value={pattern.metadata.regions.join(", ")} />
                        </div>
                        <div className="text-[9px] text-zinc-500">Entities:</div>
                        <div className="flex flex-wrap gap-1">
                            {pattern.metadata.entities.map((e) => (
                                <Badge
                                    key={e.id}
                                    variant="outline"
                                    className="text-[8px] px-1.5 py-0 border-white/10 text-zinc-400"
                                >
                                    {e.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                );
        }
    }, [pattern]);

    return <>{content}</>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-600">{label}</span>
            <span className="text-[10px] font-mono text-zinc-300">{value}</span>
        </div>
    );
}
