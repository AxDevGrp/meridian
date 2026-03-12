"use client";

import { useState, useMemo, useCallback } from "react";
import { Layers, ArrowUpDown } from "lucide-react";
import { usePatternList } from "@/lib/stores/analytics-store";
import { PatternCard } from "./pattern-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatternKind } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

type FilterValue = PatternKind | "all";

const KIND_OPTIONS: { value: FilterValue; label: string }[] = [
    { value: "all", label: "All" },
    { value: "temporal_correlation", label: "Temporal" },
    { value: "spatial_cluster", label: "Spatial" },
    { value: "sequence_detection", label: "Sequence" },
    { value: "entity_cooccurrence", label: "Co-occurrence" },
];

/**
 * Scrollable feed of detected patterns with kind filter and confidence sort.
 */
export function PatternFeed() {
    const { patterns } = usePatternList();
    const [kindFilter, setKindFilter] = useState<FilterValue>("all");
    const [sortDesc, setSortDesc] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        let list = [...patterns];
        if (kindFilter !== "all") {
            list = list.filter((p) => p.kind === kindFilter);
        }
        list.sort((a, b) =>
            sortDesc ? b.confidence - a.confidence : a.confidence - b.confidence,
        );
        return list;
    }, [patterns, kindFilter, sortDesc]);

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Filter + sort bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {KIND_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setKindFilter(opt.value)}
                            className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-medium transition-colors whitespace-nowrap",
                                kindFilter === opt.value
                                    ? "bg-white/10 text-white"
                                    : "text-zinc-500 hover:text-zinc-300",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setSortDesc((v) => !v)}
                    className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                >
                    <ArrowUpDown className="w-3 h-3" />
                    {sortDesc ? "High→Low" : "Low→High"}
                </button>
            </div>

            {/* Pattern list */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1.5">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Layers className="w-8 h-8 text-zinc-700 mb-3" />
                            <p className="text-xs text-zinc-500">No patterns detected</p>
                            <p className="text-[10px] text-zinc-600 mt-1">
                                Cross-layer patterns will appear here
                            </p>
                        </div>
                    ) : (
                        filtered.map((p) => (
                            <PatternCard
                                key={p.id}
                                pattern={p}
                                expanded={expandedId === p.id}
                                onToggleExpand={() => handleToggleExpand(p.id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
