"use client";

import { useEffect } from "react";
import {
    CheckCircle2,
    CheckCheck,
    Clock,
    AlertCircle,
    Bell,
} from "lucide-react";
import { useAlertNotifications, useAlertStore } from "@/lib/stores/alert-store";
import { getAlertSeverityColor, formatAlertTime } from "@/lib/types/alert";
import type { AlertNotification } from "@/lib/types/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Panel showing past alert notifications in chronological order.
 * Each item shows severity, title, message, timestamp, and acknowledge button.
 */
export function AlertHistoryPanel() {
    const { notifications, loading } = useAlertNotifications();
    const fetchNotifications = useAlertStore((s) => s.fetchNotifications);
    const acknowledgeNotification = useAlertStore((s) => s.acknowledgeNotification);
    const acknowledgeAll = useAlertStore((s) => s.acknowledgeAll);

    useEffect(() => {
        fetchNotifications(100);
    }, [fetchNotifications]);

    const unacknowledgedCount = notifications.filter((n) => !n.acknowledged).length;

    if (loading && notifications.length === 0) {
        return (
            <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full bg-white/5" />
                ))}
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Bell className="h-10 w-10 text-zinc-600" />
                <p className="text-sm text-zinc-500">No alert history yet.</p>
                <p className="text-xs text-zinc-600">
                    Enable alert rules to start receiving notifications.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            {/* Acknowledge All header */}
            {unacknowledgedCount > 0 && (
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                    <span className="text-[11px] text-zinc-500">
                        {unacknowledgedCount} unacknowledged
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={acknowledgeAll}
                        className="h-6 gap-1 px-2 text-[11px] text-zinc-400 hover:text-white"
                    >
                        <CheckCheck size={12} />
                        Acknowledge All
                    </Button>
                </div>
            )}

            <ScrollArea className="flex-1">
                <div className="space-y-1.5 p-3">
                    {notifications.map((notification) => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onAcknowledge={() =>
                                acknowledgeNotification(notification.id)
                            }
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

// ──────────────────────────────────────────────

function NotificationItem({
    notification,
    onAcknowledge,
}: {
    notification: AlertNotification;
    onAcknowledge: () => void;
}) {
    return (
        <div
            className={cn(
                "rounded-md border px-3 py-2.5 transition-colors",
                notification.acknowledged
                    ? "border-white/5 bg-white/[0.01] opacity-60"
                    : "border-white/10 bg-white/[0.03]",
            )}
        >
            {/* Header */}
            <div className="mb-1 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={cn(
                            "px-1.5 py-0 text-[9px] font-mono uppercase border",
                            getAlertSeverityColor(notification.severity),
                        )}
                    >
                        {notification.severity}
                    </Badge>
                    <span className="text-xs font-medium text-white line-clamp-1">
                        {notification.title}
                    </span>
                </div>
                {notification.acknowledged ? (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                ) : (
                    <button
                        type="button"
                        onClick={onAcknowledge}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                        title="Acknowledge"
                    >
                        ACK
                    </button>
                )}
            </div>

            {/* Message */}
            <p className="mb-1 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                {notification.message}
            </p>

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock size={9} />
                {formatAlertTime(notification.triggeredAt)}
                {notification.acknowledged && notification.acknowledgedAt && (
                    <span className="ml-2 text-emerald-700">
                        · Acknowledged {formatAlertTime(notification.acknowledgedAt)}
                    </span>
                )}
            </div>
        </div>
    );
}
