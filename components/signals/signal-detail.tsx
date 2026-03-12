"use client";

import { useMemo, useCallback } from "react";
import {
    useSignalPanelState,
    useSignalById,
    useSignalStore,
} from "@/lib/stores/signal-store";
import {
    confidenceToSeverity,
    getPlaybookCategoryLabel,
    getSignalSeverityColor,
    getSignalStatusColor,
} from "@/lib/types/signal";
import type {
    SignalSeverity,
    PlaybookCategory,
    CausalChainStepStatus,
    MarketTargetDirection,
    MarketTargetMagnitude,
} from "@/lib/types/signal";
import {
    X,
    Zap,
    CheckCircle2,
    Circle,
    Eye,
    Clock,
    TrendingUp,
    TrendingDown,
    Fuel,
    Cpu,
    DollarSign,
    Shield,
    Package,
    BookOpen,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
    { icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
    triggered: {
        icon: CheckCircle2,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
    },
    watching: {
        icon: Eye,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
    },
    pending: {
        icon: Circle,
        color: "text-zinc-600",
        bgColor: "bg-zinc-500/5",
    },
};

const SEVERITY_BAR_COLOR: Record<SignalSeverity, string> = {
    critical: "bg-red-500",
    high: "bg-amber-500",
    moderate: "bg-yellow-500",
    low: "bg-emerald-500",
};

const SEVERITY_BADGE: Record<SignalSeverity, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const MAGNITUDE_BADGE: Record<MarketTargetMagnitude, string> = {
    small: "text-zinc-400 bg-zinc-500/10 border-zinc-700",
    moderate: "text-amber-400 bg-amber-500/10 border-amber-700",
    large: "text-red-400 bg-red-500/10 border-red-700",
};

const DIRECTION_CONFIG: Record<
    MarketTargetDirection,
    { icon: typeof TrendingUp; color: string }
> = {
    up: { icon: TrendingUp, color: "text-emerald-400" },
    down: { icon: TrendingDown, color: "text-red-400" },
};

/** Format ISO date to human-readable */
function formatTime(isoStr: string): string {
    const date = new Date(isoStr);
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// ============================================
// Component
// ============================================

/**
 * Full-screen overlay panel for viewing detailed signal analysis.
 * Follows the same pattern as AlertPanel and AnalyticsPanel.
 */
export function SignalDetailPanel() {
    const { panelOpen, selectedSignalId, setPanelOpen, setSelectedSignalId } =
        useSignalPanelState();
    const signal = useSignalById(selectedSignalId);
    const acknowledgeSignal = useSignalStore((s) => s.acknowledgeSignal);
    const dismissSignal = useSignalStore((s) => s.dismissSignal);

    const handleClose = useCallback(() => {
        setPanelOpen(false);
        setSelectedSignalId(null);
    }, [setPanelOpen, setSelectedSignalId]);

    const handleAcknowledge = useCallback(() => {
        if (selectedSignalId) {
            acknowledgeSignal(selectedSignalId);
        }
    }, [selectedSignalId, acknowledgeSignal]);

    const handleDismiss = useCallback(() => {
        if (selectedSignalId) {
            dismissSignal(selectedSignalId);
            handleClose();
        }
    }, [selectedSignalId, dismissSignal, handleClose]);

    const severity = useMemo(
        () => (signal ? confidenceToSeverity(signal.confidence) : "low"),
        [signal],
    );

    const confidencePercent = useMemo(
        () => (signal ? Math.round(signal.confidence * 100) : 0),
        [signal],
    );

    const triggeredCount = useMemo(
        () =>
            signal
                ? signal.causalChain.filter((s) => s.status === "triggered")
                    .length
                : 0,
        [signal],
    );

    const categoryLabel = useMemo(
        () =>
            signal
                ? getPlaybookCategoryLabel(signal.playbookCategory)
                : "",
        [signal],
    );

    if (!panelOpen || !signal) return null;

    const CategoryIcon = CATEGORY_ICONS[signal.playbookCategory] ?? Package;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col",
                    "border-l border-white/10 bg-black/95 shadow-2xl",
                    "animate-in slide-in-from-right duration-300",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                            Signal Analysis
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-white"
                    >
                        <X size={16} />
                    </Button>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="space-y-4 p-4">
                        {/* Signal title + badges */}
                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] font-bold",
                                        SEVERITY_BADGE[severity],
                                    )}
                                >
                                    {severity.toUpperCase()}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-white/10 text-[10px] text-zinc-500"
                                >
                                    <CategoryIcon size={10} className="mr-1" />
                                    {categoryLabel}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px]",
                                        getSignalStatusColor(signal.status),
                                    )}
                                >
                                    {signal.status}
                                </Badge>
                            </div>
                            <h3 className="text-lg font-bold text-white">
                                {signal.playbookName}
                            </h3>
                            <p className="mt-1 text-xs text-zinc-500">
                                {signal.description}
                            </p>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Confidence meter */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Confidence
                                </span>
                                <span
                                    className={cn(
                                        "text-sm font-bold tabular-nums",
                                        severity === "critical" && "text-red-400",
                                        severity === "high" && "text-amber-400",
                                        severity === "moderate" && "text-yellow-400",
                                        severity === "low" && "text-emerald-400",
                                    )}
                                >
                                    {confidencePercent}%
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        SEVERITY_BAR_COLOR[severity],
                                    )}
                                    style={{ width: `${confidencePercent}%` }}
                                />
                            </div>
                            <p className="mt-1 text-[10px] text-zinc-600">
                                {confidencePercent}% confidence — {triggeredCount}{" "}
                                of {signal.causalChain.length} conditions met
                            </p>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Full causal chain */}
                        <div>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Causal Chain
                            </h4>
                            <div className="space-y-0">
                                {signal.causalChain.map((step, idx) => {
                                    const config = STEP_STATUS_CONFIG[step.status];
                                    const StepIcon = config.icon;
                                    return (
                                        <div key={step.order}>
                                            <div
                                                className={cn(
                                                    "rounded-lg border border-white/5 p-2.5",
                                                    config.bgColor,
                                                )}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <StepIcon
                                                        size={14}
                                                        className={cn(
                                                            "mt-0.5 shrink-0",
                                                            config.color,
                                                        )}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={cn(
                                                                "text-xs font-medium",
                                                                step.status === "pending"
                                                                    ? "text-zinc-600"
                                                                    : "text-zinc-300",
                                                            )}
                                                        >
                                                            {step.event}
                                                        </p>
                                                        <p className="mt-0.5 text-[10px] text-zinc-600">
                                                            {step.consequence}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {idx < signal.causalChain.length - 1 && (
                                                <div className="ml-4 py-0.5 text-[10px] text-zinc-700">
                                                    ↓
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Trigger conditions breakdown */}
                        <div>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Trigger Conditions
                            </h4>
                            {signal.triggeredConditions.length > 0 && (
                                <div className="mb-2">
                                    <span className="mb-1 block text-[10px] font-medium text-emerald-500/80">
                                        Triggered
                                    </span>
                                    <div className="space-y-1">
                                        {signal.triggeredConditions.map(
                                            (condition) => (
                                                <div
                                                    key={condition}
                                                    className="flex items-center gap-1.5 text-[11px] text-emerald-400/80"
                                                >
                                                    <CheckCircle2 size={10} />
                                                    {condition}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}
                            {signal.pendingConditions.length > 0 && (
                                <div>
                                    <span className="mb-1 block text-[10px] font-medium text-zinc-600">
                                        Pending
                                    </span>
                                    <div className="space-y-1">
                                        {signal.pendingConditions.map(
                                            (condition) => (
                                                <div
                                                    key={condition}
                                                    className="flex items-center gap-1.5 text-[11px] text-zinc-600"
                                                >
                                                    <Circle size={10} />
                                                    {condition}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Market targets table */}
                        <div>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Market Targets
                            </h4>
                            <div className="overflow-hidden rounded-lg border border-white/5">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-1.5">
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                                        Symbol
                                    </span>
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                                        Direction
                                    </span>
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                                        Magnitude
                                    </span>
                                </div>
                                {/* Table rows */}
                                {signal.marketTargets.map((target) => {
                                    const dirConfig =
                                        DIRECTION_CONFIG[target.expectedDirection];
                                    const DirIcon = dirConfig.icon;
                                    return (
                                        <div
                                            key={target.symbol}
                                            className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-zinc-300">
                                                    {target.symbol}
                                                </p>
                                                <p className="truncate text-[10px] text-zinc-600">
                                                    {target.name}
                                                </p>
                                                <p className="mt-0.5 text-[10px] italic text-zinc-700">
                                                    {target.reasoning}
                                                </p>
                                            </div>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-0.5",
                                                    dirConfig.color,
                                                )}
                                            >
                                                <DirIcon size={12} />
                                                <span className="text-[10px] font-medium uppercase">
                                                    {target.expectedDirection}
                                                </span>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px]",
                                                    MAGNITUDE_BADGE[target.magnitude],
                                                )}
                                            >
                                                {target.magnitude}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Context section */}
                        <div>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                Context
                            </h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                    <Clock size={12} className="text-zinc-600" />
                                    <span>Time horizon: {signal.timeHorizon}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                    <AlertTriangle
                                        size={12}
                                        className="text-zinc-600"
                                    />
                                    <span>
                                        Activated:{" "}
                                        {formatTime(signal.activatedAt)}
                                    </span>
                                </div>
                                {signal.historicalPrecedent && (
                                    <div className="mt-1 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                        <div className="mb-1 flex items-center gap-1.5">
                                            <BookOpen
                                                size={11}
                                                className="text-zinc-600"
                                            />
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                                                Historical Precedent
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-500">
                                            {signal.historicalPrecedent}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signal history timestamps (if resolved/expired) */}
                        {(signal.status === "resolved" ||
                            signal.status === "expired") && (
                                <>
                                    <Separator className="bg-white/5" />
                                    <div>
                                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                            Signal History
                                        </h4>
                                        <div className="space-y-1 text-xs text-zinc-500">
                                            {signal.acknowledgedAt && (
                                                <p>
                                                    Acknowledged:{" "}
                                                    {formatTime(
                                                        signal.acknowledgedAt,
                                                    )}
                                                </p>
                                            )}
                                            {signal.resolvedAt && (
                                                <p>
                                                    Resolved:{" "}
                                                    {formatTime(signal.resolvedAt)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                    </div>
                </ScrollArea>

                {/* Footer actions */}
                <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
                    {signal.status === "active" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleAcknowledge}
                            className="h-7 text-[11px] text-zinc-400 hover:text-emerald-400"
                        >
                            <CheckCircle2 size={12} className="mr-1.5" />
                            Acknowledge
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDismiss}
                        className="h-7 text-[11px] text-zinc-500 hover:text-red-400"
                    >
                        <X size={12} className="mr-1.5" />
                        Dismiss
                    </Button>
                </div>
            </div>
        </>
    );
}
