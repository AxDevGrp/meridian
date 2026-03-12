"use client";

import { useCallback, useState } from "react";
import {
    X,
    FileText,
    PlusCircle,
    List,
} from "lucide-react";
import { ReportViewer } from "./report-viewer";
import { ReportGenerator } from "./report-generator";
import { ReportList } from "./report-list";
import { useIntelStore, useReportPanelState } from "@/lib/stores/intel-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IntelView = "list" | "generator" | "viewer";

/**
 * Main intelligence panel — overlay/modal with 3 views:
 * List (default), Generator, and Viewer.
 * Toggled via intel store's reportPanelOpen state.
 */
export function IntelPanel() {
    const { panelOpen, viewerOpen } = useReportPanelState();
    const setReportPanelOpen = useIntelStore((s) => s.setReportPanelOpen);
    const activeReport = useIntelStore((s) => s.activeReport);

    // Determine current view
    const currentView: IntelView = viewerOpen && activeReport ? "viewer" : "list";

    const handleClose = useCallback(() => {
        setReportPanelOpen(false);
    }, [setReportPanelOpen]);

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
                    "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col",
                    "border-l border-white/10 bg-black/95 shadow-2xl",
                    "animate-in slide-in-from-right duration-300",
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-zinc-400" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                            Intelligence Reports
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

                {/* View content */}
                <div className="flex-1 overflow-hidden">
                    {currentView === "viewer" ? (
                        <ReportViewer />
                    ) : (
                        <IntelListView />
                    )}
                </div>
            </div>
        </>
    );
}

// ============================================
// List + Generator combined view
// ============================================

function IntelListView() {
    const [showGenerator, setShowGenerator] = useState(false);

    return (
        <div className="flex h-full flex-col">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-white/5 px-3 py-2">
                <button
                    type="button"
                    onClick={() => setShowGenerator(false)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                        !showGenerator
                            ? "bg-white/10 text-white"
                            : "text-zinc-500 hover:text-zinc-300",
                    )}
                >
                    <List size={12} />
                    Reports
                </button>
                <button
                    type="button"
                    onClick={() => setShowGenerator(true)}
                    className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                        showGenerator
                            ? "bg-white/10 text-white"
                            : "text-zinc-500 hover:text-zinc-300",
                    )}
                >
                    <PlusCircle size={12} />
                    Generate
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {showGenerator ? <ReportGenerator /> : <ReportList />}
            </div>
        </div>
    );
}


