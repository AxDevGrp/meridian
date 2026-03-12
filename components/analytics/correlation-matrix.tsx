"use client";

import { useMemo, useState } from "react";
import { usePatternList } from "@/lib/stores/analytics-store";
import { cn } from "@/lib/utils";

const DATA_LAYERS = ["Conflict", "GPS", "Vessel", "Aircraft", "Social", "Market"] as const;
type LayerName = (typeof DATA_LAYERS)[number];

/**
 * Cross-layer correlation matrix.
 * 6×6 grid showing which data layers have correlated activity,
 * computed from detected patterns' involvedLayers.
 */
export function CorrelationMatrix() {
    const { patterns } = usePatternList();
    const [hovered, setHovered] = useState<{ row: LayerName; col: LayerName } | null>(null);

    // Build correlation counts from patterns
    const matrix = useMemo(() => {
        const counts: Record<string, number> = {};
        const key = (a: string, b: string) => `${a}|${b}`;

        // Initialize all pairs to 0
        for (const row of DATA_LAYERS) {
            for (const col of DATA_LAYERS) {
                counts[key(row, col)] = row === col ? -1 : 0; // -1 = self
            }
        }

        // Normalize layer names from patterns to our labels
        const normalize = (layer: string): LayerName | null => {
            const lower = layer.toLowerCase();
            if (lower.includes("conflict")) return "Conflict";
            if (lower.includes("gps") || lower.includes("jamming")) return "GPS";
            if (lower.includes("vessel") || lower.includes("ship")) return "Vessel";
            if (lower.includes("aircraft") || lower.includes("plane")) return "Aircraft";
            if (lower.includes("social") || lower.includes("sentiment")) return "Social";
            if (lower.includes("market")) return "Market";
            return null;
        };

        for (const p of patterns) {
            const layers = p.involvedLayers
                .map(normalize)
                .filter((l): l is LayerName => l !== null);

            // Count co-occurrences
            for (let i = 0; i < layers.length; i++) {
                for (let j = i + 1; j < layers.length; j++) {
                    const a = layers[i];
                    const b = layers[j];
                    if (a !== b) {
                        counts[key(a, b)] = (counts[key(a, b)] || 0) + 1;
                        counts[key(b, a)] = (counts[key(b, a)] || 0) + 1;
                    }
                }
            }
        }

        // Find max for normalization
        const values = Object.values(counts).filter((v) => v > 0);
        const maxCount = values.length > 0 ? Math.max(...values) : 1;

        return { counts, maxCount, key };
    }, [patterns]);

    const getCellColor = (row: LayerName, col: LayerName): string => {
        if (row === col) return "bg-blue-500/40";
        const count = matrix.counts[matrix.key(row, col)];
        if (count <= 0) return "bg-white/[0.02]";
        const intensity = count / matrix.maxCount;
        if (intensity > 0.66) return "bg-blue-500/30";
        if (intensity > 0.33) return "bg-blue-500/15";
        return "bg-blue-500/[0.06]";
    };

    const getCellCount = (row: LayerName, col: LayerName): number => {
        if (row === col) return -1;
        return matrix.counts[matrix.key(row, col)] || 0;
    };

    return (
        <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Cross-Layer Correlations
            </h3>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse" aria-label="Correlation matrix">
                    {/* Column headers */}
                    <thead>
                        <tr>
                            <th className="w-16" />
                            {DATA_LAYERS.map((col) => (
                                <th
                                    key={col}
                                    className="text-[8px] text-zinc-500 font-medium px-1 pb-1 text-center"
                                >
                                    {col.slice(0, 4)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {DATA_LAYERS.map((row) => (
                            <tr key={row}>
                                {/* Row header */}
                                <td className="text-[9px] text-zinc-500 font-medium pr-2 text-right">
                                    {row}
                                </td>
                                {DATA_LAYERS.map((col) => {
                                    const count = getCellCount(row, col);
                                    const isHovered =
                                        hovered?.row === row && hovered?.col === col;

                                    return (
                                        <td
                                            key={col}
                                            className="p-0.5"
                                            onMouseEnter={() => setHovered({ row, col })}
                                            onMouseLeave={() => setHovered(null)}
                                        >
                                            <div
                                                className={cn(
                                                    "w-full aspect-square rounded-sm transition-all duration-150",
                                                    getCellColor(row, col),
                                                    isHovered && "ring-1 ring-white/30",
                                                )}
                                                title={
                                                    row === col
                                                        ? `${row} (self)`
                                                        : `${row} ↔ ${col}: ${count} patterns`
                                                }
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Hover tooltip */}
            {hovered && hovered.row !== hovered.col && (
                <div className="text-[9px] text-zinc-400 text-center">
                    {hovered.row} ↔ {hovered.col}:{" "}
                    <span className="font-mono text-white">
                        {getCellCount(hovered.row, hovered.col)}
                    </span>{" "}
                    correlated patterns
                </div>
            )}
        </div>
    );
}
