"use client";

import { StatusBar } from "./status-bar";
import { AlertBadge } from "@/components/alerts";
import { Radio, TrendingUp, RotateCcw, FileText, Bell } from "lucide-react";
import { useIntelStore } from "@/lib/stores/intel-store";
import { useAlertStore, useUnacknowledgedCount } from "@/lib/stores/alert-store";
import { cn } from "@/lib/utils";

/**
 * Navigation item for future features
 */
function NavItem({
    icon: Icon,
    label,
    active = false,
    disabled = true,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            disabled={disabled}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </button>
    );
}

/**
 * Meridian Logo Component
 * Simple text logo with globe icon
 */
function MeridianLogo() {
    return (
        <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="w-5 h-5 text-primary"
                >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            </div>
            <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-foreground leading-none">Meridian</h1>
                <span className="text-[10px] text-muted-foreground/70 tracking-wide uppercase">
                    Geospatial Intelligence
                </span>
            </div>
        </div>
    );
}

/**
 * Header Component
 * Main application header with branding, status bar, and navigation
 */
export function Header() {
    const unacknowledgedCount = useUnacknowledgedCount();

    return (
        <header className="absolute top-0 left-0 right-0 z-10">
            {/* Glassmorphic background */}
            <div className="bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo & Branding */}
                        <MeridianLogo />

                        {/* Status Bar - Center */}
                        <div className="flex-1 flex justify-center">
                            <StatusBar />
                        </div>

                        {/* Actions + Navigation - Right */}
                        <div className="flex items-center gap-1">
                            {/* Intel Reports button */}
                            <button
                                onClick={() => useIntelStore.getState().setReportPanelOpen(true)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                                aria-label="Open intelligence reports"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">Intel</span>
                            </button>

                            {/* Alerts button with badge */}
                            <button
                                onClick={() => useAlertStore.getState().setAlertPanelOpen(true)}
                                className={cn(
                                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                                aria-label="Open alerts"
                            >
                                <Bell className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">Alerts</span>
                                {unacknowledgedCount > 0 && (
                                    <span
                                        className={cn(
                                            "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full",
                                            "bg-red-600 px-1 font-mono text-[9px] font-bold text-white",
                                        )}
                                    >
                                        {unacknowledgedCount > 99 ? "99+" : unacknowledgedCount}
                                        <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30" />
                                    </span>
                                )}
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 bg-border/30 mx-1" />

                            {/* Navigation */}
                            <nav className="flex items-center gap-1">
                                <NavItem icon={Radio} label="Signals" />
                                <NavItem icon={TrendingUp} label="Markets" />
                                <NavItem icon={RotateCcw} label="Replay" />
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}