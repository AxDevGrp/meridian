"use client";

import { X, Plane, Ship, AlertTriangle, Satellite, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityType } from "@/lib/stores/ui-store";

interface EntityHeaderProps {
    /** Type of entity being displayed */
    entityType: EntityType;
    /** Primary identifier (callsign, name, etc.) */
    identifier: string;
    /** Secondary identifier (ICAO24, MMSI, etc.) */
    secondaryId?: string;
    /** Callback when close button is clicked */
    onClose: () => void;
}

const entityConfig: Record<EntityType, {
    label: string;
    icon: typeof Plane;
    badgeVariant: "default";
    badgeClassName: string;
}> = {
    aircraft: {
        label: "AIRCRAFT",
        icon: Plane,
        badgeVariant: "default",
        badgeClassName: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    vessel: {
        label: "VESSEL",
        icon: Ship,
        badgeVariant: "default",
        badgeClassName: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    satellite: {
        label: "SATELLITE",
        icon: Satellite,
        badgeVariant: "default",
        badgeClassName: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    conflict: {
        label: "CONFLICT",
        icon: AlertTriangle,
        badgeVariant: "default",
        badgeClassName: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    "gps-jamming": {
        label: "GPS JAMMING",
        icon: Radio,
        badgeVariant: "default",
        badgeClassName: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
};

export function EntityHeader({
    entityType,
    identifier,
    secondaryId,
    onClose,
}: EntityHeaderProps) {
    const config = entityConfig[entityType];
    const Icon = config.icon;

    return (
        <div className="flex items-start justify-between gap-4 p-4 border-b border-white/10">
            <div className="flex items-start gap-3 min-w-0">
                {/* Entity type badge */}
                <Badge
                    variant={config.badgeVariant}
                    className={`shrink-0 mt-0.5 ${config.badgeClassName}`}
                >
                    <Icon className="w-3 h-3 mr-1" />
                    {config.label}
                </Badge>

                {/* Primary and secondary identifiers */}
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-white truncate">
                        {identifier}
                    </h2>
                    {secondaryId && (
                        <p className="text-xs text-white/50 font-mono truncate">
                            {secondaryId}
                        </p>
                    )}
                </div>
            </div>

            {/* Close button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Close panel"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
