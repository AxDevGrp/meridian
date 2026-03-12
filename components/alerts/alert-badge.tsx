"use client";

import { cn } from "@/lib/utils";

interface AlertBadgeProps {
    count: number;
    onClick: () => void;
}

/**
 * Small red circle badge showing unacknowledged alert count.
 * Pulsing animation when count > 0.
 */
export function AlertBadge({ count, onClick }: AlertBadgeProps) {
    if (count === 0) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "relative flex h-5 min-w-5 items-center justify-center rounded-full",
                "bg-red-600 px-1 font-mono text-[10px] font-bold text-white",
                "transition-transform hover:scale-110",
            )}
            aria-label={`${count} unacknowledged alerts`}
        >
            {count > 99 ? "99+" : count}

            {/* Pulsing ring */}
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30" />
        </button>
    );
}
