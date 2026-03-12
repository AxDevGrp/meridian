"use client";

/**
 * FLASH Banner — Breaking News Overlay
 *
 * Full-width dramatic banner that appears at the top of the screen
 * when a high-priority social media post is detected. Designed to
 * interrupt the trader's workflow for market-moving intelligence.
 *
 * Visual hierarchy:
 *   CRITICAL → Red pulsing banner, stays until dismissed
 *   URGENT   → Amber banner, 60s auto-dismiss
 *   BREAKING → Yellow banner, 45s auto-dismiss
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { X, AlertTriangle, Zap, Radio, Landmark, MessageCircle, ExternalLink, Volume2, VolumeX } from "lucide-react";
import { useVisibleFlashAlerts, useFlashActions, useFlashStore } from "@/lib/stores/flash-store";
import { getFlashLabel } from "@/lib/types/flash";
import type { FlashAlert, FlashPriority } from "@/lib/types/flash";
import type { SocialPlatform } from "@/lib/types/social-post";

// ============================================
// Platform Icons
// ============================================

function PlatformIcon({ platform, size = 16 }: { platform: SocialPlatform; size?: number }) {
    switch (platform) {
        case "whitehouse":
            return <Landmark size={size} />;
        case "truth_social":
            return <MessageCircle size={size} />;
        case "x":
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            );
    }
}

// ============================================
// Single Flash Alert Item
// ============================================

function FlashAlertItem({ alert, onDismiss }: { alert: FlashAlert; onDismiss: (id: string) => void }) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-dismiss based on expiresAt
    useEffect(() => {
        if (!alert.expiresAt) return;
        const remaining = new Date(alert.expiresAt).getTime() - Date.now();
        if (remaining <= 0) {
            onDismiss(alert.id);
            return;
        }
        timerRef.current = setTimeout(() => onDismiss(alert.id), remaining);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [alert.expiresAt, alert.id, onDismiss]);

    const priorityConfig = useMemo(() => {
        const configs: Record<FlashPriority, {
            bg: string;
            border: string;
            glow: string;
            icon: React.ReactNode;
            pulse: boolean;
        }> = {
            critical: {
                bg: "bg-red-950/95 backdrop-blur-sm",
                border: "border-red-500",
                glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)]",
                icon: <AlertTriangle size={20} className="text-red-400 animate-pulse" />,
                pulse: true,
            },
            urgent: {
                bg: "bg-amber-950/95 backdrop-blur-sm",
                border: "border-amber-500",
                glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
                icon: <Zap size={20} className="text-amber-400" />,
                pulse: false,
            },
            breaking: {
                bg: "bg-yellow-950/90 backdrop-blur-sm",
                border: "border-yellow-500/70",
                glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
                icon: <Radio size={20} className="text-yellow-400" />,
                pulse: false,
            },
        };
        return configs[alert.priority];
    }, [alert.priority]);

    const timeAgo = useMemo(() => {
        const diff = Date.now() - new Date(alert.createdAt).getTime();
        if (diff < 60_000) return "just now";
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        return `${Math.floor(diff / 3_600_000)}h ago`;
    }, [alert.createdAt]);

    return (
        <div
            className={`
                relative w-full border-b-2 px-4 py-3
                ${priorityConfig.bg} ${priorityConfig.border} ${priorityConfig.glow}
                ${priorityConfig.pulse ? "animate-flash-pulse" : ""}
                transition-all duration-300 ease-out
            `}
            role="alert"
            aria-live="assertive"
        >
            {/* Scanning line effect for critical alerts */}
            {alert.priority === "critical" && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-400 to-transparent animate-scan-line" />
                </div>
            )}

            <div className="max-w-[1400px] mx-auto flex items-start gap-3">
                {/* Priority Icon */}
                <div className="flex-shrink-0 mt-0.5">
                    {priorityConfig.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`
                            text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded
                            ${alert.priority === "critical" ? "bg-red-600 text-white" : ""}
                            ${alert.priority === "urgent" ? "bg-amber-600 text-white" : ""}
                            ${alert.priority === "breaking" ? "bg-yellow-600 text-black" : ""}
                        `}>
                            {getFlashLabel(alert.priority)}
                        </span>

                        <span className="flex items-center gap-1 text-[10px] text-white/50">
                            <PlatformIcon platform={alert.platform} size={12} />
                            {alert.platform === "whitehouse" ? "White House" :
                                alert.platform === "truth_social" ? "Truth Social" : "X"}
                        </span>

                        <span className="text-[10px] text-white/40">{timeAgo}</span>

                        {alert.sectors.length > 0 && (
                            <div className="flex gap-1 ml-2">
                                {alert.sectors.slice(0, 3).map((s) => (
                                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase tracking-wider">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Headline */}
                    <p className={`
                        text-sm font-semibold leading-tight
                        ${alert.priority === "critical" ? "text-red-100" : ""}
                        ${alert.priority === "urgent" ? "text-amber-100" : ""}
                        ${alert.priority === "breaking" ? "text-yellow-100" : ""}
                    `}>
                        {alert.headline}
                    </p>

                    {/* Trigger reason */}
                    <p className="text-[10px] text-white/40 mt-1">
                        Trigger: {alert.triggerReason}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {alert.sourcePost.url && (
                        <a
                            href={alert.sourcePost.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            title="Open source"
                        >
                            <ExternalLink size={14} />
                        </a>
                    )}
                    <button
                        onClick={() => onDismiss(alert.id)}
                        className="p-1.5 rounded hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// Flash Banner Container
// ============================================

export function FlashBanner() {
    const visibleAlerts = useVisibleFlashAlerts();
    const enabled = useFlashStore((s) => s.enabled);
    const audioEnabled = useFlashStore((s) => s.audioEnabled);
    const totalAlerts = useFlashStore((s) => s.alerts.length);
    const { dismissAlert, dismissAll, clearExpired, toggleAudio } = useFlashActions();

    // Periodically clear expired alerts
    useEffect(() => {
        const interval = setInterval(clearExpired, 5_000);
        return () => clearInterval(interval);
    }, [clearExpired]);

    const handleDismiss = useCallback((id: string) => {
        dismissAlert(id);
    }, [dismissAlert]);

    if (!enabled || visibleAlerts.length === 0) return null;

    const hiddenCount = totalAlerts - visibleAlerts.length;

    return (
        <div
            className="fixed top-[52px] left-0 right-0 z-[60] flex flex-col"
            style={{ pointerEvents: "auto" }}
        >
            {visibleAlerts.map((alert) => (
                <FlashAlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
            ))}

            {/* Footer bar when multiple alerts or hidden count */}
            {(totalAlerts > 1 || hiddenCount > 0) && (
                <div className="flex items-center justify-between px-4 py-1.5 bg-black/80 border-b border-white/10 text-[10px] text-white/50">
                    <span>
                        {totalAlerts} active FLASH alert{totalAlerts !== 1 ? "s" : ""}
                        {hiddenCount > 0 && ` (${hiddenCount} more)`}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleAudio}
                            className="flex items-center gap-1 hover:text-white/80 transition-colors"
                        >
                            {audioEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                            {audioEnabled ? "Sound On" : "Sound Off"}
                        </button>
                        <button
                            onClick={dismissAll}
                            className="hover:text-white/80 transition-colors"
                        >
                            Dismiss All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
