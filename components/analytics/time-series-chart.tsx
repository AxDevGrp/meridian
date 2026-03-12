"use client";

import { useMemo } from "react";

interface TimeSeriesChartProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    showGrid?: boolean;
    showLabels?: boolean;
    label?: string;
}

/**
 * Reusable SVG time-series line chart.
 * Pure SVG polyline with optional grid and min/max labels.
 * More detailed than price-sparkline — supports grid and labels.
 */
export function TimeSeriesChart({
    data,
    width,
    height,
    color = "#3b82f6",
    showGrid = false,
    showLabels = false,
    label,
}: TimeSeriesChartProps) {
    const chart = useMemo(() => {
        if (data.length < 2) return null;

        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const range = maxVal - minVal || 1;

        const vw = 200;
        const vh = 60;
        const padX = showLabels ? 28 : 4;
        const padY = label ? 14 : 4;
        const plotW = vw - padX * 2;
        const plotH = vh - padY - 4;

        // Data points
        const points = data.map((val, i) => {
            const x = padX + (i / (data.length - 1)) * plotW;
            const y = padY + (1 - (val - minVal) / range) * plotH;
            return { x, y };
        });

        const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

        // Area fill
        const areaPath = [
            `M ${points[0].x},${points[0].y}`,
            ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
            `L ${points[points.length - 1].x},${padY + plotH}`,
            `L ${points[0].x},${padY + plotH}`,
            "Z",
        ].join(" ");

        // Grid lines (4 horizontal)
        const gridLines = showGrid
            ? [0.25, 0.5, 0.75].map((frac) => {
                const y = padY + (1 - frac) * plotH;
                return { y, value: minVal + frac * range };
            })
            : [];

        return { polyline, areaPath, gridLines, minVal, maxVal, vw, vh, padX, padY, plotH };
    }, [data, showGrid, showLabels, label]);

    if (!chart) {
        return (
            <div
                className="flex items-center justify-center text-white/20 text-[10px]"
                style={{ width: width ?? "100%", height: height ?? 60 }}
            >
                —
            </div>
        );
    }

    const { polyline, areaPath, gridLines, minVal, maxVal, vw, vh, padX, padY, plotH } = chart;

    return (
        <div style={{ width: width ?? "100%", height: height ?? 60 }} className="relative">
            {label && (
                <div className="absolute top-0 left-0 text-[9px] text-zinc-500 font-medium uppercase tracking-wider px-1">
                    {label}
                </div>
            )}
            <svg
                viewBox={`0 0 ${vw} ${vh}`}
                preserveAspectRatio="none"
                style={{ width: "100%", height: "100%", display: "block" }}
                aria-hidden="true"
            >
                {/* Grid lines */}
                {gridLines.map((gl, i) => (
                    <line
                        key={`grid-${i}`}
                        x1={padX}
                        y1={gl.y}
                        x2={vw - padX}
                        y2={gl.y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={0.5}
                        strokeDasharray="3,3"
                    />
                ))}

                {/* Area fill */}
                <path d={areaPath} fill={color} opacity={0.08} />

                {/* Line */}
                <polyline
                    points={polyline}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Min/Max labels */}
                {showLabels && (
                    <>
                        <text
                            x={padX - 3}
                            y={padY + 3}
                            textAnchor="end"
                            className="fill-zinc-600"
                            fontSize={5}
                            fontFamily="monospace"
                        >
                            {maxVal.toFixed(0)}
                        </text>
                        <text
                            x={padX - 3}
                            y={padY + plotH}
                            textAnchor="end"
                            className="fill-zinc-600"
                            fontSize={5}
                            fontFamily="monospace"
                        >
                            {minVal.toFixed(0)}
                        </text>
                    </>
                )}
            </svg>
        </div>
    );
}
