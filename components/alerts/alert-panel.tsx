"use client";

import { useState, useCallback } from "react";
import {
    X,
    Bell,
    Settings,
    History,
} from "lucide-react";
import { AlertConfigPanel } from "./alert-config-panel";
import { AlertHistoryPanel } from "./alert-history-panel";
import { useAlertStore, useAlertPanelState } from "@/lib/stores/alert-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertView = "rules" | "history";

/**
 * Main alert panel — overlay/modal with two tabs: Rules and History.
 * Toggled via alert store's alertPanelOpen state.
 */
export function AlertPanel() {
    const { panelOpen, historyOpen } = useAlertPanelState();
    const setAlertPanelOpen = useAlertStore((s) => s.setAlertPanelOpen);
    const setAlertHistoryOpen = useAlertStore((s) => s.setAlertHistoryOpen);
    const [activeTab, setActiveTab] = useState<AlertView>(
        historyOpen ? "history" : "rules",
    );

    const handleClose = useCallback(() => {
        setAlertPanelOpen(false);
        setAlertHistoryOpen(false);
    }, [setAlertPanelOpen, setAlertHistoryOpen]);

    const handleTabChange = useCallback(
        (tab: AlertView) => {
            setActiveTab(tab);
            setAlertHistoryOpen(tab === "history");
        },
        [setAlertHistoryOpen],
    );

    if (!panelOpen) return null;

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
                    "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col",
                    "border-l border-white/10 bg-black/95 shadow-2xl",
                    "animate-in slide-in-from-right duration-300",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Bell size={16} className="text-zinc-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                            Alerts
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

                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-white/5 px-3 py-2">
                    <button
                        type="button"
                        onClick={() => handleTabChange("rules")}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                            activeTab === "rules"
                                ? "bg-white/10 text-white"
                                : "text-zinc-500 hover:text-zinc-300",
                        )}
                    >
                        <Settings size={12} />
                        Rules
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("history")}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                            activeTab === "history"
                                ? "bg-white/10 text-white"
                                : "text-zinc-500 hover:text-zinc-300",
                        )}
                    >
                        <History size={12} />
                        History
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === "rules" ? (
                        <AlertConfigPanel />
                    ) : (
                        <AlertHistoryPanel />
                    )}
                </div>
            </div>
        </>
    );
}
