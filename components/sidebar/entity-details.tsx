"use client";

import {
    Compass,
    Gauge,
    ArrowUp,
    ArrowDown,
    Minus,
    MapPin,
    Flag,
    Clock,
    Plane,
    Mountain,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Aircraft } from "@/lib/types/aircraft";

interface EntityDetailsProps {
    /** Aircraft data to display */
    aircraft: Aircraft;
}

/**
 * Format altitude from meters to feet
 */
function formatAltitude(altitudeMeters: number | null): string {
    if (altitudeMeters === null) return "N/A";
    const feet = Math.round(altitudeMeters * 3.28084);
    return `${feet.toLocaleString()} ft`;
}

/**
 * Format velocity from m/s to knots
 */
function formatVelocity(velocityMs: number | null): string {
    if (velocityMs === null) return "N/A";
    const knots = Math.round(velocityMs * 1.94384);
    return `${knots.toLocaleString()} kts`;
}

/**
 * Format heading with compass direction
 */
function formatHeading(heading: number | null): string {
    if (heading === null) return "N/A";
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return `${Math.round(heading)}° ${directions[index]}`;
}

/**
 * Format vertical rate with climb/descent indicator
 */
function formatVerticalRate(verticalRate: number | null): {
    text: string;
    icon: React.ReactNode;
    color: string;
} {
    if (verticalRate === null) {
        return { text: "N/A", icon: <Minus className="w-3 h-3" />, color: "text-white/50" };
    }
    const fpm = Math.round(verticalRate * 196.85); // Convert m/s to ft/min
    if (Math.abs(verticalRate) < 0.5) {
        return { text: "Level", icon: <Minus className="w-3 h-3" />, color: "text-white/70" };
    }
    if (verticalRate > 0) {
        return {
            text: `+${fpm.toLocaleString()} ft/min`,
            icon: <ArrowUp className="w-3 h-3" />,
            color: "text-green-400",
        };
    }
    return {
        text: `${fpm.toLocaleString()} ft/min`,
        icon: <ArrowDown className="w-3 h-3" />,
        color: "text-orange-400",
    };
}

/**
 * Format last contact time
 */
function formatLastContact(timestamp: number | null): string {
    if (timestamp === null) return "N/A";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
}

interface DetailRowProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    className?: string;
}

function DetailRow({ icon, label, value, className = "" }: DetailRowProps) {
    return (
        <div className={`flex items-center gap-3 py-2 ${className}`}>
            <div className="w-5 h-5 flex items-center justify-center text-white/50">
                {icon}
            </div>
            <span className="text-sm text-white/60 min-w-[80px]">{label}</span>
            <div className="flex-1 text-sm text-white font-medium">{value}</div>
        </div>
    );
}

export function EntityDetails({ aircraft }: EntityDetailsProps) {
    const verticalRateInfo = formatVerticalRate(aircraft.verticalRate);

    return (
        <div className="flex-1 overflow-auto">
            <div className="p-4 space-y-1">
                {/* Identification Section */}
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Identification
                </div>

                <DetailRow
                    icon={<Plane className="w-4 h-4" />}
                    label="ICAO24"
                    value={
                        <span className="font-mono">{aircraft.icao24.toUpperCase()}</span>
                    }
                />

                <DetailRow
                    icon={<Flag className="w-4 h-4" />}
                    label="Country"
                    value={aircraft.originCountry}
                />

                {aircraft.squawk && (
                    <DetailRow
                        icon={<Mountain className="w-4 h-4" />}
                        label="Squawk"
                        value={<span className="font-mono">{aircraft.squawk}</span>}
                    />
                )}

                <Separator className="bg-white/10 my-3" />

                {/* Flight Status Section */}
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Flight Status
                </div>

                <DetailRow
                    icon={<MapPin className="w-4 h-4" />}
                    label="Status"
                    value={
                        <span
                            className={
                                aircraft.onGround ? "text-orange-400" : "text-green-400"
                            }
                        >
                            {aircraft.onGround ? "On Ground" : "Airborne"}
                        </span>
                    }
                />

                <DetailRow
                    icon={<Mountain className="w-4 h-4" />}
                    label="Altitude"
                    value={formatAltitude(aircraft.baroAltitude)}
                />

                <DetailRow
                    icon={<Gauge className="w-4 h-4" />}
                    label="Speed"
                    value={formatVelocity(aircraft.velocity)}
                />

                <DetailRow
                    icon={<Compass className="w-4 h-4" />}
                    label="Heading"
                    value={formatHeading(aircraft.heading)}
                />

                <DetailRow
                    icon={verticalRateInfo.icon}
                    label="V/S"
                    value={
                        <span className={verticalRateInfo.color}>
                            {verticalRateInfo.text}
                        </span>
                    }
                />

                <Separator className="bg-white/10 my-3" />

                {/* Data Quality Section */}
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Data Quality
                </div>

                <DetailRow
                    icon={<Clock className="w-4 h-4" />}
                    label="Last Seen"
                    value={formatLastContact(aircraft.lastContact)}
                />

                {/* Position source indicator */}
                <div className="flex items-center gap-3 py-2">
                    <div className="w-5 h-5 flex items-center justify-center text-white/50">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white/60 min-w-[80px]">Source</span>
                    <div className="flex-1 text-sm">
                        <span className="text-white/70">
                            {aircraft.positionSource === 0
                                ? "ADS-B"
                                : aircraft.positionSource === 1
                                    ? "ASTERIX"
                                    : aircraft.positionSource === 2
                                        ? "MLAT"
                                        : "Other"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}