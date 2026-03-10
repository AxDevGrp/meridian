"use client";

import { StatusBar } from "./status-bar";
import { Radio, TrendingUp, RotateCcw } from "lucide-react";
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

                        {/* Navigation - Right */}
                        <nav className="flex items-center gap-1">
                            <NavItem icon={Radio} label="Signals" />
                            <NavItem icon={TrendingUp} label="Markets" />
                            <NavItem icon={RotateCcw} label="Replay" />
                        </nav>
                    </div>
                </div>
            </div>
        </header>
    );
}