"use client";

import { useEffect, useCallback } from "react";
import * as Cesium from "cesium";
import { EntityHeader } from "./entity-header";
import { EntityDetails } from "./entity-details";
import { EntityActions } from "./entity-actions";
import { useUIStore, useSidebarActions } from "@/lib/stores/ui-store";
import { useAircraftByIcao } from "@/lib/stores/aircraft-store";
import { useGlobeStore } from "@/lib/stores/globe-store";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Sidebar panel for inspecting selected entities
 * Features a glassmorphic design with smooth slide-in/out animations
 */
export function Sidebar() {
    const { selectedEntityType, selectedEntityId, sidebarOpen } = useUIStore();
    const { deselectEntity } = useSidebarActions();
    const aircraft = useAircraftByIcao(selectedEntityId);
    const { viewer } = useGlobeStore();

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

    // Focus camera on selected aircraft
    const handleFocusOnMap = useCallback(() => {
        if (!aircraft || !viewer || !aircraft.latitude || !aircraft.longitude) {
            return;
        }

        const altitude = aircraft.baroAltitude ?? 10000; // Default to 10km if no altitude
        const height = altitude * 3.28084 + 5000; // Convert to feet and add offset

        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                aircraft.longitude,
                aircraft.latitude,
                height
            ),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0,
            },
            duration: 2,
        });
    }, [aircraft, viewer]);

    // Don't render if no entity is selected or type doesn't match
    if (!sidebarOpen || !selectedEntityId || selectedEntityType !== "aircraft") {
        return null;
    }

    // Don't render if aircraft data is not available
    if (!aircraft) {
        return null;
    }

    const identifier = aircraft.callsign?.trim() || aircraft.icao24.toUpperCase();

    return (
        <>
            {/* Backdrop for mobile - closes sidebar on tap */}
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
                {/* Header with entity type badge and close button */}
                <EntityHeader
                    entityType={selectedEntityType}
                    identifier={identifier}
                    secondaryId={aircraft.icao24.toUpperCase()}
                    onClose={deselectEntity}
                />

                {/* Scrollable content area */}
                <ScrollArea className="flex-1">
                    <EntityDetails aircraft={aircraft} />
                </ScrollArea>

                {/* Action buttons and related entities */}
                <EntityActions onFocus={handleFocusOnMap} />
            </aside>
        </>
    );
}