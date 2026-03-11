"use client";

import {
    Plane,
    Ship,
    Satellite,
    AlertTriangle,
    Radio,
    Layers,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { useLayers, useLayerActions, useEnabledLayerCount } from "@/lib/stores/layer-store";
import { useAircraftCount } from "@/lib/stores/aircraft-store";
import { useEntityCounts } from "@/lib/stores/data-store";
import type { LayerType } from "@/lib/types/geo-event";
import { cn } from "@/lib/utils";

/**
 * Icon mapping for layer types
 */
const LAYER_ICONS: Record<LayerType, React.ComponentType<{ className?: string }>> = {
    aircraft: Plane,
    vessel: Ship,
    satellite: Satellite,
    conflict: AlertTriangle,
    "gps-jamming": Radio,
};

/**
 * Individual layer toggle row
 */
function LayerToggle({
    id,
    name,
    description,
    color,
    enabled,
    count,
    onToggle,
}: {
    id: LayerType;
    name: string;
    description: string;
    color: string;
    enabled: boolean;
    count: number;
    onToggle: () => void;
}) {
    const Icon = LAYER_ICONS[id];

    return (
        <button
            onClick={onToggle}
            className={cn(
                "group flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-all duration-200",
                enabled
                    ? "bg-white/5 hover:bg-white/8"
                    : "opacity-50 hover:opacity-70 hover:bg-white/3"
            )}
        >
            {/* Color indicator + Icon */}
            <div
                className="flex items-center justify-center w-8 h-8 rounded-md border transition-colors"
                style={{
                    borderColor: enabled ? color : "rgba(255,255,255,0.1)",
                    backgroundColor: enabled ? `${color}15` : "transparent",
                }}
            >
                <span style={{ color: enabled ? color : "rgba(255,255,255,0.3)" }}>
                    <Icon className="w-4 h-4" />
                </span>
            </div>

            {/* Label + Description */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "text-xs font-medium transition-colors",
                            enabled ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {name}
                    </span>
                    {count > 0 && (
                        <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                            style={{
                                backgroundColor: enabled ? `${color}20` : "rgba(255,255,255,0.05)",
                                color: enabled ? color : "rgba(255,255,255,0.3)",
                            }}
                        >
                            {count.toLocaleString()}
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 truncate">{description}</p>
            </div>

            {/* Toggle indicator */}
            <div className="flex-shrink-0">
                {enabled ? (
                    <Eye className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                ) : (
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors" />
                )}
            </div>
        </button>
    );
}

/**
 * Layer panel component
 * Floating panel for toggling data source layer visibility
 */
export function LayerPanel() {
    const [expanded, setExpanded] = useState(true);
    const layers = useLayers();
    const { toggleLayer, enableAll, disableAll } = useLayerActions();
    const enabledCount = useEnabledLayerCount();
    const aircraftCount = useAircraftCount();
    const entityCounts = useEntityCounts();

    // Map layer IDs to counts
    const countMap: Record<LayerType, number> = {
        aircraft: aircraftCount,
        vessel: entityCounts.vessels,
        satellite: entityCounts.satellites,
        conflict: entityCounts.conflicts,
        "gps-jamming": entityCounts.gpsJamming,
    };

    return (
        <div className="absolute bottom-6 left-4 z-20">
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden w-64">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Data Layers</span>
                        <span className="text-[10px] text-muted-foreground/60">
                            {enabledCount}/{layers.length}
                        </span>
                    </div>
                    {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                    ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50" />
                    )}
                </button>

                {/* Layer List */}
                {expanded && (
                    <>
                        <div className="border-t border-white/5" />
                        <div className="p-2 space-y-0.5">
                            {layers.map((layer) => (
                                <LayerToggle
                                    key={layer.id}
                                    id={layer.id}
                                    name={layer.name}
                                    description={layer.description}
                                    color={layer.color}
                                    enabled={layer.enabled}
                                    count={countMap[layer.id]}
                                    onToggle={() => toggleLayer(layer.id)}
                                />
                            ))}
                        </div>

                        {/* Footer actions */}
                        <div className="border-t border-white/5 px-3 py-2 flex gap-2">
                            <button
                                onClick={enableAll}
                                className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                                Show All
                            </button>
                            <span className="text-muted-foreground/20">·</span>
                            <button
                                onClick={disableAll}
                                className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                                Hide All
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
