"use client";

import { useCallback } from "react";
import { Zap } from "lucide-react";
import { useHighestSignal, useSignalStore } from "@/lib/stores/signal-store";
import { cn } from "@/lib/utils";
import type { SignalSeverity } from "@/lib/types/signal";

/**
 * Severity-based styling map for the header signal indicator.
 * Acts as a "check engine light" — red pulsing for critical, amber for high, etc.
 */
const SEVERITY_STYLES: Record<
    SignalSeverity | "none",
    { container: string; icon: string }
> = {
    critical: {
        container: "bg-red-500/20 text-red-400 border-red-500/30",
        icon: "animate-pulse",
    },
    high: {
        container: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        icon: "",
    },
    moderate: {
        container: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        icon: "",
    },
    low: {
        container: "bg-zinc-700/30 text-zinc-400 border-zinc-600/30",
        icon: "",
    },
    none: {
        container: "bg-zinc-800/50 text-zinc-600 border-zinc-700/30",
        icon: "",
    },
};

/**
 * Header signal indicator — compact badge that surfaces the highest-severity
 * active signal count. Clicking opens the signal detail panel.
 */
export function SignalIndicator() {
    const { count, maxSeverity } = useHighestSignal();

    const handleClick = useCallback(() => {
        useSignalStore.getState().setSignalPanelOpen(true);
    }, []);

    const key = maxSeverity ?? "none";
    const styles = SEVERITY_STYLES[key];

    const label =
        count === 0
            ? "—"
            : `${count} signal${count > 1 ? "s" : ""}`;

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                styles.container,
            )}
            aria-label={
                count === 0
                    ? "No active signals"
                    : `${count} active signal${count > 1 ? "s" : ""}`
            }
        >
            <Zap size={12} className={cn(styles.icon)} />
            <span>{label}</span>
        </button>
    );
}
