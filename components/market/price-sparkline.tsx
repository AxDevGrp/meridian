"use client";

import { useMemo } from "react";
import type { PricePoint } from "@/lib/types/market";

interface PriceSparklineProps {
    prices: PricePoint[];
    width?: number;
    height?: number;
    color?: string;
    showArea?: boolean;
}

/**
 * Minimal SVG sparkline for price history.
 * No axis labels — just the line and optional area fill.
 */
export function PriceSparkline({
    prices,
    width,
    height,
    color,
    showArea = true,
}: PriceSparklineProps) {
    const svgData = useMemo(() => {
        if (prices.length < 2) return null;

        const closes = prices.map((p) => p.close);
        const minVal = Math.min(...closes);
        const maxVal = Math.max(...closes);
        const range = maxVal - minVal || 1; // avoid division by zero

        // Determine color from direction if not provided
        const lineColor =
            color ??
            (closes[closes.length - 1] >= closes[0] ? "#22c55e" : "#ef4444");

        // SVG viewBox dimensions (internal coordinate space)
        const vw = 100;
        const vh = 40;
        const padding = 1;

        // Build points
        const points = closes.map((val, i) => {
            const x = padding + (i / (closes.length - 1)) * (vw - padding * 2);
            const y = padding + (1 - (val - minVal) / range) * (vh - padding * 2);
            return { x, y };
        });

        const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

        // Area path: line path + close along the bottom
        const areaPath = [
            `M ${points[0].x},${points[0].y}`,
            ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
            `L ${points[points.length - 1].x},${vh}`,
            `L ${points[0].x},${vh}`,
            "Z",
        ].join(" ");

        return { polylinePoints, areaPath, lineColor, vw, vh };
    }, [prices, color]);

    if (!svgData) {
        return (
            <div
                className="flex items-center justify-center text-white/20 text-[10px]"
                style={{ width: width ?? "100%", height: height ?? 32 }}
            >
                —
            </div>
        );
    }

    const { polylinePoints, areaPath, lineColor, vw, vh } = svgData;

    return (
        <svg
            viewBox={`0 0 ${vw} ${vh}`}
            preserveAspectRatio="none"
            style={{
                width: width ?? "100%",
                height: height ?? 32,
                display: "block",
            }}
            aria-hidden="true"
        >
            {showArea && (
                <path d={areaPath} fill={lineColor} opacity={0.1} />
            )}
            <polyline
                points={polylinePoints}
                fill="none"
                stroke={lineColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
