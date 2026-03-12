"use client";

import { useMemo } from "react";

// ============================================
// Types
// ============================================

interface RadarChartProps {
    regions: {
        name: string;
        color: string;
        factors: { name: string; value: number }[];
    }[];
    size?: number;
    showLabels?: boolean;
    showGrid?: boolean;
}

// ============================================
// Geometry helpers
// ============================================

/** Convert polar (angle in radians, radius) to cartesian (x, y) offset from center */
function polarToCartesian(
    angleDeg: number,
    radius: number,
): { x: number; y: number } {
    // Start at top (-90°) and go clockwise
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: radius * Math.cos(angleRad),
        y: radius * Math.sin(angleRad),
    };
}

/** Build SVG polygon points string from an array of {x,y} with center offset */
function pointsToString(
    pts: { x: number; y: number }[],
    cx: number,
    cy: number,
): string {
    return pts.map((p) => `${cx + p.x},${cy + p.y}`).join(" ");
}

// ============================================
// Constants
// ============================================

const GRID_LEVELS = [20, 40, 60, 80, 100];
const AXIS_LABELS = [
    "Conflict",
    "Military",
    "GPS",
    "Market",
    "Sentiment",
    "Vessel",
];
const AXIS_COUNT = AXIS_LABELS.length;
const ANGLE_STEP = 360 / AXIS_COUNT;

// ============================================
// Component
// ============================================

/**
 * Pure SVG radar / spider chart for comparing regions across 6 risk factors.
 * Up to 4 regions rendered as semi-transparent polygon overlays on a hexagonal grid.
 */
export function RadarChart({
    regions,
    size = 300,
    showLabels = true,
    showGrid = true,
}: RadarChartProps) {
    const padding = showLabels ? 48 : 16;
    const svgSize = size + padding * 2;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const maxRadius = size / 2;

    // Precompute axis endpoints at max radius
    const axisEndpoints = useMemo(
        () =>
            Array.from({ length: AXIS_COUNT }, (_, i) =>
                polarToCartesian(i * ANGLE_STEP, maxRadius),
            ),
        [maxRadius],
    );

    // Build grid ring polygons
    const gridRings = useMemo(
        () =>
            GRID_LEVELS.map((level) => {
                const r = (level / 100) * maxRadius;
                const pts = Array.from({ length: AXIS_COUNT }, (_, i) =>
                    polarToCartesian(i * ANGLE_STEP, r),
                );
                return { level, points: pointsToString(pts, cx, cy) };
            }),
        [maxRadius, cx, cy],
    );

    // Build region polygons
    const regionPolygons = useMemo(
        () =>
            regions.slice(0, 4).map((region) => {
                const pts = Array.from({ length: AXIS_COUNT }, (_, i) => {
                    const factor = region.factors[i];
                    const val = factor ? Math.max(0, Math.min(100, factor.value)) : 0;
                    const r = (val / 100) * maxRadius;
                    return polarToCartesian(i * ANGLE_STEP, r);
                });
                return {
                    name: region.name,
                    color: region.color,
                    points: pointsToString(pts, cx, cy),
                    vertices: pts.map((p) => ({ x: cx + p.x, y: cy + p.y })),
                };
            }),
        [regions, maxRadius, cx, cy],
    );

    // Label positions — slightly beyond max radius
    const labelPositions = useMemo(
        () =>
            AXIS_LABELS.map((label, i) => {
                const p = polarToCartesian(i * ANGLE_STEP, maxRadius + 20);
                return { label, x: cx + p.x, y: cy + p.y };
            }),
        [maxRadius, cx, cy],
    );

    return (
        <div className="flex flex-col items-center gap-3">
            <svg
                width={svgSize}
                height={svgSize}
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                className="select-none"
            >
                {/* Grid rings */}
                {showGrid &&
                    gridRings.map((ring) => (
                        <polygon
                            key={`grid-${ring.level}`}
                            points={ring.points}
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth={ring.level === 100 ? 1 : 0.5}
                        />
                    ))}

                {/* Grid level labels (small numbers) */}
                {showGrid &&
                    GRID_LEVELS.map((level) => {
                        const r = (level / 100) * maxRadius;
                        return (
                            <text
                                key={`glabel-${level}`}
                                x={cx + 3}
                                y={cy - r + 3}
                                fill="rgba(255,255,255,0.2)"
                                fontSize={8}
                                fontFamily="var(--font-geist-mono)"
                            >
                                {level}
                            </text>
                        );
                    })}

                {/* Axis lines from center to edge */}
                {axisEndpoints.map((ep, i) => (
                    <line
                        key={`axis-${i}`}
                        x1={cx}
                        y1={cy}
                        x2={cx + ep.x}
                        y2={cy + ep.y}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={0.5}
                    />
                ))}

                {/* Region polygons */}
                {regionPolygons.map((rp) => (
                    <g key={`region-${rp.name}`}>
                        <polygon
                            points={rp.points}
                            fill={rp.color}
                            fillOpacity={0.15}
                            stroke={rp.color}
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                        />
                        {/* Vertex dots */}
                        {rp.vertices.map((v, vi) => (
                            <circle
                                key={`dot-${rp.name}-${vi}`}
                                cx={v.x}
                                cy={v.y}
                                r={2.5}
                                fill={rp.color}
                                stroke="rgba(0,0,0,0.5)"
                                strokeWidth={0.5}
                            />
                        ))}
                    </g>
                ))}

                {/* Axis labels */}
                {showLabels &&
                    labelPositions.map((lp) => (
                        <text
                            key={`label-${lp.label}`}
                            x={lp.x}
                            y={lp.y}
                            fill="rgba(255,255,255,0.6)"
                            fontSize={10}
                            fontFamily="var(--font-geist-sans)"
                            textAnchor="middle"
                            dominantBaseline="central"
                        >
                            {lp.label}
                        </text>
                    ))}

                {/* Center dot */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={1.5}
                    fill="rgba(255,255,255,0.25)"
                />
            </svg>

            {/* Legend */}
            {regions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {regions.slice(0, 4).map((region) => (
                        <div
                            key={`legend-${region.name}`}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: region.color }}
                            />
                            <span className="text-[10px] text-zinc-400">
                                {region.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
