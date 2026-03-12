"use client";

import { useEffect, useCallback, useMemo } from "react";
import * as Cesium from "cesium";
import { FileText } from "lucide-react";
import { EntityHeader } from "./entity-header";
import { EntityDetails } from "./entity-details";
import { EntityActions } from "./entity-actions";
import {
    VesselDetails,
    SatelliteDetails,
    ConflictDetails,
    GPSJammingDetails,
} from "./entity-details-multi";
import { SocialPostDetails } from "./social-post-details";
import { RelatedInstruments } from "./related-instruments";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAircraftByIcao } from "@/lib/stores/aircraft-store";
import {
    useVesselByMmsi,
    useSatelliteByNoradId,
    useConflictById,
    useGPSJammingZoneById,
    useSocialPostById,
} from "@/lib/stores/data-store";
import { useGlobeStore } from "@/lib/stores/globe-store";
import { useIntelStore } from "@/lib/stores/intel-store";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Sidebar panel for inspecting selected entities of any type
 * Supports: aircraft, vessels, satellites, conflicts, GPS jamming zones
 */
export function Sidebar() {
    const selectedEntityType = useUIStore((state) => state.selectedEntityType);
    const selectedEntityId = useUIStore((state) => state.selectedEntityId);
    const sidebarOpen = useUIStore((state) => state.sidebarOpen);
    const deselectEntity = useUIStore((state) => state.deselectEntity);
    const viewer = useGlobeStore((state) => state.viewer);

    // Fetch entity data based on type
    const aircraft = useAircraftByIcao(
        selectedEntityType === "aircraft" ? selectedEntityId : null
    );
    const vessel = useVesselByMmsi(
        selectedEntityType === "vessel" ? selectedEntityId : null
    );
    const satellite = useSatelliteByNoradId(
        selectedEntityType === "satellite" ? selectedEntityId : null
    );
    const conflict = useConflictById(
        selectedEntityType === "conflict" ? selectedEntityId : null
    );
    const gpsJammingZone = useGPSJammingZoneById(
        selectedEntityType === "gps-jamming" ? selectedEntityId : null
    );
    const socialPost = useSocialPostById(
        selectedEntityType === "social" ? selectedEntityId : null
    );

    // Handle keyboard close (Escape key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && sidebarOpen) {
                deselectEntity();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sidebarOpen, deselectEntity]);

    // Get entity position for camera focus
    const getEntityPosition = useCallback(() => {
        if (selectedEntityType === "aircraft" && aircraft) {
            return aircraft.latitude && aircraft.longitude
                ? { lng: aircraft.longitude, lat: aircraft.latitude, alt: aircraft.baroAltitude ?? 10000 }
                : null;
        }
        if (selectedEntityType === "vessel" && vessel) {
            return { lng: vessel.longitude, lat: vessel.latitude, alt: 500 };
        }
        if (selectedEntityType === "satellite" && satellite) {
            return {
                lng: satellite.position.longitude,
                lat: satellite.position.latitude,
                alt: satellite.position.altitude * 1000,
            };
        }
        if (selectedEntityType === "conflict" && conflict) {
            return { lng: conflict.longitude, lat: conflict.latitude, alt: 50000 };
        }
        if (selectedEntityType === "gps-jamming" && gpsJammingZone) {
            return {
                lng: gpsJammingZone.longitude,
                lat: gpsJammingZone.latitude,
                alt: gpsJammingZone.radiusKm * 3000,
            };
        }
        // Social posts don't have coordinates yet (pending geocoding)
        if (selectedEntityType === "social") {
            return null;
        }
        return null;
    }, [selectedEntityType, aircraft, vessel, satellite, conflict, gpsJammingZone, socialPost]);

    // Focus camera on selected entity
    const handleFocusOnMap = useCallback(() => {
        if (!viewer) return;
        const pos = getEntityPosition();
        if (!pos) return;

        const height = pos.alt * 3.28084 + 5000;

        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, height),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0,
            },
            duration: 2,
        });
    }, [viewer, getEntityPosition]);

    // Compute entity location + region for market correlation
    const entityMarketInfo = useMemo(() => {
        if (selectedEntityType === "conflict" && conflict) {
            return {
                entityType: "conflict",
                entitySeverity: "high", // conflicts default to high
                entityLocation: { lat: conflict.latitude, lng: conflict.longitude },
                regionName: conflict.country,
            };
        }
        if (selectedEntityType === "gps-jamming" && gpsJammingZone) {
            return {
                entityType: "gps-jamming",
                entitySeverity: gpsJammingZone.severity ?? "medium",
                entityLocation: { lat: gpsJammingZone.latitude, lng: gpsJammingZone.longitude },
                regionName: gpsJammingZone.region,
            };
        }
        if (selectedEntityType === "vessel" && vessel) {
            return {
                entityType: "vessel",
                entitySeverity: "medium",
                entityLocation: { lat: vessel.latitude, lng: vessel.longitude },
                regionName: undefined,
            };
        }
        return null;
    }, [selectedEntityType, conflict, gpsJammingZone, vessel]);

    // Determine if we have entity data
    const hasEntity =
        (selectedEntityType === "aircraft" && aircraft) ||
        (selectedEntityType === "vessel" && vessel) ||
        (selectedEntityType === "satellite" && satellite) ||
        (selectedEntityType === "conflict" && conflict) ||
        (selectedEntityType === "gps-jamming" && gpsJammingZone) ||
        (selectedEntityType === "social" && socialPost);

    // Don't render if no entity is selected
    if (!sidebarOpen || !selectedEntityId || !selectedEntityType || !hasEntity) {
        return null;
    }

    // Get display identifiers based on entity type
    const getIdentifier = (): { primary: string; secondary?: string } => {
        switch (selectedEntityType) {
            case "aircraft":
                return {
                    primary: aircraft?.callsign?.trim() || aircraft?.icao24?.toUpperCase() || "Unknown",
                    secondary: aircraft?.icao24?.toUpperCase(),
                };
            case "vessel":
                return {
                    primary: vessel?.name || "Unknown Vessel",
                    secondary: `MMSI: ${vessel?.mmsi}`,
                };
            case "satellite":
                return {
                    primary: satellite?.name || "Unknown Satellite",
                    secondary: `NORAD: ${satellite?.noradId}`,
                };
            case "conflict":
                return {
                    primary: conflict?.location || "Unknown Location",
                    secondary: conflict?.country,
                };
            case "gps-jamming":
                return {
                    primary: gpsJammingZone?.name || "Unknown Zone",
                    secondary: gpsJammingZone?.region,
                };
            case "social":
                return {
                    primary: socialPost?.author || "Unknown Author",
                    secondary: socialPost?.platform ? socialPost.platform.toUpperCase() : undefined,
                };
            default:
                return { primary: "Unknown" };
        }
    };

    const { primary, secondary } = getIdentifier();

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
                onClick={deselectEntity}
                aria-hidden="true"
            />

            {/* Sidebar panel */}
            <aside
                className={`
                    fixed right-0 top-0 bottom-0 z-50
                    w-full sm:w-96
                    bg-black/80 backdrop-blur-xl
                    border-l border-white/10
                    shadow-2xl shadow-black/50
                    transform transition-transform duration-300 ease-out
                    flex flex-col
                    ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
                `}
                aria-label="Entity inspection panel"
            >
                {/* Header */}
                <EntityHeader
                    entityType={selectedEntityType}
                    identifier={primary}
                    secondaryId={secondary}
                    onClose={deselectEntity}
                />

                {/* Scrollable content area */}
                <ScrollArea className="flex-1">
                    {selectedEntityType === "aircraft" && aircraft && (
                        <EntityDetails aircraft={aircraft} />
                    )}
                    {selectedEntityType === "vessel" && vessel && (
                        <VesselDetails vessel={vessel} />
                    )}
                    {selectedEntityType === "satellite" && satellite && (
                        <SatelliteDetails satellite={satellite} />
                    )}
                    {selectedEntityType === "conflict" && conflict && (
                        <ConflictDetails event={conflict} />
                    )}
                    {selectedEntityType === "gps-jamming" && gpsJammingZone && (
                        <GPSJammingDetails zone={gpsJammingZone} />
                    )}
                    {selectedEntityType === "social" && socialPost && (
                        <SocialPostDetails post={socialPost} />
                    )}

                    {/* Market correlation section for geo-entities */}
                    {entityMarketInfo && (
                        <RelatedInstruments
                            entityType={entityMarketInfo.entityType}
                            entitySeverity={entityMarketInfo.entitySeverity}
                            entityLocation={entityMarketInfo.entityLocation}
                            regionName={entityMarketInfo.regionName}
                        />
                    )}

                    {/* Generate Region Report — shown for conflicts and GPS jamming zones */}
                    {(selectedEntityType === "conflict" || selectedEntityType === "gps-jamming") && (
                        <div className="px-4 py-3 border-t border-white/5">
                            <button
                                onClick={() => useIntelStore.getState().setReportPanelOpen(true)}
                                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-primary/80 hover:text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Generate Region Report
                            </button>
                        </div>
                    )}
                </ScrollArea>

                {/* Action buttons */}
                <EntityActions onFocus={handleFocusOnMap} />
            </aside>
        </>
    );
}
