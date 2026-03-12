"use client";

import { useEffect } from "react";
import {
    Trash2,
    MapPin,
    AlertCircle,
} from "lucide-react";
import { useAlertRules, useAlertStore } from "@/lib/stores/alert-store";
import {
    getAlertSeverityColor,
    getConditionTypeLabel,
    ALERT_PRESETS,
} from "@/lib/types/alert";
import type { AlertRule } from "@/lib/types/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Panel for managing alert rules — presets and custom rules.
 * Each rule has a toggle switch and optional delete button.
 */
export function AlertConfigPanel() {
    const { rules, loading, error } = useAlertRules();
    const fetchRules = useAlertStore((s) => s.fetchRules);
    const toggleRule = useAlertStore((s) => s.toggleRule);
    const deleteRule = useAlertStore((s) => s.deleteRule);

    useEffect(() => {
        if (rules.length === 0) fetchRules();
    }, [fetchRules, rules.length]);

    // Separate presets from custom rules
    const presetNames = new Set(ALERT_PRESETS.map((p) => p.name));
    const presetRules = rules.filter((r) => presetNames.has(r.name));
    const customRules = rules.filter((r) => !presetNames.has(r.name));

    if (loading && rules.length === 0) {
        return (
            <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full bg-white/5" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-5 p-4">
                {/* Presets */}
                <div>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Presets
                    </h3>
                    <div className="space-y-1.5">
                        {presetRules.length > 0 ? (
                            presetRules.map((rule) => (
                                <AlertRuleItem
                                    key={rule.id}
                                    rule={rule}
                                    onToggle={() => toggleRule(rule.id)}
                                    isPreset
                                />
                            ))
                        ) : (
                            <p className="text-xs text-zinc-600">
                                No preset rules loaded. Fetch rules to see presets.
                            </p>
                        )}
                    </div>
                </div>

                {/* Custom Rules */}
                <div>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Custom Rules
                    </h3>
                    <div className="space-y-1.5">
                        {customRules.length > 0 ? (
                            customRules.map((rule) => (
                                <AlertRuleItem
                                    key={rule.id}
                                    rule={rule}
                                    onToggle={() => toggleRule(rule.id)}
                                    onDelete={() => deleteRule(rule.id)}
                                />
                            ))
                        ) : (
                            <p className="text-xs italic text-zinc-600">
                                No custom rules — create your first rule.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}

// ──────────────────────────────────────────────

function AlertRuleItem({
    rule,
    onToggle,
    onDelete,
    isPreset,
}: {
    rule: AlertRule;
    onToggle: () => void;
    onDelete?: () => void;
    isPreset?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors",
                rule.enabled
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-white/5 bg-white/[0.01] opacity-60",
            )}
        >
            <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={cn(
                            "px-1.5 py-0 text-[9px] font-mono uppercase border",
                            getAlertSeverityColor(rule.severity),
                        )}
                    >
                        {rule.severity}
                    </Badge>
                    <span className="text-xs font-medium text-white line-clamp-1">
                        {rule.name}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>{getConditionTypeLabel(rule.conditionType)}</span>
                    {rule.regionName && (
                        <span className="flex items-center gap-0.5">
                            <MapPin size={8} />
                            {rule.regionName}
                        </span>
                    )}
                </div>
            </div>

            <div className="ml-3 flex items-center gap-2">
                {/* Toggle Switch */}
                <button
                    type="button"
                    onClick={onToggle}
                    className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        rule.enabled ? "bg-emerald-600" : "bg-zinc-700",
                    )}
                    aria-label={`Toggle ${rule.name}`}
                >
                    <span
                        className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                            rule.enabled ? "left-[18px]" : "left-0.5",
                        )}
                    />
                </button>

                {/* Delete (only for custom rules) */}
                {!isPreset && onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="text-zinc-600 transition-colors hover:text-red-400"
                        aria-label={`Delete ${rule.name}`}
                    >
                        <Trash2 size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}
