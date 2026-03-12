"use client";

import { useEffect, useRef, useState } from "react";
import {
    X,
    Siren,
    AlertTriangle,
    Bell,
    BellDot,
    Info,
} from "lucide-react";
import { useAlertStore } from "@/lib/stores/alert-store";
import { formatAlertTime } from "@/lib/types/alert";
import type { AlertNotification, AlertSeverity } from "@/lib/types/alert";
import { cn } from "@/lib/utils";

/** Auto-dismiss after 8 seconds for non-critical alerts */
const AUTO_DISMISS_MS = 8_000;

const SEVERITY_ICONS: Record<AlertSeverity, typeof Siren> = {
    critical: Siren,
    high: AlertTriangle,
    medium: Bell,
    low: BellDot,
    info: Info,
};

const SEVERITY_BORDER_COLORS: Record<AlertSeverity, string> = {
    critical: "border-l-red-500",
    high: "border-l-orange-500",
    medium: "border-l-amber-500",
    low: "border-l-blue-500",
    info: "border-l-zinc-500",
};

const SEVERITY_ICON_COLORS: Record<AlertSeverity, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-amber-400",
    low: "text-blue-400",
    info: "text-zinc-400",
};

interface AlertToastProps {
    notification: AlertNotification;
}

/**
 * Single toast notification with severity color, icon, auto-dismiss,
 * and animated slide-in entry.
 */
export function AlertToast({ notification }: AlertToastProps) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const dismissToast = useAlertStore((s) => s.dismissToast);
    const setAlertPanelOpen = useAlertStore((s) => s.setAlertPanelOpen);
    const setAlertHistoryOpen = useAlertStore((s) => s.setAlertHistoryOpen);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Slide in on mount
    useEffect(() => {
        const frame = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Auto-dismiss for non-critical
    useEffect(() => {
        if (notification.severity === "critical") return;

        timerRef.current = setTimeout(() => {
            handleDismiss();
        }, AUTO_DISMISS_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [notification.severity, notification.id]);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => {
            dismissToast(notification.id);
        }, 200);
    };

    const handleClick = () => {
        setAlertPanelOpen(true);
        setAlertHistoryOpen(true);
    };

    const Icon = SEVERITY_ICONS[notification.severity];

    return (
        <div
            className={cn(
                "pointer-events-auto w-80 cursor-pointer rounded-md border border-white/10 border-l-4 bg-black/95 p-3 shadow-xl backdrop-blur-sm transition-all duration-200",
                SEVERITY_BORDER_COLORS[notification.severity],
                visible && !exiting
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0",
            )}
            onClick={handleClick}
        >
            {/* Header */}
            <div className="mb-1 flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <Icon
                        size={13}
                        className={SEVERITY_ICON_COLORS[notification.severity]}
                    />
                    <span
                        className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            SEVERITY_ICON_COLORS[notification.severity],
                        )}
                    >
                        {notification.severity}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss();
                    }}
                    className="shrink-0 text-zinc-600 transition-colors hover:text-white"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Title */}
            <p className="mb-0.5 text-xs font-medium text-white leading-tight line-clamp-1">
                {notification.title}
            </p>

            {/* Message */}
            <p className="mb-1.5 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {notification.message}
            </p>

            {/* Timestamp */}
            <p className="text-[10px] text-zinc-600">
                {formatAlertTime(notification.triggeredAt)}
            </p>
        </div>
    );
}
