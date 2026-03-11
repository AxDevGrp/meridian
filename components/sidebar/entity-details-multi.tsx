"use client";

import {
    Compass,
    Gauge,
    MapPin,
    Flag,
    Clock,
    Ship,
    Satellite,
    AlertTriangle,
    Radio,
    Skull,
    Globe2,
    ArrowRight,
    Shield,
    BarChart3,
    Activity,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Vessel } from "@/lib/types/vessel";
import type { Satellite as SatelliteType } from "@/lib/types/satellite";
import type { ConflictEvent } from "@/lib/types/conflict";
import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import { getVesselTypeLabel, getNavigationStatusLabel } from "@/lib/types/vessel";
import { getOrbitTypeLabel } from "@/lib/types/satellite";
import { getConflictTypeLabel, getConflictSeverity } from "@/lib/types/conflict";
import { getInterferenceTypeLabel } from "@/lib/types/gps-jamming";

/**
 * Detail row component for consistent layout
 */
function DetailRow({
    icon: Icon,
    label,
    value,
    subValue,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    subValue?: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 shrink-0">
                <Icon className="w-4 h-4 text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                <p className="text-sm text-white font-medium truncate">{value}</p>
                {subValue && <p className="text-xs text-white/40">{subValue}</p>}
            </div>
        </div>
    );
}

/**
 * Section header for grouping details
 */
function SectionHeader({ title }: { title: string }) {
    return (
        <>
            <Separator className="bg-white/10 my-3" />
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-3">
                {title}
            </div>
        </>
    );
}

// ============================================
// Vessel Details
// ============================================

export function VesselDetails({ vessel }: { vessel: Vessel }) {
    return (
        <div className="p-4 space-y-3">
            {/* Identification */}
            <DetailRow icon={Ship} label="Vessel Type" value={getVesselTypeLabel(vessel.vesselType)} />
            {vessel.imo && <DetailRow icon={Globe2} label="IMO" value={vessel.imo} />}
            {vessel.callsign && <DetailRow icon={Radio} label="Callsign" value={vessel.callsign} />}
            {vessel.flag && <DetailRow icon={Flag} label="Flag State" value={vessel.flag} />}

            <SectionHeader title="Navigation" />

            <DetailRow
                icon={MapPin}
                label="Position"
                value={`${vessel.latitude.toFixed(4)}°, ${vessel.longitude.toFixed(4)}°`}
            />
            <DetailRow
                icon={Activity}
                label="Status"
                value={getNavigationStatusLabel(vessel.navigationStatus)}
            />
            {vessel.speed !== null && (
                <DetailRow
                    icon={Gauge}
                    label="Speed"
                    value={`${vessel.speed.toFixed(1)} knots`}
                />
            )}
            {vessel.course !== null && (
                <DetailRow
                    icon={Compass}
                    label="Course"
                    value={`${vessel.course.toFixed(0)}°`}
                />
            )}
            {vessel.destination && (
                <DetailRow icon={ArrowRight} label="Destination" value={vessel.destination} />
            )}

            {vessel.length && (
                <>
                    <SectionHeader title="Dimensions" />
                    <DetailRow
                        icon={Ship}
                        label="Size"
                        value={`${vessel.length}m × ${vessel.width}m`}
                        subValue={vessel.draught ? `Draught: ${vessel.draught}m` : undefined}
                    />
                </>
            )}

            <SectionHeader title="Metadata" />
            <DetailRow
                icon={Clock}
                label="Last Update"
                value={new Date(vessel.lastUpdate * 1000).toLocaleTimeString()}
            />
        </div>
    );
}

// ============================================
// Satellite Details
// ============================================

export function SatelliteDetails({ satellite }: { satellite: SatelliteType }) {
    return (
        <div className="p-4 space-y-3">
            {/* Identification */}
            <DetailRow icon={Satellite} label="NORAD ID" value={satellite.noradId} />
            {satellite.intlDesignator && (
                <DetailRow icon={Globe2} label="International Designator" value={satellite.intlDesignator} />
            )}
            <DetailRow icon={Shield} label="Orbit Type" value={getOrbitTypeLabel(satellite.orbitType)} />

            <SectionHeader title="Position" />

            <DetailRow
                icon={MapPin}
                label="Ground Track"
                value={`${satellite.position.latitude.toFixed(2)}°, ${satellite.position.longitude.toFixed(2)}°`}
            />
            <DetailRow
                icon={BarChart3}
                label="Altitude"
                value={`${satellite.position.altitude.toFixed(0)} km`}
            />
            <DetailRow
                icon={Gauge}
                label="Velocity"
                value={`${satellite.position.velocity.toFixed(1)} km/s`}
            />

            <SectionHeader title="Orbital Elements" />

            <DetailRow
                icon={Compass}
                label="Inclination"
                value={`${satellite.orbitalElements.inclination.toFixed(2)}°`}
            />
            <DetailRow
                icon={Activity}
                label="Period"
                value={`${(1440 / satellite.orbitalElements.meanMotion).toFixed(1)} min`}
                subValue={`${satellite.orbitalElements.meanMotion.toFixed(4)} rev/day`}
            />
            <DetailRow
                icon={Globe2}
                label="Eccentricity"
                value={satellite.orbitalElements.eccentricity.toFixed(6)}
            />

            <SectionHeader title="Metadata" />
            <DetailRow
                icon={Clock}
                label="TLE Epoch"
                value={new Date(satellite.orbitalElements.epoch).toLocaleString()}
            />
        </div>
    );
}

// ============================================
// Conflict Event Details
// ============================================

export function ConflictDetails({ event }: { event: ConflictEvent }) {
    const severity = getConflictSeverity(event);
    const severityColors: Record<string, string> = {
        critical: "bg-red-500/20 text-red-400 border-red-500/30",
        high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        info: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };

    return (
        <div className="p-4 space-y-3">
            {/* Event Info */}
            <div className="flex items-center gap-2 mb-2">
                <Badge className={severityColors[severity]}>
                    {severity.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/60">
                    {getConflictTypeLabel(event.eventType)}
                </Badge>
            </div>

            <DetailRow icon={AlertTriangle} label="Event Type" value={getConflictTypeLabel(event.eventType)} />
            <DetailRow icon={Clock} label="Date" value={event.eventDate} />

            <SectionHeader title="Location" />

            <DetailRow icon={Flag} label="Country" value={event.country} />
            <DetailRow icon={MapPin} label="Location" value={event.location} />
            <DetailRow
                icon={Globe2}
                label="Coordinates"
                value={`${event.latitude.toFixed(4)}°, ${event.longitude.toFixed(4)}°`}
                subValue={`Precision: Level ${event.geoPrecision}`}
            />
            {event.admin1 && <DetailRow icon={MapPin} label="Region" value={event.admin1} />}

            <SectionHeader title="Actors" />

            <DetailRow icon={Shield} label="Actor 1" value={event.actor1} />
            {event.actor2 && <DetailRow icon={Shield} label="Actor 2" value={event.actor2} />}

            <SectionHeader title="Impact" />

            <DetailRow
                icon={Skull}
                label="Fatalities"
                value={`${event.fatalities.reported}`}
                subValue={event.fatalities.isEstimate ? "Estimated" : "Reported"}
            />

            {event.notes && (
                <>
                    <SectionHeader title="Notes" />
                    <p className="text-xs text-white/60 leading-relaxed">{event.notes}</p>
                </>
            )}

            <SectionHeader title="Source" />
            <DetailRow icon={BarChart3} label="Source" value={event.source} />
        </div>
    );
}

// ============================================
// GPS Jamming Zone Details
// ============================================

export function GPSJammingDetails({ zone }: { zone: GPSJammingZone }) {
    const severityColors: Record<string, string> = {
        critical: "bg-red-500/20 text-red-400 border-red-500/30",
        high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        info: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };

    return (
        <div className="p-4 space-y-3">
            {/* Severity + Type badges */}
            <div className="flex items-center gap-2 mb-2">
                <Badge className={severityColors[zone.severity]}>
                    {zone.severity.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/60">
                    {getInterferenceTypeLabel(zone.interferenceType)}
                </Badge>
                {zone.isActive && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        ACTIVE
                    </Badge>
                )}
            </div>

            <DetailRow icon={Radio} label="Interference Type" value={getInterferenceTypeLabel(zone.interferenceType)} />
            <DetailRow icon={Globe2} label="Region" value={zone.region} />

            <SectionHeader title="Location" />

            <DetailRow
                icon={MapPin}
                label="Center"
                value={`${zone.latitude.toFixed(2)}°, ${zone.longitude.toFixed(2)}°`}
            />
            <DetailRow
                icon={Activity}
                label="Affected Radius"
                value={`${zone.radiusKm} km`}
            />
            {zone.country && <DetailRow icon={Flag} label="Country" value={zone.country} />}

            <SectionHeader title="Activity" />

            <DetailRow
                icon={BarChart3}
                label="Confidence"
                value={`${(zone.confidence * 100).toFixed(0)}%`}
            />
            <DetailRow
                icon={Gauge}
                label="ADS-B Reports"
                value={`${zone.reportCount.toLocaleString()}`}
            />
            <DetailRow
                icon={Shield}
                label="Affected Aircraft"
                value={`${zone.affectedAircraftCount.toLocaleString()}`}
            />

            <SectionHeader title="Timeline" />

            <DetailRow
                icon={Clock}
                label="First Detected"
                value={new Date(zone.firstDetected).toLocaleDateString()}
            />
            <DetailRow
                icon={Clock}
                label="Last Detected"
                value={new Date(zone.lastDetected).toLocaleString()}
            />

            {zone.description && (
                <>
                    <SectionHeader title="Description" />
                    <p className="text-xs text-white/60 leading-relaxed">{zone.description}</p>
                </>
            )}
        </div>
    );
}
