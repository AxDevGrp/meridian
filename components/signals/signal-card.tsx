"use client";

import { useCallback, useMemo } from "react";
import type {
    MarketSignal,
    PlaybookCategory,
    CausalChainStepStatus,
} from "@/lib/types/signal";
import { confidenceToSeverity, getPlaybookCategoryLabel } from "@/lib/types/signal";
import { useSignalStore } from "@/lib/stores/signal-store";
import {
    CheckCircle2,
    Circle,
    Eye,
    Clock,
    TrendingUp,
    TrendingDown,
    ChevronRight,
    Fuel,
    Cpu,
    DollarSign,
    Shield,
    Package,
    Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// Constants
// ============================================

const CATEGORY_ICONS: Record<PlaybookCategory, typeof Fuel> = {
    energy: Fuel,
    technology: Cpu,
    currency: DollarSign,
    "safe-haven": Shield,
    commodity: Package,
};

const STEP_STATUS_CONFIG: Record<
    CausalChainStepStatus,
    { icon: typeof CheckCircle2; color: string }
> = {
    triggered: { icon: CheckCircle2, color: "text-emerald-400" },
    watching: { icon: Eye, color: "text-amber-400" },
    pending: { icon: Circle, color: "text-zinc-600" },
};

const SEVERITY_LEFT_BORDER: Record<string, string> = {
    critical: "border-l-red-500",
    high: "border-l-amber-500",
    moderate: "border-l-yellow-500",
    low: "border-l-emerald-500",
};

const SEVERITY_BADGE: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

// ============================================
// Component
// ============================================

interface SignalCardProps {
    signal: MarketSignal;
}

/**
 * Card component for a single market impact signal.
 * Displays causal chain steps, market targets, and confidence.
 * Sized for legibility — all text at ≥ 12px.
 */
export function SignalCard({ signal }: SignalCardProps) {
    const setSignalPanelOpen = useSignalStore((s) => s.setSignalPanelOpen);
    const setSelectedSignalId = useSignalStore((s) => s.setSelectedSignalId);
    const acknowledgeSignal = useSignalStore((s) => s.acknowledgeSignal);

    const severity = useMemo(
        () => confidenceToSeverity(signal.confidence),
        [signal.confidence],
    );

    const confidencePercent = useMemo(
        () => `${Math.round(signal.confidence * 100)}%`,
        [signal.confidence],
    );

    const categoryLabel = useMemo(
        () => getPlaybookCategoryLabel(signal.playbookCategory),
        [signal.playbookCategory],
    );

    const CategoryIcon = CATEGORY_ICONS[signal.playbookCategory] ?? Package;

    const handleViewAnalysis = useCallback(() => {
        setSelectedSignalId(signal.id);
        setSignalPanelOpen(true);
    }, [signal.id, setSelectedSignalId, setSignalPanelOpen]);

    const handleAcknowledge = useCallback(() => {
        acknowledgeSignal(signal.id);
    }, [signal.id, acknowledgeSignal]);

    return (
        <div
            className={cn(
                "rounded-lg border border-white/10 bg-white/5 p-4",
                "border-l-[3px] transition-colors hover:bg-white/[0.07]",
                SEVERITY_LEFT_BORDER[severity],
            )}
        >
            {/* Header: confidence badge + category + acknowledge */}
            <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <Badge
                        variant="outline"
                        className={cn(
                            "h-6 px-2 text-xs font-bold tabular-nums",
                            SEVERITY_BADGE[severity],
                        )}
                    >
                        {confidencePercent}
                    </Badge>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        <CategoryIcon size={14} />
                        {categoryLabel}
                    </span>
                </div>
                {signal.status === "active" && (
                    <button
                        type="button"
                        onClick={handleAcknowledge}
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/10 hover:text-emerald-400"
                        title="Acknowledge signal"
                    >
                        <Check size={14} />
                    </button>
                )}
            </div>

            {/* Title */}
            <p className="mb-3 text-sm font-bold leading-snug text-zinc-200">
                {signal.playbookName}
            </p>

            {/* Causal chain */}
            <div className="mb-3 space-y-0">
                {signal.causalChain.map((step, idx) => {
                    const config = STEP_STATUS_CONFIG[step.status];
                    const StepIcon = config.icon;
                    return (
                        <div key={step.order}>
                            <div className="flex items-start gap-2">
                                <StepIcon
                                    size={14}
                                    className={cn(
                                        "mt-0.5 shrink-0",
                                        config.color,
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-xs leading-snug",
                                        step.status === "pending"
                                            ? "text-zinc-600"
                                            : "text-zinc-400",
                                    )}
                                >
                                    {step.event}
                                </span>
                            </div>
                            {idx < signal.causalChain.length - 1 && (
                                <div className="ml-[6px] text-xs leading-tight text-zinc-700">
                                    ↓
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Market targets */}
            <div className="mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    Expect:
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                    {signal.marketTargets.map((target) => (
                        <span
                            key={target.symbol}
                            className={cn(
                                "flex items-center gap-1 text-xs font-semibold",
                                target.expectedDirection === "up"
                                    ? "text-emerald-400"
                                    : "text-red-400",
                            )}
                        >
                            {target.symbol}
                            {target.expectedDirection === "up" ? (
                                <TrendingUp size={14} />
                            ) : (
                                <TrendingDown size={14} />
                            )}
                        </span>
                    ))}
                </div>
            </div>

            {/* Footer: time horizon + view analysis */}
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Clock size={12} />
                    {signal.timeHorizon}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewAnalysis}
                    className="h-6 px-2 text-[11px] text-zinc-500 hover:text-white"
                >
                    View Analysis
                    <ChevronRight size={12} className="ml-0.5" />
                </Button>
            </div>
        </div>
    );
}
