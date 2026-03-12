"use client";

import { useState, useCallback } from "react";
import {
    Loader2,
    AlertCircle,
    Globe2,
    MapPin,
} from "lucide-react";
import { useIntelStore, useReportGeneration } from "@/lib/stores/intel-store";
import { PREDEFINED_REGIONS } from "@/lib/types/intel-report";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReportClassification } from "@/lib/types/intel-report";

const CLASSIFICATION_OPTIONS: ReportClassification[] = [
    "unclassified",
    "internal",
    "confidential",
    "restricted",
];

const TIMEFRAME_OPTIONS = [
    { label: "6 hours", value: 6 },
    { label: "12 hours", value: 12 },
    { label: "24 hours", value: 24 },
    { label: "48 hours", value: 48 },
    { label: "7 days", value: 168 },
];

/**
 * Form to generate a new intelligence report.
 * Supports predefined regions or custom coordinates.
 */
export function ReportGenerator() {
    const [selectedRegionIdx, setSelectedRegionIdx] = useState<number>(0);
    const [useCustom, setUseCustom] = useState(false);
    const [customLat, setCustomLat] = useState("");
    const [customLng, setCustomLng] = useState("");
    const [customRadius, setCustomRadius] = useState("200");
    const [customName, setCustomName] = useState("");
    const [classification, setClassification] =
        useState<ReportClassification>("unclassified");
    const [timeframeHours, setTimeframeHours] = useState(24);

    const generateReport = useIntelStore((s) => s.generateReport);
    const { isGenerating, error } = useReportGeneration();

    const handleGenerate = useCallback(async () => {
        if (useCustom) {
            const lat = parseFloat(customLat);
            const lng = parseFloat(customLng);
            const radius = parseFloat(customRadius);
            if (isNaN(lat) || isNaN(lng) || isNaN(radius)) return;

            await generateReport({
                regionName: customName || `Custom Region (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
                regionCenter: { lat, lng },
                regionRadiusKm: radius,
                classification,
                timeframeHours,
            });
        } else {
            const region = PREDEFINED_REGIONS[selectedRegionIdx];
            if (!region) return;

            await generateReport({
                ...region,
                classification,
                timeframeHours,
            });
        }
    }, [
        useCustom,
        customLat,
        customLng,
        customRadius,
        customName,
        classification,
        timeframeHours,
        selectedRegionIdx,
        generateReport,
    ]);

    return (
        <div className="space-y-5 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Globe2 size={14} />
                Generate Intelligence Report
            </h3>

            {/* Region Selection */}
            <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Region
                </label>

                {/* Toggle: Predefined vs Custom */}
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setUseCustom(false)}
                        className={cn(
                            "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                            !useCustom
                                ? "bg-white/10 text-white"
                                : "text-zinc-500 hover:text-zinc-300",
                        )}
                    >
                        Predefined
                    </button>
                    <button
                        type="button"
                        onClick={() => setUseCustom(true)}
                        className={cn(
                            "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                            useCustom
                                ? "bg-white/10 text-white"
                                : "text-zinc-500 hover:text-zinc-300",
                        )}
                    >
                        Custom
                    </button>
                </div>

                {!useCustom ? (
                    <select
                        value={selectedRegionIdx}
                        onChange={(e) => setSelectedRegionIdx(Number(e.target.value))}
                        className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                    >
                        {PREDEFINED_REGIONS.map((r, i) => (
                            <option key={r.regionName} value={i}>
                                {r.regionName}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Region name (optional)"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-600">Lat</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="26.57"
                                    value={customLat}
                                    onChange={(e) => setCustomLat(e.target.value)}
                                    className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white/20 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-600">Lng</label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="56.25"
                                    value={customLng}
                                    onChange={(e) => setCustomLng(e.target.value)}
                                    className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white/20 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-600">
                                    Radius (km)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    placeholder="200"
                                    value={customRadius}
                                    onChange={(e) => setCustomRadius(e.target.value)}
                                    className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-xs text-white placeholder:text-zinc-700 focus:border-white/20 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Classification */}
            <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Classification
                </label>
                <select
                    value={classification}
                    onChange={(e) =>
                        setClassification(e.target.value as ReportClassification)
                    }
                    className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm capitalize text-white focus:border-white/20 focus:outline-none"
                >
                    {CLASSIFICATION_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Timeframe */}
            <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Timeframe
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {TIMEFRAME_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTimeframeHours(opt.value)}
                            className={cn(
                                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                timeframeHours === opt.value
                                    ? "border-white/20 bg-white/10 text-white"
                                    : "border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected summary */}
            {!useCustom && (
                <div className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
                    <MapPin size={12} className="text-zinc-500" />
                    <span className="font-mono text-xs text-zinc-400">
                        {PREDEFINED_REGIONS[selectedRegionIdx]?.regionName} —{" "}
                        {PREDEFINED_REGIONS[selectedRegionIdx]?.regionRadiusKm}km radius
                    </span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
                    <AlertCircle size={14} className="text-red-400" />
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}

            {/* Generate button */}
            <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
            >
                {isGenerating ? (
                    <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Generating… aggregating sources
                    </span>
                ) : (
                    "Generate Report"
                )}
            </Button>
        </div>
    );
}
