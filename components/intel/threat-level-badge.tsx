"use client";

import {
    AlertOctagon,
    AlertTriangle,
    ShieldAlert,
    Shield,
    ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getThreatLevelColor } from "@/lib/types/intel-report";
import type { ThreatLevel } from "@/lib/types/intel-report";
import { cn } from "@/lib/utils";

interface ThreatLevelBadgeProps {
    level: ThreatLevel;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
}

const ICON_MAP: Record<ThreatLevel, typeof AlertOctagon> = {
    critical: AlertOctagon,
    high: AlertTriangle,
    elevated: ShieldAlert,
    guarded: Shield,
    low: ShieldCheck,
};

const SIZE_MAP: Record<string, { badge: string; icon: number; text: string }> = {
    sm: { badge: "px-1.5 py-0.5 text-[10px]", icon: 10, text: "uppercase" },
    md: { badge: "px-2 py-0.5 text-xs", icon: 12, text: "uppercase" },
    lg: { badge: "px-2.5 py-1 text-sm", icon: 14, text: "uppercase font-semibold" },
};

/**
 * Reusable badge displaying a threat level with color and optional icon.
 */
export function ThreatLevelBadge({
    level,
    size = "md",
    showIcon = true,
}: ThreatLevelBadgeProps) {
    const Icon = ICON_MAP[level];
    const colorClasses = getThreatLevelColor(level);
    const sizeConfig = SIZE_MAP[size];

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1 border font-mono",
                colorClasses,
                sizeConfig.badge,
                sizeConfig.text,
            )}
        >
            {showIcon && <Icon size={sizeConfig.icon} />}
            {level}
        </Badge>
    );
}
